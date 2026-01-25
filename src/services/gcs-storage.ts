/**
 * Google Cloud Storage Service
 *
 * Provides secure document storage for tax filing documents.
 * All files are stored encrypted in GCS (Canada region) using Google-managed AES-256 encryption.
 *
 * Security features:
 * - Files are automatically encrypted at rest
 * - Signed URLs for time-limited access (via service account impersonation)
 * - No direct bucket access from clients
 * - File integrity verification via SHA256 checksum
 *
 * Authentication options:
 * 1. Service account key file (GCP_SERVICE_ACCOUNT_PATH)
 * 2. Application Default Credentials with impersonation (GCS_IMPERSONATE_SERVICE_ACCOUNT)
 */

import { Storage, Bucket } from '@google-cloud/storage';
import { IAMCredentialsClient } from '@google-cloud/iam-credentials';
import * as crypto from 'crypto';
import * as path from 'path';

// Document types enum matching Strapi schema
export type DocumentType = 'tax_slip' | 'supporting_doc' | 'id_document' | 'business_doc' | 'other';

// Configuration interface
interface GCSConfig {
    projectId: string;
    keyFilename?: string;
    bucketName: string;
    impersonateServiceAccount?: string;
}

// Upload result interface
export interface UploadResult {
    gcsPath: string;
    gcsBucket: string;
    checksum: string;
    fileSize: number;
}

// Signed URL options
interface SignedUrlOptions {
    expirationMinutes?: number;
    contentType?: string;
    filename?: string;
}

// Lazy-loaded singleton instance
let gcsServiceInstance: GCSStorageService | null = null;

/**
 * Get or create the GCS storage service instance
 * Uses lazy initialization for better performance
 */
export function getGCSStorageService(): GCSStorageService {
    if (!gcsServiceInstance) {
        gcsServiceInstance = new GCSStorageService();
    }
    return gcsServiceInstance;
}

/**
 * GCS Storage Service Class
 *
 * Handles all interactions with Google Cloud Storage for document management.
 * Implements connection pooling via singleton pattern for efficiency.
 */
export class GCSStorageService {
    private storage: Storage;
    private bucket: Bucket;
    private bucketName: string;
    private initialized: boolean = false;
    private impersonateServiceAccount?: string;
    private projectId: string;

    constructor() {
        const config = this.getConfig();
        this.bucketName = config.bucketName;
        this.projectId = config.projectId;
        this.impersonateServiceAccount = config.impersonateServiceAccount;

        // Initialize GCS client with credentials
        const storageOptions: any = {
            projectId: config.projectId,
        };

        // Use service account key file if provided
        if (config.keyFilename) {
            storageOptions.keyFilename = config.keyFilename;
        }

        this.storage = new Storage(storageOptions);
        this.bucket = this.storage.bucket(this.bucketName);
    }

    /**
     * Get configuration from environment variables
     */
    private getConfig(): GCSConfig {
        const projectId = process.env.GCP_PROJECT_ID;
        const bucketName = process.env.GCS_BUCKET_NAME;
        const keyFilename = process.env.GCP_SERVICE_ACCOUNT_PATH;
        const impersonateServiceAccount = process.env.GCS_IMPERSONATE_SERVICE_ACCOUNT;

        if (!projectId) {
            throw new Error('GCP_PROJECT_ID environment variable is required');
        }

        if (!bucketName) {
            throw new Error('GCS_BUCKET_NAME environment variable is required');
        }

        return {
            projectId,
            keyFilename,
            bucketName,
            impersonateServiceAccount,
        };
    }

    /**
     * Verify bucket exists and is accessible
     * Called lazily on first operation
     */
    private async ensureInitialized(): Promise<void> {
        if (this.initialized) return;

        try {
            const [exists] = await this.bucket.exists();
            if (!exists) {
                throw new Error(`GCS bucket '${this.bucketName}' does not exist`);
            }
            this.initialized = true;
        } catch (error: any) {
            if (error.code === 403) {
                throw new Error('Access denied to GCS bucket. Check service account permissions.');
            }
            throw error;
        }
    }

    /**
     * Generate the GCS path for a document
     *
     * Structure: {env}/{tax_year}/{filing_documentId}/{document_type}/{timestamp}_{sanitized_filename}
     */
    generateGCSPath(
        filingDocumentId: string,
        taxYear: number | string,
        documentType: DocumentType,
        originalFilename: string
    ): string {
        const env = process.env.NODE_ENV === 'production' ? 'production' : 'development';
        const timestamp = Date.now();
        const sanitizedFilename = this.sanitizeFilename(originalFilename);

        return `${env}/${taxYear}/${filingDocumentId}/${documentType}/${timestamp}_${sanitizedFilename}`;
    }

