/**
 * Filing Lifecycle Hooks
 * Handles email notifications for filing submissions and status changes
 */

import emailNotificationService from '../../../../services/email-notification';

// Status codes that trigger "Filing Submitted" email
const SUBMITTED_STATUSES = ['SUBMITTED', 'UNDER_REVIEW'];

// Status codes to ignore (don't send emails for these)
const IGNORED_STATUSES = ['NOT_STARTED', 'IN_PROGRESS'];

// Store for tracking old status during updates (keyed by filing ID)
const statusChangeTracker = new Map<number, { oldStatusId: number; oldStatusDisplay: string }>();

export default {
    /**
     * Before update lifecycle hook
     * Captures the current status before update for comparison
     */
    async beforeUpdate(event: any) {
        const { params } = event;

        // Only track if filingStatus is being updated
        if (!params?.data?.filingStatus) {
            return;
        }

        try {
            const filingId = params.where?.id;
            if (!filingId) return;

            // Fetch the current filing to get old status
            const currentFiling = await strapi.entityService.findOne('api::filing.filing', filingId, {
                populate: ['filingStatus'],
            });

            if (currentFiling?.filingStatus) {
                const oldStatus = currentFiling.filingStatus as any;
                statusChangeTracker.set(filingId, {
                    oldStatusId: oldStatus.id,
                    oldStatusDisplay: oldStatus.displayName || oldStatus.statusCode,
                });
            }
        } catch (error) {
            strapi.log.error('Failed to capture old status in beforeUpdate:', error);
        }
    },

    /**
     * After update lifecycle hook
     * Triggered when a filing is updated - checks for status changes and sends emails
     */
    async afterUpdate(event: any) {
        const { result, params } = event;

        // Skip if no filingStatus relation was updated
        if (!params?.data?.filingStatus) {
            return;
        }

        try {
            // Fetch the full filing with relations
            const filing = await strapi.entityService.findOne('api::filing.filing', result.id, {
                populate: ['user', 'filingStatus', 'filingType', 'taxYear'],
            });

            if (!filing || !filing.user || !filing.filingStatus) {
                return;
            }

            const user = filing.user as any;
            const newStatusObj = filing.filingStatus as any;
            const newStatusCode = newStatusObj?.statusCode;
            const newStatusDisplay = newStatusObj?.displayName || newStatusCode;

            // Get old status from tracker
            const oldStatusInfo = statusChangeTracker.get(result.id);
            statusChangeTracker.delete(result.id); // Clean up

            // Skip if status hasn't actually changed
            if (oldStatusInfo && oldStatusInfo.oldStatusId === newStatusObj.id) {
                return;
            }

            // Skip ignored statuses
            if (IGNORED_STATUSES.includes(newStatusCode)) {
                return;
            }

            const recipient = {
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
            };

            const filingType = (filing.filingType as any)?.displayName || 'Tax Filing';
            const taxYear = (filing.taxYear as any)?.year || 'Unknown';

            // Check if this is a submission (transition to SUBMITTED or UNDER_REVIEW)
            const isSubmission = SUBMITTED_STATUSES.includes(newStatusCode) && filing.submittedAt;
            const oldStatusDisplay = oldStatusInfo?.oldStatusDisplay || 'Not Started';

            // Don't send submission email if already was in submitted status
            const wasAlreadySubmitted = oldStatusInfo && SUBMITTED_STATUSES.includes(oldStatusInfo.oldStatusDisplay?.toUpperCase()?.replace(' ', '_'));

            if (isSubmission && !wasAlreadySubmitted) {
                // Send filing submitted email
                await emailNotificationService.sendFilingSubmittedEmail(recipient, {
                    confirmationNumber: filing.confirmationNumber || 'N/A',
                    filingType,
                    taxYear: String(taxYear),
                    entityName: filing.entityName || undefined,
                    submittedAt: filing.submittedAt ? new Date(filing.submittedAt).toISOString() : undefined,
                });

                strapi.log.info(`Filing submitted email sent for filing ${filing.id} (${filing.confirmationNumber})`);
            } else if (!isSubmission || wasAlreadySubmitted) {
                // Send status change email for other status transitions
                await emailNotificationService.sendStatusChangeEmail(recipient, {
                    confirmationNumber: filing.confirmationNumber || 'N/A',
                    filingType,
                    taxYear: String(taxYear),
                    oldStatus: oldStatusDisplay,
                    newStatus: newStatusDisplay,
                    entityName: filing.entityName || undefined,
                });

                strapi.log.info(`Status change email sent for filing ${filing.id}: ${oldStatusDisplay} → ${newStatusDisplay}`);
            }
        } catch (error) {
            // Don't fail the update if email sending fails
            strapi.log.error('Failed to send filing notification email:', error);
        }
    },
};
