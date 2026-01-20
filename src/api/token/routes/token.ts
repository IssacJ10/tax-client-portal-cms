module.exports = {
    routes: [
        {
            method: 'POST',
            path: '/token/refresh',
            handler: 'token.refresh',
            config: {
                policies: [],
                middlewares: ['global::rate-limiter'], // Apply rate limiting
                auth: false, // Public endpoint, validated via token signature + IP-based rate limiting
                description: 'Refresh JWT token using refresh token',
            },
        },
        {
            method: 'POST',
            path: '/token/revoke',
            handler: 'logout.logout',
            config: {
                policies: [],
                middlewares: ['global::rate-limiter'],
                // SECURITY: Remove auth:false to use default authenticated behavior
                description: 'Revoke refresh token (logout)',
            },
        },
    ],
};
