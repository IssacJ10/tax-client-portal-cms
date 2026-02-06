import { errors } from '@strapi/utils';
const { ApplicationError, ValidationError } = errors;
import nodeCrypto from 'node:crypto';
import { setAuthCookies, clearAuthCookies } from '../../utils/cookie-config';

const NAME_REGEX = /^[a-zA-Z \-']+$/;

// Branded password reset email template
const getPasswordResetEmailHtml = (firstName: string, resetUrl: string) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Your Password</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7fa;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f7fa; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="background-color: #07477a; padding: 30px 40px; border-radius: 12px 12px 0 0;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">JJ Elevate Accounting Solutions Inc.</h1>
                        </td>
                    </tr>
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px;">
                            <h2 style="color: #1a1a1a; margin: 0 0 20px 0; font-size: 20px;">Reset Your Password</h2>
                            <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                Hi ${firstName || 'there'},
                            </p>
                            <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                                We received a request to reset your password. Click the button below to create a new password:
                            </p>

                            <!-- Button -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 30px;">
                                <tr>
                                    <td align="center">
                                        <a href="${resetUrl}" style="display: inline-block; background-color: #07477a; color: #ffffff; padding: 14px 40px; font-size: 16px; font-weight: 600; text-decoration: none; border-radius: 8px;">Reset Password</a>
                                    </td>
                                </tr>
                            </table>

                            <p style="color: #718096; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
                                This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
                            </p>

                            <p style="color: #718096; font-size: 12px; line-height: 1.6; margin: 0; padding: 15px; background-color: #f8fafc; border-radius: 6px;">
                                If the button doesn't work, copy and paste this link into your browser:<br>
                                <a href="${resetUrl}" style="color: #07477a; word-break: break-all;">${resetUrl}</a>
                            </p>
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f8fafc; padding: 25px 40px; border-radius: 0 0 12px 12px; border-top: 1px solid #e2e8f0;">
                            <p style="color: #718096; font-size: 12px; margin: 0; text-align: center;">
                                This is an automated message from JJ Elevate Accounting Solutions Inc.. Please do not reply directly to this email.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
`;

const getPasswordResetEmailText = (firstName: string, resetUrl: string) => `
Reset Your Password

Hi ${firstName || 'there'},

We received a request to reset your password. Click the link below to create a new password:

${resetUrl}

This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.

- JJ Elevate Accounting Solutions Inc.
`;

export default (plugin) => {
    console.log('[users-permissions extension] Loading custom extension...');

    // --- 1. Custom Callback for Refresh Tokens (HttpOnly Cookie Auth) ---
    const originalCallback = plugin.controllers.auth.callback;

    plugin.controllers.auth.callback = async (ctx) => {
        // Run original login
        await originalCallback(ctx);

        // If successful, set httpOnly cookies instead of returning tokens in body
        if (ctx.response.status === 200 && ctx.body?.jwt) {
            try {
                const user = ctx.body.user;
                const jwt = ctx.body.jwt;
                const jwtService = strapi.plugin('users-permissions').service('jwt');

                // Generate refresh token
                const refreshToken = jwtService.issue({
                    id: user.id,
                    type: 'refresh',
                    version: user.tokenVersion || 1
                }, { expiresIn: '7d' });

                // Set tokens as httpOnly cookies
                setAuthCookies(ctx, jwt, refreshToken);

                // Return user only (tokens are in cookies, not body)
                // Also return jwt in body for backwards compatibility during migration
                ctx.body = {
                    jwt, // Keep for backwards compatibility - frontend will stop using this
                    user,
                    message: 'Login successful. Tokens set in httpOnly cookies.'
                };

                strapi.log.info(`[Auth] User ${user.email} logged in with httpOnly cookies`);
            } catch (e) {
                strapi.log.error('Failed to set auth cookies', e);
            }
        }
    };

    // --- 2. Custom updateMe for Profile Management ---
    const sanitizeOutput = async (user, ctx) => {
        const schema = strapi.getModel('plugin::users-permissions.user');
        const { auth } = ctx.state;
        return strapi.contentAPI.sanitize.output(user, schema, { auth });
    };

    plugin.controllers.user.updateMe = async (ctx) => {
        if (!ctx.state.user || !ctx.state.user.id) {
            return ctx.unauthorized();
        }

        const { firstName, lastName } = ctx.request.body;
        const updateData: Record<string, any> = {};

        // Validate and build update data
        if (firstName !== undefined) {
            if (!NAME_REGEX.test(firstName)) {
                throw new ApplicationError('First name can only contain letters, spaces, hyphens, and apostrophes.');
            }
            updateData.firstName = firstName;
        }

        if (lastName !== undefined) {
            if (!NAME_REGEX.test(lastName)) {
                throw new ApplicationError('Last name can only contain letters, spaces, hyphens, and apostrophes.');
            }
            updateData.lastName = lastName;
        }

        if (Object.keys(updateData).length === 0) {
            return ctx.badRequest('No valid fields to update.');
        }

        // Perform Update
        const updatedUser = await strapi.entityService.update(
            'plugin::users-permissions.user',
            ctx.state.user.id,
            { data: updateData }
        );

        ctx.body = await sanitizeOutput(updatedUser, ctx);
    };

    // Register Route
    plugin.routes['content-api'].routes.unshift({
        method: 'PUT',
        path: '/users/me', // Kept as /users/me for consistency with rest of API, though /user/me was original. frontend uses /users/me now.
        handler: 'user.updateMe',
        config: {
            prefix: '',
            policies: [],
        },
    });

    // --- 3. Custom Forgot Password with Branded Email + reCAPTCHA ---
    console.log('[users-permissions extension] Overriding forgotPassword controller');
    plugin.controllers.auth.forgotPassword = async (ctx) => {
        console.log('[CUSTOM forgotPassword] Called with body:', ctx.request.body);
        const { email, recaptchaToken } = ctx.request.body;

        if (!email) {
            throw new ValidationError('Please provide your email');
        }

        // Validate reCAPTCHA - REQUIRED for forgot password to prevent email spam attacks
        const recaptchaSecret = process.env.JJ_PORTAL_CAPTCHA_SECRET;
        if (recaptchaSecret) {
            if (!recaptchaToken) {
                strapi.log.warn(`[forgotPassword] Missing reCAPTCHA token for email: ${email}`);
                throw new ApplicationError('Security verification required. Please try again.');
            }

            try {
                const recaptchaResponse = await fetch('https://www.google.com/recaptcha/api/siteverify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: `secret=${recaptchaSecret}&response=${recaptchaToken}`,
                });
                const recaptchaResult = await recaptchaResponse.json() as { success: boolean; score?: number; action?: string };

                strapi.log.info(`[forgotPassword] reCAPTCHA result: success=${recaptchaResult.success}, score=${recaptchaResult.score}, action=${recaptchaResult.action}`);

                if (!recaptchaResult.success) {
                    strapi.log.warn(`[forgotPassword] reCAPTCHA failed for email: ${email}`);
                    throw new ApplicationError('Security verification failed. Please try again.');
                }

                // Check score (0.0 = bot, 1.0 = human) - reject if below 0.5
                if (recaptchaResult.score !== undefined && recaptchaResult.score < 0.5) {
                    strapi.log.warn(`[forgotPassword] reCAPTCHA low score (${recaptchaResult.score}) for email: ${email}`);
                    throw new ApplicationError('Security verification failed. Please try again.');
                }
            } catch (err: any) {
                if (err instanceof ApplicationError) throw err;
                strapi.log.error('[forgotPassword] reCAPTCHA verification error:', err);
                // In case of network error, allow the request but log it
                strapi.log.warn('[forgotPassword] reCAPTCHA verification skipped due to error');
            }
        }

        const pluginStore = strapi.store({ type: 'plugin', name: 'users-permissions' });
        const emailSettings = await pluginStore.get({ key: 'email' });
        const advancedSettings = await pluginStore.get({ key: 'advanced' });

        // Find user by email
        const user = await strapi.query('plugin::users-permissions.user').findOne({
            where: { email: email.toLowerCase() },
        });

        // Always return success to prevent email enumeration
        if (!user || user.blocked) {
            ctx.send({ ok: true });
            return;
        }

        // Don't allow password reset for OAuth users (Google, etc.)
        if (user.provider && user.provider !== 'local') {
            strapi.log.info(`[forgotPassword] Blocked password reset for OAuth user: ${user.email} (provider: ${user.provider})`);
            throw new ApplicationError('This account uses Google Sign-In. Please use the "Sign in with Google" button to access your account.');
        }

        // Generate reset token
        const resetPasswordToken = nodeCrypto.randomBytes(64).toString('hex');

        // Save token to user
        await strapi.query('plugin::users-permissions.user').update({
            where: { id: user.id },
            data: { resetPasswordToken },
        });

        // Build reset URL - use frontend URL from env or default
        const clientUrl = process.env.CLIENT_PORTAL_URL || process.env.PUBLIC_URL || 'http://localhost:3000';
        const resetUrl = `${clientUrl}/reset-password?code=${resetPasswordToken}`;

        // Send branded email
        try {
            await strapi.plugins['email'].services.email.send({
                to: user.email,
                subject: 'Reset Your Password - JJ Elevate Accounting Solutions Inc.',
                html: getPasswordResetEmailHtml(user.firstName, resetUrl),
                text: getPasswordResetEmailText(user.firstName, resetUrl),
            });

            strapi.log.info(`Password reset email sent to ${user.email}`);
        } catch (err) {
            strapi.log.error('Failed to send password reset email:', err);
            throw new ApplicationError('Error sending password reset email');
        }

        ctx.send({ ok: true });
    };

    // --- 4. Custom Reset Password (accepts recaptchaToken) ---
    console.log('[users-permissions extension] Overriding resetPassword controller');
    plugin.controllers.auth.resetPassword = async (ctx) => {
        console.log('[CUSTOM resetPassword] Called');
        const { code, password, passwordConfirmation, recaptchaToken } = ctx.request.body;

        if (!code || !password || !passwordConfirmation) {
            throw new ValidationError('Please provide code, password, and password confirmation');
        }

        if (password !== passwordConfirmation) {
            throw new ValidationError('Passwords do not match');
        }

        // Validate reCAPTCHA if token provided and secret is configured
        const recaptchaSecret = process.env.JJ_PORTAL_CAPTCHA_SECRET;
        if (recaptchaToken && recaptchaSecret) {
            try {
                const recaptchaResponse = await fetch('https://www.google.com/recaptcha/api/siteverify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: `secret=${recaptchaSecret}&response=${recaptchaToken}`,
                });
                const recaptchaResult = await recaptchaResponse.json() as { success: boolean; score?: number };

                if (!recaptchaResult.success || (recaptchaResult.score && recaptchaResult.score < 0.5)) {
                    strapi.log.warn(`reCAPTCHA failed for password reset: score=${recaptchaResult.score}`);
                    throw new ApplicationError('Security verification failed. Please try again.');
                }
            } catch (err: any) {
                if (err instanceof ApplicationError) throw err;
                strapi.log.error('reCAPTCHA verification error:', err);
                // Continue without reCAPTCHA if verification service fails
            }
        }

        // Find user by reset token
        const user = await strapi.query('plugin::users-permissions.user').findOne({
            where: { resetPasswordToken: code },
        });

        if (!user) {
            throw new ValidationError('Invalid or expired reset code');
        }

        // Update password and clear reset token
        // Note: We do NOT change the provider - our custom local login allows password auth for any provider
        const hashedPassword = await strapi.plugin('users-permissions').service('user').hashPassword(password);

        await strapi.query('plugin::users-permissions.user').update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                resetPasswordToken: null,
            },
        });

        strapi.log.info(`Password reset successful for user ${user.email}`);

        // Auto-login: Set httpOnly cookies
        const jwtService = strapi.plugin('users-permissions').service('jwt');
        const jwt = jwtService.issue({ id: user.id });
        const refreshToken = jwtService.issue({
            id: user.id,
            type: 'refresh',
            version: user.tokenVersion || 1
        }, { expiresIn: '7d' });

        // Set tokens as httpOnly cookies
        setAuthCookies(ctx, jwt, refreshToken);

        const sanitizedUser = await strapi.plugin('users-permissions').service('user').sanitizeOutput(user, ctx);

        ctx.send({
            jwt, // Keep for backwards compatibility
            user: sanitizedUser,
            message: 'Password reset successful. You are now logged in.'
        });
    };

    // --- 5. Consent Confirmation ---
    plugin.controllers.user.confirmConsent = async (ctx) => {
        const user = ctx.state.user;

        if (!user) {
            return ctx.unauthorized('You must be logged in to confirm consent.');
        }

        try {
            const updatedUser = await strapi.entityService.update(
                'plugin::users-permissions.user',
                user.id,
                {
                    data: {
                        hasConsentedToTerms: true,
                        consentDate: new Date().toISOString(),
                    },
                }
            );

            const sanitizedUser = await strapi
                .plugin('users-permissions')
                .service('user')
                .sanitizeOutput(updatedUser, ctx);

            return sanitizedUser;
        } catch (err: any) {
            return ctx.badRequest(err.message);
        }
    };

    // Register consent route
    plugin.routes['content-api'].routes.push({
        method: 'POST',
        path: '/user/consent',
        handler: 'user.confirmConsent',
        config: {
            policies: [],
            middlewares: [],
        },
    });

    return plugin;
};
