import { errors } from '@strapi/utils';
import nodeCrypto from 'node:crypto';

const { ApplicationError, ValidationError } = errors;

const NAME_REGEX = /^[a-zA-Z \-']+$/;

const validateName = (value: string, fieldName: string) => {
  if (value && !NAME_REGEX.test(value)) {
    throw new ApplicationError(`${fieldName} can only contain letters, spaces, hyphens, and apostrophes.`);
  }
};

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
                    <tr>
                        <td style="background-color: #07477a; padding: 30px 40px; border-radius: 12px 12px 0 0;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">JJ Elevate Accounting Solutions Inc.</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px;">
                            <h2 style="color: #1a1a1a; margin: 0 0 20px 0; font-size: 20px;">Reset Your Password</h2>
                            <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                Hi ${firstName || 'there'},
                            </p>
                            <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                                We received a request to reset your password. Click the button below to create a new password:
                            </p>
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
                    <tr>
                        <td style="background-color: #f8fafc; padding: 25px 40px; border-radius: 0 0 12px 12px; border-top: 1px solid #e2e8f0;">
                            <p style="color: #718096; font-size: 12px; margin: 0; text-align: center;">
                                This is an automated message from JJ Elevate Accounting Solutions Inc. Please do not reply directly to this email.
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

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register({ strapi }) {
    console.log('[[REGISTER]] Overriding forgotPassword controller...');

    // Override forgotPassword controller to block Google OAuth users
    const originalForgotPassword = strapi.plugin('users-permissions').controller('auth').forgotPassword;

    strapi.plugin('users-permissions').controller('auth').forgotPassword = async (ctx) => {
      console.log('[CUSTOM forgotPassword] Called with body:', ctx.request.body);
      const { email } = ctx.request.body;

      if (!email) {
        throw new ValidationError('Please provide your email');
      }

      // Find user by email FIRST to check provider
      const user = await strapi.query('plugin::users-permissions.user').findOne({
        where: { email: email.toLowerCase() },
      });

      // Always return success to prevent email enumeration (if no user found)
      if (!user || user.blocked) {
        ctx.send({ ok: true });
        return;
      }

      // BLOCK Google OAuth users from password reset
      if (user.provider && user.provider !== 'local') {
        strapi.log.info(`[forgotPassword] BLOCKED password reset for OAuth user: ${user.email} (provider: ${user.provider})`);
        throw new ApplicationError('This account uses Google Sign-In. Please use the "Sign in with Google" button to access your account.');
      }

      // For local users, generate custom branded email
      const resetPasswordToken = nodeCrypto.randomBytes(64).toString('hex');

      await strapi.query('plugin::users-permissions.user').update({
        where: { id: user.id },
        data: { resetPasswordToken },
      });

      const clientUrl = process.env.CLIENT_PORTAL_URL || 'http://localhost:3000';
      const resetUrl = `${clientUrl}/reset-password?code=${resetPasswordToken}`;

      try {
        await strapi.plugin('email').service('email').send({
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

    console.log('[[REGISTER]] forgotPassword override complete!');
  },

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }) {
    console.log('[[BOOTSTRAP]] JJElevate Admin starting...');

    // 1. LIFECYCLE HOOKS
    strapi.db.lifecycles.subscribe({
      models: ['plugin::users-permissions.user'],
      async beforeCreate(event) {
        const { data } = event.params;
        validateName(data.firstName, 'First name');
        validateName(data.lastName, 'Last name');
      },
      async beforeUpdate(event) {
        const { data, where } = event.params;
        validateName(data.firstName, 'First name');
        validateName(data.lastName, 'Last name');

        // PASSWORD RESET: Log when password is being reset (provider change removed - handled in custom callback)
        if (data.password && data.resetPasswordToken === null) {
          strapi.log.info(`[PASSWORD_RESET] Password updated for user`);
        }
      },
      async afterCreate(event) {
        const { result } = event;
        try {
          await strapi.plugin('email').service('email').send({
            to: result.email,
            subject: 'User Registration Successful',
            text: `Welcome to JJ Elevate Tax Portal. This email confirms that you have successfully completed the registration. your user name is ${result.username}.`,
            html: `<p>Welcome to JJ Elevate Tax Portal.</p><p>This email confirms that you have successfully completed the registration.</p><p>your user name is <strong>${result.username}</strong>.</p>`,
          });
        } catch (err) {
          strapi.log.error('Failed to send welcome email:', err);
        }
      },
    });

    // 2. DISABLE EMAIL CONFIRMATION
    const pluginStore = strapi.store({
      type: 'plugin',
      name: 'users-permissions',
    });

    const settings = await pluginStore.get({ key: 'advanced' });

    // Set reset password URL to client portal (Strapi appends ?code= automatically)
    const clientPortalUrl = process.env.CLIENT_PORTAL_URL || 'http://localhost:3000';
    const resetPasswordUrl = `${clientPortalUrl}/reset-password`;

    const needsUpdate = settings.email_confirmation || settings.email_reset_password !== resetPasswordUrl;

    if (needsUpdate) {
      await pluginStore.set({
        key: 'advanced',
        value: {
          ...settings,
          email_confirmation: false,
          email_reset_password: resetPasswordUrl,
        },
      });
      strapi.log.info(`Email settings updated: confirmation=false, reset_url=${resetPasswordUrl}`);
    }

    // 3. GRANT PERMISSIONS
    const authenticatedRole = await strapi
      .query('plugin::users-permissions.role')
      .findOne({ where: { type: 'authenticated' } });

    if (authenticatedRole) {
      const permissionAction = 'plugin::users-permissions.user.updateMe';
      const existingPermission = await strapi.query('plugin::users-permissions.permission').findOne({
        where: {
          action: permissionAction,
          role: authenticatedRole.id,
        },
      });

      if (!existingPermission) {
        await strapi.query('plugin::users-permissions.permission').create({
          data: {
            action: permissionAction,
            role: authenticatedRole.id,
          },
        });
        strapi.log.info('Granted updateMe permission to Authenticated role.');
      }
    }

    // Helper to grant permissions
    const grantPermission = async (roleName, action) => {
      const role = await strapi
        .query('plugin::users-permissions.role')
        .findOne({ where: { type: roleName } });

      if (role) {
        const existing = await strapi.query('plugin::users-permissions.permission').findOne({
          where: { action, role: role.id },
        });
        if (!existing) {
          await strapi.query('plugin::users-permissions.permission').create({
            data: { action, role: role.id },
          });
          strapi.log.info(`Granted ${action} permission to ${roleName} role.`);
        }
      }
    };

    // Grant Permissions
    await grantPermission('authenticated', 'plugin::users-permissions.user.updateMe');
    await grantPermission('authenticated', 'api::token.logout.logout');
    await grantPermission('authenticated', 'api::tax-year.tax-year.find');
    await grantPermission('authenticated', 'api::tax-year.tax-year.findOne');
    await grantPermission('authenticated', 'api::filing.filing.create');
    await grantPermission('authenticated', 'api::filing.filing.find');
    await grantPermission('authenticated', 'api::filing.filing.findOne');
    await grantPermission('authenticated', 'api::filing.filing.update');
    await grantPermission('authenticated', 'plugin::upload.content-api.upload'); // Fix 403 on Upload
    await grantPermission('public', 'api::token.token.refresh');

    // Grant Permissions for MASTER DATA (Read-only for Authenticated)
    await grantPermission('authenticated', 'api::filing-status.filing-status.find');
    await grantPermission('authenticated', 'api::filing-status.filing-status.findOne');
    await grantPermission('authenticated', 'api::filing-type.filing-type.find');
    await grantPermission('authenticated', 'api::filing-type.filing-type.findOne');

    // Grant Permissions for NEW FILING COLLECTIONS (CRUD for Authenticated)
    // Personal Filing
    await grantPermission('authenticated', 'api::personal-filing.personal-filing.find');
    await grantPermission('authenticated', 'api::personal-filing.personal-filing.findOne');
    await grantPermission('authenticated', 'api::personal-filing.personal-filing.create');
    await grantPermission('authenticated', 'api::personal-filing.personal-filing.update');

    // Corporate Filing
    await grantPermission('authenticated', 'api::corporate-filing.corporate-filing.find');
    await grantPermission('authenticated', 'api::corporate-filing.corporate-filing.findOne');
    await grantPermission('authenticated', 'api::corporate-filing.corporate-filing.create');
    await grantPermission('authenticated', 'api::corporate-filing.corporate-filing.update');

    // Trust Filing
    await grantPermission('authenticated', 'api::trust-filing.trust-filing.find');
    await grantPermission('authenticated', 'api::trust-filing.trust-filing.findOne');
    await grantPermission('authenticated', 'api::trust-filing.trust-filing.create');
    await grantPermission('authenticated', 'api::trust-filing.trust-filing.update');

    // Payment
    await grantPermission('authenticated', 'api::payment.payment.find');
    await grantPermission('authenticated', 'api::payment.payment.findOne');
    await grantPermission('authenticated', 'api::payment.payment.create');
    await grantPermission('authenticated', 'api::payment.payment.update');


    // 4. SEED FILING QUESTIONS (2024/2025)
    // Now loading from the V2 format in src/config/questions_v2.json
    // This is the new question-based format with proper conditional logic support
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const filingQuestions = require('./config/questions_v2.json');


    const taxYear2024 = await strapi.db.query('api::tax-year.tax-year').findOne({
      where: { year: '2024' },
    });

    if (taxYear2024) {
      await strapi.db.query('api::tax-year.tax-year').update({
        where: { id: taxYear2024.id },
        data: { filingQuestions },
      });
      strapi.log.info('Seeded Filing Questions for Tax Year 2024.');
    }

    // Seed 2025 as well for development defaults
    const taxYear2025 = await strapi.db.query('api::tax-year.tax-year').findOne({
      where: { year: '2025' },
    });

    if (taxYear2025) {
      await strapi.db.query('api::tax-year.tax-year').update({
        where: { id: taxYear2025.id },
        data: { filingQuestions },
      });
      strapi.log.info('Seeded Filing Questions for Tax Year 2025.');
    }

  },
};
