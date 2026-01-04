'use strict';

/**
 * A set of functions called "actions" for `token`
 */

module.exports = {
    async refresh(ctx) {
        const { refreshToken } = ctx.request.body;

        if (!refreshToken) {
            return ctx.badRequest('No refresh token provided');
        }

        try {
            // 1. Verify the Refresh Token
            const jwtService = strapi.plugin('users-permissions').service('jwt');
            const payload = await jwtService.verify(refreshToken);

            // 2. Check if it's a valid Refresh Token type
            if (payload.type !== 'refresh') {
                return ctx.badRequest('Invalid token type');
            }

            // 3. Check if user still exists/active
            const user = await strapi.entityService.findOne('plugin::users-permissions.user', payload.id);
            if (!user || user.blocked) {
                return ctx.badRequest('User no longer valid');
            }

            // 4. Verify Token Version (Server-Side Invalidation Check)
            const currentVersion = user.tokenVersion || 1;
            if (payload.version && payload.version !== currentVersion) {
                return ctx.badRequest('Refresh token invalidated (logged out)');
            }

            // 5. Issue NEW Access Token (1h)
            const newAccessToken = jwtService.issue({ id: user.id });

            // 6. Issue NEW Refresh Token (7d) with SAME version
            const newRefreshToken = jwtService.issue({
                id: user.id,
                type: 'refresh',
                version: currentVersion
            }, { expiresIn: '7d' });

            return ctx.send({
                jwt: newAccessToken,
                refreshToken: newRefreshToken,
            });

        } catch (err) {
            return ctx.badRequest('Invalid refresh token');
        }
    }
};
