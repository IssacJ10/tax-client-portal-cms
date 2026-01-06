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
            // @ts-ignore
            const existing = await strapi.entityService.findMany('api::filing.filing', {
                filters: {
                    user: user.id,
                    taxYear: requestData.taxYear
                }
            });
            // @ts-ignore
            if (existing && existing.length > 0) {
                return ctx.badRequest('A filing already exists for this tax year');
            }
        }

        // Use EntityService to bypass HTTP sanitization of 'user' field
        // @ts-ignore
        const newFiling = await strapi.entityService.create('api::filing.filing', {
            data: {
                ...requestData,
                user: user.id,
                publishedAt: new Date() // Publish immediately
            }
        });

        // Sanitize output
        const sanitizedEntity = await this.sanitizeOutput(newFiling, ctx);
        return this.transformResponse(sanitizedEntity);
    },

    async find(ctx) {
        const user = ctx.state.user;
        if (!user) return ctx.unauthorized();

        // Use EntityService for strict control
        // @ts-ignore
        const { results, pagination } = await strapi.entityService.findPage('api::filing.filing', {
            ...ctx.query,
            filters: {
                ...(ctx.query.filters as any || {}),
                user: user.id
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

        // @ts-ignore
        const entity: any = await strapi.entityService.findOne('api::filing.filing', id, {
            populate: ['user', 'taxYear']
        });

        if (!entity || entity.user?.id !== user.id) {
            return ctx.notFound();
        }

        const sanitizedEntity = await this.sanitizeOutput(entity, ctx);
        return this.transformResponse(sanitizedEntity);
    },

    async update(ctx) {
        const user = ctx.state.user;
        if (!user) return ctx.unauthorized();

        const { id } = ctx.params;

        // @ts-ignore
        const entity: any = await strapi.entityService.findOne('api::filing.filing', id, {
            populate: ['user']
        });

        if (!entity || entity.user?.id !== user.id) {
            return ctx.notFound(); // Or unauthorized, but notFound is safer to avoid enumeration
        }

        const { data } = ctx.request.body;

        // Prevent changing taxYear or user
        if (data.user || data.taxYear) {
            delete data.user;
            delete data.taxYear;
        }

        console.log('[CONTROLLER DEBUG] Forcing SQL update with:', {
            status: data.status,
            confirmationNumber: data.confirmationNumber,
            progress: data.progress
        });

        // First update OTHER fields via entityService (for Strapi's internal tracking)
        // @ts-ignore
        await strapi.entityService.update('api::filing.filing', id, {
            data: {
                status: data.status,
                confirmationNumber: data.confirmationNumber,
                progress: data.progress
            }
        });

        // Then update ALL fields including status via raw SQL to ensure database persistence
        // @ts-ignore
        await strapi.db.connection.raw(`
            UPDATE filings 
            SET 
                status = ?,
                confirmation_number = ?,
                progress = ?,
                updated_at = NOW()
            WHERE id = ?
        `, [data.status || null, data.confirmationNumber || null, data.progress || null, id]);

        // Update remaining fields
        // @ts-ignore
        const updated = await strapi.db.query('api::filing.filing').update({
            where: { id },
            data
        });

        // Verify and read back via entityService (so Strapi's cache is correct)
        // @ts-ignore
        const verified = await strapi.entityService.findOne('api::filing.filing', id);

        console.log('[CONTROLLER DEBUG] Verified from entityService:', {
            status: verified.status,
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
