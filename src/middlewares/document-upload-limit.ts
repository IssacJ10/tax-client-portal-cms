/**
 * Document Upload Rate Limit Middleware
 *
 * Specific rate limiting for secure document uploads.
 * Limit: 10 uploads per minute per IP
 *
 * This middleware works in conjunction with the global rate-limiter
 * to provide specific limits for document operations.
 */

interface UploadRateLimitEntry {
    count: number;
    windowStart: number;
    blocked: boolean;
    blockExpiry?: number;
}

// Document upload rate limit configuration
const UPLOAD_RATE_LIMIT_CONFIG = {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 uploads per minute per IP
    blockDurationMs: 2 * 60 * 1000, // Block for 2 minutes
};

// In-memory storage for rate limiting
const uploadRateLimitStore = new Map<string, UploadRateLimitEntry>();

// Cleanup interval (clean expired entries every 5 minutes)
const UPLOAD_CLEANUP_INTERVAL = 5 * 60 * 1000;
let uploadLastCleanup = Date.now();

/**
 * Get the client identifier (IP address)
 */
function getUploadClientId(ctx: any): string {
    const forwardedFor = ctx.request.header['x-forwarded-for'];
    if (forwardedFor) {
        return forwardedFor.split(',')[0].trim();
    }
    const realIp = ctx.request.header['x-real-ip'];
    if (realIp) {
        return realIp;
    }
    return ctx.request.ip || 'unknown';
}

/**
 * Clean up expired entries from the store
 */
function cleanupUploadExpiredEntries(): void {
    const now = Date.now();
    for (const [key, entry] of uploadRateLimitStore.entries()) {
        const windowExpired = now - entry.windowStart > UPLOAD_RATE_LIMIT_CONFIG.windowMs;
        const blockExpired = entry.blockExpiry && now > entry.blockExpiry;
        if ((windowExpired && !entry.blocked) || blockExpired) {
            uploadRateLimitStore.delete(key);
        }
    }
}

/**
 * Check and update rate limit for a client
 */
function checkUploadRateLimit(clientId: string): { allowed: boolean; remaining: number; retryAfter?: number } {
    const now = Date.now();
    const key = `doc-upload:${clientId}`;

    // Periodic cleanup
    if (now - uploadLastCleanup > UPLOAD_CLEANUP_INTERVAL) {
        cleanupUploadExpiredEntries();
        uploadLastCleanup = now;
    }

    let entry = uploadRateLimitStore.get(key);

    // Check if client is currently blocked
    if (entry?.blocked && entry.blockExpiry) {
        if (now < entry.blockExpiry) {
            const retryAfter = Math.ceil((entry.blockExpiry - now) / 1000);
            return { allowed: false, remaining: 0, retryAfter };
        }
        entry = undefined;
    }

    // Initialize or reset entry if window has passed
    if (!entry || now - entry.windowStart > UPLOAD_RATE_LIMIT_CONFIG.windowMs) {
        entry = {
            count: 1,
            windowStart: now,
            blocked: false,
        };
        uploadRateLimitStore.set(key, entry);
        return { allowed: true, remaining: UPLOAD_RATE_LIMIT_CONFIG.maxRequests - 1 };
    }

    // Increment count
    entry.count++;

    // Check if limit exceeded
    if (entry.count > UPLOAD_RATE_LIMIT_CONFIG.maxRequests) {
        entry.blocked = true;
        entry.blockExpiry = now + UPLOAD_RATE_LIMIT_CONFIG.blockDurationMs;
        uploadRateLimitStore.set(key, entry);
        const retryAfter = Math.ceil((entry.blockExpiry - now) / 1000);
        return { allowed: false, remaining: 0, retryAfter };
    }

    uploadRateLimitStore.set(key, entry);
    return { allowed: true, remaining: UPLOAD_RATE_LIMIT_CONFIG.maxRequests - entry.count };
}

module.exports = (config: any, { strapi }: { strapi: any }) => {
    return async (ctx: any, next: () => Promise<void>) => {
        const clientId = getUploadClientId(ctx);
        const result = checkUploadRateLimit(clientId);

        // Set rate limit headers
        ctx.set('X-RateLimit-Limit', String(UPLOAD_RATE_LIMIT_CONFIG.maxRequests));
        ctx.set('X-RateLimit-Remaining', String(Math.max(0, result.remaining)));
        ctx.set('X-RateLimit-Reset', String(Math.ceil(Date.now() / 1000) + Math.ceil(UPLOAD_RATE_LIMIT_CONFIG.windowMs / 1000)));

        if (!result.allowed) {
            strapi.log.warn(`[DocumentUploadLimit] Blocked upload from ${clientId}`, {
                retryAfter: result.retryAfter,
            });

            ctx.set('Retry-After', String(result.retryAfter));
            ctx.status = 429;
            ctx.body = {
                error: {
                    status: 429,
                    name: 'TooManyRequestsError',
                    message: `Upload rate limit exceeded. Please wait ${result.retryAfter} seconds before trying again.`,
                },
            };
            return;
        }

        await next();
    };
};
