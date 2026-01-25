/**
 * Rate Limiting Middleware
 * Protects against DoS attacks and brute force attempts
 */

interface GlobalRateLimitEntry {
  count: number;
  windowStart: number;
  blocked: boolean;
  blockExpiry?: number;
}

interface GlobalRateLimitConfig {
  windowMs: number;
  maxRequests: number;
  blockDurationMs?: number;
  skipSuccessfulRequests?: boolean;
}

// Rate limit configurations for different endpoint types
const GLOBAL_RATE_LIMIT_CONFIGS: Record<string, GlobalRateLimitConfig> = {
  // Authentication endpoints - strict but reasonable
  auth: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20, // 20 attempts per minute
    blockDurationMs: 2 * 60 * 1000, // Block for 2 minutes after exceeding
  },
  // Token refresh - moderate
  token: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 refreshes per minute
    blockDurationMs: 60 * 1000, // Block for 1 minute
  },
  // Password reset - strict
  passwordReset: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 5, // 5 attempts per hour
    blockDurationMs: 30 * 60 * 1000, // Block for 30 minutes
  },
  // Registration - moderate
  register: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10, // 10 registrations per hour per IP
    blockDurationMs: 30 * 60 * 1000, // Block for 30 minutes
  },
  // File uploads
  upload: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 uploads per minute
    blockDurationMs: 60 * 1000, // Block for 1 minute
  },
  // Secure document uploads (stricter limit)
  documentUpload: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 uploads per minute per IP
    blockDurationMs: 2 * 60 * 1000, // Block for 2 minutes
  },
  // Secure document downloads
  documentDownload: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 downloads per minute per IP
    blockDurationMs: 60 * 1000, // Block for 1 minute
  },
  // General write operations (POST, PUT, PATCH, DELETE)
  write: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 write ops per minute
    blockDurationMs: 30 * 1000, // Block for 30 seconds
  },
  // General read operations (GET)
  read: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 300, // 300 reads per minute
    blockDurationMs: 15 * 1000, // Block for 15 seconds
  },
  // Admin operations
  admin: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 200, // 200 ops per minute
    blockDurationMs: 30 * 1000, // Block for 30 seconds
  },
};

// In-memory storage for rate limiting
// In production, consider using Redis for distributed rate limiting
const globalRateLimitStore = new Map<string, GlobalRateLimitEntry>();

// Cleanup interval (clean expired entries every 5 minutes)
const GLOBAL_CLEANUP_INTERVAL = 5 * 60 * 1000;
let globalLastCleanup = Date.now();

/**
 * Get the client identifier (IP address)
 */
function getGlobalClientId(ctx: any): string {
  // Check for X-Forwarded-For header (for proxied requests)
  const forwardedFor = ctx.request.header['x-forwarded-for'];
  if (forwardedFor) {
    // Take the first IP in the chain
    return forwardedFor.split(',')[0].trim();
  }

  // Check for X-Real-IP header
  const realIp = ctx.request.header['x-real-ip'];
  if (realIp) {
    return realIp;
  }

  // Fall back to direct IP
  return ctx.request.ip || 'unknown';
}

/**
 * Determine the rate limit category for a request
 */
function getGlobalRateLimitCategory(path: string, method: string): string {
  // Auth endpoints
  if (path.includes('/auth/local') || path.includes('/auth/forgot-password')) {
    if (path.includes('forgot-password') || path.includes('reset-password')) {
      return 'passwordReset';
    }
    if (path.includes('register')) {
      return 'register';
    }
    return 'auth';
  }

  // Token endpoints
  if (path.includes('/token/')) {
    return 'token';
  }

  // Secure document upload endpoint (stricter limit)
  if (path.includes('/documents/upload')) {
    return 'documentUpload';
  }

  // Secure document download endpoints
  if (path.includes('/documents/') && path.includes('/download')) {
    return 'documentDownload';
  }

  // Upload endpoints
  if (path.includes('/upload')) {
    return 'upload';
  }

  // Admin endpoints
  if (path.includes('/admin') || path.includes('/content-manager')) {
    return 'admin';
  }

  // Write vs Read operations
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return 'write';
  }

  return 'read';
}

/**
 * Clean up expired entries from the store
 */
