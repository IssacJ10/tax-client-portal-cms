/**
 * Custom routes for global API
 */

export default {
    routes: [
        {
            method: 'POST',
            path: '/email/test',
            handler: 'global.testEmail',
            config: {
                policies: [],
                middlewares: [],
            },
        },
    ],
};
