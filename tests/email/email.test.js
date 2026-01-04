const request = require('supertest');
const { createStrapi } = require('@strapi/strapi');

describe('Email Notification Test', () => {
    let app;

    beforeAll(async () => {
        // Initialize Strapi if not already
        if (!process.env.STRAPI_TEST_INITIALIZED) {
            app = await createStrapi({ distDir: './dist' }).load();
            app.server.mount();
            process.env.STRAPI_TEST_INITIALIZED = 'true';
        } else {
            app = createStrapi({ distDir: './dist' });
        }
    });

    it('should invoke email send service on user registration', async () => {
        // Spy on the email service
        const emailService = strapi.plugin('email').service('email');
        // We mock implementation to avoid actual sending (and errors if config is dummy)
        const sendSpy = jest.spyOn(emailService, 'send').mockImplementation((emailOptions) => {
            console.log('\n--- EMAIL CAPTURED ---');
            console.log('To:', emailOptions.to);
            console.log('Subject:', emailOptions.subject);
            console.log('Text:', emailOptions.text);
            console.log('HTML:', emailOptions.html);
            console.log('----------------------\n');
            return Promise.resolve();
        });

        const res = await request(strapi.server.httpServer)
            .post('/api/auth/local/register')
            .send({
                username: `EmailTestUser_${Date.now()}`, // Unique username
                email: `emailtest_${Date.now()}@example.com`,
                password: 'Password123!',
                firstName: 'Email',
                lastName: 'Test'
            });

        expect(res.status).toBe(200);

        // Strapi sends email asynchronously.
        // In unit tests, we can expect the spy to be called.
        expect(sendSpy).toHaveBeenCalled();
        expect(sendSpy).toHaveBeenCalledWith(expect.objectContaining({
            to: expect.stringMatching(/@example.com/),
            subject: 'User Registration Successful',
            text: expect.stringContaining('Welcome to JJ Elevate Tax Portal'),
        }));

        sendSpy.mockRestore();
    });
});
