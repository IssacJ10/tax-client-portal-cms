const request = require('supertest');
const { createStrapi } = require('@strapi/strapi');

describe('Profile Management Test', () => {
    let app;
    let jwt;
    let user;

    beforeAll(async () => {
        if (!process.env.STRAPI_TEST_INITIALIZED) {
            app = await createStrapi({ distDir: './dist' }).load();
            app.server.mount();
            process.env.STRAPI_TEST_INITIALIZED = 'true';
        } else {
            app = createStrapi({ distDir: './dist' });
        }

        // Create a user and login to get JWT
        const timestamp = Date.now();
        const userData = {
            username: `ProfileUser_${timestamp}`,
            email: `profile_${timestamp}@example.com`,
            password: 'Password123!',
            firstName: 'Original',
            lastName: 'Name'
        };

        let res = await request(strapi.server.httpServer)
            .post('/api/auth/local/register')
            .send(userData);

        jwt = res.body.jwt;
        user = res.body.user;
    });

    it('should allow user to update first and last name', async () => {
        const res = await request(strapi.server.httpServer)
            .put('/api/user/me')
            .set('Authorization', `Bearer ${jwt}`)
            .send({
                firstName: 'Updated',
                lastName: 'Person'
            });

        expect(res.status).toBe(200);
        expect(res.body.firstName).toBe('Updated');
        expect(res.body.lastName).toBe('Person');
    });

    it('should reject invalid characters in name', async () => {
        const res = await request(strapi.server.httpServer)
            .put('/api/user/me')
            .set('Authorization', `Bearer ${jwt}`)
            .send({
                firstName: 'Bad<script>',
            });

        expect(res.status).toBe(400); // ApplicationError maps to 400
    });

    it('should ignore attempts to update sensitive fields', async () => {
        const res = await request(strapi.server.httpServer)
            .put('/api/user/me')
            .set('Authorization', `Bearer ${jwt}`)
            .send({
                blocked: true,
                email: 'hacked@example.com'
            });

        expect(res.status).toBe(400);

        // Verify user is unchanged
        const check = await request(strapi.server.httpServer)
            .get('/api/users/me')
            .set('Authorization', `Bearer ${jwt}`);

        expect(check.body.email).toContain('profile_'); // Original email
        expect(check.body.blocked).toBeFalsy();
    });

    it('should allow password change via standard endpoint', async () => {
        const res = await request(strapi.server.httpServer)
            .post('/api/auth/change-password')
            .set('Authorization', `Bearer ${jwt}`)
            .send({
                currentPassword: 'Password123!',
                password: 'NewPassword123!',
                passwordConfirmation: 'NewPassword123!'
            });

        expect(res.status).toBe(200);

        // Verify login with new password
        const login = await request(strapi.server.httpServer)
            .post('/api/auth/local')
            .send({
                identifier: user.email,
                password: 'NewPassword123!'
            });

        expect(login.status).toBe(200);
        expect(login.body.jwt).toBeDefined();
    });

    it('should ignore attempts to change role or ID', async () => {
        // Create another user to try to impersonate (target)
        // We generally don't need a real other user, just any ID different from ours.
        const fakeTargetId = 99999;

        // Attempt to update:
        // 1. A different ID (spoofing)
        // 2. The role (privilege escalation)
        // 3. Valid name change (to verify the request actually processed)
        const res = await request(strapi.server.httpServer)
            .put('/api/user/me')
            .set('Authorization', `Bearer ${jwt}`)
            .send({
                id: fakeTargetId,
                role: 1, // Admin role usually
                firstName: 'HackerAttempt'
            });

        expect(res.status).toBe(200);

        // Verify:
        // 1. The response ID is STILL our original user's ID
        expect(res.body.id).toBe(user.id);
        expect(res.body.id).not.toBe(fakeTargetId);

        // 2. The role is NOT changed (we can check the user in DB or rely on response if role is returned)
        // Let's check the DB directly to be sure
        const updatedUser = await strapi.entityService.findOne('plugin::users-permissions.user', user.id, {
            populate: ['role']
        });

        expect(updatedUser.role.type).toBe('authenticated'); // Should remain 'authenticated'
        expect(updatedUser.firstName).toBe('HackerAttempt'); // Valid field SHOULD change
    });
});
