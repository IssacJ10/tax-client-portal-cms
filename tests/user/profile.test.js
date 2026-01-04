const request = require('supertest');
const { expect, test, beforeAll, afterAll, describe } = require('@jest/globals');

let strapiInstance;
let jwt;
let user;

beforeAll(async () => {
    // Setup Strapi (Standardized Pattern)
    const Strapi = require('@strapi/strapi');
    strapiInstance = await Strapi.createStrapi({ distDir: './dist' }).load();
    await strapiInstance.server.mount();

    // Create a fresh user for this test suite
    const timestamp = Date.now();
    const userData = {
        username: `ProfileUser_${timestamp}`,
        email: `profile_${timestamp}@example.com`,
        password: 'Password123!',
        firstName: 'Original',
        lastName: 'Name'
    };

    // GRANT PERMISSIONS logic
    const authenticatedRole = await strapiInstance.entityService.findMany('plugin::users-permissions.role', {
        filters: { type: 'authenticated' },
        limit: 1
    });

    if (authenticatedRole && authenticatedRole.length > 0) {
        const role = authenticatedRole[0];

        // Use service to update role permissions (handles cache clearing)
        const roleService = strapiInstance.plugin('users-permissions').service('role');

        // Construct the permissions object tree for the update
        // This is complex: { permissions: { 'plugin::users-permissions': { controllers: { user: { updateMe: { enabled: true } } } } } }
        // Attempting a simpler way: direct permission creation + clear cache manually?

        // Let's try direct DB creation again, but verify cache clearing.
        // There isn't a simple public API to clear permission cache in v4 easily accessible here without deeper hacking.

        // ALTERNATIVE: Use the 'users-permissions' 'permission' service's 'find' to see if it's there.
        // But let's try to overwrite the role with the permission.

        // A commonly used workaround in tests:
        await strapiInstance.entityService.create('plugin::users-permissions.permission', {
            data: {
                action: 'plugin::users-permissions.user.updateMe',
                role: role.id
            }
        });

        // Manually trigger a reload of permissions if possible
        // strapi.plugin('users-permissions').service('permission').loadPermissions(); // Doesn't exist generally

        // HACK: Re-assign the role to the user? No, cache is global usually.
        // Let's try enabling it for PUBLIC too, maybe authenticated isn't picking up?
        // No, that's weak.

        // Let's assume the permission IS created but the Policy check fails?
        // Is 'policies: []' meaning "allow all"? No, it means "no extra policies, check permissions".
    }

    // Force strict reload of user permissions for the next request? 
    // They are fetched on login. Login gives JWT.
    // The JWT contains the ID. The backend fetches permissions on every request based on that ID's role.

    // Maybe the action name is wrong?
    // In strapi-server.ts: plugin.controllers.user.updateMe
    // So action is plugin::users-permissions.user.updateMe

    // Let's print the permissions to debug
    // console.log('Permissions:', await strapiInstance.entityService.findMany('plugin::users-permissions.permission', { filters: { role: authenticatedRole[0].id } }));

    let res = await request(strapiInstance.server.httpServer)
        .post('/api/auth/local/register')
        .send(userData);

    jwt = res.body.jwt;
    user = res.body.user;
});

afterAll(async () => {
    // await strapiInstance.destroy();
});

describe('Profile Management Test', () => {

    test('should allow user to update first and last name', async () => {
        const res = await request(strapiInstance.server.httpServer)
            .put('/api/users/me') // Corrected endpoint
            .set('Authorization', `Bearer ${jwt}`)
            .send({
                firstName: 'Updated',
                lastName: 'Person'
            });

        expect(res.status).toBe(200);
        expect(res.body.firstName).toBe('Updated');
        expect(res.body.lastName).toBe('Person');
    });

    test('should reject invalid characters in name', async () => {
        const res = await request(strapiInstance.server.httpServer)
            .put('/api/users/me')
            .set('Authorization', `Bearer ${jwt}`)
            .send({
                firstName: 'Bad<script>',
            });

        expect(res.status).toBe(400); // ApplicationError maps to 400
    });

    test('should ignore attempts to update sensitive fields', async () => {
        // Note: Our implementation manualy explicitly only allows firstName/lastName update
        // But let's verify blocking logic
        const res = await request(strapiInstance.server.httpServer)
            .put('/api/users/me')
            .set('Authorization', `Bearer ${jwt}`)
            .send({
                blocked: true,
                email: 'hacked@example.com'
            });

        // Current implementation throws "No valid fields" if only invalid fields are sent -> 400
        // Or if mixed, it ignores invalid.
        // Let's expect 400 since we only sent invalid fields.
        expect(res.status).toBe(400);

        // Verify user is unchanged
        const check = await request(strapiInstance.server.httpServer)
            .get('/api/users/me')
            .set('Authorization', `Bearer ${jwt}`);

        expect(check.body.email).toContain('profile_'); // Original email
        expect(check.body.blocked).not.toBe(true);
    });

    test('should allow password change via standard endpoint', async () => {
        const res = await request(strapiInstance.server.httpServer)
            .post('/api/auth/change-password')
            .set('Authorization', `Bearer ${jwt}`)
            .send({
                currentPassword: 'Password123!',
                password: 'NewPassword123!',
                passwordConfirmation: 'NewPassword123!'
            });

        expect(res.status).toBe(200);

        // Verify login with new password
        const login = await request(strapiInstance.server.httpServer)
            .post('/api/auth/local')
            .send({
                identifier: user.email,
                password: 'NewPassword123!'
            });

        expect(login.status).toBe(200);
        expect(login.body.jwt).toBeDefined();
    });

    test('should ignore attempts to change role or ID', async () => {
        const fakeTargetId = 99999;

        const res = await request(strapiInstance.server.httpServer)
            .put('/api/users/me')
            .set('Authorization', `Bearer ${jwt}`)
            .send({
                id: fakeTargetId,
                role: 1,
                firstName: 'HackerAttempt'
            });

        expect(res.status).toBe(200);

        // Verify ID is unchanged in response
        expect(res.body.id).toBe(user.id);
        expect(res.body.id).not.toBe(fakeTargetId);

        // Verify Role in DB
        const updatedUser = await strapiInstance.entityService.findOne('plugin::users-permissions.user', user.id, {
            populate: ['role']
        });
        expect(updatedUser.role.type).toBe('authenticated');
        expect(updatedUser.firstName).toBe('HackerAttempt');
    });
});
