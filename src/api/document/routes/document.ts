/**
 * Document Routes
 *
 * Secure document upload/download endpoints using Google Cloud Storage.
 * All endpoints require authentication and respect ownership/admin permissions.
 *
 * Rate limits applied:
 * - Upload: 10/minute per IP (document-upload-limit)
 * - Download: 30/minute per IP (document-download-limit)
 */

module.exports = {
    routes: [
        // Upload endpoint (multipart/form-data)
        {
            method: 'POST',
            path: '/documents/upload',
            handler: 'document.upload',
            config: {
                policies: [],
                middlewares: ['global::document-upload-limit'],
            },
        },
        // User download - get signed URL for own documents
        {
            method: 'GET',
            path: '/documents/:id/download',
            handler: 'document.download',
            config: {
                policies: [],
                middlewares: ['global::document-download-limit'],
            },
        },
        // Admin download - get signed URL for any document
        {
            method: 'GET',
            path: '/documents/:id/admin-download',
            handler: 'document.adminDownload',
            config: {
                policies: [],
                middlewares: ['global::document-download-limit'],
            },
        },
        // List documents for a filing
        {
            method: 'GET',
            path: '/documents/filing/:filingId',
            handler: 'document.findByFiling',
            config: {
                policies: [],
                middlewares: [],
            },
        },
        // Delete document (admin only)
        {
            method: 'DELETE',
            path: '/documents/:id',
            handler: 'document.delete',
            config: {
                policies: [],
                middlewares: [],
            },
        },
    ],
};
