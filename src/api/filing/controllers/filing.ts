/**
 * filing controller
 */

import { factories } from '@strapi/strapi'

// --- HELPER FUNCTIONS ---
const clean = (val: any) => (val === "" || val === undefined ? null : val);

const yesNoToBool = (val: any) => (val === 'YES' || val === 'Yes' || val === true) ? true : ((val === 'NO' || val === 'No' || val === false) ? false : null);

const splitName = (fullName: string) => {
    if (!fullName) return { firstName: null, lastName: null };
    const parts = fullName.trim().split(' ');
    return {
        firstName: parts[0],
        lastName: parts.slice(1).join(' ') || null
    };
};

const extractValue = (source: any, key: string) => {
    if (source?.[key] && typeof source[key] === 'object' && source[key].status) {
        return source[key].status;
    }
    if (source?.[key] && typeof source[key] === 'object' && source[key].value) {
        return source[key].value;
    }
    return source?.[key];
};

const mapPersonalFilingData = (filingData: any) => {
    if (!filingData) return {};
    const fd = filingData;
    const personalInfo = fd.personalInfo || {};

    // SPOUSE
    let mappedSpouse = null;
    const spousePayload = fd.spouse;
    if (spousePayload && (spousePayload.fullName || spousePayload.firstName)) {
        const { firstName, lastName } = spousePayload.firstName
            ? { firstName: spousePayload.firstName, lastName: spousePayload.lastName }
            : splitName(spousePayload.fullName);

        mappedSpouse = {
            firstName: clean(firstName),
            lastName: clean(lastName),
            middleName: clean(spousePayload.middleName),
            sin: clean(spousePayload.sin),
            birthDate: clean(spousePayload.dateOfBirth),
            phoneNumber: clean(spousePayload.phoneNumber),
            netIncome: clean(spousePayload.netIncome),
            statusInCanada: clean(spousePayload.statusInCanada),
            residencyStatus: ['RESIDENT', 'NON_RESIDENT'].includes(spousePayload.residencyStatus) ? spousePayload.residencyStatus : null,
            incomeOutsideCanada: ['Yes', 'No'].includes(spousePayload.incomeOutsideCanada) ? spousePayload.incomeOutsideCanada : null
        };
    }

    // DEPENDENTS
    const rawDependents = fd.dependants?.list || fd.dependents?.list || [];
    const mappedDependents = Array.isArray(rawDependents) ? rawDependents.map((dep: any) => {
        const { firstName, lastName } = dep.firstName
            ? { firstName: dep.firstName, lastName: dep.lastName }
            : splitName(dep.fullName);

        return {
            firstName: clean(firstName),
            lastName: clean(lastName),
            middleName: clean(dep.middleName),
            birthDate: clean(dep.dateOfBirth),
            sin: clean(dep.sin),
            relationship: clean(dep.relationship)
        };
    }) : [];

    // NEW COMPONENTS
    const mappedElections = fd.electionsCanada ? {
        authorizeCRA: yesNoToBool(fd.electionsCanada.authorizeCRA),
        consentRegister: yesNoToBool(fd.electionsCanada.consentRegister)
    } : null;

    const pa = fd.propertyAssets;
    const mappedPropertyAssets = pa ? {
        purchasedPrincipalResidence: yesNoToBool(pa.purchasedPrincipalResidence),
        disposedPrincipalResidence: yesNoToBool(pa.disposedPrincipalResidence),
        foreignPropertyOver100k: yesNoToBool(pa.foreignPropertyOver100k),
        foreignAffiliate: yesNoToBool(pa.foreignAffiliate)
    } : null;

    const mappedDisability = fd.disabilityCredit ? {
        affectedPersons: fd.disabilityCredit.affectedPersons,
        dependantName: clean(fd.disabilityCredit.dependantName)
    } : null;

    const mappedWorkExpenses = fd.workExpenses ? {
        categories: fd.workExpenses.categories,
        expenseTypes: fd.workExpenses.expenseTypes
    } : null;

    const ho = fd.homeOffice;
    const mappedHomeOffice = ho ? {
        totalHomeSize: clean(ho.totalHomeSize),
        workAreaSize: clean(ho.workAreaSize),
        monthlyRent: clean(ho.monthlyRent),
        monthlyMortgageInterest: clean(ho.monthlyMortgageInterest),
        monthlyPropertyTax: clean(ho.monthlyPropertyTax),
        monthlyInsurance: clean(ho.monthlyInsurance),
        monthlyElectricity: clean(ho.monthlyElectricity),
        monthlyWater: clean(ho.monthlyWater),
        monthlyHeat: clean(ho.monthlyHeat),
        monthlyInternet: clean(ho.monthlyInternet),
        monthlyOtherUtilities: clean(ho.monthlyOtherUtilities),
        monthlyCleaningSupplies: clean(ho.monthlyCleaningSupplies),
        monthlyMinorRepairs: clean(ho.monthlyMinorRepairs),
        monthlyOtherMaintenance: clean(ho.monthlyOtherMaintenance)
    } : null;

    const ve = fd.vehicleExpenses;
    const mappedVehicleExpenses = ve ? {
        make: clean(ve.make),
        model: clean(ve.model),
        year: clean(ve.year),
        purchaseDate: clean(ve.purchaseDate),
        purchaseCost: clean(ve.purchaseCost),
        totalKmDriven: clean(ve.totalKmDriven),
        kmDrivenThisYear: clean(ve.kmDrivenThisYear),
        kmDrivenForWork: clean(ve.kmDrivenForWork),
        uccStartOfYear: clean(ve.uccStartOfYear),
        monthlyFuel: clean(ve.monthlyFuel),
        monthlyInsurance: clean(ve.monthlyInsurance),
        monthlyMaintenance: clean(ve.monthlyMaintenance),
        monthlyLicense: clean(ve.monthlyLicense),
        monthlyParking: clean(ve.monthlyParking),
        monthlyLease: clean(ve.monthlyLease),
        monthlyLoanInterest: clean(ve.monthlyLoanInterest),
        monthlyRides: clean(ve.monthlyRides),
        monthlyOther: clean(ve.monthlyOther)
    } : null;

    const se = fd.selfEmployment;
    const mappedSelfEmployment = se ? {
        needsBookkeeping: clean(se.needsBookkeeping),
        expenseCategories: se.expenseCategories,
        gstRegistered: yesNoToBool(se.gstRegistered),
        gstNumber: clean(se.gstNumber),
        hasCapitalAssets: yesNoToBool(se.hasCapitalAssets),
        capitalAssets: Array.isArray(se.capitalAssets) ? se.capitalAssets.map((ca: any) => ({
            assetName: clean(ca.assetName),
            purchaseDate: clean(ca.purchaseDate),
            cost: clean(ca.cost)
        })) : []
    } : null;

    const ri = fd.rentalIncome;
    const mappedRentalIncome = ri ? {
        propertyAddress: clean(ri.propertyAddress),
        propertyType: clean(ri.propertyType),
        ownershipPercentage: clean(ri.ownershipPercentage),
        rentalStartDate: clean(ri.rentalStartDate),
        rentedFullYear: yesNoToBool(ri.rentedFullYear),
        personalUse: yesNoToBool(ri.personalUse),
        totalRentReceived: clean(ri.totalRentReceived),
        expenses: clean(ri.expenses),
        ccaClaims: clean(ri.ccaClaims),
        equipment: Array.isArray(ri.equipment) ? ri.equipment.map((eq: any) => ({
            assetName: clean(eq.assetName),
            purchaseDate: clean(eq.purchaseDate),
            cost: clean(eq.cost)
        })) : []
    } : null;

    const me = fd.movingExpenses;
    const mappedMovingExpenses = me ? {
        reason: clean(me.reason),
        oldAddress: clean(me.oldAddress),
        newAddress: clean(me.newAddress),
        dateOfMove: clean(me.dateOfMove),
        dateStartedJob: clean(me.dateStartedJob),
        transportCost: clean(me.transportCost),
        travelCost: clean(me.travelCost),
        temporaryLivingCost: clean(me.temporaryLivingCost),
        costOfSellingOldHome: clean(me.costOfSellingOldHome),
        costOfPurchasingNewHome: clean(me.costOfPurchasingNewHome),
        addressChangeCost: clean(me.addressChangeCost),
        kmDrivenForMoving: clean(me.kmDrivenForMoving)
    } : null;

    return {
        firstName: clean(personalInfo.firstName),
        lastName: clean(personalInfo.lastName),
        middleName: clean(personalInfo.middleName),
        sin: clean(personalInfo.sin),
        birthDate: clean(personalInfo.dateOfBirth),
        phoneNumber: clean(personalInfo.phoneNumber),
        streetNumber: clean(personalInfo.address?.streetNumber || personalInfo.streetNumber),
        streetName: clean(personalInfo.address?.streetName || personalInfo.streetName),
        apartmentNumber: clean(personalInfo.address?.apartmentNumber || personalInfo.apartmentNumber),
        city: clean(personalInfo.address?.city || personalInfo.city),
        province: clean(personalInfo.address?.province || personalInfo.province),
        postalCode: clean(personalInfo.address?.postalCode || personalInfo.postalCode),

        maritalStatus: extractValue(personalInfo, 'maritalStatus'),
        maritalStatusChangedDate: clean(personalInfo.maritalStatusChangedDate),

        provinceResided: extractValue(personalInfo.residency, 'provinceResided'),
        livedOutsideCanada: (extractValue(personalInfo.residency, 'livedOutsideCanada') === 'YES' ? 'YES' : 'NO') as any,
        becameResidentThisYear: (extractValue(personalInfo.residency, 'becameResidentThisYear') === 'YES' ? 'YES' : 'NO') as any,
        dateOfEntry: clean(personalInfo.residency?.dateOfEntry),

        // CHILDREN & COMPONENTS
        spouse: mappedSpouse,
        dependents: mappedDependents,
        electionsCanada: mappedElections,
        propertyAssets: mappedPropertyAssets,
        disabilityCredit: mappedDisability,
        workExpenses: mappedWorkExpenses,
        homeOffice: mappedHomeOffice,
        vehicleExpenses: mappedVehicleExpenses,
        selfEmployment: mappedSelfEmployment,
        rentalIncome: mappedRentalIncome,
        movingExpenses: mappedMovingExpenses,

        // JSON ARRAYS
        incomeSources: fd.income?.sources || personalInfo.incomeSources,
        deductionSources: fd.deductions?.sources || personalInfo.deductionSources,
        taxSlips: personalInfo.taxSlips, // If exists in payload
        additionalDocs: personalInfo.additionalDocs // If exists in payload
    };
}


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
                filingStatus: requestData.filingStatus || 'published' // Ensure status ID is passed if provided
            },
            populate: ['filingStatus', 'filingType', 'taxYear']
        });

        // HANDLE PERSONAL FILING DATA PERSISTENCE
        // HANDLE DATA PERSISTENCE BASED ON TYPE
        try {
            if (filingTypeStr === 'PERSONAL') {
                const mappedData = mapPersonalFilingData(requestData.filingData);
                await strapi.documents('api::personal-filing.personal-filing').create({
                    data: {
                        filing: newFiling.documentId,
                        formData: requestData.filingData || {},
                        ...mappedData
                    }
                });
            } else if (filingTypeStr === 'CORPORATE') {
                const corpData = requestData.filingData?.corpInfo || {};
                await strapi.documents('api::corporate-filing.corporate-filing').create({
                    data: {
                        filing: newFiling.documentId,
                        legalName: corpData.legalName || requestData.entityName || 'Unknown Corp',
                        businessNumber: corpData.businessNumber || 'PENDING',
                        address: corpData.address,
                        incorporationDate: corpData.incorporationDate,
                        fiscalYearEnd: corpData.fiscalYearEnd,
                        formData: requestData.filingData || {}
                    }
                });
            } else if (filingTypeStr === 'TRUST') {
                const trustData = requestData.filingData?.trustInfo || {};
                await strapi.documents('api::trust-filing.trust-filing').create({
                    data: {
                        filing: newFiling.documentId,
                        trustName: trustData.name || requestData.entityName || 'Unknown Trust',
                        accountNumber: trustData.accountNumber || 'PENDING',
                        creationDate: trustData.creationDate,
                        residency: trustData.residency,
                        formData: requestData.filingData || {}
                    }
                });
            }
        } catch (err) {
            console.error(`[CONTROLLER ERROR] Failed to create ${filingTypeStr} filing data:`, err);
        }

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
            populate: ['taxYear', 'filingStatus', 'filingType'] // Added master data relations
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
            populate: ['user', 'taxYear', 'filingStatus', 'filingType'] // Added master data relations
        });

        if (results && results.length > 0) {
            entity = results[0];
        } else {
            // Second try: use findOne with documentId (works for UUID documentIds)
            try {
                entity = await strapi.documents('api::filing.filing').findOne({
                    documentId: id,
                    populate: ['user', 'taxYear', 'filingStatus', 'filingType'] // Added master data relations
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
            populate: ['user', 'filingType']
        });

        if (results && results.length > 0) {
            entity = results[0];
        } else {
            // Second try: use findOne with documentId
            try {
                entity = await strapi.documents('api::filing.filing').findOne({
                    documentId: id,
                    populate: ['user', 'filingType']
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
            filingStatus: data.filingStatus, // Renamed status -> filingStatus
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
            populate: ['filingStatus', 'filingType'] // Populate relations in return
        });

        // ==========================================
        //  PERSONAL FILING SAVING LOGIC
        // ==========================================
        // ==========================================
        //  FILING DATA PERSISTENCE LOGIC
        // ==========================================
        const filingTypeStr = entity.filingType?.type || 'PERSONAL'; // Default if Not Populated (careful)
        console.log('[CONTROLLER] Persistence Logic - Type:', filingTypeStr);
        console.log('[CONTROLLER] Persistence Logic - Has Data:', !!data.filingData);

        try {
            if (filingTypeStr === 'PERSONAL' && data.filingData) {
                // PERSONAL
                console.log('[CONTROLLER] Processing PERSONAL filing data...');
                const relatedItems = await strapi.documents('api::personal-filing.personal-filing').findMany({
                    filters: { filing: { documentId: entity.documentId } }, limit: 1
                });
                console.log('[CONTROLLER] Found related personal filing:', relatedItems.length);
                const personalData = data.filingData.personalInfo || {};
                // The frontend sends address fields FLATTENED in personalInfo, not nested in an address object.
                // We handle both just in case, but prioritize the flattened version as seen in the payload.
                const address = personalData.address || personalData;

                // Helper to clean empty strings to null (Strapi validation hates "" for dates/enums)
                const clean = (val: any) => (val === "" || val === undefined ? null : val);
                const yesNoToBool = (val: any) => (val === 'YES' || val === 'Yes' || val === true) ? true : ((val === 'NO' || val === 'No' || val === false) ? false : null);

                // Helper to split fullName into firstName/lastName if needed
                const splitName = (fullName: string) => {
                    if (!fullName) return { firstName: null, lastName: null };
                    const parts = fullName.trim().split(' ');
                    return {
                        firstName: parts[0],
                        lastName: parts.slice(1).join(' ') || null
                    };
                };

                // Helper to extract value from potentially nested object (e.g. maritalStatus.status)
                const extractValue = (source: any, key: string) => {
                    if (source?.[key] && typeof source[key] === 'object' && source[key].status) {
                        return source[key].status; // Handle { status: "SINGLE" }
                    }
                    if (source?.[key] && typeof source[key] === 'object' && source[key].value) {
                        return source[key].value; // Handle { value: "..." }
                    }
                    return source?.[key]; // Handle direct value "SINGLE"
                };

                // TRANSFORM SPOUSE DATA
                let mappedSpouse = null;
                const spousePayload = data.filingData.spouse;
                if (spousePayload && (spousePayload.fullName || spousePayload.firstName)) {
                    const { firstName, lastName } = spousePayload.firstName
                        ? { firstName: spousePayload.firstName, lastName: spousePayload.lastName }
                        : splitName(spousePayload.fullName);

                    mappedSpouse = {
                        firstName: clean(firstName),
                        lastName: clean(lastName),
                        middleName: clean(spousePayload.middleName),
                        sin: clean(spousePayload.sin),
                        birthDate: clean(spousePayload.dateOfBirth),
                        phoneNumber: clean(spousePayload.phoneNumber),
                        netIncome: clean(spousePayload.netIncome),
                        statusInCanada: clean(spousePayload.statusInCanada),
                        residencyStatus: ['RESIDENT', 'NON_RESIDENT'].includes(spousePayload.residencyStatus) ? spousePayload.residencyStatus : null,
                        incomeOutsideCanada: ['Yes', 'No'].includes(spousePayload.incomeOutsideCanada) ? spousePayload.incomeOutsideCanada : null
                    };
                }

                // TRANSFORM DEPENDENTS DATA
                const rawDependents = data.filingData.dependants?.list || data.filingData.dependents?.list || [];
                const mappedDependents = Array.isArray(rawDependents) ? rawDependents.map((dep: any) => {
                    const { firstName, lastName } = dep.firstName
                        ? { firstName: dep.firstName, lastName: dep.lastName }
                        : splitName(dep.fullName);

                    return {
                        firstName: clean(firstName),
                        lastName: clean(lastName),
                        middleName: clean(dep.middleName),
                        birthDate: clean(dep.dateOfBirth),
                        sin: clean(dep.sin),
                        relationship: clean(dep.relationship)
                    };
                }) : [];

                // NEW COMPONENT MAPPINGS
                const fd = data.filingData;

                const mappedElections = fd.electionsCanada ? {
                    authorizeCRA: yesNoToBool(fd.electionsCanada.authorizeCRA),
                    consentRegister: yesNoToBool(fd.electionsCanada.consentRegister)
                } : null;

                const pa = fd.propertyAssets;
                const mappedPropertyAssets = pa ? {
                    purchasedPrincipalResidence: yesNoToBool(pa.purchasedPrincipalResidence),
                    disposedPrincipalResidence: yesNoToBool(pa.disposedPrincipalResidence),
                    foreignPropertyOver100k: yesNoToBool(pa.foreignPropertyOver100k),
                    foreignAffiliate: yesNoToBool(pa.foreignAffiliate)
                } : null;

                const mappedDisability = fd.disabilityCredit ? {
                    affectedPersons: fd.disabilityCredit.affectedPersons,
                    dependantName: clean(fd.disabilityCredit.dependantName)
                } : null;

                const mappedWorkExpenses = fd.workExpenses ? {
                    categories: fd.workExpenses.categories,
                    expenseTypes: fd.workExpenses.expenseTypes
                } : null;

                const ho = fd.homeOffice;
                const mappedHomeOffice = ho ? {
                    totalHomeSize: clean(ho.totalHomeSize),
                    workAreaSize: clean(ho.workAreaSize),
                    monthlyRent: clean(ho.monthlyRent),
                    monthlyMortgageInterest: clean(ho.monthlyMortgageInterest),
                    monthlyPropertyTax: clean(ho.monthlyPropertyTax),
                    monthlyInsurance: clean(ho.monthlyInsurance),
                    monthlyElectricity: clean(ho.monthlyElectricity),
                    monthlyWater: clean(ho.monthlyWater),
                    monthlyHeat: clean(ho.monthlyHeat),
                    monthlyInternet: clean(ho.monthlyInternet),
                    monthlyOtherUtilities: clean(ho.monthlyOtherUtilities),
                    monthlyCleaningSupplies: clean(ho.monthlyCleaningSupplies),
                    monthlyMinorRepairs: clean(ho.monthlyMinorRepairs),
                    monthlyOtherMaintenance: clean(ho.monthlyOtherMaintenance)
                } : null;

                const ve = fd.vehicleExpenses;
                const mappedVehicleExpenses = ve ? {
                    make: clean(ve.make),
                    model: clean(ve.model),
                    year: clean(ve.year),
                    purchaseDate: clean(ve.purchaseDate),
                    purchaseCost: clean(ve.purchaseCost),
                    totalKmDriven: clean(ve.totalKmDriven),
                    kmDrivenThisYear: clean(ve.kmDrivenThisYear),
                    kmDrivenForWork: clean(ve.kmDrivenForWork),
                    uccStartOfYear: clean(ve.uccStartOfYear),
                    monthlyFuel: clean(ve.monthlyFuel),
                    monthlyInsurance: clean(ve.monthlyInsurance),
                    monthlyMaintenance: clean(ve.monthlyMaintenance),
                    monthlyLicense: clean(ve.monthlyLicense),
                    monthlyParking: clean(ve.monthlyParking),
                    monthlyLease: clean(ve.monthlyLease),
                    monthlyLoanInterest: clean(ve.monthlyLoanInterest),
                    monthlyRides: clean(ve.monthlyRides),
                    monthlyOther: clean(ve.monthlyOther)
                } : null;

                const se = fd.selfEmployment;
                const mappedSelfEmployment = se ? {
                    needsBookkeeping: clean(se.needsBookkeeping),
                    expenseCategories: se.expenseCategories,
                    gstRegistered: yesNoToBool(se.gstRegistered),
                    gstNumber: clean(se.gstNumber),
                    hasCapitalAssets: yesNoToBool(se.hasCapitalAssets),
                    capitalAssets: Array.isArray(se.capitalAssets) ? se.capitalAssets.map((ca: any) => ({
                        assetName: clean(ca.assetName),
                        purchaseDate: clean(ca.purchaseDate),
                        cost: clean(ca.cost)
                    })) : []
                } : null;

                const ri = fd.rentalIncome;
                const mappedRentalIncome = ri ? {
                    propertyAddress: clean(ri.propertyAddress),
                    propertyType: clean(ri.propertyType),
                    ownershipPercentage: clean(ri.ownershipPercentage),
                    rentalStartDate: clean(ri.rentalStartDate),
                    rentedFullYear: yesNoToBool(ri.rentedFullYear),
                    personalUse: yesNoToBool(ri.personalUse),
                    totalRentReceived: clean(ri.totalRentReceived),
                    otherRentalIncome: clean(ri.otherRentalIncome),
                    expenseCategories: ri.expenseCategories,
                    claimCCA: yesNoToBool(ri.claimCCA),
                    purchasePrice: clean(ri.purchasePrice),
                    purchaseDate: clean(ri.purchaseDate),
                    buildingValue: clean(ri.buildingValue),
                    priorCCAClaimed: clean(ri.priorCCAClaimed),
                    totalHomeSize: clean(ri.totalHomeSize),
                    rentalAreaSize: clean(ri.rentalAreaSize),
                    equipment: Array.isArray(ri.equipment) ? ri.equipment.map((eq: any) => ({
                        assetName: clean(eq.assetName),
                        purchaseDate: clean(eq.purchaseDate),
                        cost: clean(eq.cost)
                    })) : []
                } : null;

                const me = fd.movingExpenses;
                const mappedMovingExpenses = me ? {
                    reason: clean(me.reason),
                    oldAddress: clean(me.oldAddress),
                    oldCityProvince: clean(me.oldCityProvince),
                    newAddress: clean(me.newAddress),
                    newCityProvince: clean(me.newCityProvince),
                    moveDate: clean(me.moveDate),
                    workStartDate: clean(me.workStartDate),
                    transportExpenses: me.transportExpenses,
                    travelExpenses: me.travelExpenses,
                    tempLivingExpenses: me.tempLivingExpenses,
                    homeExpenses: me.homeExpenses,
                    otherExpenses: me.otherExpenses,
                    usedVehicle: yesNoToBool(me.usedVehicle),
                    vehicleInfo: clean(me.vehicleInfo),
                    kmDrivenForMoving: clean(me.kmDrivenForMoving)
                } : null;

                const mappedData = {
                    // Identity
                    firstName: clean(personalData.firstName),
                    middleName: clean(personalData.middleName),
                    lastName: clean(personalData.lastName),
                    dateOfBirth: clean(personalData.dateOfBirth),
                    sin: clean(personalData.sin),

                    // Contact
                    email: clean(personalData.email || personalData.emailAddress), // Handle both keys
                    phoneNumber: clean(personalData.phoneNumber),

                    // Address (Map from flattened 'personalData' or nested 'address')
                    streetNumber: clean(address.streetNumber),
                    streetName: clean(address.streetName),
                    apartmentNumber: clean(address.apartmentNumber),
                    city: clean(address.city),
                    province: address.province?.code || address.province || null, // Handle object or string
                    postalCode: clean(address.postalCode),

                    // Status & Residency
                    currentAddress: clean(personalData.currentAddress),
                    previousAddress: clean(personalData.previousAddress),
                    isFirstTimeFiler: clean(personalData.isFirstTimeFiler),
                    statusInCanada: clean(personalData.statusInCanada),
                    dateBecameResident: clean(personalData.dateBecameResident),
                    provinceResided: clean(data.filingData.residency?.provinceResided || personalData.provinceResided), // From root residency obj
                    livedOutsideCanada: clean(data.filingData.residency?.livedOutsideCanada || personalData.livedOutsideCanada),
                    countryOfResidence: clean(personalData.countryOfResidence),
                    becameResidentThisYear: clean(data.filingData.residency?.becameResidentThisYear || personalData.becameResidentThisYear),
                    worldIncome: clean(personalData.worldIncome),

                    // Marital Status (Fix: Handle { status: "SINGLE" })
                    maritalStatus: clean(extractValue(data.filingData, 'maritalStatus') || personalData.maritalStatus),
                    maritalStatusChanged: clean(personalData.maritalStatusChanged),
                    maritalStatusChangeDate: clean(personalData.maritalStatusChangeDate),

                    // Spouse (Component)
                    spouse: mappedSpouse,

                    // Dependents (Component)
                    dependents: mappedDependents,
                    dependentsCount: mappedDependents.length,

                    // Family Members
                    hasFamilyMembers: clean(data.filingData.filingSetup?.hasFamilyMembers),

                    // Employment & Newcomer
                    employmentStatus: clean(personalData.employmentStatus),
                    employmentDetails: clean(personalData.employmentDetails),
                    movedInYear: clean(personalData.movedInYear),
                    arrivalDateCanada: clean(personalData.arrivalDateCanada),
                    workedOutsideCanada: clean(personalData.workedOutsideCanada),
                    amountOutsideCanada: clean(personalData.amountOutsideCanada),

                    // Financial & Deductions
                    directDeposit: clean(personalData.directDeposit),
                    directDepositInfo: clean(personalData.directDepositInfo),
                    medicalExpenses: clean(personalData.medicalExpenses),
                    donations: clean(personalData.donations),
                    rrsp: clean(personalData.rrsp),
                    workFromHome: clean(personalData.workFromHome),

                    // NEW MAPPED SECTIONS
                    electionsCanada: mappedElections,
                    propertyAssets: mappedPropertyAssets,
                    disabilityCredit: mappedDisability,
                    workExpenses: mappedWorkExpenses,
                    homeOffice: mappedHomeOffice,
                    vehicleExpenses: mappedVehicleExpenses,
                    selfEmployment: mappedSelfEmployment,
                    rentalIncome: mappedRentalIncome,
                    movingExpenses: mappedMovingExpenses,

                    // JSON Arrays
                    incomeSources: data.filingData.income?.sources || personalData.incomeSources,
                    deductionSources: data.filingData.deductions?.sources || personalData.deductionSources,
                    taxSlips: personalData.taxSlips,
                    additionalDocs: personalData.additionalDocs,

                    // Full Blob Backup
                    formData: data.filingData
                };

                console.log('[CONTROLLER] Mapped Personal Data:', JSON.stringify(mappedData, null, 2));

                if (relatedItems.length > 0) {
                    await strapi.documents('api::personal-filing.personal-filing').update({
                        documentId: relatedItems[0].documentId, data: mappedData
                    });
                    console.log('[CONTROLLER] SUCCESS: Updated PersonalFiling ' + relatedItems[0].documentId);
                } else {
                    await strapi.documents('api::personal-filing.personal-filing').create({
                        data: { filing: entity.documentId, ...mappedData }
                    });
                    console.log('[CONTROLLER] SUCCESS: Created new PersonalFiling');
                }

            } else if (filingTypeStr === 'CORPORATE' && data.filingData) {
                // CORPORATE
                const relatedItems = await strapi.documents('api::corporate-filing.corporate-filing').findMany({
                    filters: { filing: entity.documentId }, limit: 1
                });
                const corpData = data.filingData.corpInfo || {};
                const mappedData = {
                    legalName: corpData.legalName || entity.entityName,
                    businessNumber: corpData.businessNumber,
                    address: corpData.address,
                    incorporationDate: corpData.incorporationDate,
                    fiscalYearEnd: corpData.fiscalYearEnd,
                    formData: data.filingData
                };

                if (relatedItems.length > 0) {
                    await strapi.documents('api::corporate-filing.corporate-filing').update({
                        documentId: relatedItems[0].documentId, data: mappedData
                    });
                } else {
                    await strapi.documents('api::corporate-filing.corporate-filing').create({
                        data: {
                            filing: entity.documentId,
                            legalName: mappedData.legalName || 'Unknown Corp',
                            businessNumber: mappedData.businessNumber || 'PENDING',
                            ...mappedData
                        }
                    });
                }

            } else if (filingTypeStr === 'TRUST' && data.filingData) {
                // TRUST
                const relatedItems = await strapi.documents('api::trust-filing.trust-filing').findMany({
                    filters: { filing: entity.documentId }, limit: 1
                });
                const trustData = data.filingData.trustInfo || {};
                const mappedData = {
                    trustName: trustData.name || entity.entityName,
                    accountNumber: trustData.accountNumber,
                    creationDate: trustData.creationDate,
                    residency: trustData.residency,
                    formData: data.filingData
                };

                if (relatedItems.length > 0) {
                    await strapi.documents('api::trust-filing.trust-filing').update({
                        documentId: relatedItems[0].documentId, data: mappedData
                    });
                } else {
                    await strapi.documents('api::trust-filing.trust-filing').create({
                        data: {
                            filing: entity.documentId,
                            trustName: mappedData.trustName || 'Unknown Trust',
                            accountNumber: mappedData.accountNumber || 'PENDING',
                            ...mappedData
                        }
                    });
                }
            }
        } catch (err) {
            console.error(`[CONTROLLER ERROR] Failed to sync ${filingTypeStr} data:`, err);
        }
        // ==========================================

        // Verify and read back via document service
        const verified: any = await strapi.documents('api::filing.filing').findOne({
            documentId: entity.documentId,
            populate: ['user', 'taxYear', 'filingStatus', 'filingType'] // Added master data relations
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
