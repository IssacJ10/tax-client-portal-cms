/**
 * error-log controller
 */

import { factories } from '@strapi/strapi'

export default factories.createCoreController('api::error-log.error-log', ({ strapi }) => ({
    // Override create to allow unauthenticated error logging
    async create(ctx) {
        const data = ctx.request.body.data || {};

        // Add timestamp if not provided
        if (!data.createdAt) {
            data.createdAt = new Date().toISOString();
        }

        // Create the error log entry
        const entry = await strapi.documents('api::error-log.error-log').create({
            data
        });

        return { data: entry };
    },

    // Find - only for authenticated admins
    async find(ctx) {
        const user = ctx.state.user;
        if (!user) return ctx.unauthorized();

        const isAdmin = user.role?.type === 'admin_role' || user.role?.name === 'Admin';
        if (!isAdmin) return ctx.forbidden();

        // @ts-ignore
        const { results, pagination } = await strapi.service('api::error-log.error-log').find({
            ...ctx.query,
            sort: { createdAt: 'desc' }
        });

        return this.transformResponse(results, { pagination });
    },

    // Update - only for admins (to mark as resolved)
    async update(ctx) {
        const user = ctx.state.user;
        if (!user) return ctx.unauthorized();

        const isAdmin = user.role?.type === 'admin_role' || user.role?.name === 'Admin';
        if (!isAdmin) return ctx.forbidden();

        const { id } = ctx.params;
        const data = ctx.request.body.data || {};

        const updated = await strapi.documents('api::error-log.error-log').update({
            documentId: id,
            data
        });

        return { data: updated };
    }
}));
