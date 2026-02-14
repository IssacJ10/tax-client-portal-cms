/**
 * Google OAuth Middleware
 * Handles Google OAuth callback and token exchange
 */

import { AUTH_COOKIE_CONFIG } from '../utils/cookie-config';

export default (config, { strapi }) => {
  return async (ctx, next) => {
    // Intercept the initial Google OAuth redirect to ensure correct scopes are sent
    // Strapi's grant library only sends 'email' scope by default (stored in DB, not configurable via admin UI)
    // We need 'openid email profile' to get given_name and family_name from Google
    if (ctx.method === 'GET' && ctx.path === '/api/connect/google') {
      const strapiUrl = process.env.STRAPI_URL || process.env.PUBLIC_URL || 'http://localhost:1337';
      const clientId = process.env.GOOGLE_CLIENT_ID || '';
      const redirectUri = `${strapiUrl}/api/connect/google/callback`;

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        access_type: 'online',
        prompt: 'select_account',
      });

      strapi.log.info(`[[GOOGLE_MIDDLEWARE]] Redirecting to Google with scopes: openid email profile`);
      ctx.status = 302;
      ctx.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
      return;
    }

    // Check if this is the Google callback URL
    if (ctx.method === 'GET' && ctx.path === '/api/connect/google/callback') {
      strapi.log.info('[[GOOGLE_MIDDLEWARE]] Intercepting Google Callback');

      try {
        const { code } = ctx.query;
        if (!code) throw new Error('No code provided');

        // Validate code format (should be a string)
        if (typeof code !== 'string' || code.length > 2000) {
          throw new Error('Invalid code format');
        }

        // Build redirect_uri dynamically from environment or request
        // IMPORTANT: This MUST match exactly what's configured in Google Cloud Console
        const strapiUrl = process.env.STRAPI_URL || process.env.PUBLIC_URL || 'http://localhost:1337';
        const redirectUri = `${strapiUrl}/api/connect/google/callback`;

        strapi.log.info(`[[GOOGLE_MIDDLEWARE]] Using redirect_uri: ${redirectUri}`);

        // 1. Manually Exchange Code for Access Token
        // This avoids Strapi's internal redirect_uri mismatch issues
        const params = new URLSearchParams();
        params.append('code', code as string);
        params.append('client_id', process.env.GOOGLE_CLIENT_ID || '');
        params.append('client_secret', process.env.GOOGLE_CLIENT_SECRET || '');
        params.append('redirect_uri', redirectUri);
        params.append('grant_type', 'authorization_code');

        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
        });

        if (!tokenRes.ok) {
          const errorText = await tokenRes.text();
          const status = tokenRes.status;
          strapi.log.error(`Google Token Exchange Failed: ${status}`, errorText);
          throw new Error(`Google Token Exchange Failed: ${status} ${errorText}`);
        }

        const tokenData = (await tokenRes.json()) as any;
        const accessToken = tokenData.access_token;

        strapi.log.info('[[GOOGLE_MIDDLEWARE]] Manual Token Exchange Successful');

        // 2. Fetch User Profile from Google directly to ensure we get names
        const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const profile = (await profileRes.json()) as any;

        // 3. Delegate to Strapi Providers Service
        const providersService = strapi.plugin('users-permissions').service('providers');
        let user = await providersService.connect('google', { access_token: accessToken });

        if (!user) {
          throw new Error('User not found after mapping google profile');
        }

        // 4. Force Update User Profile (FirstName/LastName) with sanitization
        // Strapi's default provider might not map these fields automatically
        if (!user.firstName || !user.lastName) {
          strapi.log.info(`[[GOOGLE_MIDDLEWARE]] Updating user ${user.id} with Google Profile data`);

          // Sanitize profile data to prevent XSS
          const sanitizedFirstName = (profile.given_name || user.username || 'User')
            .replace(/[<>'"&]/g, '')
            .slice(0, 100);
          const sanitizedLastName = (profile.family_name || '')
            .replace(/[<>'"&]/g, '')
            .slice(0, 100);

          user = await strapi.entityService.update('plugin::users-permissions.user', user.id, {
            data: {
              firstName: sanitizedFirstName,
              lastName: sanitizedLastName || 'User',
              // We can also set confirmed to true if not already
              confirmed: true,
            },
          });
        }

        // 5. Issue JWT (Access Token)
        const jwtService = strapi.plugin('users-permissions').service('jwt');
        const jwt = jwtService.issue({ id: user.id });

        // 6. Issue Manual Refresh Token (7 Days)
        const refreshToken = jwtService.issue(
          { id: user.id, type: 'refresh', version: user.tokenVersion || 1 },
          { expiresIn: '7d' }
        );

        strapi.log.info(`[[GOOGLE_MIDDLEWARE]] Success! Redirecting to frontend.`);

        // 7. Set httpOnly cookies only in production (shared parent domain: .jjelevateas.com)
        // In development, frontend uses localStorage + Bearer token (different origins can't share cookies)
        const isProduction = process.env.APP_ENVIRONMENT === 'production';
        if (isProduction) {
          try {
            // App Engine terminates HTTPS at the load balancer, so Koa may not see the
            // connection as secure. Ensure ctx.secure reflects the original protocol.
            if (ctx.request.header['x-forwarded-proto'] === 'https') {
              ctx.request.protocol = 'https';
            }
            ctx.cookies.set('jwt', jwt, AUTH_COOKIE_CONFIG.jwt);
            ctx.cookies.set('refreshToken', refreshToken, AUTH_COOKIE_CONFIG.refresh);
          } catch (cookieError: any) {
            // Cookie setting can fail behind reverse proxies. Log but don't block auth flow.
            // JWT is also passed via URL params as fallback.
            strapi.log.warn(`[[GOOGLE_MIDDLEWARE]] Cookie set failed (non-blocking): ${cookieError.message}`);
          }
        }

        // 8. Redirect to Frontend with JWT in URL (dev uses this, prod has cookies as primary)
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        ctx.status = 302;
        ctx.redirect(`${frontendUrl}/connect/google/redirect?jwt=${jwt}&refresh=${refreshToken}`);

        return;
      } catch (error: any) {
        strapi.log.error('[[GOOGLE_MIDDLEWARE]] Error:', error);
        strapi.log.error('[[GOOGLE_MIDDLEWARE]] Error message:', error?.message);
        strapi.log.error('[[GOOGLE_MIDDLEWARE]] Error stack:', error?.stack);

        // Show error details in development (APP_ENVIRONMENT, not NODE_ENV which is always 'production' on App Engine)
        const isDev = process.env.APP_ENVIRONMENT !== 'production';
        const errorMessage = isDev && error?.message
          ? `Authentication failed: ${error.message.substring(0, 200)}`
          : 'Authentication failed. Please try again.';

        // Redirect with error (sanitized message)
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        ctx.status = 302;
        ctx.redirect(`${frontendUrl}/connect/google/redirect?error=${encodeURIComponent(errorMessage)}`);
        return;
      }
    }

    // Pass through for all other requests
    await next();
  };
};
