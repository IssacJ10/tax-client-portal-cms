module.exports = (plugin) => {
    // 1. Extend the User Controller with consent action
    plugin.controllers.user.confirmConsent = async (ctx) => {
        const user = ctx.state.user;

        if (!user) {
            return ctx.unauthorized('You must be logged in to confirm consent.');
        }

        try {
            // Update only consent fields
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

            // Sanitize and return
            const sanitizedUser = await strapi
                .plugin('users-permissions')
                .service('user')
                .sanitizeOutput(updatedUser, ctx);

            return sanitizedUser;
        } catch (err) {
            return ctx.badRequest(err.message);
        }
    };

    // 2. Add custom route using correct v5 format
    plugin.routes['content-api'].routes.push({
        method: 'POST',
        path: '/user/consent',
        handler: 'user.confirmConsent',
        config: {
            policies: [],
            middlewares: [],
        },
    });

    return plugin;
};
