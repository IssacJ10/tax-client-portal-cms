/**
 * Google OAuth Middleware
 * Handles Google OAuth callback and token exchange
 */

import { AUTH_COOKIE_CONFIG } from '../utils/cookie-config';

export default (config, { strapi }) => {
  return async (ctx, next) => {
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

        strapi.log.info(`[[GOOGLE_MIDDLEWARE]] Success! Setting httpOnly cookies and redirecting to frontend.`);

        // 7. Set httpOnly cookies for secure authentication (using shared config with sameSite: 'none' for cross-origin)
        ctx.cookies.set('jwt', jwt, AUTH_COOKIE_CONFIG.jwt);
        ctx.cookies.set('refreshToken', refreshToken, AUTH_COOKIE_CONFIG.refresh);

        // 8. Redirect to Frontend (cookies are set, no tokens in URL needed)
        // Keep JWT in URL for backwards compatibility during migration
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        ctx.status = 302;
        ctx.redirect(`${frontendUrl}/connect/google/redirect?jwt=${jwt}&refresh=${refreshToken}`);

        return;
      } catch (error: any) {
        strapi.log.error('[[GOOGLE_MIDDLEWARE]] Error:', error);
        strapi.log.error('[[GOOGLE_MIDDLEWARE]] Error message:', error?.message);
        strapi.log.error('[[GOOGLE_MIDDLEWARE]] Error stack:', error?.stack);

        // In development, show more details for debugging
        const isDev = process.env.NODE_ENV !== 'production';
        const errorMessage = isDev && error?.message
          ? `Authentication failed: ${error.message.substring(0, 100)}`
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
