'use strict';

/**
 * Consent controller
 * Handles user consent recording
 */

module.exports = {
    /**
     * Record user consent to terms
     */
    async confirm(ctx) {
        const user = ctx.state.user;

        if (!user) {
            return ctx.unauthorized('You must be authenticated to confirm consent.');
        }

        try {
            // Update the user's consent status
            const updatedUser = await strapi.entityService.update(
                'plugin::users-permissions.user',
                user.id,
                {
                    data: {
                        hasConsentedToTerms: true,
                        consentDate: new Date().toISOString(),
                    },
                }
            );

            // Sanitize and return the updated user
            const sanitizedUser = await strapi
                .plugin('users-permissions')
                .service('user')
                .sanitizeOutput(updatedUser, ctx);

            ctx.send({
                success: true,
                user: sanitizedUser,
            });
        } catch (err) {
            ctx.throw(500, err);
        }
    },
};