    /**
     * Sanitize filename to prevent path traversal and special character issues
     *
     * Security: Removes directory separators, null bytes, and special characters
     */
    sanitizeFilename(filename: string): string {
        if (!filename || typeof filename !== 'string') {
            return 'unnamed_file';
        }

        // Get just the filename without any path
        let sanitized = path.basename(filename);

        // Remove null bytes (security)
        sanitized = sanitized.replace(/\0/g, '');

        // Replace path separators
        sanitized = sanitized.replace(/[/\\]/g, '_');

        // Remove or replace potentially dangerous characters
        sanitized = sanitized.replace(/[<>:"|?*]/g, '_');

        // Remove leading dots (hidden files)
        sanitized = sanitized.replace(/^\.+/, '');

        // Limit length (preserve extension)
        const maxLength = 100;
        if (sanitized.length > maxLength) {
            const ext = path.extname(sanitized);
            const name = path.basename(sanitized, ext);
            sanitized = name.substring(0, maxLength - ext.length) + ext;
        }

        // Fallback for empty result
        if (!sanitized || sanitized === '.') {
            sanitized = 'unnamed_file';
        }

        return sanitized;
    }

    /**
     * Calculate SHA256 checksum of file buffer
     *
     * Used for file integrity verification
     */
    calculateChecksum(buffer: Buffer): string {
        return crypto.createHash('sha256').update(buffer).digest('hex');
    }

    /**
     * Upload a file to GCS
     *
     * @param buffer - File content as Buffer
     * @param gcsPath - Target path in GCS bucket
     * @param mimeType - MIME type of the file
     * @returns Upload result with path, bucket, checksum, and size
     */
    async uploadFile(
        buffer: Buffer,
        gcsPath: string,
        mimeType: string
    ): Promise<UploadResult> {
        await this.ensureInitialized();

        const file = this.bucket.file(gcsPath);
        const checksum = this.calculateChecksum(buffer);

        try {
            // Upload with metadata
            await file.save(buffer, {
                contentType: mimeType,
                metadata: {
                    // Custom metadata for tracking
                    uploadedAt: new Date().toISOString(),
                    sha256Checksum: checksum,
                },
                // Resumable upload is better for large files
                resumable: buffer.length > 5 * 1024 * 1024, // > 5MB
            });

            return {
                gcsPath,
                gcsBucket: this.bucketName,
                checksum,
                fileSize: buffer.length,
            };
        } catch (error: any) {
            // Handle specific GCS errors
            if (error.code === 403) {
                throw new Error('Permission denied when uploading to GCS');
            }
            if (error.code === 404) {
                throw new Error('GCS bucket not found');
            }
            throw new Error(`Failed to upload file to GCS: ${error.message}`);
        }
    }

    /**
     * Generate a signed URL for secure file download
     *
     * Signed URLs provide time-limited access without exposing bucket credentials.
     * Supports service account impersonation when GCS_IMPERSONATE_SERVICE_ACCOUNT is set.
     *
     * @param gcsPath - Path of file in GCS bucket
     * @param options - URL generation options
     * @returns Time-limited signed URL for direct download
     */
    async getSignedUrl(
        gcsPath: string,
        options: SignedUrlOptions = {}
    ): Promise<string> {
        await this.ensureInitialized();

        const {
            expirationMinutes = 15,
            contentType,
            filename,
        } = options;

        const file = this.bucket.file(gcsPath);

        // Verify file exists before generating URL
        const [exists] = await file.exists();
        if (!exists) {
            throw new Error('File not found in storage');
        }

        // Calculate expiration time
        const expirationMs = expirationMinutes * 60 * 1000;
        const expires = Date.now() + expirationMs;

        // Build signed URL options
        const signedUrlOptions: any = {
            version: 'v4',
            action: 'read',
            expires,
        };

        // Add response headers for download
        if (filename) {
            signedUrlOptions.responseDisposition = `attachment; filename="${this.sanitizeFilename(filename)}"`;
        }

        if (contentType) {
            signedUrlOptions.responseType = contentType;
        }

        try {
            // If using impersonation, we need to sign via IAM Credentials API
            if (this.impersonateServiceAccount) {
                const serviceAccountEmail = this.impersonateServiceAccount;

                // Create IAM Credentials client for signing
                const iamClient = new IAMCredentialsClient();

                // Add custom signing function that uses IAM signBlob
                signedUrlOptions.signingEndpoint = undefined; // Clear any default
                signedUrlOptions.client_email = serviceAccountEmail;

                // Custom sign function using IAM Credentials API
                signedUrlOptions.signBlob = async (blobToSign: string): Promise<string> => {
                    const name = `projects/-/serviceAccounts/${serviceAccountEmail}`;
                    const [response] = await iamClient.signBlob({
                        name,
                        payload: Buffer.from(blobToSign).toString('base64'),
                    });

                    if (!response.signedBlob) {
                        throw new Error('Failed to sign blob: no signature returned');
                    }

                    // Return the signature as base64
                    return typeof response.signedBlob === 'string'
                        ? response.signedBlob
                        : Buffer.from(response.signedBlob).toString('base64');
                };

                const [url] = await file.getSignedUrl(signedUrlOptions);
                return url;
            }

            // Standard signed URL generation (requires service account key)
            const [url] = await file.getSignedUrl(signedUrlOptions);
            return url;
        } catch (error: any) {
            if (error.message?.includes('Could not load the default credentials')) {
                throw new Error('GCS credentials not configured. Check GCP_SERVICE_ACCOUNT_PATH or GCS_IMPERSONATE_SERVICE_ACCOUNT.');
            }
            if (error.message?.includes('Cannot sign data without')) {
                throw new Error(
                    'Cannot sign URLs with current credentials. ' +
                    'Set GCS_IMPERSONATE_SERVICE_ACCOUNT to a service account email and ensure your account has ' +
                    'roles/iam.serviceAccountTokenCreator permission on that service account.'
                );
            }
            if (error.message?.includes('Permission') && error.message?.includes('serviceAccountTokenCreator')) {
                throw new Error(
                    `Permission denied: Your account needs roles/iam.serviceAccountTokenCreator on ${this.impersonateServiceAccount}. ` +
                    'Grant this role in GCP IAM settings.'
                );
            }
            throw new Error(`Failed to generate signed URL: ${error.message}`);
        }
    }

    /**
     * Delete a file from GCS
     *
     * @param gcsPath - Path of file to delete
     * @returns true if deleted, false if file didn't exist
     */
    async deleteFile(gcsPath: string): Promise<boolean> {
        await this.ensureInitialized();

        const file = this.bucket.file(gcsPath);

        try {
            const [exists] = await file.exists();
            if (!exists) {
                return false;
            }

            await file.delete();
            return true;
        } catch (error: any) {
            if (error.code === 404) {
                return false;
            }
            throw new Error(`Failed to delete file from GCS: ${error.message}`);
        }
    }

    /**
     * Get file metadata from GCS
     *
     * @param gcsPath - Path of file in bucket
     * @returns File metadata or null if not found
     */
    async getFileMetadata(gcsPath: string): Promise<any | null> {
        await this.ensureInitialized();

        const file = this.bucket.file(gcsPath);

        try {
            const [exists] = await file.exists();
            if (!exists) {
                return null;
            }

            const [metadata] = await file.getMetadata();
            return metadata;
        } catch (error: any) {
            if (error.code === 404) {
                return null;
            }
            throw error;
        }
    }

    /**
     * Verify file integrity by comparing checksums
     *
     * @param gcsPath - Path of file in bucket
     * @param expectedChecksum - Expected SHA256 checksum
     * @returns true if checksums match
     */
    async verifyFileIntegrity(gcsPath: string, expectedChecksum: string): Promise<boolean> {
        const metadata = await this.getFileMetadata(gcsPath);

        if (!metadata) {
            return false;
        }

        const storedChecksum = metadata.metadata?.sha256Checksum;
        return storedChecksum === expectedChecksum;
    }

    /**
     * List files in a specific path prefix
     *
     * Useful for listing all documents for a filing
     *
     * @param prefix - Path prefix to list
     * @returns Array of file paths
     */
    async listFiles(prefix: string): Promise<string[]> {
        await this.ensureInitialized();

        try {
            const [files] = await this.bucket.getFiles({
                prefix,
                maxResults: 1000,
            });

            return files.map(file => file.name);
        } catch (error: any) {
            throw new Error(`Failed to list files: ${error.message}`);
        }
    }
}

export default GCSStorageService;
