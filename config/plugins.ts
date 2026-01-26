export default () => ({
    // Disable Strapi Cloud plugin
    cloud: {
        enabled: false,
    },
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
                        host: process.env.SMTP_HOST || 'smtp.sendgrid.net',
                        port: parseInt(process.env.SMTP_PORT || '587'),
                        secure: false,
                        auth: {
                            user: process.env.SMTP_USER || 'apikey',
                            pass: process.env.SENDGRID_API_KEY || process.env.SMTP_PASS,
                        },
                    },
                    settings: {
                        defaultFrom: process.env.SMTP_FROM || 'noreply@jjelevate.com',
                        defaultReplyTo: process.env.SMTP_REPLY_TO || 'support@jjelevate.com',
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
                host: process.env.SMTP_HOST || 'smtp.sendgrid.net',
                port: parseInt(process.env.SMTP_PORT || '587'),
                secure: false, // true for 465, false for other ports
                auth: {
                    user: process.env.SMTP_USER || 'apikey', // SendGrid uses 'apikey' as username
                    pass: process.env.SENDGRID_API_KEY || process.env.SMTP_PASS,
                },
            },
            settings: {
                defaultFrom: process.env.SMTP_FROM || 'noreply@jjelevate.com',
                defaultReplyTo: process.env.SMTP_REPLY_TO || 'support@jjelevate.com',
            },
        },
    },
});
