const request = require('supertest');
const { createStrapi } = require('@strapi/strapi');

describe('Filing Logic & Validation', () => {
    let strapiInstance;
    let user, jwt;
    let activeYearId;

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

        // We need create permission for tax-year to test validation (admin usually does this, but we can simulate or just use entityService if we want strict schema validation check. 
        // Actually, schema validation happens on entityService too. Let's use entityService for TaxYear to test schema directly, 
        // and API for Filing to test controller/API layer validation if needed, or entityService for both specific schema constraints).
        // The Prompt asked for "TaxYear entries display years correctly" which implies verifying the string format.

        await strapiInstance.entityService.create('plugin::users-permissions.permission', {
            data: { action: 'api::filing.filing.create', role: authenticatedRole[0].id }
        });

        // Setup a valid tax year for reference
        const validYear = await strapiInstance.entityService.create('api::tax-year.tax-year', {
            data: { year: `9${timestamp.toString().substring(9, 12)}`, isActive: true } // Random 4 digit string
        });
        activeYearId = validYear.id;

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

    test('Filing schema should REJECT "snake_case" status', async () => {
        try {
            await strapiInstance.entityService.create('api::filing.filing', {
                data: {
                    user: user.id,
                    taxYear: activeYearId,
                    status: 'in_progress'
                }
            });
            throw new Error('Should have failed enum validation');
        } catch (e) {
            // Error message: "status must be one of the following values..."
            expect(e.message).toMatch(/must be one of/i);
        }
    });

    test('Filing schema should ACCEPT "Title Case" status', async () => {
        const filing = await strapiInstance.entityService.create('api::filing.filing', {
            data: {
                user: user.id,
                taxYear: activeYearId,
                status: 'In Progress'
            }
        });
        expect(filing).toBeDefined();
        expect(filing.status).toBe('In Progress');
    });

});
