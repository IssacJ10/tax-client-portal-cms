/**
 * Corporate Filing Service Wrapper
 *
 * Handles corporate-filing (T2) operations including:
 * - Creating corporate-filing records
 * - Updating formData on wizard progression
 * - Querying corporate-filings by filing
 */

export default () => ({
    /**
     * Create a corporate-filing record
     * Called when user starts a new corporate tax filing
     */
    async createCorporateFiling(filingDocumentId: string, initialData: any = {}) {
        // Validate filing exists
        const filing = await strapi.documents('api::filing.filing').findOne({
            documentId: filingDocumentId
        });

        if (!filing) {
            throw new Error('Filing not found');
        }

        // Create corporate-filing
        const corporateFiling = await strapi.documents('api::corporate-filing.corporate-filing').create({
            data: {
                filing: filingDocumentId,
                formData: initialData.formData || {},
                // Set initial status to DRAFT (only becomes COMPLETED on submission)
                corporateFilingStatus: 'DRAFT',
                // Optional initial fields from schema
                legalName: initialData.legalName || 'New Corporation',
                businessNumber: initialData.businessNumber || '',
                address: initialData.address || null,
                incorporationDate: initialData.incorporationDate || null,
                fiscalYearEnd: initialData.fiscalYearEnd || null,
                shareholders: initialData.shareholders || null,
                totalRevenue: initialData.totalRevenue || null,
                netIncome: initialData.netIncome || null,
                expenses: initialData.expenses || null,
                financialStatements: initialData.financialStatements || null,
            }
        });

        return corporateFiling;
    },

    /**
     * Update formData for a corporate-filing
     * Called on each wizard "next" button click
     */
    async updateFormData(corporateFilingId: string, formData: any, user: any) {
        // Permission check: Verify user owns the parent filing
        const corporateFiling = await this.findOneWithPermissions(corporateFilingId, user);

        if (!corporateFiling) {
            throw new Error('Corporate filing not found or unauthorized');
        }

        // Merge existing formData with new data (don't overwrite everything)
        const existingFormData = corporateFiling.formData || {};
        const mergedFormData = {
            ...existingFormData,
            ...formData
        };

        // Extract top-level fields from formData for direct schema mapping
        const updateData: any = {
            formData: mergedFormData
        };

        // Map known fields from formData to schema fields
        if (mergedFormData['corpInfo.legalName']) {
            updateData.legalName = mergedFormData['corpInfo.legalName'];
        }
        if (mergedFormData['corpInfo.businessNumber']) {
            updateData.businessNumber = mergedFormData['corpInfo.businessNumber'];
        }
        if (mergedFormData['corpInfo.address']) {
            updateData.address = mergedFormData['corpInfo.address'];
        }
        if (mergedFormData['corpInfo.incorporationDate']) {
            updateData.incorporationDate = mergedFormData['corpInfo.incorporationDate'];
        }
        if (mergedFormData['corpInfo.fiscalYearEnd']) {
            updateData.fiscalYearEnd = mergedFormData['corpInfo.fiscalYearEnd'];
        }
        if (mergedFormData['shareholders']) {
            updateData.shareholders = mergedFormData['shareholders'];
        }
        if (mergedFormData['financials.totalRevenue']) {
            updateData.totalRevenue = mergedFormData['financials.totalRevenue'];
        }
        if (mergedFormData['financials.netIncome']) {
            updateData.netIncome = mergedFormData['financials.netIncome'];
        }
        if (mergedFormData['financials.expenses.salaries']) {
            updateData.expensesSalaries = mergedFormData['financials.expenses.salaries'];
        }
        if (mergedFormData['financials.expenses.rent']) {
            updateData.expensesRent = mergedFormData['financials.expenses.rent'];
        }
        if (mergedFormData['financials.expenses.professionalFees']) {
            updateData.expensesProfessionalFees = mergedFormData['financials.expenses.professionalFees'];
        }
        if (mergedFormData['financials.expenses.other']) {
            updateData.expensesOther = mergedFormData['financials.expenses.other'];
        }
        if (mergedFormData['documents.financialStatements']) {
            updateData.financialStatements = mergedFormData['documents.financialStatements'];
        }

        // Update corporate-filing
        const updated = await strapi.documents('api::corporate-filing.corporate-filing').update({
            documentId: corporateFiling.documentId,
            data: updateData
        });

        return updated;
    },

    /**
     * Find all corporate-filings for a given filing
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

        // Find all corporate-filings for this filing
        const corporateFilings = await strapi.documents('api::corporate-filing.corporate-filing').findMany({
            filters: {
                filing: { documentId: filingDocumentId }
            }
        });

        return corporateFilings;
    },

    /**
     * Find one corporate-filing with permission check
     */
    async findOneWithPermissions(id: string | number, user: any) {
        let entity: any;

        // Try numeric ID first
        const results = await strapi.documents('api::corporate-filing.corporate-filing').findMany({
            filters: { id: id },
            populate: ['filing', 'filing.user']
        });

        if (results && results.length > 0) {
            entity = results[0];
        } else {
            // Try documentId
            try {
                entity = await strapi.documents('api::corporate-filing.corporate-filing').findOne({
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
     * Mark corporate-filing as complete
     */
    async markComplete(corporateFilingId: string, user: any) {
        const corporateFiling = await this.findOneWithPermissions(corporateFilingId, user);

        if (!corporateFiling) {
            throw new Error('Corporate filing not found or unauthorized');
        }

        const updated = await strapi.documents('api::corporate-filing.corporate-filing').update({
            documentId: corporateFiling.documentId,
            data: {
                corporateFilingStatus: 'COMPLETED'
            }
        });

        return updated;
    },

    /**
     * Delete a corporate-filing
     */
    async deleteCorporateFiling(corporateFilingId: string, user: any) {
        const corporateFiling = await this.findOneWithPermissions(corporateFilingId, user);

        if (!corporateFiling) {
            throw new Error('Corporate filing not found or unauthorized');
        }

        await strapi.documents('api::corporate-filing.corporate-filing').delete({
            documentId: corporateFiling.documentId
        });

        return { success: true };
    }
});
