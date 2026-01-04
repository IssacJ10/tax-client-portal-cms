export default ({ env }) => ({
    auth: {
        secret: env('ADMIN_JWT_SECRET', 'test-admin-secret'),
    },
    apiToken: {
        salt: env('API_TOKEN_SALT', 'test-salt'),
    },
    transfer: {
        token: {
            salt: env('TRANSFER_TOKEN_SALT', 'test-salt'),
        },
    },
    flags: {
        nps: false,
        promoteEE: false,
    },
});
