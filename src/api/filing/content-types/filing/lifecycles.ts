/**
 * Filing Lifecycle Hooks
 * Handles email notifications for filing submissions and status changes
 * Also handles SERVER-SIDE VALIDATION before submission
 */

import emailNotificationService from '../../../../services/email-notification';
import filingValidationService from '../../services/filing-validation';

// Status codes that trigger "Filing Submitted" email
const SUBMITTED_STATUSES = ['SUBMITTED', 'UNDER_REVIEW'];

// Status codes to ignore (don't send emails for these)
const IGNORED_STATUSES = ['NOT_STARTED', 'IN_PROGRESS'];

// Store for tracking old status during updates (keyed by filing ID)
const statusChangeTracker = new Map<number, { oldStatusId: number; oldStatusDisplay: string }>();

export default {
    /**
     * Before update lifecycle hook
     * 1. Captures the current status before update for comparison
     * 2. VALIDATES all required fields when submitting (status -> UNDER_REVIEW)
     */
    async beforeUpdate(event: any) {
        const { params } = event;

        // Only process if filingStatus is being updated
        if (!params?.data?.filingStatus) {
            return;
        }

        try {
            const filingId = params.where?.id;
            const documentId = params.where?.documentId;

            if (!filingId && !documentId) return;

            // Fetch the current filing to get old status and filing data
            let currentFiling: any;

            if (filingId) {
                currentFiling = await strapi.entityService.findOne('api::filing.filing', filingId, {
                    populate: ['filingStatus', 'filingType', 'personalFilings', 'corporateFiling', 'trustFiling'],
                });
            } else if (documentId) {
                // For Strapi v5 document API
                const results = await strapi.documents('api::filing.filing').findMany({
                    filters: { documentId },
                    populate: ['filingStatus', 'filingType', 'personalFilings', 'corporateFiling', 'trustFiling'],
                });
                currentFiling = results?.[0];
            }

            if (!currentFiling) return;

            // Track old status for email notifications
            if (currentFiling?.filingStatus) {
                const oldStatus = currentFiling.filingStatus;
                const trackingId = filingId || currentFiling.id;
                statusChangeTracker.set(trackingId, {
                    oldStatusId: oldStatus.id,
                    oldStatusDisplay: oldStatus.displayName || oldStatus.statusCode,
                });
            }

            // ============================================================
            // SERVER-SIDE VALIDATION: Check if submitting (status -> UNDER_REVIEW)
            // ============================================================
            const newStatusId = params.data.filingStatus;

            // Fetch the new status to check if it's UNDER_REVIEW
            let newStatus: any;
            try {
                // newStatusId could be numeric ID or documentId
                if (typeof newStatusId === 'number') {
                    newStatus = await strapi.entityService.findOne('api::filing-status.filing-status', newStatusId);
                } else {
                    // Try to find by documentId
                    const statuses = await strapi.documents('api::filing-status.filing-status').findMany({
                        filters: { documentId: newStatusId },
                    });
                    newStatus = statuses?.[0];
                }
            } catch (e) {
                strapi.log.warn('Could not fetch new status for validation:', e);
            }

            const isSubmitting = newStatus?.statusCode === 'UNDER_REVIEW' || newStatus?.statusCode === 'SUBMITTED';
            const wasAlreadySubmitted = SUBMITTED_STATUSES.includes(currentFiling.filingStatus?.statusCode);

            // Only validate on NEW submissions (not re-submissions or status changes after submission)
            if (isSubmitting && !wasAlreadySubmitted) {
                strapi.log.info(`[Filing Validation] Validating filing ${filingId || documentId} before submission...`);

                // Determine filing type
                const filingTypeStr = currentFiling.filingType?.type || 'PERSONAL';
                const filingType = filingTypeStr === 'PERSONAL' ? 'PERSONAL' :
                                   filingTypeStr === 'CORPORATE' ? 'CORPORATE' :
                                   filingTypeStr === 'TRUST' ? 'TRUST' : 'PERSONAL';

                // Validate
                const validationResult = await filingValidationService.validateForSubmission(currentFiling, filingType);

                if (!validationResult.isValid) {
                    strapi.log.warn(`[Filing Validation] BLOCKED: Filing ${filingId || documentId} failed validation. Missing ${validationResult.totalMissingFields} required fields.`);

                    // Throw error to prevent the update
                    const error: any = new Error(validationResult.errorMessage || 'Filing validation failed. Please complete all required fields before submitting.');
                    error.name = 'ValidationError';
                    error.details = {
                        errors: validationResult.errors,
                        totalMissingFields: validationResult.totalMissingFields
                    };
                    throw error;
                }

                strapi.log.info(`[Filing Validation] PASSED: Filing ${filingId || documentId} validated successfully.`);
            }

        } catch (error: any) {
            // Re-throw validation errors to block the update
            if (error.name === 'ValidationError') {
                throw error;
            }
            strapi.log.error('Failed in beforeUpdate lifecycle:', error);
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
            }) as any;

            if (!filing || !filing.user || !filing.filingStatus) {
                return;
            }

            const user = filing.user;
            const newStatusObj = filing.filingStatus;
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

            const filingType = filing.filingType?.displayName || 'Tax Filing';
            const taxYear = filing.taxYear?.year || 'Unknown';

            // Check if this is a submission (transition to SUBMITTED or UNDER_REVIEW)
            const isSubmission = SUBMITTED_STATUSES.includes(newStatusCode) && filing.submittedAt;
            const oldStatusDisplay = oldStatusInfo?.oldStatusDisplay || 'Not Started';

            // Don't send submission email if already was in submitted status
            const wasAlreadySubmitted = oldStatusInfo && SUBMITTED_STATUSES.includes(oldStatusInfo.oldStatusDisplay?.toUpperCase()?.replace(' ', '_'));

            if (isSubmission && !wasAlreadySubmitted) {
                // Send filing submitted email to client
                await emailNotificationService.sendFilingSubmittedEmail(recipient, {
                    confirmationNumber: filing.confirmationNumber || 'N/A',
                    filingType,
                    taxYear: String(taxYear),
                    entityName: filing.entityName || undefined,
                    submittedAt: filing.submittedAt ? new Date(filing.submittedAt).toISOString() : undefined,
                });

                strapi.log.info(`Filing submitted email sent for filing ${filing.id} (${filing.confirmationNumber})`);

                // Send admin notification email
                await emailNotificationService.sendAdminFilingNotification({
                    confirmationNumber: filing.confirmationNumber || 'N/A',
                    filingType,
                    taxYear: String(taxYear),
                    entityName: filing.entityName || undefined,
                    clientName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown',
                    clientEmail: user.email || 'N/A',
                });

                strapi.log.info(`Admin notification sent for filing ${filing.id} (${filing.confirmationNumber})`);
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
