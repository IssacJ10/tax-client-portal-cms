/**
 * Rate Limiting Middleware
 *
 * Protects against DoS attacks and brute force attempts.
 * Uses Redis (Cloud Memorystore) for distributed rate limiting across multiple instances.
 * Falls back to in-memory storage for local development or if Redis is unavailable.
 */

import { checkRateLimit, isRedisAvailable } from '../services/redis-client';

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

// Paths that should be excluded from rate limiting
const GLOBAL_RATE_LIMIT_EXCLUDED_PATHS = [
  '/admin/init',
  '/admin',
  '/_health',
  '/health',
  '/favicon.ico',
  '/api/connect', // OAuth flows - handled by OAuth provider's own rate limiting
];

// Log Redis status once on startup
let hasLoggedRedisStatus = false;

module.exports = (config: any, { strapi }: { strapi: any }) => {
  return async (ctx: any, next: () => Promise<void>) => {
    const path = ctx.request.path;
    const method = ctx.request.method;

    // Log Redis status once
    if (!hasLoggedRedisStatus) {
      hasLoggedRedisStatus = true;
      // Delay check to allow Redis to connect
      setTimeout(() => {
        if (isRedisAvailable()) {
          strapi.log.info('[RateLimit] Using Redis (Cloud Memorystore) for distributed rate limiting');
        } else {
          strapi.log.warn('[RateLimit] Redis not available, using in-memory fallback (not suitable for multi-instance)');
        }
      }, 2000);
    }

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
    const configInfo = GLOBAL_RATE_LIMIT_CONFIGS[category] || GLOBAL_RATE_LIMIT_CONFIGS.read;

    // Build the rate limit key (IP + category for granular limits)
    const rateLimitKey = `${clientId}:${category}`;

    // Check rate limit using Redis or fallback
    const result = await checkRateLimit(
      rateLimitKey,
      configInfo.maxRequests,
      configInfo.windowMs
    );

    // Set rate limit headers
    ctx.set('X-RateLimit-Limit', String(configInfo.maxRequests));
    ctx.set('X-RateLimit-Remaining', String(Math.max(0, result.remaining)));
    ctx.set('X-RateLimit-Reset', String(Math.ceil(Date.now() / 1000) + Math.ceil(configInfo.windowMs / 1000)));

    if (!result.allowed) {
      strapi.log.warn(`[RateLimit] Blocked request from ${clientId}`, {
        category,
        path,
        method,
        retryAfter: result.retryAfter,
        usingRedis: isRedisAvailable(),
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
module.exports.RATE_LIMIT_CONFIGS = GLOBAL_RATE_LIMIT_CONFIGS;
module.exports.getClientId = getGlobalClientId;
module.exports.getCategory = getGlobalRateLimitCategory;
