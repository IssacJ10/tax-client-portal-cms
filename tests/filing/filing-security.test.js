const request = require('supertest');
const { createStrapi } = require('@strapi/strapi');

describe('Filing Security & Workflow', () => {
    let strapiInstance;
    let userA, jwtA;
    let userB, jwtB;
    let taxYear2024;

    beforeAll(async () => {
        // 1. Init Strapi
        strapiInstance = await createStrapi({ distDir: './dist' }).load();
        await strapiInstance.server.mount();

        // 2. Clear Database (Optional, but safer)
        // await strapiInstance.db.query('api::filing.filing').deleteMany({});

        // 3. Create Tax Year 2024
        const existingYear = await strapiInstance.entityService.findMany('api::tax-year.tax-year', { filters: { year: '2024' } });
        if (existingYear.length === 0) {
            taxYear2024 = await strapiInstance.entityService.create('api::tax-year.tax-year', {
                data: { year: '2024', isActive: true, isCurrent: true }
            });
        } else {
            taxYear2024 = existingYear[0];
        }

        // 4. Create User A
        const timestamp = Date.now();
        let resA = await request(strapiInstance.server.httpServer)
            .post('/api/auth/local/register')
            .send({
                username: `filerA_${timestamp}`,
                email: `filera_${timestamp}@example.com`,
                password: 'Password123!',
                firstName: 'Filer',
                lastName: 'A'
            });
        jwtA = resA.body.jwt;
        userA = resA.body.user;

        // 5. Create User B
        let resB = await request(strapiInstance.server.httpServer)
            .post('/api/auth/local/register')
            .send({
                username: `filerB_${timestamp}`,
                email: `filerb_${timestamp}@example.com`,
                password: 'Password123!',
                firstName: 'Filer',
                lastName: 'B'
            });
        jwtB = resB.body.jwt;
        userB = resB.body.user;

        // 6. Grant Permissions (Filing: create, find, findOne)
        const authenticatedRole = await strapiInstance.entityService.findMany('plugin::users-permissions.role', {
            filters: { type: 'authenticated' }
        });
        const permissions = [
            { action: 'api::filing.filing.create', role: authenticatedRole[0].id },
            { action: 'api::filing.filing.find', role: authenticatedRole[0].id },
            { action: 'api::filing.filing.findOne', role: authenticatedRole[0].id },
            { action: 'api::tax-year.tax-year.find', role: authenticatedRole[0].id },
            { action: 'api::tax-year.tax-year.findOne', role: authenticatedRole[0].id },
        ];
        for (const p of permissions) {
            await strapiInstance.entityService.create('plugin::users-permissions.permission', { data: p });
        }
    }, 60000);

    afterAll(async () => {
        await strapiInstance.server.httpServer.close();
        // await strapiInstance.destroy(); // Can cause race conditions in runInBand
    });

    it('User A should be able to create a filing for 2024', async () => {
        const res = await request(strapiInstance.server.httpServer)
            .post('/api/filings')
            .set('Authorization', `Bearer ${jwtA}`)
            .send({
                data: {
                    taxYear: taxYear2024.id,
                    status: 'In Progress'
                }
            });

        expect(res.status).toBe(200);
        const status = res.body.data.attributes ? res.body.data.attributes.status : res.body.data.status;
        expect(status).toBe('In Progress');
    });

    it('User A should NOT be able to create a DUPLICATE filing for 2024', async () => {
        const res = await request(strapiInstance.server.httpServer)
            .post('/api/filings')
            .set('Authorization', `Bearer ${jwtA}`)
            .send({
                data: {
                    taxYear: taxYear2024.id,
                    status: 'In Progress'
                }
            });

        // Expect 400 Bad Request due to our controller logic
        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain('already exists');
    });
    it('User B should NOT be able to see User A\'s filings', async () => {
        // 1. User B lists filings
        const res = await request(strapiInstance.server.httpServer)
            .get('/api/filings')
            .set('Authorization', `Bearer ${jwtB}`);

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(0); // Should be empty
    });

    it('User A should see their own filing', async () => {
        const res = await request(strapiInstance.server.httpServer)
            .get('/api/filings')
            .set('Authorization', `Bearer ${jwtA}`);

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
    });

});
