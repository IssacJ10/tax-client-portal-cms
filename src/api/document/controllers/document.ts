/**
 * Document Controller
 *
 * Handles secure document upload/download operations using Google Cloud Storage.
 * All files are encrypted at rest using Google-managed AES-256 encryption.
 *
 * Endpoints:
 * - POST /api/documents/upload - Upload file to GCS
 * - GET /api/documents/:id/download - Get signed URL (user)
 * - GET /api/documents/:id/admin-download - Get signed URL (admin)
 * - DELETE /api/documents/:id - Delete document (admin only)
 */

import { factories } from '@strapi/strapi';
import { errors } from '@strapi/utils';
import { getGCSStorageService, DocumentType } from '../../../services/gcs-storage';

const { ValidationError, ForbiddenError, NotFoundError } = errors;

// Allowed MIME types for upload
const ALLOWED_MIME_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
];

// Maximum file size (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Signed URL expiration times
const USER_URL_EXPIRATION_MINUTES = 15;
const ADMIN_URL_EXPIRATION_MINUTES = 30;

/**
 * Helper: Verify user has access to a filing
 */
async function verifyFilingAccess(strapi: any, filingId: string, user: any, isAdmin: boolean): Promise<any | null> {
    const filing = await strapi.documents('api::filing.filing').findOne({
        documentId: filingId,
        populate: ['user'],
    });

    if (!filing) {
        return null;
    }

    // Admins have access to all filings
    if (isAdmin) {
        return filing;
    }

    // Check if user owns the filing
    const filingUser = (filing as any).user;
    const filingUserId = filingUser?.id || filingUser?.documentId || filingUser;

    if (filingUserId !== user.id && filingUserId !== user.documentId) {
        return null;
    }

    return filing;
}

/**
 * Helper: Find document with access verification
 */
async function findDocumentWithAccess(strapi: any, id: string, user: any, isAdmin: boolean): Promise<any | null> {
    // Try to find by documentId first
    let document = await strapi.documents('api::document.document').findOne({
        documentId: id,
        populate: ['filing', 'filing.user', 'uploadedBy'],
    });

    // If not found, try by numeric ID
    if (!document) {
        const results = await strapi.documents('api::document.document').findMany({
            filters: { id: id },
            populate: ['filing', 'filing.user', 'uploadedBy'],
        });
        document = results?.[0] || null;
    }

    if (!document) {
        return null;
    }

    // Admins have access to all documents
    if (isAdmin) {
        return document;
    }

    // Check if user owns the parent filing
    const filing = (document as any).filing;
    if (!filing) {
        return null;
    }

    const filingUser = filing.user;
    const filingUserId = filingUser?.id || filingUser?.documentId || filingUser;

    if (filingUserId !== user.id && filingUserId !== user.documentId) {
        return null;
    }

    return document;
}

/**
 * Helper: Check if user is an admin
 */
async function isAdminUser(strapi: any, user: any): Promise<boolean> {
    // Check common admin role patterns
    const role = user.role;
    if (role?.type === 'admin_role' || role?.name === 'Admin') {
        return true;
    }

    // If role not populated, fetch it
    if (!role && user.id) {
        const fullUser = await strapi.documents('plugin::users-permissions.user').findOne({
            documentId: user.documentId || user.id.toString(),
            populate: ['role'],
        });

        const userRole = (fullUser as any)?.role;
        if (userRole?.type === 'admin_role' || userRole?.name === 'Admin') {
            return true;
        }
    }

    return false;
}

