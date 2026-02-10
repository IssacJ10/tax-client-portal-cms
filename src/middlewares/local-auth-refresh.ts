'use strict';

const { setAuthCookies } = require('../utils/cookie-config');

/**
 * Local Auth Middleware
 *
 * Handles login responses to:
 * 1. Issue refresh tokens for session persistence
 * 2. Set httpOnly cookies for production (jjelevateas.com domain)
 *
 * Dual-mode authentication:
 * - Production: httpOnly cookies work across subdomains (shared parent domain)
 * - Development: Cookies are set but frontend uses localStorage + Bearer token
 */
module.exports = (config, { strapi }) => {
    return async (ctx, next) => {
        // 1. Execute the default logic (Login)
        await next();

        // 2. Check if it's the Local Auth login route and successful
        if (
            ctx.method === 'POST' &&
            ctx.path === '/api/auth/local' &&
            ctx.response.status === 200 &&
            ctx.body &&
            ctx.body.jwt &&
            ctx.body.user
        ) {
            try {
                strapi.log.info('[[LOCAL_AUTH_MIDDLEWARE]] Injecting refresh token and setting cookies...');
                const user = ctx.body.user;
                const jwtService = strapi.plugin('users-permissions').service('jwt');

                // Issue Refresh Token with Version
                const refreshToken = jwtService.issue({
                    id: user.id,
                    type: 'refresh',
                    version: user.tokenVersion || 1
                }, { expiresIn: '7d' });

                // Set httpOnly cookies for auth
                // In production (jjelevateas.com): These cookies are shared across subdomains
                // In development: Set but not relied upon (frontend uses localStorage)
                setAuthCookies(ctx, ctx.body.jwt, refreshToken);

                // Append refresh token to response body
                ctx.body = {
                    ...ctx.body,
                    refreshToken
                };
                strapi.log.info('[[LOCAL_AUTH_MIDDLEWARE]] Success!');
            } catch (e) {
                strapi.log.error('[[LOCAL_AUTH_MIDDLEWARE]] Failed to inject refresh token', e);
            }
        }
    };
};