function cleanupGlobalExpiredEntries(): void {
  const now = Date.now();

  for (const [key, entry] of globalRateLimitStore.entries()) {
    // Remove entries that are:
    // 1. No longer blocked and outside the window
    // 2. Block has expired
    const config = GLOBAL_RATE_LIMIT_CONFIGS[key.split(':')[1]] || GLOBAL_RATE_LIMIT_CONFIGS.read;
    const windowExpired = now - entry.windowStart > config.windowMs;
    const blockExpired = entry.blockExpiry && now > entry.blockExpiry;

    if ((windowExpired && !entry.blocked) || blockExpired) {
      globalRateLimitStore.delete(key);
    }
  }
}

/**
 * Check and update rate limit for a client
 */
function checkGlobalRateLimit(clientId: string, category: string): { allowed: boolean; remaining: number; retryAfter?: number } {
  const now = Date.now();
  const config = GLOBAL_RATE_LIMIT_CONFIGS[category] || GLOBAL_RATE_LIMIT_CONFIGS.read;
  const key = `${clientId}:${category}`;

  // Periodic cleanup
  if (now - globalLastCleanup > GLOBAL_CLEANUP_INTERVAL) {
    cleanupGlobalExpiredEntries();
    globalLastCleanup = now;
  }

  let entry = globalRateLimitStore.get(key);

  // Check if client is currently blocked
  if (entry?.blocked && entry.blockExpiry) {
    if (now < entry.blockExpiry) {
      const retryAfter = Math.ceil((entry.blockExpiry - now) / 1000);
      return { allowed: false, remaining: 0, retryAfter };
    }
    // Block has expired, reset entry
    entry = undefined;
  }

  // Initialize or reset entry if window has passed
  if (!entry || now - entry.windowStart > config.windowMs) {
    entry = {
      count: 1,
      windowStart: now,
      blocked: false,
    };
    globalRateLimitStore.set(key, entry);
    return { allowed: true, remaining: config.maxRequests - 1 };
  }

  // Increment count
  entry.count++;

  // Check if limit exceeded
  if (entry.count > config.maxRequests) {
    entry.blocked = true;
    entry.blockExpiry = now + (config.blockDurationMs || 60000);
    globalRateLimitStore.set(key, entry);

    const retryAfter = Math.ceil((entry.blockExpiry - now) / 1000);
    return { allowed: false, remaining: 0, retryAfter };
  }

  globalRateLimitStore.set(key, entry);
  return { allowed: true, remaining: config.maxRequests - entry.count };
}

// Paths that should be excluded from rate limiting
const GLOBAL_RATE_LIMIT_EXCLUDED_PATHS = [
  '/admin/init',
  '/admin',
  '/_health',
  '/health',
  '/favicon.ico',
  '/api/connect', // OAuth flows - handled by OAuth provider's own rate limiting
];

module.exports = (config: any, { strapi }: { strapi: any }) => {
  return async (ctx: any, next: () => Promise<void>) => {
    const path = ctx.request.path;
    const method = ctx.request.method;

    // Skip rate limiting for excluded paths
    if (GLOBAL_RATE_LIMIT_EXCLUDED_PATHS.some((excluded) => path === excluded || path.startsWith(excluded))) {
      return next();
    }

    // Skip OPTIONS requests (CORS preflight)
    if (method === 'OPTIONS') {
      return next();
    }

    const clientId = getGlobalClientId(ctx);
    const category = getGlobalRateLimitCategory(path, method);

    const result = checkGlobalRateLimit(clientId, category);

    // Set rate limit headers
    const config_info = GLOBAL_RATE_LIMIT_CONFIGS[category] || GLOBAL_RATE_LIMIT_CONFIGS.read;
    ctx.set('X-RateLimit-Limit', String(config_info.maxRequests));
    ctx.set('X-RateLimit-Remaining', String(Math.max(0, result.remaining)));
    ctx.set('X-RateLimit-Reset', String(Math.ceil(Date.now() / 1000) + Math.ceil(config_info.windowMs / 1000)));

    if (!result.allowed) {
      strapi.log.warn(`[RateLimit] Blocked request from ${clientId}`, {
        category,
        path,
        method,
        retryAfter: result.retryAfter,
      });

      ctx.set('Retry-After', String(result.retryAfter));
      ctx.status = 429;
      ctx.body = {
        error: {
          status: 429,
          name: 'TooManyRequestsError',
          message: `Too many requests. Please wait ${result.retryAfter} seconds before trying again.`,
        },
      };
      return;
    }

    await next();
  };
};

// Export for testing
module.exports.checkRateLimit = checkGlobalRateLimit;
module.exports.rateLimitStore = globalRateLimitStore;
module.exports.RATE_LIMIT_CONFIGS = GLOBAL_RATE_LIMIT_CONFIGS;
