/**
 * Personal Filing Service Wrapper
 * 
 * Handles personal-filing operations including:
 * - Creating personal-filing records (primary/spouse/dependent)
 * - Updating formData on wizard progression
 * - Querying personal-filings by filing
 */

export default () => ({
    /**
     * Create a personal-filing record
     * Used for adding spouse or dependents to an existing filing
     */
    async createPersonalFiling(filingDocumentId: string, type: 'primary' | 'spouse' | 'dependent', initialData: any = {}) {
        // Validate filing exists
        const filing = await strapi.documents('api::filing.filing').findOne({
            documentId: filingDocumentId
        });

        if (!filing) {
            throw new Error('Filing not found');
        }

        // Create personal-filing
        const personalFiling = await strapi.documents('api::personal-filing.personal-filing').create({
            data: {
                filing: filingDocumentId,
                type,
                individualStatus: 'DRAFT',
                formData: initialData.formData || {},
                // Optional initial fields
                firstName: initialData.firstName || null,
                lastName: initialData.lastName || null,
            }
        });

        return personalFiling;
    },

    /**
     * Update formData for a personal-filing
     * Called on each wizard "next" button click
     */
    async updateFormData(personalFilingId: string, formData: any, user: any) {
        // Permission check: Verify user owns the parent filing
        const personalFiling = await this.findOneWithPermissions(personalFilingId, user);

        if (!personalFiling) {
            throw new Error('Personal filing not found or unauthorized');
        }

        // Merge existing formData with new data (don't overwrite everything)
        const existingFormData = personalFiling.formData || {};
        const mergedFormData = {
            ...existingFormData,
            ...formData
        };

        // Update personal-filing
        const updated = await strapi.documents('api::personal-filing.personal-filing').update({
            documentId: personalFiling.documentId,
            data: {
                formData: mergedFormData,
                // Optionally extract some fields to top-level if needed
                // This can be enhanced based on your schema
            }
        });

        return updated;
    },

    /**
     * Find all personal-filings for a given filing
     */
    async findByFiling(filingDocumentId: string, user: any) {
        // First verify user has access to the filing
        const filing = await strapi.documents('api::filing.filing').findOne({
            documentId: filingDocumentId,
            populate: ['user']
        });

        if (!filing) {
            throw new Error('Filing not found');
        }

        const isAdmin = user.role?.type === 'admin_role' || user.role?.name === 'Admin';
        const entityUserId = filing.user?.id || filing.user?.documentId || filing.user;
        const userMatches = entityUserId === user.id || entityUserId === user.documentId;

        if (!isAdmin && !userMatches) {
            throw new Error('Unauthorized');
        }

        // Find all personal-filings for this filing
        const personalFilings = await strapi.documents('api::personal-filing.personal-filing').findMany({
            filters: {
                filing: { documentId: filingDocumentId }
            }
        });

        return personalFilings;
    },

    /**
     * Find one personal-filing with permission check
     */
    async findOneWithPermissions(id: string | number, user: any) {
        let entity: any;

        // Try numeric ID first
        const results = await strapi.documents('api::personal-filing.personal-filing').findMany({
            filters: { id: id },
            populate: ['filing', 'filing.user']
        });

        if (results && results.length > 0) {
            entity = results[0];
        } else {
            // Try documentId
            try {
                entity = await strapi.documents('api::personal-filing.personal-filing').findOne({
                    documentId: id as string,
                    populate: ['filing', 'filing.user']
                });
            } catch (e) {
                return null;
            }
        }

        if (!entity) {
            return null;
        }

        // Permission check: verify user owns the parent filing
        const isAdmin = user.role?.type === 'admin_role' || user.role?.name === 'Admin';
        const filing = entity.filing;

        if (!filing) {
            return null;
        }

        const entityUserId = filing.user?.id || filing.user?.documentId || filing.user;
        const userMatches = entityUserId === user.id || entityUserId === user.documentId;

        if (!isAdmin && !userMatches) {
            return null; // Not authorized
        }

        return entity;
    },

    /**
     * Delete a personal-filing (spouse or dependent)
     * Primary cannot be deleted
     */
    async deletePersonalFiling(personalFilingId: string, user: any) {
        const personalFiling = await this.findOneWithPermissions(personalFilingId, user);

        if (!personalFiling) {
            throw new Error('Personal filing not found or unauthorized');
        }

        if (personalFiling.type === 'primary') {
            throw new Error('Cannot delete primary personal-filing');
        }

        await strapi.documents('api::personal-filing.personal-filing').delete({
            documentId: personalFiling.documentId
        });

        return { success: true };
    }
});
