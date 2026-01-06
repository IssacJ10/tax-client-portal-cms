/**
 * filing controller
 */

import { factories } from '@strapi/strapi'

// @ts-ignore
export default factories.createCoreController('api::filing.filing', ({ strapi }) => ({
    async create(ctx) {
        const user = ctx.state.user;
        if (!user) {
            return ctx.unauthorized('You must be logged in to start a filing');
        }

        const requestData = ctx.request.body.data || {};

        // Check if filing already exists
        if (requestData.taxYear) {
            // Use Document Service findMany
            const existing = await strapi.documents('api::filing.filing').findMany({
                filters: {
                    user: user.id,
                    taxYear: requestData.taxYear
                }
            });
            if (existing && existing.length > 0) {
                return ctx.badRequest('A filing already exists for this tax year');
            }
        }

        // Use Document Service create
        const newFiling = await strapi.documents('api::filing.filing').create({
            data: {
                ...requestData,
                user: user.id,
                status: 'published' // Strapi v5 published status
            }
        });

        // Sanitize output
        const sanitizedEntity = await this.sanitizeOutput(newFiling, ctx);
        return this.transformResponse(sanitizedEntity);
    },

    async find(ctx) {
        const user = ctx.state.user;
        if (!user) return ctx.unauthorized();

        // Check if user is Admin
        const isAdmin = user.role?.type === 'admin_role' || user.role?.name === 'Admin';

        // Use Core Service find for pagination (since Document Service findMany/findPage differ in v5 internal)
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

        // Try to find by ID first (numeric), then by documentId (UUID)
        let entity: any;

        // First try: use findMany with ID filter (works for numeric IDs)
        const results = await strapi.documents('api::filing.filing').findMany({
            filters: { id: id },
            populate: ['user', 'taxYear']
        });

        if (results && results.length > 0) {
            entity = results[0];
        } else {
            // Second try: use findOne with documentId (works for UUID documentIds)
            try {
                entity = await strapi.documents('api::filing.filing').findOne({
                    documentId: id,
                    populate: ['user', 'taxYear']
                });
            } catch (e) {
                console.log('[FINDONE DEBUG] DocumentId lookup failed:', e.message);
            }
        }

        console.log('[FINDONE DEBUG] Entity found:', !!entity, 'for ID:', id);

        console.log('[FINDONE DEBUG] Entity user:', {
            entityUserId: entity?.user?.id,
            entityUserDocumentId: entity?.user?.documentId,
            entityUser: entity?.user,
            currentUserId: user.id,
            isAdmin
        });

        // Handle both numeric ID and documentId comparison
        const entityUserId = entity?.user?.id || entity?.user?.documentId || entity?.user;
        const userMatches = entityUserId === user.id || entityUserId === user.documentId;

        if (!entity || (!isAdmin && !userMatches)) {
            console.log('[FINDONE DEBUG] Access denied:', {
                hasEntity: !!entity,
                isAdmin,
                userMatches,
                entityUserId,
                currentUserId: user.id
            });
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

        // Try to find by ID first (numeric), then by documentId (UUID)
        let entity: any;

        // First try: use findMany with ID filter
        const results = await strapi.documents('api::filing.filing').findMany({
            filters: { id: id },
            populate: ['user']
        });

        if (results && results.length > 0) {
            entity = results[0];
        } else {
            // Second try: use findOne with documentId
            try {
                entity = await strapi.documents('api::filing.filing').findOne({
                    documentId: id,
                    populate: ['user']
                });
            } catch (e) {
                console.log('[UPDATE DEBUG] DocumentId lookup failed:', e.message);
            }
        }

        // Handle both numeric ID and documentId comparison
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
        console.log('[CONTROLLER DEBUG] Forcing SQL update with:', {
            filingStatus: data.filingStatus,
            confirmationNumber: data.confirmationNumber,
            progress: data.progress
        });

        // First update via entityService (for Strapi's internal tracking)
        // @ts-ignore
        await strapi.entityService.update('api::filing.filing', id, {
            data: {
                filingStatus: data.filingStatus,
                confirmationNumber: data.confirmationNumber,
                progress: data.progress
            }
        });

        // Then update ALL fields including filingStatus via raw SQL to ensure database persistence
        // @ts-ignore
        await strapi.db.connection.raw(`
            UPDATE filings 
            SET 
                filing_status = ?,
                confirmation_number = ?,
                progress = ?,
                updated_at = NOW()
            WHERE id = ?
        `, [data.filingStatus || null, data.confirmationNumber || null, data.progress || null, id]);

        // Update remaining fields
        // @ts-ignore
        // Use Document Service update with documentId
        const updated = await strapi.documents('api::filing.filing').update({
            documentId: id,
            data
        });
        // Verify and read back via entityService (so Strapi's cache is correct)
        // @ts-ignore
        const verified = await strapi.entityService.findOne('api::filing.filing', id);

        console.log('[CONTROLLER DEBUG] Verified from entityService:', {
            filingStatus: verified.filingStatus,
            confirmationNumber: verified.confirmationNumber,
            progress: verified.progress
        });

        // Return in Strapi API format
        return {
            data: {
                id: verified.id,
                attributes: verified
            }
        };
    },

    async startFiling(ctx) {
        const user = ctx.state.user;
        if (!user) return ctx.unauthorized();
        // Forward to create logic
        // @ts-ignore
        return this.create(ctx, async () => { });
    }
}));
