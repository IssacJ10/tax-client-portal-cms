module.exports = (plugin) => {
    // 1. Extend the User Controller
    plugin.controllers.user.confirmConsent = async (ctx) => {
        const user = ctx.state.user;

        if (!user) {
            return ctx.unauthorized('You must be logged in to confirm consent.');
        }

        try {
            // Use the entity service to securely update the user
            // We explicitly only update the consent fields
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

            // Return the sanitized user
            ctx.body = await strapi
                .plugin('users-permissions')
                .service('user')
                .sanitizeOutput(updatedUser, ctx);
        } catch (err) {
            ctx.body = err;
        }
    };

    // 2. Add the Custom Route
    plugin.routes['content-api'].routes.push({
        method: 'POST',
        path: '/users/consent',
        handler: 'user.confirmConsent',
        config: {
            prefix: '',
            policies: [],
        },
    });

    return plugin;
};
