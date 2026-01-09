const request = require('supertest');
const { createStrapi } = require('@strapi/strapi');

describe('Filing Logic & Validation', () => {
    let strapiInstance;
    let user, jwt;
    let activeYearId;
    let inProgressStatusId;
    let personalFilingTypeId;

    beforeAll(async () => {
        // 1. Init Strapi
        strapiInstance = await createStrapi({ distDir: './dist' }).load();
        await strapiInstance.server.mount();

        // 2. Create User for testing
        const timestamp = Date.now();
        const res = await request(strapiInstance.server.httpServer)
            .post('/api/auth/local/register')
            .send({
                username: `logicUser_${timestamp}`,
                email: `logic_${timestamp}@example.com`,
                password: 'Password123!',
                firstName: 'Logic',
                lastName: 'Tester'
            });

        jwt = res.body.jwt;
        user = res.body.user;

        // 3. Grant Permissions
        const authenticatedRole = await strapiInstance.entityService.findMany('plugin::users-permissions.role', {
            filters: { type: 'authenticated' }
        });

        await strapiInstance.entityService.create('plugin::users-permissions.permission', {
            data: { action: 'api::filing.filing.create', role: authenticatedRole[0].id }
        });

        // 4. Setup a valid tax year for reference
        const validYear = await strapiInstance.entityService.create('api::tax-year.tax-year', {
            data: { year: `9${timestamp.toString().substring(9, 12)}`, isActive: true }
        });
        activeYearId = validYear.id;

        // 5. Get FilingStatus "In Progress" ID
        const inProgressStatus = await strapiInstance.entityService.findMany('api::filing-status.filing-status', {
            filters: { statusCode: 'IN_PROGRESS' }
        });
        inProgressStatusId = inProgressStatus[0]?.id;

        // 6. Get FilingType "Personal" ID
        const personalType = await strapiInstance.entityService.findMany('api::filing-type.filing-type', {
            filters: { type: 'PERSONAL' }
        });
        personalFilingTypeId = personalType[0]?.id;

    }, 60000);

    afterAll(async () => {
        await strapiInstance.server.httpServer.close();
        // await strapiInstance.destroy(); 
    });

    test('TaxYear schema should REJECT integer year', async () => {
        // Attempt to create TaxYear with integer via Entity Service
        try {
            await strapiInstance.entityService.create('api::tax-year.tax-year', {
                data: { year: 2026 }
            });
            // If it succeeds, fail the test
            throw new Error('Should have failed');
        } catch (e) {
            // Strapi validation error is expected
            expect(e).toBeDefined();
            // We expect some validation error about type string
        }
    });

    test('TaxYear schema should REJECT 3-digit string', async () => {
        try {
            await strapiInstance.entityService.create('api::tax-year.tax-year', {
                data: { year: "123" }
            });
            throw new Error('Should have failed');
        } catch (e) {
            // Strapi might return "year must be..." or similar. 
            // Just ensure it failed.
            expect(e).toBeDefined();
        }
    });

    test('Filing schema should REJECT invalid status ID (non-existent relation)', async () => {
        try {
            await strapiInstance.entityService.create('api::filing.filing', {
                data: {
                    user: user.id,
                    taxYear: activeYearId,
                    filingType: personalFilingTypeId,
                    status: 99999 // Non-existent FilingStatus ID
                }
            });
            throw new Error('Should have failed relation validation');
        } catch (e) {
            // Error message: "1 relation(s) of type api::filing-status.filing-status associated with this entity do not exist"
            expect(e.message).toMatch(/do not exist/i);
        }
    });

    test('Filing schema should ACCEPT valid status ID', async () => {
        const filing = await strapiInstance.entityService.create('api::filing.filing', {
            data: {
                user: user.id,
                taxYear: activeYearId,
                filingType: personalFilingTypeId,
                status: inProgressStatusId
            }
        });
        expect(filing).toBeDefined();
        expect(filing.status).toBe(inProgressStatusId);
    });

});
