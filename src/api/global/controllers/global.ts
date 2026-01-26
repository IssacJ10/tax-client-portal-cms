/**
 * Global controller with email test functionality
 */

import { factories } from '@strapi/strapi';
import emailNotificationService from '../../../services/email-notification';

export default factories.createCoreController('api::global.global', ({ strapi }) => ({
    async testEmail(ctx) {
        const { to } = ctx.request.body as { to?: string };

        if (!to) {
            return ctx.badRequest('Email address is required', {
                error: 'Missing "to" field in request body',
            });
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(to)) {
            return ctx.badRequest('Invalid email address', {
                error: 'Please provide a valid email address',
            });
        }

        try {
            // Log the email configuration (without sensitive data)
            strapi.log.info('Email test requested', {
                to,
                provider: process.env.EMAIL_PROVIDER || 'google',
                smtpUser: process.env.GOOGLE_SMTP_USER || process.env.SMTP_USER || 'not set',
                smtpFrom: process.env.SMTP_FROM || 'not set',
            });

            const result = await emailNotificationService.sendTestEmail(to);

            if (result.success) {
                return ctx.send({
                    success: true,
                    message: `Test email sent to ${to}`,
                });
            } else {
                strapi.log.error('Email test failed:', result.error);
                return ctx.internalServerError('Failed to send test email', {
                    error: (result.error as any)?.message || 'Unknown error',
                });
            }
        } catch (error: any) {
            strapi.log.error('Email test exception:', error);
            return ctx.internalServerError('Email sending failed', {
                error: error.message || 'Unknown error',
                code: error.code,
            });
        }
    },
}));
