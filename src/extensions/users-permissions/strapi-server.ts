module.exports = (plugin) => {
    const originalCallback = plugin.controllers.auth.callback;

    plugin.controllers.auth.callback = async (ctx) => {
        // 1. Run original login
        await originalCallback(ctx);

        // 2. If successful and is local auth, inject Custom Refresh Token
        if (ctx.params.provider === 'local' && ctx.response.status === 200 && ctx.body.jwt) {
            try {
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
            } catch (e) {
                strapi.log.error('Failed to issue refresh token for local auth', e);
            }
        }
    };

    return plugin;
};
