/**
 * Email Notification Service
 * Handles all transactional emails for JJ Elevate Accounting Solutions Inc.
 */

interface EmailRecipient {
    email: string;
    firstName?: string;
    lastName?: string;
}

interface FilingEmailData {
    confirmationNumber: string;
    filingType: string;
    taxYear: string;
    entityName?: string;
    submittedAt?: string;
}

interface StatusChangeData {
    confirmationNumber: string;
    filingType: string;
    taxYear: string;
    oldStatus: string;
    newStatus: string;
    entityName?: string;
}

// Email templates
const templates = {
    filingSubmitted: (recipient: EmailRecipient, data: FilingEmailData) => ({
        subject: `Filing Submitted - Confirmation #${data.confirmationNumber}`,
        html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Filing Submitted</title>
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
                            <h2 style="color: #1a1a1a; margin: 0 0 20px 0; font-size: 20px;">Filing Successfully Submitted!</h2>
                            <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                Hi ${recipient.firstName || 'Valued Client'},
                            </p>
                            <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                                Your tax filing has been successfully submitted and is now under review by our team.
                            </p>

                            <!-- Confirmation Box -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0f7ff; border-radius: 8px; margin-bottom: 30px;">
                                <tr>
                                    <td style="padding: 25px;">
                                        <p style="color: #07477a; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px 0; font-weight: 600;">Confirmation Number</p>
                                        <p style="color: #07477a; font-size: 28px; font-weight: 700; margin: 0; font-family: monospace;">${data.confirmationNumber}</p>
                                    </td>
                                </tr>
                            </table>

                            <!-- Filing Details -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 30px;">
                                <tr>
                                    <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
                                        <span style="color: #718096; font-size: 14px;">Filing Type</span>
                                        <span style="color: #1a1a1a; font-size: 14px; float: right; font-weight: 600;">${data.filingType}</span>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
                                        <span style="color: #718096; font-size: 14px;">Tax Year</span>
                                        <span style="color: #1a1a1a; font-size: 14px; float: right; font-weight: 600;">${data.taxYear}</span>
                                    </td>
                                </tr>
                                ${data.entityName ? `
                                <tr>
                                    <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
                                        <span style="color: #718096; font-size: 14px;">Entity Name</span>
                                        <span style="color: #1a1a1a; font-size: 14px; float: right; font-weight: 600;">${data.entityName}</span>
                                    </td>
                                </tr>
                                ` : ''}
                                <tr>
                                    <td style="padding: 12px 0;">
                                        <span style="color: #718096; font-size: 14px;">Status</span>
                                        <span style="color: #07477a; font-size: 14px; float: right; font-weight: 600;">Under Review</span>
                                    </td>
                                </tr>
                            </table>

                            <p style="color: #4a5568; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
                                Our team will review your submission and contact you if any additional information is needed. You can track your filing status by logging into your account.
                            </p>

                            <p style="color: #4a5568; font-size: 14px; line-height: 1.6; margin: 0;">
                                Thank you for choosing JJ Elevate Accounting Solutions Inc.!
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
        `,
        text: `
Filing Successfully Submitted!

Hi ${recipient.firstName || 'Valued Client'},

Your tax filing has been successfully submitted and is now under review by our team.

Confirmation Number: ${data.confirmationNumber}
Filing Type: ${data.filingType}
Tax Year: ${data.taxYear}
${data.entityName ? `Entity Name: ${data.entityName}` : ''}
Status: Under Review

Our team will review your submission and contact you if any additional information is needed.

Thank you for choosing JJ Elevate Accounting Solutions Inc.!
        `
    }),

    statusChanged: (recipient: EmailRecipient, data: StatusChangeData) => ({
        subject: `Filing Status Update - ${data.newStatus} - #${data.confirmationNumber}`,
        html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Filing Status Update</title>
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
                            <h2 style="color: #1a1a1a; margin: 0 0 20px 0; font-size: 20px;">Filing Status Update</h2>
                            <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                Hi ${recipient.firstName || 'Valued Client'},
                            </p>
                            <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                                The status of your tax filing has been updated.
                            </p>

                            <!-- Status Change Box -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0f7ff; border-radius: 8px; margin-bottom: 30px;">
                                <tr>
                                    <td style="padding: 25px; text-align: center;">
                                        <p style="color: #718096; font-size: 14px; margin: 0 0 10px 0;">${data.oldStatus}</p>
                                        <p style="color: #07477a; font-size: 24px; margin: 0 0 10px 0;">↓</p>
                                        <p style="color: #07477a; font-size: 22px; font-weight: 700; margin: 0;">${data.newStatus}</p>
                                    </td>
                                </tr>
                            </table>

                            <!-- Filing Details -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 30px;">
                                <tr>
                                    <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
                                        <span style="color: #718096; font-size: 14px;">Confirmation #</span>
                                        <span style="color: #1a1a1a; font-size: 14px; float: right; font-weight: 600; font-family: monospace;">${data.confirmationNumber}</span>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
                                        <span style="color: #718096; font-size: 14px;">Filing Type</span>
                                        <span style="color: #1a1a1a; font-size: 14px; float: right; font-weight: 600;">${data.filingType}</span>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
                                        <span style="color: #718096; font-size: 14px;">Tax Year</span>
                                        <span style="color: #1a1a1a; font-size: 14px; float: right; font-weight: 600;">${data.taxYear}</span>
                                    </td>
                                </tr>
                                ${data.entityName ? `
                                <tr>
                                    <td style="padding: 12px 0;">
                                        <span style="color: #718096; font-size: 14px;">Entity Name</span>
                                        <span style="color: #1a1a1a; font-size: 14px; float: right; font-weight: 600;">${data.entityName}</span>
                                    </td>
                                </tr>
                                ` : ''}
                            </table>

                            <p style="color: #4a5568; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
                                Log in to your account to view more details about your filing.
                            </p>

                            <p style="color: #4a5568; font-size: 14px; line-height: 1.6; margin: 0;">
                                Thank you for choosing JJ Elevate Accounting Solutions Inc.!
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
        `,
        text: `
Filing Status Update

Hi ${recipient.firstName || 'Valued Client'},

The status of your tax filing has been updated.

Status Change: ${data.oldStatus} → ${data.newStatus}

Confirmation Number: ${data.confirmationNumber}
Filing Type: ${data.filingType}
Tax Year: ${data.taxYear}
${data.entityName ? `Entity Name: ${data.entityName}` : ''}

Log in to your account to view more details about your filing.

Thank you for choosing JJ Elevate Accounting Solutions Inc.!
        `
    }),

    adminFilingNotification: (data: FilingEmailData & { clientName: string; clientEmail: string }) => ({
        subject: `New Filing Submitted - #${data.confirmationNumber} - ${data.clientName}`,
        html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Filing Submitted</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7fa;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f7fa; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="background-color: #07477a; padding: 30px 40px; border-radius: 12px 12px 0 0;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">JJ Elevate - Admin Notification</h1>
                        </td>
                    </tr>
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px;">
                            <h2 style="color: #1a1a1a; margin: 0 0 20px 0; font-size: 20px;">New Filing Submitted for Review</h2>
                            <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                                A new tax filing has been submitted and requires review.
                            </p>

                            <!-- Confirmation Box -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef3c7; border-radius: 8px; margin-bottom: 30px; border: 1px solid #f59e0b;">
                                <tr>
                                    <td style="padding: 25px;">
                                        <p style="color: #92400e; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px 0; font-weight: 600;">Confirmation Number</p>
                                        <p style="color: #92400e; font-size: 28px; font-weight: 700; margin: 0; font-family: monospace;">${data.confirmationNumber}</p>
                                    </td>
                                </tr>
                            </table>

                            <!-- Filing Details -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 30px;">
                                <tr>
                                    <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
                                        <span style="color: #718096; font-size: 14px;">Client Name</span>
                                        <span style="color: #1a1a1a; font-size: 14px; float: right; font-weight: 600;">${data.clientName}</span>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
                                        <span style="color: #718096; font-size: 14px;">Client Email</span>
                                        <span style="color: #1a1a1a; font-size: 14px; float: right; font-weight: 600;">${data.clientEmail}</span>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
                                        <span style="color: #718096; font-size: 14px;">Filing Type</span>
                                        <span style="color: #1a1a1a; font-size: 14px; float: right; font-weight: 600;">${data.filingType}</span>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
                                        <span style="color: #718096; font-size: 14px;">Tax Year</span>
                                        <span style="color: #1a1a1a; font-size: 14px; float: right; font-weight: 600;">${data.taxYear}</span>
                                    </td>
                                </tr>
                                ${data.entityName ? `
                                <tr>
                                    <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
                                        <span style="color: #718096; font-size: 14px;">Entity Name</span>
                                        <span style="color: #1a1a1a; font-size: 14px; float: right; font-weight: 600;">${data.entityName}</span>
                                    </td>
                                </tr>
                                ` : ''}
                                <tr>
                                    <td style="padding: 12px 0;">
                                        <span style="color: #718096; font-size: 14px;">Status</span>
                                        <span style="color: #f59e0b; font-size: 14px; float: right; font-weight: 600;">Under Review</span>
                                    </td>
                                </tr>
                            </table>

                            <p style="color: #4a5568; font-size: 14px; line-height: 1.6; margin: 0;">
                                Please log in to the admin dashboard to review this filing.
                            </p>
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f8fafc; padding: 25px 40px; border-radius: 0 0 12px 12px; border-top: 1px solid #e2e8f0;">
                            <p style="color: #718096; font-size: 12px; margin: 0; text-align: center;">
                                This is an automated admin notification from JJ Elevate Accounting Solutions Inc.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `,
        text: `
New Filing Submitted for Review

A new tax filing has been submitted and requires review.

Confirmation Number: ${data.confirmationNumber}
Client Name: ${data.clientName}
Client Email: ${data.clientEmail}
Filing Type: ${data.filingType}
Tax Year: ${data.taxYear}
${data.entityName ? `Entity Name: ${data.entityName}` : ''}
Status: Under Review

Please log in to the admin dashboard to review this filing.
        `
    }),

    passwordReset: (recipient: EmailRecipient, resetUrl: string) => ({
        subject: 'Reset Your Password - JJ Elevate Accounting Solutions Inc.',
        html: `
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
                                Hi ${recipient.firstName || 'there'},
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
        `,
        text: `
Reset Your Password

Hi ${recipient.firstName || 'there'},

We received a request to reset your password. Click the link below to create a new password:

${resetUrl}

This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.

- JJ Elevate Accounting Solutions Inc.
        `
    })
};

/**
 * Email Notification Service
 */
const emailNotificationService = {
    /**
     * Send filing submitted notification
     */
    async sendFilingSubmittedEmail(recipient: EmailRecipient, filingData: FilingEmailData) {
        try {
            const template = templates.filingSubmitted(recipient, filingData);

            await strapi.plugins['email'].services.email.send({
                to: recipient.email,
                subject: template.subject,
                html: template.html,
                text: template.text,
            });

            strapi.log.info(`Filing submitted email sent to ${recipient.email} for confirmation #${filingData.confirmationNumber}`);
            return { success: true };
        } catch (error) {
            strapi.log.error(`Failed to send filing submitted email to ${recipient.email}:`, error);
            return { success: false, error };
        }
    },

    /**
     * Send filing status change notification
     */
    async sendStatusChangeEmail(recipient: EmailRecipient, statusData: StatusChangeData) {
        try {
            const template = templates.statusChanged(recipient, statusData);

            await strapi.plugins['email'].services.email.send({
                to: recipient.email,
                subject: template.subject,
                html: template.html,
                text: template.text,
            });

            strapi.log.info(`Status change email sent to ${recipient.email} for confirmation #${statusData.confirmationNumber}: ${statusData.oldStatus} → ${statusData.newStatus}`);
            return { success: true };
        } catch (error) {
            strapi.log.error(`Failed to send status change email to ${recipient.email}:`, error);
            return { success: false, error };
        }
    },

    /**
     * Send password reset email
     */
    async sendPasswordResetEmail(recipient: EmailRecipient, resetUrl: string) {
        try {
            const template = templates.passwordReset(recipient, resetUrl);

            await strapi.plugins['email'].services.email.send({
                to: recipient.email,
                subject: template.subject,
                html: template.html,
                text: template.text,
            });

            strapi.log.info(`Password reset email sent to ${recipient.email}`);
            return { success: true };
        } catch (error) {
            strapi.log.error(`Failed to send password reset email to ${recipient.email}:`, error);
            return { success: false, error };
        }
    },

    /**
     * Send admin notification when a filing is submitted
     */
    async sendAdminFilingNotification(filingData: FilingEmailData & { clientName: string; clientEmail: string }) {
        const ADMIN_EMAIL = 'contact@jjelevateas.com';

        try {
            const template = templates.adminFilingNotification(filingData);

            await strapi.plugins['email'].services.email.send({
                to: ADMIN_EMAIL,
                subject: template.subject,
                html: template.html,
                text: template.text,
            });

            strapi.log.info(`Admin notification sent to ${ADMIN_EMAIL} for filing #${filingData.confirmationNumber}`);
            return { success: true };
        } catch (error) {
            strapi.log.error(`Failed to send admin notification to ${ADMIN_EMAIL}:`, error);
            return { success: false, error };
        }
    },

    /**
     * Test email configuration
     */
    async sendTestEmail(to: string) {
        try {
            await strapi.plugins['email'].services.email.send({
                to,
                subject: 'JJ Elevate Accounting Solutions Inc. - Email Test',
                html: '<h1>Email Configuration Working!</h1><p>Your SendGrid integration is configured correctly.</p>',
                text: 'Email Configuration Working! Your SendGrid integration is configured correctly.',
            });

            strapi.log.info(`Test email sent to ${to}`);
            return { success: true };
        } catch (error) {
            strapi.log.error(`Failed to send test email to ${to}:`, error);
            return { success: false, error };
        }
    }
};

export default emailNotificationService;
