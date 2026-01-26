/**
 * Email Provider Configuration
 * Supports: 'google' (Google Workspace), 'sendgrid', 'brevo', 'ses'
 * Set EMAIL_PROVIDER env var to switch providers
 *
 * Google Workspace: Use with App Password (free with Workspace subscription)
 * SendGrid Free: 100 emails/day
 * Brevo Free: 300 emails/day
 * Amazon SES: $0.10 per 1,000 emails (free if sent from EC2)
 */
const getEmailConfig = () => {
    const provider = (process.env.EMAIL_PROVIDER || 'google').toLowerCase();

    // Provider-specific defaults
    const providerDefaults = {
        google: {
            host: 'smtp.gmail.com',
            port: 587,
            user: process.env.GOOGLE_SMTP_USER || process.env.SMTP_USER, // Google Workspace email (e.g., noreply@jjelevate.com)
            pass: process.env.GOOGLE_APP_PASSWORD || process.env.SMTP_PASS, // App Password from Google Account
        },
        gmail: { // Alias for google
            host: 'smtp.gmail.com',
            port: 587,
            user: process.env.GOOGLE_SMTP_USER || process.env.SMTP_USER,
            pass: process.env.GOOGLE_APP_PASSWORD || process.env.SMTP_PASS,
        },
        sendgrid: {
            host: 'smtp.sendgrid.net',
            port: 587,
            user: 'apikey', // SendGrid always uses 'apikey' as username
            pass: process.env.SENDGRID_API_KEY || process.env.SMTP_PASS,
        },
        brevo: {
            host: 'smtp-relay.brevo.com',
            port: 587,
            user: process.env.BREVO_USER || process.env.SMTP_USER, // Brevo login email
            pass: process.env.BREVO_API_KEY || process.env.SMTP_PASS,
        },
        ses: {
            host: process.env.AWS_SES_REGION
                ? `email-smtp.${process.env.AWS_SES_REGION}.amazonaws.com`
                : 'email-smtp.ca-central-1.amazonaws.com', // Default to Canada
            port: 587,
            user: process.env.AWS_SES_SMTP_USER || process.env.SMTP_USER,
            pass: process.env.AWS_SES_SMTP_PASS || process.env.SMTP_PASS,
        },
    };

    // Use provider defaults or fall back to sendgrid
    const defaults = providerDefaults[provider] || providerDefaults.sendgrid;

    return {
        provider: 'nodemailer',
        providerOptions: {
            host: process.env.SMTP_HOST || defaults.host,
            port: parseInt(process.env.SMTP_PORT || String(defaults.port)),
            secure: false, // true for 465, false for 587
            auth: {
                user: process.env.SMTP_USER || defaults.user,
                pass: defaults.pass,
            },
        },
        settings: {
            defaultFrom: process.env.SMTP_FROM || 'noreply@jjelevate.com',
            defaultReplyTo: process.env.SMTP_REPLY_TO || 'support@jjelevate.com',
        },
    };
};

const emailConfig = getEmailConfig();

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
                config: emailConfig,
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
        config: emailConfig,
    },
});