export default factories.createCoreController('api::document.document', ({ strapi }) => ({
    /**
     * Upload a file to GCS and create document metadata
     *
     * Expected request body (multipart/form-data):
     * - file: The file to upload
     * - filingId: The parent filing documentId
     * - personalFilingId: (optional) The personal filing documentId
     * - documentType: Type of document (tax_slip, supporting_doc, etc.)
     * - questionId: (optional) The question ID from wizard
     * - fieldName: (optional) The field name
     */
    async upload(ctx) {
        const user = ctx.state?.user;
        if (!user) {
            throw new ForbiddenError('Authentication required');
        }

        // Get uploaded file from request
        const { files } = ctx.request;
        const uploadedFile = files?.file;

        if (!uploadedFile) {
            throw new ValidationError('No file provided');
        }

        // Handle array of files (take first one)
        const file = Array.isArray(uploadedFile) ? uploadedFile[0] : uploadedFile;

        // Get form fields
        const body = ctx.request.body || {};
        const filingId = body.filingId;
        const personalFilingId = body.personalFilingId;
        const documentType = (body.documentType || 'other') as DocumentType;
        const questionId = body.questionId;
        const fieldName = body.fieldName;

        // Validate filingId
        if (!filingId) {
            throw new ValidationError('Filing ID is required');
        }

        // Validate document type
        const validDocTypes: DocumentType[] = ['tax_slip', 'supporting_doc', 'id_document', 'business_doc', 'other'];
        if (!validDocTypes.includes(documentType)) {
            throw new ValidationError(`Invalid document type. Must be one of: ${validDocTypes.join(', ')}`);
        }

        // Validate file type
        const mimeType = file.mimetype || (file as any).type;
        if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
            throw new ValidationError(
                `File type not allowed. Allowed types: PDF, images (JPEG, PNG, GIF, WebP), Word documents, Excel spreadsheets, text files.`
            );
        }

        // Validate file size
        const fileSize = file.size;
        if (fileSize > MAX_FILE_SIZE) {
            throw new ValidationError(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`);
        }

        // Verify user owns the filing
        const filing = await verifyFilingAccess(strapi, filingId, user, false);
        if (!filing) {
            throw new ForbiddenError('You do not have permission to upload to this filing');
        }

        // If personalFilingId provided, verify it belongs to the filing
        if (personalFilingId) {
            const personalFiling = await strapi.documents('api::personal-filing.personal-filing').findOne({
                documentId: personalFilingId,
                populate: ['filing'],
            });

            if (!personalFiling || (personalFiling as any).filing?.documentId !== filingId) {
                throw new ValidationError('Personal filing not found or does not belong to the specified filing');
            }
        }

        try {
            // Read file content
            const fs = require('fs');
            const fileBuffer = fs.readFileSync(file.filepath || (file as any).path);

            // Get GCS service
            const gcsService = getGCSStorageService();

            // Generate GCS path
            const taxYear = (filing as any).taxYear || new Date().getFullYear();
            const originalFilename = file.originalFilename || 'document';
            const gcsPath = gcsService.generateGCSPath(
                filingId,
                taxYear,
                documentType,
                originalFilename
            );

            // Upload to GCS
            const uploadResult = await gcsService.uploadFile(fileBuffer, gcsPath, mimeType);

            // Create document record in Strapi
            const document = await strapi.documents('api::document.document').create({
                data: {
                    filing: filingId,
                    personalFiling: personalFilingId || null,
                    gcsPath: uploadResult.gcsPath,
                    gcsBucket: uploadResult.gcsBucket,
                    originalFilename: originalFilename,
                    mimeType: mimeType,
                    fileSize: uploadResult.fileSize,
                    documentType: documentType,
                    checksum: uploadResult.checksum,
                    uploadedBy: user.documentId || user.id,
                    questionId: questionId || null,
                    fieldName: fieldName || null,
                },
            });

            strapi.log.info('[Document] Uploaded', {
                documentId: (document as any).documentId,
                userId: user.id,
                filingId,
                documentType,
                fileSize: uploadResult.fileSize,
            });

            // Return document metadata (without private fields like gcsPath)
            return {
                data: {
                    id: (document as any).id,
                    documentId: (document as any).documentId,
                    originalFilename: (document as any).originalFilename,
                    mimeType: (document as any).mimeType,
                    fileSize: (document as any).fileSize,
                    documentType: (document as any).documentType,
                    questionId: (document as any).questionId,
                    fieldName: (document as any).fieldName,
                    createdAt: (document as any).createdAt,
                },
            };
        } catch (error: any) {
            strapi.log.error('[Document] Upload failed', {
                userId: user.id,
                filingId,
                error: error.message,
            });

            if (error instanceof ValidationError || error instanceof ForbiddenError) {
                throw error;
            }

            throw new ValidationError(`Failed to upload document: ${error.message}`);
        }
    },

    /**
     * Get signed URL for user download
     * Users can only download documents from their own filings
     */
    async download(ctx) {
        const user = ctx.state?.user;
        if (!user) {
            throw new ForbiddenError('Authentication required');
        }

        const { id } = ctx.params;
        if (!id) {
            throw new ValidationError('Document ID is required');
        }

        // Find document with filing relation
        const document = await findDocumentWithAccess(strapi, id, user, false);
        if (!document) {
            throw new NotFoundError('Document not found or access denied');
        }

        try {
            const gcsService = getGCSStorageService();
            const signedUrl = await gcsService.getSignedUrl(
                (document as any).gcsPath,
                {
                    expirationMinutes: USER_URL_EXPIRATION_MINUTES,
                    contentType: (document as any).mimeType,
                    filename: (document as any).originalFilename,
                }
            );

            strapi.log.info('[Document] User download requested', {
                documentId: id,
                userId: user.id,
            });

            return {
                data: {
                    url: signedUrl,
                    expiresInMinutes: USER_URL_EXPIRATION_MINUTES,
                    filename: (document as any).originalFilename,
                    mimeType: (document as any).mimeType,
                },
            };
        } catch (error: any) {
            strapi.log.error('[Document] Download URL generation failed', {
                documentId: id,
                userId: user.id,
                error: error.message,
            });

            throw new ValidationError(`Failed to generate download URL: ${error.message}`);
        }
    },

    /**
     * Get signed URL for admin download
     * Admins can download any document
     */
    async adminDownload(ctx) {
        const user = ctx.state?.user;
        if (!user) {
            throw new ForbiddenError('Authentication required');
        }

        // Verify admin role
        const isAdmin = await isAdminUser(strapi, user);
        if (!isAdmin) {
            throw new ForbiddenError('Admin access required');
        }

        const { id } = ctx.params;
        if (!id) {
            throw new ValidationError('Document ID is required');
        }

        // Find document (admin has access to all)
        const document = await findDocumentWithAccess(strapi, id, user, true);
        if (!document) {
            throw new NotFoundError('Document not found');
        }

        try {
            const gcsService = getGCSStorageService();
            const signedUrl = await gcsService.getSignedUrl(
                (document as any).gcsPath,
                {
                    expirationMinutes: ADMIN_URL_EXPIRATION_MINUTES,
                    contentType: (document as any).mimeType,
                    filename: (document as any).originalFilename,
                }
            );

            strapi.log.info('[Document] Admin download requested', {
                documentId: id,
                adminId: user.id,
                filingId: (document as any).filing?.documentId || (document as any).filing,
            });

            return {
                data: {
                    url: signedUrl,
                    expiresInMinutes: ADMIN_URL_EXPIRATION_MINUTES,
                    filename: (document as any).originalFilename,
                    mimeType: (document as any).mimeType,
                    fileSize: (document as any).fileSize,
                    documentType: (document as any).documentType,
                },
            };
        } catch (error: any) {
            strapi.log.error('[Document] Admin download URL generation failed', {
                documentId: id,
                adminId: user.id,
                error: error.message,
            });

            throw new ValidationError(`Failed to generate download URL: ${error.message}`);
        }
    },

    /**
     * Delete a document (admin only for now)
     * Removes both the GCS file and Strapi record
     */
    async delete(ctx) {
        const user = ctx.state?.user;
        if (!user) {
            throw new ForbiddenError('Authentication required');
        }

        // Only admins can delete documents
        const isAdmin = await isAdminUser(strapi, user);
        if (!isAdmin) {
            throw new ForbiddenError('Admin access required to delete documents');
        }

        const { id } = ctx.params;
        if (!id) {
            throw new ValidationError('Document ID is required');
        }

        // Find document
        const document = await findDocumentWithAccess(strapi, id, user, true);
        if (!document) {
            throw new NotFoundError('Document not found');
        }

        try {
            // Delete from GCS first
            const gcsService = getGCSStorageService();
            await gcsService.deleteFile((document as any).gcsPath);

            // Delete Strapi record
            await strapi.documents('api::document.document').delete({
                documentId: (document as any).documentId,
            });

            strapi.log.info('[Document] Deleted', {
                documentId: id,
                adminId: user.id,
                gcsPath: (document as any).gcsPath,
            });

            return {
                data: {
                    success: true,
                    message: 'Document deleted successfully',
                },
            };
        } catch (error: any) {
            strapi.log.error('[Document] Delete failed', {
                documentId: id,
                adminId: user.id,
                error: error.message,
            });

            throw new ValidationError(`Failed to delete document: ${error.message}`);
        }
    },

    /**
     * List documents for a filing
     * Users see only their own, admins see all
     */
    async findByFiling(ctx) {
        const user = ctx.state?.user;
        if (!user) {
            throw new ForbiddenError('Authentication required');
        }

        const filingId = ctx.query?.filingId || ctx.params?.filingId;
        if (!filingId) {
            throw new ValidationError('Filing ID is required');
        }

        const isAdmin = await isAdminUser(strapi, user);

        // Verify access to filing
        const filing = await verifyFilingAccess(strapi, filingId as string, user, isAdmin);
        if (!filing) {
            throw new ForbiddenError('Access denied to this filing');
        }

        // Find all documents for this filing
        const documents = await strapi.documents('api::document.document').findMany({
            filters: {
                filing: { documentId: filingId },
            },
            sort: { createdAt: 'desc' },
        });

        // Return documents without private fields
        const sanitizedDocs = (documents as any[]).map(doc => ({
            id: doc.id,
            documentId: doc.documentId,
            originalFilename: doc.originalFilename,
            mimeType: doc.mimeType,
            fileSize: doc.fileSize,
            documentType: doc.documentType,
            questionId: doc.questionId,
            fieldName: doc.fieldName,
            createdAt: doc.createdAt,
        }));

        return {
            data: sanitizedDocs,
        };
    },
}));
