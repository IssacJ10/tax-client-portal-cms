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

        // Programmatically enable Google provider for this test
        const pluginStore = strapi.store({
            type: 'plugin',
            name: 'users-permissions',
        });

        const grantConfig = await pluginStore.get({ key: 'grant' }) || {};

        await pluginStore.set({
            key: 'grant',
            value: {
                ...grantConfig,
                google: {
                    enabled: true,
                    icon: 'google',
                    key: 'mock-google-client-id',
                    secret: 'mock-google-client-secret',
                    callback: '/api/connect/google/callback',
                    scope: ['email', 'profile'],
                },
            },
        });
    });

    it('should have Google Provider configured in the store', async () => {
        const pluginStore = strapi.store({
            type: 'plugin',
            name: 'users-permissions',
        });

        const grantConfig = await pluginStore.get({ key: 'grant' });

        expect(grantConfig).toHaveProperty('google');
        expect(grantConfig.google.enabled).toBe(true);
        expect(grantConfig.google.key).toBe('mock-google-client-id');
    });

    it('should have a working /api/connect/google endpoint', async () => {
        const request = require('supertest');

        const res = await request(strapi.server.httpServer)
            .get('/api/connect/google');

        // Expect redirect to Google (302)
        expect(res.status).toBe(302);
        expect(res.header.location).toContain('accounts.google.com');
        expect(res.header.location).toContain('mock-google-client-id');
    });
});
