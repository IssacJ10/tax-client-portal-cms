/**
 * Trust Filing Service Wrapper
 *
 * Handles trust-filing (T3) operations including:
 * - Creating trust-filing records
 * - Updating formData on wizard progression
 * - Querying trust-filings by filing
 */

export default () => ({
    /**
     * Create a trust-filing record
     * Called when user starts a new trust tax filing
     */
    async createTrustFiling(filingDocumentId: string, initialData: any = {}) {
        // Validate filing exists
        const filing = await strapi.documents('api::filing.filing').findOne({
            documentId: filingDocumentId
        });

        if (!filing) {
            throw new Error('Filing not found');
        }

        // Create trust-filing
        const trustFiling = await strapi.documents('api::trust-filing.trust-filing').create({
            data: {
                filing: filingDocumentId,
                formData: initialData.formData || {},
                // Optional initial fields from schema
                trustName: initialData.trustName || 'New Trust',
                accountNumber: initialData.accountNumber || '',
                creationDate: initialData.creationDate || null,
                residency: initialData.residency || null,
                trustees: initialData.trustees || null,
                beneficiaries: initialData.beneficiaries || null,
                income: initialData.income || null,
            }
        });

        return trustFiling;
    },

    /**
     * Update formData for a trust-filing
     * Called on each wizard "next" button click
     */
    async updateFormData(trustFilingId: string, formData: any, user: any) {
        // Permission check: Verify user owns the parent filing
        const trustFiling = await this.findOneWithPermissions(trustFilingId, user);

        if (!trustFiling) {
            throw new Error('Trust filing not found or unauthorized');
        }

        // Merge existing formData with new data (don't overwrite everything)
        const existingFormData = trustFiling.formData || {};
        const mergedFormData = {
            ...existingFormData,
            ...formData
        };

        // Extract top-level fields from formData for direct schema mapping
        const updateData: any = {
            formData: mergedFormData
        };

        // Map known fields from formData to schema fields
        if (mergedFormData['trustInfo.trustName']) {
            updateData.trustName = mergedFormData['trustInfo.trustName'];
        }
        if (mergedFormData['trustInfo.accountNumber']) {
            updateData.accountNumber = mergedFormData['trustInfo.accountNumber'];
        }
        if (mergedFormData['trustInfo.creationDate']) {
            updateData.creationDate = mergedFormData['trustInfo.creationDate'];
        }
        if (mergedFormData['trustInfo.residency']) {
            updateData.residency = mergedFormData['trustInfo.residency'];
        }
        if (mergedFormData['trustees']) {
            updateData.trustees = mergedFormData['trustees'];
        }
        if (mergedFormData['beneficiaries']) {
            updateData.beneficiaries = mergedFormData['beneficiaries'];
        }
        if (mergedFormData['income']) {
            updateData.income = mergedFormData['income'];
        }

        // Update trust-filing
        const updated = await strapi.documents('api::trust-filing.trust-filing').update({
            documentId: trustFiling.documentId,
            data: updateData
        });

        return updated;
    },

    /**
     * Find all trust-filings for a given filing
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

        // Find all trust-filings for this filing
        const trustFilings = await strapi.documents('api::trust-filing.trust-filing').findMany({
            filters: {
                filing: { documentId: filingDocumentId }
            }
        });

        return trustFilings;
    },

    /**
     * Find one trust-filing with permission check
     */
    async findOneWithPermissions(id: string | number, user: any) {
        let entity: any;

        // Try numeric ID first
        const results = await strapi.documents('api::trust-filing.trust-filing').findMany({
            filters: { id: id },
            populate: ['filing', 'filing.user']
        });

        if (results && results.length > 0) {
            entity = results[0];
        } else {
            // Try documentId
            try {
                entity = await strapi.documents('api::trust-filing.trust-filing').findOne({
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
     * Mark trust-filing as complete
     */
    async markComplete(trustFilingId: string, user: any) {
        const trustFiling = await this.findOneWithPermissions(trustFilingId, user);

        if (!trustFiling) {
            throw new Error('Trust filing not found or unauthorized');
        }

        const updated = await strapi.documents('api::trust-filing.trust-filing').update({
            documentId: trustFiling.documentId,
            data: {
                status: 'COMPLETED'
            }
        });

        return updated;
    },

    /**
     * Delete a trust-filing
     */
    async deleteTrustFiling(trustFilingId: string, user: any) {
        const trustFiling = await this.findOneWithPermissions(trustFilingId, user);

        if (!trustFiling) {
            throw new Error('Trust filing not found or unauthorized');
        }

        await strapi.documents('api::trust-filing.trust-filing').delete({
            documentId: trustFiling.documentId
        });

        return { success: true };
    }
});
