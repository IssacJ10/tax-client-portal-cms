export default () => ({
    'users-permissions': {
        config: {
            register: {
                allowedFields: ['firstName', 'lastName'],
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
