export default ({ env }) => ({
    'users-permissions': {
        config: {
            register: {
                allowedFields: ['firstName', 'lastName'],
            },
            jwt: {
                expiresIn: '1h',
            },
            jwtSecret: env('JWT_SECRET', 'test-secret'),
        },
    },
});
