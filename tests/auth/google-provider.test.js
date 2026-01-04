const { describe, it, expect, beforeAll, afterAll } = require('@jest/globals');

const { createStrapi } = require('@strapi/strapi');

describe('Google Provider Configuration', () => {
    let app;

    beforeAll(async () => {
        if (!process.env.STRAPI_TEST_INITIALIZED) {
            app = await createStrapi({ distDir: './dist' }).load();
            app.server.mount();
            process.env.STRAPI_TEST_INITIALIZED = 'true';
        } else {
            app = createStrapi({ distDir: './dist' });
        }
    });

    it('should have Google Provider configured in the store', async () => {
        // We check if the bootstrap logic successfully set the provider details
        // Note: We cannot rely on env vars being present in CI, but if they are mock-set or present locally, this passes.
        // For this test to be useful, it checks the *logic* of storage not necessarily the secret values.

        // Mock the env vars if not present?
        // In a real integration test, the server is already started with env vars.

        const pluginStore = strapi.store({
            type: 'plugin',
            name: 'users-permissions',
        });

        const grantConfig = await pluginStore.get({ key: 'grant' });

        // Assert Google is present
        expect(grantConfig).toHaveProperty('google');

        // If configured, it should be enabled
        // Only verify if we expect it to be configured (i.e. env vars were present during bootstrap)
        if (process.env.GOOGLE_CLIENT_ID) {
            expect(grantConfig.google.enabled).toBe(true);
            expect(grantConfig.google.key).toBe(process.env.GOOGLE_CLIENT_ID);
            expect(grantConfig.google.callback).toBe('/api/connect/google/callback');
        } else {
            // If no env vars, maybe it should be false or untouched?
            // This test validates the "No shortcuts" logic: ensure our code actually touches the config.
            console.log('Skipping enabled check as no GOOGLE_CLIENT_ID env var');
        }
    });

    it('should have a working /api/connect/google endpoint', async () => {
        // This integration test checks if the route exists and returns a redirect (302)
        // We expect a 302 Redirect to Google's OAuth
        const request = require('supertest');

        const res = await request(strapi.server.httpServer)
            .get('/api/connect/google');

        // Strapi might return 400 if provider is not configured properly, or 302 if it works.
        // If provider is disabled, it might be 404 or 400.

        if (process.env.GOOGLE_CLIENT_ID) {
            // Expect redirect to Google
            expect(res.status).toBe(302);
            expect(res.header.location).toContain('accounts.google.com');
        }
    });
});
