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

        // Resolve Filing Type if ID is provided
        let filingTypeStr = 'PERSONAL'; // Default
        if (requestData.filingType) {
            // If it's a number/ID
            if (typeof requestData.filingType === 'number' || !isNaN(Number(requestData.filingType))) {
                // Try to find by numeric ID first (most likely case from frontend)
                const results = await strapi.documents('api::filing-type.filing-type').findMany({
                    filters: { id: requestData.filingType },
                    limit: 1
                });

                if (results && results.length > 0) {
                    filingTypeStr = results[0].type;
                } else {
                    // Fallback: try as documentId just in case
                    try {
                        const doc = await strapi.documents('api::filing-type.filing-type').findOne({
                            documentId: String(requestData.filingType),
                        });
                        if (doc) {
                            filingTypeStr = doc.type;
                        } else {
                            return ctx.badRequest('Invalid filing type ID provided');
                        }
                    } catch (e) {
                        return ctx.badRequest('Invalid filing type ID provided');
                    }
                }
            } else if (typeof requestData.filingType === 'string') {
                filingTypeStr = requestData.filingType; // Backward compat
            }
        }

        // Check if filing already exists for this specific combination
        if (requestData.taxYear) {
            const filters: any = {
                user: user.id,
                taxYear: requestData.taxYear,
                filingType: requestData.filingType // Works if it's ID or String
            };

            // For PERSONAL returns: one per user per year
            // For CORPORATE/TRUST: check entity name to allow multiple entities
            if (filingTypeStr !== 'PERSONAL' && requestData.entityName) {
                filters.entityName = requestData.entityName;
            }

            const existing = await strapi.documents('api::filing.filing').findMany({
                filters
            });

            if (existing && existing.length > 0) {
                const typeLabel = filingTypeStr.toLowerCase();

                if (filingTypeStr === 'PERSONAL') {
                    return ctx.badRequest(`A ${typeLabel} return already exists for this tax year`);
                } else {
                    return ctx.badRequest(`A ${typeLabel} return for "${requestData.entityName}" already exists for this tax year`);
                }
            }
        }

        // Use Document Service create
        const newFiling = await strapi.documents('api::filing.filing').create({
            data: {
                ...requestData,
                user: user.id,
                status: requestData.status || 'published' // Ensure status ID is passed if provided
            },
            populate: ['status', 'filingType', 'taxYear']
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
            populate: ['taxYear', 'status', 'filingType'] // Added master data relations
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
            populate: ['user', 'taxYear', 'status', 'filingType'] // Added master data relations
        });

        if (results && results.length > 0) {
            entity = results[0];
        } else {
            // Second try: use findOne with documentId (works for UUID documentIds)
            try {
                entity = await strapi.documents('api::filing.filing').findOne({
                    documentId: id,
                    populate: ['user', 'taxYear', 'status', 'filingType'] // Added master data relations
                });
            } catch (e) {
                console.log('[FINDONE DEBUG] DocumentId lookup failed:', e.message);
            }
        }

        console.log('[FINDONE DEBUG] Entity found:', !!entity, 'for ID:', id);

        // Handle both numeric ID and documentId comparison
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

        console.log('[CONTROLLER DEBUG] Updating filing via Document Service:', {
            id,
            documentId: entity.documentId,
            filingStatus: data.filingStatus, // Might be undefined now
            status: data.status, // New ID field
            hasFilingData: !!data.filingData,
            keys: Object.keys(data)
        });

        // SMART WIZARD SYNC:
        // Extract top-level fields from filingData if they exist, to ensure Schema columns are populated
        if (data.filingData && data.filingData.personalInfo) {
            // Sync Dependents Count
            if (data.filingData.personalInfo.dependentsCount) {
                data.dependentsCount = parseInt(data.filingData.personalInfo.dependentsCount);
            }
            // Sync Family Members Enum
            if (data.filingData.personalInfo.hasFamilyMembers) {
                data.hasFamilyMembers = data.filingData.personalInfo.hasFamilyMembers;
            }
        }

        // Use Document Service update with documentId
        // This handles components, JSON fields, and regular fields correctly in Strapi v5
        const updated = await strapi.documents('api::filing.filing').update({
            documentId: entity.documentId,
            data,
            populate: ['status', 'filingType'] // Populate relations in return
        });

        // Verify and read back via document service
        const verified: any = await strapi.documents('api::filing.filing').findOne({
            documentId: entity.documentId,
            populate: ['user', 'taxYear', 'status', 'filingType'] // Added master data relations
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
