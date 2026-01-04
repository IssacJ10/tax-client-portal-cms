import { errors } from '@strapi/utils';

const { ApplicationError } = errors;

const NAME_REGEX = /^[a-zA-Z \-']+$/;

export default (plugin) => {
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

        const updatedUser = await strapi.entityService.update(
            'plugin::users-permissions.user',
            ctx.state.user.id,
            {
                data: updateData,
            }
        );

        ctx.body = await sanitizeOutput(updatedUser, ctx);
    };

    plugin.routes['content-api'].routes.push({
        method: 'PUT',
        path: '/user/me',
        handler: 'user.updateMe',
        config: {
            prefix: '',
            policies: [],
        },
    });

    return plugin;
};
