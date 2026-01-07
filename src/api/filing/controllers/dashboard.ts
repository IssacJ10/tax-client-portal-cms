/**
 * Dashboard Controller - Custom endpoints for user dashboard
 */

export default {
    /**
     * GET /dashboard/filings
     * Get all filings for the authenticated user
     */
    async find(ctx) {
        try {
            const user = ctx.state.user;
            if (!user) {
                return ctx.unauthorized('You must be logged in to access the dashboard');
            }

            // Get user's filings with tax year relation
            const filings = await strapi.entityService.findMany('api::filing.filing', {
                filters: {
                    user: user.id
                },
                populate: {
                    taxYear: {
                        fields: ['year', 'isActive', 'isCurrent', 'filingDeadline']
                    }
                },
                sort: { updatedAt: 'desc' }
            });

            // Calculate overall stats
            const stats = {
                totalFilings: filings.length,
                inProgress: filings.filter(f => f.filingStatus === 'In Progress').length,
                submitted: filings.filter(f => ['Submitted', 'Under Review'].includes(f.filingStatus)).length,
                completed: filings.filter(f => ['Approved', 'Completed'].includes(f.filingStatus)).length
            };

            ctx.body = {
                data: {
                    stats,
                    filings
                }
            };
        } catch (err) {
            console.error('Dashboard find error:', err);
            ctx.throw(500, 'Failed to fetch dashboard data');
        }
    },

    /**
     * GET /dashboard/filings/:id
     * Get a single filing by ID
     */
    async findOne(ctx) {
        try {
            const user = ctx.state.user;
            if (!user) {
                return ctx.unauthorized('You must be logged in');
            }

            const { id } = ctx.params;

            // Fetch the filing (cast to any for populated relations)
            const filing: any = await strapi.entityService.findOne('api::filing.filing', id, {
                populate: {
                    user: {
                        fields: ['id', 'username', 'email']
                    },
                    taxYear: {
                        fields: ['year', 'isActive', 'isCurrent', 'filingDeadline', 'filingQuestions', 'corporateQuestions', 'trustQuestions']
                    }
                }
            });

            if (!filing) {
                return ctx.notFound('Filing not found');
            }

            // Check ownership (unless admin)
            const isAdmin = user.role?.type === 'admin' || user.role?.name === 'Admin';
            const isOwner = filing.user?.id === user.id;

            if (!isAdmin && !isOwner) {
                return ctx.forbidden('You do not have permission to access this filing');
            }

            ctx.body = { data: filing };
        } catch (err) {
            console.error('Dashboard findOne error:', err);
            ctx.throw(500, 'Failed to fetch filing');
        }
    },

    /**
     * PUT /dashboard/filings/:id
     * Update a filing
     */
    async update(ctx) {
        try {
            const user = ctx.state.user;
            if (!user) {
                return ctx.unauthorized('You must be logged in');
            }

            const { id } = ctx.params;
            const { data } = ctx.request.body;

            // First, fetch the existing filing to check ownership (cast to any for populated relations)
            const existingFiling: any = await strapi.entityService.findOne('api::filing.filing', id, {
                populate: {
                    user: {
                        fields: ['id']
                    }
                }
            });

            if (!existingFiling) {
                return ctx.notFound('Filing not found');
            }

            // Check ownership (unless admin)
            const isAdmin = user.role?.type === 'admin' || user.role?.name === 'Admin';
            const isOwner = existingFiling.user?.id === user.id;

            if (!isAdmin && !isOwner) {
                return ctx.forbidden('You do not have permission to update this filing');
            }

            // Prevent changing ownership or tax year
            delete data.user;
            delete data.taxYear;

            // Update the filing
            const updatedFiling = await strapi.entityService.update('api::filing.filing', id, {
                data,
                populate: {
                    taxYear: {
                        fields: ['year', 'isActive', 'isCurrent', 'filingDeadline']
                    }
                }
            });

            ctx.body = { data: updatedFiling };
        } catch (err) {
            console.error('Dashboard update error:', err);
            ctx.throw(500, 'Failed to update filing');
        }
    },

    /**
     * GET /dashboard/tax-years
     * Get active tax years for new filings
     */
    async getTaxYears(ctx) {
        try {
            const user = ctx.state.user;
            if (!user) {
                return ctx.unauthorized('You must be logged in');
            }

            // Get active tax years
            const activeTaxYears = await strapi.entityService.findMany('api::tax-year.tax-year', {
                filters: {
                    isActive: true
                },
                sort: { year: 'desc' },
                fields: ['year', 'isActive', 'isCurrent', 'filingDeadline']
            });

            ctx.body = {
                data: activeTaxYears
            };
        } catch (err) {
            console.error('Dashboard getTaxYears error:', err);
            ctx.throw(500, 'Failed to fetch tax years');
        }
    },

    /**
     * POST /dashboard/consent
     * Record user consent to terms
     */
    async confirmConsent(ctx) {
        try {
            const user = ctx.state.user;
            if (!user) {
                return ctx.unauthorized('You must be logged in to confirm consent.');
            }

            // Update the user's consent status
            const updatedUser = await strapi.entityService.update(
                'plugin::users-permissions.user',
                user.id,
                {
                    data: {
                        hasConsentedToTerms: true,
                        consentDate: new Date().toISOString(),
                    },
                }
            );

            // Sanitize the user output
            const sanitizedUser = await strapi
                .plugin('users-permissions')
                .service('user')
                .sanitizeOutput(updatedUser, ctx);

            ctx.body = {
                success: true,
                user: sanitizedUser,
            };
        } catch (err) {
            console.error('Dashboard confirmConsent error:', err);
            ctx.throw(500, 'Failed to record consent');
        }
    }
};