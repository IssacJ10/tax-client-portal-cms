'use strict';

/**
 * Logout Controller
 * Clears httpOnly auth cookies and invalidates refresh tokens
 */

import { clearAuthCookies } from '../../../utils/cookie-config';

module.exports = {
    async logout(ctx: any) {
        const user = ctx.state.user;

        if (!user) {
            // Even if no user, clear cookies (handles edge cases)
            clearAuthCookies(ctx);
            return ctx.unauthorized('No user authenticated');
        }

        try {
            // Increment tokenVersion to invalidate all existing refresh tokens
            await strapi.entityService.update('plugin::users-permissions.user', user.id, {
                data: {
                    tokenVersion: (user.tokenVersion || 1) + 1,
                },
            });

            // Clear httpOnly cookies
            clearAuthCookies(ctx);

            strapi.log.info(`[Auth] User ${user.email} logged out, cookies cleared`);

            return ctx.send({ message: 'Logged out successfully' });
        } catch (err) {
            // Still clear cookies even if DB update fails
            clearAuthCookies(ctx);
            return ctx.badRequest('Logout failed');
        }
    }
};
