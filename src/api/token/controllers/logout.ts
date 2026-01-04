'use strict';

module.exports = {
    async logout(ctx) {
        const user = ctx.state.user;

        if (!user) {
            return ctx.unauthorized('No user authenticated');
        }

        try {
            // Increment tokenVersion to invalidate all existing refresh tokens
            await strapi.entityService.update('plugin::users-permissions.user', user.id, {
                data: {
                    tokenVersion: (user.tokenVersion || 1) + 1,
                },
            });

            return ctx.send({ message: 'Logged out successfully' });
        } catch (err) {
            return ctx.badRequest('Logout failed');
        }
    }
};
