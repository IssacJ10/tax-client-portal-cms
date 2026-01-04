'use strict';

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
                strapi.log.info('[[LOCAL_AUTH_MIDDLEWARE]] Injecting Refresh Token...');
                const user = ctx.body.user;
                const jwtService = strapi.plugin('users-permissions').service('jwt');

                // Issue Refresh Token with Version
                const refreshToken = jwtService.issue({
                    id: user.id,
                    type: 'refresh',
                    version: user.tokenVersion || 1
                }, { expiresIn: '7d' });

                // Append to response
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
