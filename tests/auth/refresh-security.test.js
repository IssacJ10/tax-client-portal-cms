const request = require('supertest');
const { expect, test, beforeAll, afterAll, describe } = require('@jest/globals');

let strapiInstance;
let jwt;
let refreshToken;
let user;

beforeAll(async () => {
    // Setup Strapi
    const Strapi = require('@strapi/strapi');
    strapiInstance = await Strapi.createStrapi({ distDir: './dist' }).load();
    await strapiInstance.server.mount();

    // Create a test user if not exists (or use existing)
    // Ideally, we create a fresh user for isolation
    const users = await strapiInstance.entityService.findMany('plugin::users-permissions.user', { limit: 1 });
    if (users.length > 0) {
        user = users[0];
    } else {
        // create user... (omitted for brevity, assuming seed data exists from previous steps)
        throw new Error('No users found for testing');
    }
});

afterAll(async () => {
    // await strapiInstance.destroy(); // Optional, sometimes causes handles to leak in watch mode
});

describe('Session Security (Refresh Tokens & Logout)', () => {

    test('1. Login should return JWT and Refresh Token (Version 1)', async () => {
        // We'll use the user we found, assume password is 'Password123!' or reset it
        // For this test, let's reset the password to be sure
        await strapiInstance.entityService.update('plugin::users-permissions.user', user.id, {
            data: { password: 'Password123!', tokenVersion: 1 }
        });

        const res = await request(strapiInstance.server.httpServer)
            .post('/api/auth/local')
            .send({
                identifier: user.email,
                password: 'Password123!',
            })
            .expect(200);

        expect(res.body).toHaveProperty('jwt');
        expect(res.body).toHaveProperty('refreshToken');

        jwt = res.body.jwt;
        refreshToken = res.body.refreshToken;

        // Decode to check version? (Optional, requires jwt-decode or just trusting API)
    });

    test('2. Refresh Token should grant new Access Token (Version 1)', async () => {
        const res = await request(strapiInstance.server.httpServer)
            .post('/api/token/refresh')
            .send({ refreshToken })
            .expect(200);

        expect(res.body).toHaveProperty('jwt');
        expect(res.body).toHaveProperty('refreshToken');

        // Update our tokens
        jwt = res.body.jwt;
        refreshToken = res.body.refreshToken;
    });

    test('3. Logout should succeed and increment Token Version', async () => {
        const res = await request(strapiInstance.server.httpServer)
            .post('/api/token/revoke')
            .set('Authorization', `Bearer ${jwt}`);

        if (res.status !== 200) {
            console.log('LOGOUT FAIL - Response:', res.status, res.text);
        }
        expect(res.status).toBe(200);

        expect(res.body.message).toBe('Logged out successfully');

        // Verify DB
        const dbUser = await strapiInstance.entityService.findOne('plugin::users-permissions.user', user.id);
        expect(dbUser.tokenVersion).toBe(2); // Was 1, now 2
    });

    test('4. ATTACK: Old Refresh Token (Version 1) should be REJECTED', async () => {
        // Try to use the refreshToken from step 2 (which encoded Version 1)
        // The user is now on Version 2.

        const res = await request(strapiInstance.server.httpServer)
            .post('/api/token/refresh')
            .send({ refreshToken }); // This is the old one

        if (res.status !== 400) {
            console.log('ATTACK FAIL - Response:', res.status, res.body, res.text);
        }
        expect(res.status).toBe(400);

        expect(res.text).toContain('Refresh token invalidated');
    });

});
