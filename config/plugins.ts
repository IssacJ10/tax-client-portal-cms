export default () => ({
    'users-permissions': {
        config: {
            register: {
                allowedFields: ['firstName', 'lastName'],
            },
            ratelimit: {
                interval: 60000,
                max: 100
            },
            jwt: {
                expiresIn: '1h',
            },
            email: {
                config: {
                    provider: 'nodemailer',
                    providerOptions: {
                        host: process.env.SMTP_HOST || 'localhost',
                        port: parseInt(process.env.SMTP_PORT || '1025'),
                        ignoreTLS: true,
                    },
                    settings: {
                        defaultFrom: 'no-reply@jjelevatetest.com',
                        defaultReplyTo: 'contact@jjelevatetest.com',
                    },
                },
            },
            'users-permissions': {
                config: {
                    jwt: {
                        expiresIn: '1h',
                    },
                    jwtSecret: process.env.JWT_SECRET || 'test-secret',
                }
            },
            providers: {
                google: {
                    enabled: true,
                    icon: 'google',
                    key: process.env.GOOGLE_CLIENT_ID,
                    secret: process.env.GOOGLE_CLIENT_SECRET,
                    callback: `${process.env.PUBLIC_URL || 'http://localhost:1337'}/api/connect/google/callback`,
                    scope: ['email', 'profile'],
                },
            },
        },
    },
    email: {
        config: {
            provider: 'nodemailer',
            providerOptions: {
                host: process.env.SMTP_HOST || 'smtp.example.com',
                port: process.env.SMTP_PORT || 587,
                auth: {
                    user: process.env.SMTP_USER || 'user@example.com',
                    pass: process.env.SMTP_PASS || 'password',
                },
                // ... any other options
            },
            settings: {
                defaultFrom: process.env.SMTP_FROM || 'hello@example.com',
                defaultReplyTo: process.env.SMTP_REPLY_TO || 'hello@example.com',
            },
        },
    },
});
