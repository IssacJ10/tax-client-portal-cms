/**
 * Shared Cookie Configuration for httpOnly Auth Tokens
 *
 * Dual-mode authentication:
 * - Production (jjelevateas.com domain): httpOnly cookies with shared parent domain
 *   - domain=.jjelevateas.com allows cookies to be shared across subdomains
 *   - portal.jjelevateas.com and cms.jjelevateas.com share the same cookies
 * - Development (App Engine dev, localhost): Cookies set but not relied upon
 *   - Frontend uses localStorage + Bearer token for auth
 *   - Third-party cookies are blocked by browsers in cross-origin scenarios
 *
 * Note: sameSite='none' REQUIRES secure=true (HTTPS).
 */

// Check if we're in real production (jjelevateas.com domain)
// APP_ENVIRONMENT is set in app.yaml - "development" for dev, "production" for prod
const isRealProduction = process.env.APP_ENVIRONMENT === 'production';
const isHttps = process.env.NODE_ENV === 'production'; // Always true on App Engine

// Production domain for shared cookies
const PRODUCTION_DOMAIN = '.jjelevateas.com';

// Cookie settings based on environment
export const AUTH_COOKIE_CONFIG = {
  jwt: {
    httpOnly: true,
    secure: isHttps, // true for HTTPS (all App Engine), false for local HTTP
    sameSite: (isHttps ? 'none' : 'lax') as 'none' | 'lax',
    maxAge: 60 * 60 * 1000, // 1 hour (matches JWT expiry)
    path: '/',
    // Only set domain in production - allows cookies to be shared across subdomains
    ...(isRealProduction && { domain: PRODUCTION_DOMAIN }),
  },
  refresh: {
    httpOnly: true,
    secure: isHttps,
    sameSite: (isHttps ? 'none' : 'lax') as 'none' | 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
    // Only set domain in production
    ...(isRealProduction && { domain: PRODUCTION_DOMAIN }),
  },
};

/**
 * Set auth cookies on the Koa context
 */
export function setAuthCookies(ctx: any, jwt: string, refreshToken?: string): void {
  ctx.cookies.set('jwt', jwt, AUTH_COOKIE_CONFIG.jwt);
  if (refreshToken) {
    ctx.cookies.set('refreshToken', refreshToken, AUTH_COOKIE_CONFIG.refresh);
  }
}

/**
 * Clear auth cookies on the Koa context
 */
export function clearAuthCookies(ctx: any): void {
  ctx.cookies.set('jwt', '', { ...AUTH_COOKIE_CONFIG.jwt, maxAge: 0 });
  ctx.cookies.set('refreshToken', '', { ...AUTH_COOKIE_CONFIG.refresh, maxAge: 0 });
}

export default AUTH_COOKIE_CONFIG;
