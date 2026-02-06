/**
 * Shared Cookie Configuration for httpOnly Auth Tokens
 *
 * Cookie policy depends on environment:
 * - Production (HTTPS): secure=true, sameSite='none' for cross-origin
 * - Development (HTTP): secure=false, sameSite='lax' for localhost
 *
 * Note: sameSite='none' REQUIRES secure=true (HTTPS).
 * In development on HTTP, we use sameSite='lax' which allows cookies
 * on top-level navigations (redirects) but not on cross-origin fetch.
 * The frontend falls back to JWT from URL params for development.
 */

const isProduction = process.env.NODE_ENV === 'production';

// Cookie settings based on environment
export const AUTH_COOKIE_CONFIG = {
  jwt: {
    httpOnly: true,
    secure: isProduction, // true for HTTPS in production, false for HTTP in development
    sameSite: (isProduction ? 'none' : 'lax') as 'none' | 'lax',
    maxAge: 60 * 60 * 1000, // 1 hour (matches JWT expiry)
    path: '/',
  },
  refresh: {
    httpOnly: true,
    secure: isProduction,
    sameSite: (isProduction ? 'none' : 'lax') as 'none' | 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
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
