const { errors } = require('@strapi/utils');
const { ApplicationError, ValidationError } = errors;
const crypto = require('crypto');

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

module.exports = (plugin) => {
    // --- 1. Custom Callback for Refresh Tokens ---
    const originalCallback = plugin.controllers.auth.callback;

    plugin.controllers.auth.callback = async (ctx) => {
        // Run original login
        await originalCallback(ctx);

        // If successful and is local auth, inject Custom Refresh Token
        if (ctx.params.provider === 'local' && ctx.response.status === 200 && ctx.body.jwt) {
            try {
                const user = ctx.body.user;
                const jwtService = strapi.plugin('users-permissions').service('jwt');

                // Issue Refresh Token with Version
                const refreshToken = jwtService.issue({
                    id: user.id,
                    type: 'refresh',
                    version: user.tokenVersion || 1
                }, { expiresIn: '7d' });

                // Append to response
                ctx.body = {
                    ...ctx.body,
                    refreshToken
                };
            } catch (e) {
                strapi.log.error('Failed to issue refresh token for local auth', e);
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

    // --- 3. Custom Forgot Password with Branded Email ---
    plugin.controllers.auth.forgotPassword = async (ctx) => {
        const { email } = ctx.request.body;

        if (!email) {
            throw new ValidationError('Please provide your email');
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

        // Generate reset token
        const resetPasswordToken = crypto.randomBytes(64).toString('hex');

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

    return plugin;
};
