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

            const isAdmin = user.role?.type === 'admin_role' || user.role?.type === 'admin' || user.role?.name === 'Admin';

            console.log(`[Dashboard Find] User: ${user.email}, isAdmin: ${isAdmin}, Query: ${JSON.stringify(ctx.query)}`);

            // 1. Calculate GLOBAL stats (respecting ownership/admin but ignoring table filters)
            // Use limit: -1 to get all records, and populate taxYear for local calculations
            const allFilingsForStats = await strapi.entityService.findMany('api::filing.filing', {
                filters: {
                    ...(isAdmin ? {} : { user: { id: user.id } })
                },
                populate: {
                    filingStatus: { fields: ['statusCode'] },
                    taxYear: { fields: ['year'] }
                },
                limit: -1
            }) as any[];

            const stats = {
                totalFilings: allFilingsForStats.length,
                inProgress: allFilingsForStats.filter(f => f.filingStatus?.statusCode === 'IN_PROGRESS').length,
                submitted: allFilingsForStats.filter(f => ['SUBMITTED', 'UNDER_REVIEW'].includes(f.filingStatus?.statusCode)).length,
                completed: allFilingsForStats.filter(f => ['APPROVED', 'COMPLETED'].includes(f.filingStatus?.statusCode)).length
            };

            // 2. Fetch FILTERED and PAGINATED results for the table
            const paginationParams = (ctx.query.pagination as any) || {};
            const page = parseInt(paginationParams.page) || 1;
            const pageSize = parseInt(paginationParams.pageSize) || parseInt(paginationParams.limit) || 10;

            const { results: filings, pagination } = await strapi.entityService.findPage('api::filing.filing', {
                filters: {
                    ...(ctx.query.filters as any || {}),
                    ...(isAdmin ? {} : { user: { id: user.id } })
                },
                sort: ctx.query.sort || { updatedAt: 'desc' },
                pagination: { page, pageSize },
                populate: {
                    user: {
                        fields: ['firstName', 'lastName', 'email']
                    },
                    taxYear: {
                        fields: ['year', 'isActive', 'isCurrent', 'filingDeadline']
                    },
                    filingStatus: {
                        fields: ['statusCode', 'displayName']
                    },
                    filingType: {
                        fields: ['type', 'displayName']
                    }
                }
            });

            ctx.body = {
                data: {
                    stats,
                    filings: pageSize > 100 ? allFilingsForStats : filings
                },
                meta: {
                    pagination
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
            const filing: any = await strapi.documents('api::filing.filing').findOne({
                documentId: id,
                populate: [
                    'user',
                    'taxYear',
                    'filingStatus',
                    'filingType',
                    'personalFiling',
                    'personalFiling.spouse',
                    'personalFiling.dependents',
                    'personalFiling.electionsCanada',
                    'personalFiling.propertyAssets',
                    'personalFiling.disabilityCredit',
                    'personalFiling.workExpenses',
                    'personalFiling.homeOffice',
                    'personalFiling.vehicleExpenses',
                    'personalFiling.selfEmployment',
                    'personalFiling.rentalIncome',
                    'personalFiling.movingExpenses',
                    'corporateFiling',
                    'trustFiling'
                ]
            });

            if (!filing) {
                return ctx.notFound('Filing not found');
            }

            console.log(`[Dashboard findOne] Checking: ${id}, type: ${filing.filingType?.type}`);

            // AUTO-FIX: If sub-record is missing, create a seeded one
            const type = filing.filingType?.type;
            if (type === 'PERSONAL' && !filing.personalFiling) {
                console.log('[Dashboard findOne] Auto-fixing missing Personal Filing');
                filing.personalFiling = await strapi.documents('api::personal-filing.personal-filing').create({
                    data: {
                        filing: filing.documentId,
                        firstName: filing.user?.firstName || 'Auto',
                        lastName: filing.user?.lastName || 'Generated',
                        email: filing.user?.email || 'auto@example.com',
                        maritalStatus: 'SINGLE',
                        employmentStatus: 'Full-time'
                    }
                });
            } else if (type === 'CORPORATE' && !filing.corporateFiling) {
                console.log('[Dashboard findOne] Auto-fixing missing Corporate Filing');
                filing.corporateFiling = await strapi.documents('api::corporate-filing.corporate-filing').create({
                    data: {
                        filing: filing.documentId,
                        legalName: (filing.entityName || 'Auto Corp') + ' (T2)',
                        businessNumber: 'BN-AUTO-REPAIR',
                        incorporationDate: '2020-01-01'
                    }
                });
            } else if (type === 'TRUST' && !filing.trustFiling) {
                console.log('[Dashboard findOne] Auto-fixing missing Trust Filing');
                filing.trustFiling = await strapi.documents('api::trust-filing.trust-filing').create({
                    data: {
                        filing: filing.documentId,
                        trustName: (filing.entityName || 'Auto Trust') + ' (T3)',
                        accountNumber: 'T-AUTO-REPAIR',
                        creationDate: '2022-01-01'
                    }
                });
            }

            // Check ownership (unless admin)
            const isAdmin = user.role?.type === 'admin_role' || user.role?.type === 'admin' || user.role?.name === 'Admin';
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
            const existingFiling: any = await strapi.documents('api::filing.filing').findOne({
                documentId: id,
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

            // Handle filingStatus if it's a string (map statusCode to ID)
            if (data.filingStatus && typeof data.filingStatus === 'string') {
                const status = await strapi.entityService.findMany('api::filing-status.filing-status', {
                    filters: { statusCode: data.filingStatus },
                    limit: 1
                });
                if (status && status.length > 0) {
                    data.filingStatus = status[0].id;
                }
            }

            // Update the filing
            const updatedFiling = await strapi.documents('api::filing.filing').update({
                documentId: id,
                data,
                populate: {
                    user: {
                        fields: ['firstName', 'lastName', 'email']
                    },
                    taxYear: {
                        fields: ['year', 'isActive', 'isCurrent', 'filingDeadline']
                    },
                    filingStatus: {
                        fields: ['statusCode', 'displayName', 'color']
                    },
                    filingType: {
                        fields: ['type', 'displayName']
                    }
                }
            });

            ctx.body = { data: updatedFiling };
        } catch (err) {
            console.error('Dashboard update error:', err);
            ctx.throw(500, 'Failed to update filing');
        }
    },

    async migrateRelationships(ctx) {
        try {
            console.log('🔄 Starting relation migration...');
            let pCount = 0, cCount = 0, tCount = 0;

            // 1. Personal
            const pFs = await strapi.documents('api::personal-filing.personal-filing').findMany({
                populate: ['filing']
            });
            console.log(`Found ${pFs.length} Personal Filings`);
            for (const pf of pFs) {
                if (pf.filing) {
                    await strapi.documents('api::filing.filing').update({
                        documentId: pf.filing.documentId,
                        data: { personalFiling: pf.documentId }
                    });
                    pCount++;
                }
            }

            // 2. Corporate
            const cFs = await strapi.documents('api::corporate-filing.corporate-filing').findMany({
                populate: ['filing']
            });
            console.log(`Found ${cFs.length} Corporate Filings`);
            for (const cf of cFs) {
                if (cf.filing) {
                    await strapi.documents('api::filing.filing').update({
                        documentId: cf.filing.documentId,
                        data: { corporateFiling: cf.documentId }
                    });
                    cCount++;
                }
            }

            // 3. Trust
            const tFs = await strapi.documents('api::trust-filing.trust-filing').findMany({
                populate: ['filing']
            });
            console.log(`Found ${tFs.length} Trust Filings`);
            for (const tf of tFs) {
                if (tf.filing) {
                    await strapi.documents('api::filing.filing').update({
                        documentId: tf.filing.documentId,
                        data: { trustFiling: tf.documentId }
                    });
                    tCount++;
                }
            }

            ctx.body = { success: true, migrated: { personal: pCount, corporate: cCount, trust: tCount } };
        } catch (err) {
            console.error('Migration error:', err);
            ctx.throw(500, `Migration failed: ${err.message}`);
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

            // Get active tax years and categories
            const [years, categories] = await Promise.all([
                strapi.entityService.findMany('api::tax-year.tax-year', {
                    filters: { isActive: true },
                    sort: { year: 'desc' },
                    fields: ['year', 'isActive', 'isCurrent', 'filingDeadline']
                }),
                strapi.entityService.findMany('api::filing-type.filing-type', {
                    filters: { isActive: true },
                    fields: ['type', 'displayName']
                })
            ]);

            ctx.body = {
                data: {
                    years,
                    categories
                }
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

            console.log('[CONSENT] Attempting to update user:', user.id);

            // Update the user's consent status using Document Service (Strapi v5)
            const updatedUser = await strapi.documents('plugin::users-permissions.user').update({
                documentId: user.documentId || user.id.toString(),
                data: {
                    hasConsentedToTerms: true,
                    consentDate: new Date().toISOString(),
                },
            });

            console.log('[CONSENT] User updated successfully:', updatedUser?.id);

            ctx.body = {
                success: true,
                message: 'Consent recorded successfully',
            };
        } catch (err) {
            console.error('[CONSENT ERROR]', err.message, err.stack);
            ctx.throw(500, `Failed to record consent: ${err.message}`);
        }
    }
};