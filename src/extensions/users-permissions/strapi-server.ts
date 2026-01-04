const { errors } = require('@strapi/utils');
const { ApplicationError } = errors;

const NAME_REGEX = /^[a-zA-Z \-']+$/;

module.exports = (plugin) => {
    // --- 1. Custom Callback for Refresh Tokens ---
    const originalCallback = plugin.controllers.auth.callback;

    plugin.controllers.auth.callback = async (ctx) => {
        // Run original login
        await originalCallback(ctx);

        // If successful and is local auth, inject Custom Refresh Token
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

    // --- 2. Custom updateMe for Profile Management ---
    const sanitizeOutput = async (user, ctx) => {
        const schema = strapi.getModel('plugin::users-permissions.user');
        const { auth } = ctx.state;
        return strapi.contentAPI.sanitize.output(user, schema, { auth });
    };

    plugin.controllers.user.updateMe = async (ctx) => {
        if (!ctx.state.user || !ctx.state.user.id) {
            return ctx.unauthorized();
        }

        const { firstName, lastName } = ctx.request.body;
        const updateData: Record<string, any> = {};

        // Validate and build update data
        if (firstName !== undefined) {
            if (!NAME_REGEX.test(firstName)) {
                throw new ApplicationError('First name can only contain letters, spaces, hyphens, and apostrophes.');
            }
            updateData.firstName = firstName;
        }

        if (lastName !== undefined) {
            if (!NAME_REGEX.test(lastName)) {
                throw new ApplicationError('Last name can only contain letters, spaces, hyphens, and apostrophes.');
            }
            updateData.lastName = lastName;
        }

        if (Object.keys(updateData).length === 0) {
            return ctx.badRequest('No valid fields to update.');
        }

        // Perform Update
        const updatedUser = await strapi.entityService.update(
            'plugin::users-permissions.user',
            ctx.state.user.id,
            { data: updateData }
        );

        ctx.body = await sanitizeOutput(updatedUser, ctx);
    };

    // Register Route
    plugin.routes['content-api'].routes.unshift({
        method: 'PUT',
        path: '/users/me', // Kept as /users/me for consistency with rest of API, though /user/me was original. frontend uses /users/me now.
        handler: 'user.updateMe',
        config: {
            prefix: '',
            policies: [],
        },
    });

    return plugin;
};
