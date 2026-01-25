/**
 * Document Download Rate Limit Middleware
 *
 * Specific rate limiting for secure document downloads.
 * Limit: 30 downloads per minute per IP
 *
 * This middleware works in conjunction with the global rate-limiter
 * to provide specific limits for document operations.
 */

interface DownloadRateLimitEntry {
    count: number;
    windowStart: number;
    blocked: boolean;
    blockExpiry?: number;
}

// Document download rate limit configuration
const DOWNLOAD_RATE_LIMIT_CONFIG = {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 downloads per minute per IP
    blockDurationMs: 60 * 1000, // Block for 1 minute
};

// In-memory storage for rate limiting
const downloadRateLimitStore = new Map<string, DownloadRateLimitEntry>();

// Cleanup interval (clean expired entries every 5 minutes)
const DOWNLOAD_CLEANUP_INTERVAL = 5 * 60 * 1000;
let downloadLastCleanup = Date.now();

/**
 * Get the client identifier (IP address)
 */
function getDownloadClientId(ctx: any): string {
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
function cleanupDownloadExpiredEntries(): void {
    const now = Date.now();
    for (const [key, entry] of downloadRateLimitStore.entries()) {
        const windowExpired = now - entry.windowStart > DOWNLOAD_RATE_LIMIT_CONFIG.windowMs;
        const blockExpired = entry.blockExpiry && now > entry.blockExpiry;
        if ((windowExpired && !entry.blocked) || blockExpired) {
            downloadRateLimitStore.delete(key);
        }
    }
}

/**
 * Check and update rate limit for a client
 */
function checkDownloadRateLimit(clientId: string): { allowed: boolean; remaining: number; retryAfter?: number } {
    const now = Date.now();
    const key = `doc-download:${clientId}`;

    // Periodic cleanup
    if (now - downloadLastCleanup > DOWNLOAD_CLEANUP_INTERVAL) {
        cleanupDownloadExpiredEntries();
        downloadLastCleanup = now;
    }

    let entry = downloadRateLimitStore.get(key);

    // Check if client is currently blocked
    if (entry?.blocked && entry.blockExpiry) {
        if (now < entry.blockExpiry) {
            const retryAfter = Math.ceil((entry.blockExpiry - now) / 1000);
            return { allowed: false, remaining: 0, retryAfter };
        }
        entry = undefined;
    }

    // Initialize or reset entry if window has passed
    if (!entry || now - entry.windowStart > DOWNLOAD_RATE_LIMIT_CONFIG.windowMs) {
        entry = {
            count: 1,
            windowStart: now,
            blocked: false,
        };
        downloadRateLimitStore.set(key, entry);
        return { allowed: true, remaining: DOWNLOAD_RATE_LIMIT_CONFIG.maxRequests - 1 };
    }

    // Increment count
    entry.count++;

    // Check if limit exceeded
    if (entry.count > DOWNLOAD_RATE_LIMIT_CONFIG.maxRequests) {
        entry.blocked = true;
        entry.blockExpiry = now + DOWNLOAD_RATE_LIMIT_CONFIG.blockDurationMs;
        downloadRateLimitStore.set(key, entry);
        const retryAfter = Math.ceil((entry.blockExpiry - now) / 1000);
        return { allowed: false, remaining: 0, retryAfter };
    }

    downloadRateLimitStore.set(key, entry);
    return { allowed: true, remaining: DOWNLOAD_RATE_LIMIT_CONFIG.maxRequests - entry.count };
}

module.exports = (config: any, { strapi }: { strapi: any }) => {
    return async (ctx: any, next: () => Promise<void>) => {
        const clientId = getDownloadClientId(ctx);
        const result = checkDownloadRateLimit(clientId);

        // Set rate limit headers
        ctx.set('X-RateLimit-Limit', String(DOWNLOAD_RATE_LIMIT_CONFIG.maxRequests));
        ctx.set('X-RateLimit-Remaining', String(Math.max(0, result.remaining)));
        ctx.set('X-RateLimit-Reset', String(Math.ceil(Date.now() / 1000) + Math.ceil(DOWNLOAD_RATE_LIMIT_CONFIG.windowMs / 1000)));

        if (!result.allowed) {
            strapi.log.warn(`[DocumentDownloadLimit] Blocked download from ${clientId}`, {
                retryAfter: result.retryAfter,
            });

            ctx.set('Retry-After', String(result.retryAfter));
            ctx.status = 429;
            ctx.body = {
                error: {
                    status: 429,
                    name: 'TooManyRequestsError',
                    message: `Download rate limit exceeded. Please wait ${result.retryAfter} seconds before trying again.`,
                },
            };
            return;
        }

        await next();
    };
};
