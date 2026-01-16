/**
 * Filing Service Wrapper
 *
 * Handles filing-related operations including:
 * - Creating filings (PersonalFiling is created by the client to avoid race conditions)
 * - Permission-based queries
 * - Duplicate prevention
 */

export default () => ({
    /**
     * Create a filing record only.
     * NOTE: PersonalFiling creation is handled by the client (tax-client-portal)
     * to avoid race conditions and duplicate creation issues.
     */
    async createWithPrimary(requestData: any, user: any) {
        const { data, error } = await this.validateFilingCreation(requestData, user);

        if (error) {
            throw error;
        }

        // Create the Filing record only - client will create PersonalFiling
        const newFiling = await strapi.documents('api::filing.filing').create({
            data: {
                ...requestData,
                user: user.id,
            },
            populate: ['filingStatus', 'filingType', 'taxYear', 'user', 'personalFilings', 'corporateFiling', 'trustFiling']
        });

        return { filing: newFiling, primaryFiling: null };
    },

    /**
     * Validate filing creation - check for duplicates and resolve filing type
     */
    async validateFilingCreation(requestData: any, user: any) {
        // Resolve Filing Type
        let filingTypeStr = 'PERSONAL'; // Default

        if (requestData.filingType) {
            if (typeof requestData.filingType === 'number' || !isNaN(Number(requestData.filingType))) {
                const results = await strapi.documents('api::filing-type.filing-type').findMany({
                    filters: { id: requestData.filingType },
                    limit: 1
                });
                if (results && results.length > 0) {
                    filingTypeStr = results[0].type;
                }
            } else if (typeof requestData.filingType === 'string') {
                if (['PERSONAL', 'CORPORATE', 'TRUST'].includes(requestData.filingType)) {
                    filingTypeStr = requestData.filingType;
                } else {
                    try {
                        const doc = await strapi.documents('api::filing-type.filing-type').findOne({
                            documentId: requestData.filingType,
                        });
                        if (doc) {
                            filingTypeStr = doc.type;
                        }
                    } catch (e) {
                        // ignore
                    }
                }
            }
        }

        // Check for duplicates - ONLY for PERSONAL filings
        // CORPORATE and TRUST filings can have multiple per user per year
        if (requestData.taxYear && filingTypeStr === 'PERSONAL') {
            const filters: any = {
                user: { id: user.id },
                taxYear: { id: requestData.taxYear }
            };

            const candidates = await strapi.documents('api::filing.filing').findMany({
                filters,
                populate: ['filingType']
            });

            // Only check for existing PERSONAL filings
            const existing = candidates.filter(f =>
                f.filingType && f.filingType.type === 'PERSONAL'
            );

            if (existing && existing.length > 0) {
                return { data: null, error: new Error('A personal return already exists for this tax year') };
            }
        }

        // Note: CORPORATE and TRUST filings are allowed multiple per user per year
        // No duplicate check is performed for these types

        return { data: { filingTypeStr }, error: null };
    },

    /**
     * Find one filing with permission checks
     * Supports both numeric ID and documentId (UUID)
     */
    async findOneWithPermissions(id: string | number, user: any) {
        const isAdmin = user.role?.type === 'admin_role' || user.role?.name === 'Admin';

        let entity: any;

        // Try numeric ID first
        const results = await strapi.documents('api::filing.filing').findMany({
            filters: { id: id },
            populate: ['user', 'taxYear', 'filingStatus', 'filingType', 'personalFilings', 'corporateFiling', 'trustFiling']
        });

        if (results && results.length > 0) {
            entity = results[0];
        } else {
            // Try documentId
            try {
                entity = await strapi.documents('api::filing.filing').findOne({
                    documentId: id as string,
                    populate: ['user', 'taxYear', 'filingStatus', 'filingType', 'personalFilings', 'corporateFiling', 'trustFiling']
                });
            } catch (e) {
                return null;
            }
        }

        if (!entity) {
            return null;
        }

        // Permission check
        const entityUserId = entity?.user?.id || entity?.user?.documentId || entity?.user;
        const userMatches = entityUserId === user.id || entityUserId === user.documentId;

        if (!isAdmin && !userMatches) {
            return null; // Not authorized
        }

        return entity;
    },

    /**
     * Find all filings for a user (or all if admin)
     */
    async findWithPermissions(query: any, user: any) {
        const isAdmin = user.role?.type === 'admin_role' || user.role?.name === 'Admin';

        // @ts-ignore
        const { results, pagination } = await strapi.service('api::filing.filing').find({
            ...query,
            filters: {
                ...(query.filters || {}),
                ...(isAdmin ? {} : { user: user.id })
            },
            populate: ['taxYear', 'filingStatus', 'filingType', 'personalFilings', 'corporateFiling', 'trustFiling']
        });

        return { results, pagination };
    }
});
