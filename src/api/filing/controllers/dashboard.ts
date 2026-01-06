/**
 * Dedicated Dashboard Controller
 * Used exclusively by JJElevateDashboard to avoid side effects on JJElevate public app.
 */

import { factories } from '@strapi/strapi';

// @ts-ignore
export default factories.createCoreController('api::filing.filing', ({ strapi }) => ({
    async find(ctx) {
        const user = ctx.state.user;
        if (!user) return ctx.unauthorized();

        const isAdmin = user.role?.type === 'admin_role' || user.role?.name === 'Admin';

        // Use Core Service find for pagination 
        // @ts-ignore
        const { results, pagination } = await strapi.service('api::filing.filing').find({
            ...ctx.query,
            filters: {
                ...(ctx.query.filters as any || {}),
                ...(isAdmin ? {} : { user: user.id })
            },
            populate: ['taxYear']
        });

        const sanitizedResults = await this.sanitizeOutput(results, ctx);
        return this.transformResponse(sanitizedResults, { pagination });
    },

    async findOne(ctx) {
        const user = ctx.state.user;
        if (!user) return ctx.unauthorized();

        const { id } = ctx.params;
        const isAdmin = user.role?.type === 'admin_role' || user.role?.name === 'Admin';

        let entity: any;

        // Safer ID handling for Dashboard: handle both numeric id and UUID documentId
        const isNumeric = !isNaN(Number(id));

        if (isNumeric) {
            const results = await strapi.documents('api::filing.filing').findMany({
                filters: { id: id },
                populate: ['user', 'taxYear']
            });
            if (results && results.length > 0) {
                entity = results[0];
            }
        }

        if (!entity) {
            try {
                entity = await strapi.documents('api::filing.filing').findOne({
                    documentId: id,
                    populate: ['user', 'taxYear']
                });
            } catch (e) {
                // Silent fail for documentId lookup
            }
        }

        const entityUserId = entity?.user?.id || entity?.user?.documentId || entity?.user;
        const userMatches = entityUserId === user.id || entityUserId === user.documentId;

        if (!entity || (!isAdmin && !userMatches)) {
            return ctx.notFound();
        }

        const sanitizedEntity = await this.sanitizeOutput(entity, ctx);
        return this.transformResponse(sanitizedEntity);
    },

    async update(ctx) {
        const user = ctx.state.user;
        if (!user) return ctx.unauthorized();

        const { id } = ctx.params;
        const isAdmin = user.role?.type === 'admin_role' || user.role?.name === 'Admin';

        let entity: any;
        const isNumeric = !isNaN(Number(id));

        if (isNumeric) {
            const results = await strapi.documents('api::filing.filing').findMany({
                filters: { id: id },
                populate: ['user']
            });
            if (results && results.length > 0) {
                entity = results[0];
            }
        }

        if (!entity) {
            try {
                entity = await strapi.documents('api::filing.filing').findOne({
                    documentId: id,
                    populate: ['user']
                });
            } catch (e) {
                // Silent fail
            }
        }

        const entityUserId = entity?.user?.id || entity?.user?.documentId || entity?.user;
        const userMatches = entityUserId === user.id || entityUserId === user.documentId;

        if (!entity || (!isAdmin && !userMatches)) {
            return ctx.notFound();
        }

        const { data } = ctx.request.body;

        // Prevent changing taxYear or user
        if (data.user || data.taxYear) {
            delete data.user;
            delete data.taxYear;
        }

        const updated = await strapi.documents('api::filing.filing').update({
            documentId: entity.documentId,
            data
        });

        // Read back with full population
        const verified: any = await strapi.documents('api::filing.filing').findOne({
            documentId: entity.documentId,
            populate: ['user', 'taxYear']
        });

        const sanitizedEntity = await this.sanitizeOutput(verified, ctx);
        return this.transformResponse(sanitizedEntity);
    },

    async getTaxYears(ctx) {
        const user = ctx.state.user;
        if (!user) return ctx.unauthorized();

        // Fetch latest 3 tax years
        const taxYears = await strapi.documents('api::tax-year.tax-year').findMany({
            sort: 'year:desc',
            limit: 3,
            fields: ['year', 'isActive', 'isCurrent']
        });

        return { data: taxYears };
    }
}));
