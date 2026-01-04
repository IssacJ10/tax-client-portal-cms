module.exports = {
    routes: [
        {
            method: 'POST',
            path: '/token/refresh',
            handler: 'token.refresh',
            config: {
                policies: [],
                middlewares: [],
                auth: false, // Public endpoint, validated via token signature
            },
        },
        {
            method: 'POST',
            path: '/token/revoke',
            handler: 'logout.logout',
            config: {
                policies: [],
                middlewares: [],
            },
        },
    ],
};
