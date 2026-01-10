const request = require('supertest');
const { createStrapi } = require('@strapi/strapi');

describe('Full Schema Verification QA', () => {
    let strapiInstance;
    let user, jwt;
    let activeYearId;
    let inProgressStatusId;
    let personalFilingTypeId;

    // A comprehensive payload mimicking questions_v2.json
    const fullPayload = {
        filingType: 'PERSONAL', // Using string for backward compat logic helper
        taxYear: null, // Will be set in creating
        filingData: {
            personalInfo: {
                firstName: "QA",
                lastName: "Tester",
                middleName: "Automated",
                sin: "999-999-999",
                dateOfBirth: "1990-01-01",
                phoneNumber: "555-0199",
                email: "qa@example.com",
                address: {
                    streetNumber: "123",
                    streetName: "Test St",
                    city: "Testville",
                    province: "ON",
                    postalCode: "M1M 1M1"
                },
                maritalStatus: "MARRIED", // Direct string or object handling
                residency: {
                    provinceResided: "ON",
                    livedOutsideCanada: "NO",
                    becameResidentThisYear: "NO"
                }
            },
            spouse: {
                firstName: "SpouseQA",
                lastName: "Tester",
                sin: "888-888-888",
                dateOfBirth: "1992-02-02",
                netIncome: 50000,
                statusInCanada: "CANADIAN_CITIZEN",
                residencyStatus: "RESIDENT"
            },
            dependants: {
                list: [
                    {
                        firstName: "Kid1",
                        lastName: "Tester",
                        dateOfBirth: "2020-01-01",
                        relationship: "SON",
                        sin: "000-000-000"
                    }
                ]
            },
            // NEW SECTIONS
            rentalIncome: {
                propertyAddress: "1 Rental Rd",
                totalRentReceived: 12000,
                rentedFullYear: "YES",
                equipment: [
                    { assetName: "Washing Machine", purchaseDate: "2023-01-01", cost: 500 }
                ]
            },
            selfEmployment: {
                needsBookkeeping: "BOOKKEEPING",
                gstRegistered: "YES",
                gstNumber: "123456789RT0001",
                hasCapitalAssets: "YES",
                capitalAssets: [
                    { assetName: "Laptop", purchaseDate: "2023-05-01", cost: 1500 }
                ]
            },
            vehicleExpenses: {
                make: "Toyota",
                model: "Camry",
                year: 2022,
                totalKmDriven: 20000,
                kmDrivenForWork: 10000
            },
            homeOffice: {
                totalHomeSize: 2000,
                workAreaSize: 200,
                monthlyElectricity: 100
            },
            movingExpenses: {
                reason: "NEW_JOB",
                oldAddress: "Old Place",
                newAddress: "New Place",
                kmDrivenForMoving: 500
            },
            electionsCanada: {
                authorizeCRA: "YES",
                consentRegister: "YES"
            },
            propertyAssets: {
                purchasedPrincipalResidence: "YES",
                foreignPropertyOver100k: "NO"
            },
            disabilityCredit: {
                dependantName: "Grandma",
                affectedPersons: ["DEPENDANT"]
            },
            workExpenses: {
                categories: ["MEALS", "TRAVEL"]
            }
        }
    };

    beforeAll(async () => {
        try {
            strapiInstance = await createStrapi({ distDir: './dist' }).load();
            await strapiInstance.server.mount();

            // Create User via Entity Service (Bypasses API permissions/rate limits)
            const timestamp = Date.now();
            const random = Math.floor(Math.random() * 10000);

            // 1. Get authenticated role
            const authenticatedRole = await strapiInstance.entityService.findMany('plugin::users-permissions.role', { filters: { type: 'authenticated' } });
            const roleId = authenticatedRole[0].id;

            // 2. Create User
            user = await strapiInstance.entityService.create('plugin::users-permissions.user', {
                data: {
                    username: `qaUser_${timestamp}_${random}`,
                    email: `qa_${timestamp}_${random}@example.com`,
                    password: 'Password123!',
                    confirmed: true,
                    blocked: false,
                    role: roleId,
                    firstName: 'QA',
                    lastName: 'Bot',
                    hasConsentedToTerms: true
                }
            });

            // 3. Issue JWT
            jwt = strapiInstance.plugins['users-permissions'].services.jwt.issue({ id: user.id });

            // Setup Master Data
            const yearStr = (2090 + Math.floor(Math.random() * 90)).toString();
            const validYear = await strapiInstance.entityService.create('api::tax-year.tax-year', {
                data: { year: yearStr, isActive: true }
            });
            activeYearId = validYear.id;
            fullPayload.taxYear = activeYearId;

            // Status
            const inProgressStatus = await strapiInstance.entityService.findMany('api::filing-status.filing-status', {
                filters: { statusCode: 'IN_PROGRESS' }
            });
            inProgressStatusId = inProgressStatus[0]?.id;

            // Type
            const personalType = await strapiInstance.entityService.findMany('api::filing-type.filing-type', {
                filters: { type: 'PERSONAL' }
            });
            personalFilingTypeId = personalType[0]?.id;
            fullPayload.filingType = personalFilingTypeId;

            // Permissions
            // Reuse roleId from above
            await strapiInstance.entityService.create('plugin::users-permissions.permission', {
                data: { action: 'api::filing.filing.create', role: roleId }
            });
            await strapiInstance.entityService.create('plugin::users-permissions.permission', {
                data: { action: 'api::filing.filing.find', role: roleId }
            });
            await strapiInstance.entityService.create('plugin::users-permissions.permission', {
                data: { action: 'api::filing.filing.findOne', role: roleId }
            });

        } catch (e) {
            console.error("[QA SETUP FATAL ERROR]", e);
            throw e;
        }
    }, 120000);

    afterAll(async () => {
        await strapiInstance.server.httpServer.close();
    });

    test('Should persist ALL schema fields from payload', async () => {
        // 1. Create Filing via API
        const createRes = await request(strapiInstance.server.httpServer)
            .post('/api/filings')
            .set('Authorization', `Bearer ${jwt}`)
            .send({ data: fullPayload });

        expect(createRes.status).toBe(200);
        const filingId = createRes.body.data.id;
        const filingDocId = createRes.body.data.attributes.documentId;

        // 2. Fetch the "Personal Filing" entry directly via Entity Service to verify columns
        // The API returns the "Filing" wrapper, but we want to check the linked "PersonalFiling" details
        // Note: The controller logic ensures they are linked.

        const personalFilings = await strapiInstance.documents('api::personal-filing.personal-filing').findMany({
            filters: { filing: { documentId: filingDocId } },
            populate: [
                'spouse',
                'dependents',
                'rentalIncome',
                'rentalIncome.equipment',
                'selfEmployment',
                'selfEmployment.capitalAssets',
                'vehicleExpenses',
                'homeOffice',
                'movingExpenses',
                'electionsCanada',
                'propertyAssets',
                'disabilityCredit',
                'workExpenses'
            ]
        });

        expect(personalFilings.length).toBe(1);
        const pf = personalFilings[0];

        // --- VERIFICATIONS ---

        // spouse
        expect(pf.spouse).toBeDefined();
        expect(pf.spouse.firstName).toBe("SpouseQA");
        expect(pf.spouse.netIncome).toBe(50000); // The fix we just made
        expect(pf.spouse.statusInCanada).toBe("CANADIAN_CITIZEN");

        // dependents
        expect(pf.dependents.length).toBe(1);
        expect(pf.dependents[0].firstName).toBe("Kid1");

        // rentalIncome (Component)
        expect(pf.rentalIncome).toBeDefined();
        expect(pf.rentalIncome.totalRentReceived).toBe(12000);
        expect(pf.rentalIncome.rentedFullYear).toBe(true); // "YES" -> true conversion lookup
        expect(pf.rentalIncome.equipment.length).toBe(1);
        expect(pf.rentalIncome.equipment[0].assetName).toBe("Washing Machine");

        // selfEmployment
        expect(pf.selfEmployment).toBeDefined();
        expect(pf.selfEmployment.gstRegistered).toBe(true);
        expect(pf.selfEmployment.gstNumber).toBe("123456789RT0001");
        expect(pf.selfEmployment.capitalAssets.length).toBe(1);
        expect(pf.selfEmployment.capitalAssets[0].assetName).toBe("Laptop");

        // vehicleExpenses
        expect(pf.vehicleExpenses).toBeDefined();
        expect(pf.vehicleExpenses.make).toBe("Toyota");
        expect(pf.vehicleExpenses.totalKmDriven).toBe(20000);

        // homeOffice
        expect(pf.homeOffice).toBeDefined();
        expect(pf.homeOffice.totalHomeSize).toBe(2000);

        // movingExpenses
        expect(pf.movingExpenses).toBeDefined();
        expect(pf.movingExpenses.reason).toBe("NEW_JOB");
        expect(pf.movingExpenses.kmDrivenForMoving).toBe(500);

        // electionsCanada
        expect(pf.electionsCanada.authorizeCRA).toBe(true);

        // propertyAssets
        expect(pf.propertyAssets.purchasedPrincipalResidence).toBe(true);
        expect(pf.propertyAssets.foreignPropertyOver100k).toBe(false);

        // disabilityCredit
        expect(pf.disabilityCredit.dependantName).toBe("Grandma");

        // workExpenses
        expect(pf.workExpenses.categories).toContain("MEALS");

    });
});
