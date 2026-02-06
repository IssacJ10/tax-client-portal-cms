'use strict';

/**
 * A set of functions called "actions" for `token`
 * Security-hardened token refresh controller with httpOnly cookie support
 */

import { AUTH_COOKIE_CONFIG } from '../../../utils/cookie-config';

// Track failed refresh attempts per IP for security monitoring
const failedAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_FAILED_ATTEMPTS = 10;
const FAILED_ATTEMPT_WINDOW = 15 * 60 * 1000; // 15 minutes

/**
 * Get client IP address
 */
function getClientIp(ctx): string {
  return ctx.request.header['x-forwarded-for']?.split(',')[0]?.trim() ||
    ctx.request.header['x-real-ip'] ||
    ctx.request.ip ||
    'unknown';
}

/**
 * Check if IP has too many failed attempts
 */
function checkFailedAttempts(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = failedAttempts.get(ip);

  if (!entry) {
    return { allowed: true };
  }

  // Reset if window has passed
  if (now - entry.lastAttempt > FAILED_ATTEMPT_WINDOW) {
    failedAttempts.delete(ip);
    return { allowed: true };
  }

  if (entry.count >= MAX_FAILED_ATTEMPTS) {
    const retryAfter = Math.ceil((FAILED_ATTEMPT_WINDOW - (now - entry.lastAttempt)) / 1000);
    return { allowed: false, retryAfter };
  }

  return { allowed: true };
}

/**
 * Record a failed attempt
 */
function recordFailedAttempt(ip: string): void {
  const now = Date.now();
  const entry = failedAttempts.get(ip);

  if (!entry || now - entry.lastAttempt > FAILED_ATTEMPT_WINDOW) {
    failedAttempts.set(ip, { count: 1, lastAttempt: now });
  } else {
    entry.count++;
    entry.lastAttempt = now;
    failedAttempts.set(ip, entry);
  }
}

/**
 * Clear failed attempts on successful refresh
 */
function clearFailedAttempts(ip: string): void {
  failedAttempts.delete(ip);
}

/**
 * Validate refresh token format (basic sanity check)
 */
function isValidTokenFormat(token: string): boolean {
  // JWT format: header.payload.signature
  if (typeof token !== 'string') return false;
  if (token.length < 50 || token.length > 2000) return false;
  const parts = token.split('.');
  return parts.length === 3;
}

module.exports = {
  async refresh(ctx) {
    const clientIp = getClientIp(ctx);

    // Security: Check for too many failed attempts
    const attemptCheck = checkFailedAttempts(clientIp);
    if (!attemptCheck.allowed) {
      strapi.log.warn(`[Security] Token refresh blocked for IP ${clientIp} - too many failed attempts`);
      ctx.status = 429;
      return ctx.send({
        error: {
          status: 429,
          name: 'TooManyRequestsError',
          message: `Too many failed refresh attempts. Please wait ${attemptCheck.retryAfter} seconds.`,
        },
      });
    }

    // Try to get refresh token from httpOnly cookie first, then fall back to body (backwards compatibility)
    const refreshToken = ctx.cookies.get('refreshToken') || ctx.request.body?.refreshToken;

    // Validate refresh token is provided
    if (!refreshToken) {
      recordFailedAttempt(clientIp);
      return ctx.badRequest('No refresh token provided');
    }

    // Validate token format before attempting to verify
    if (!isValidTokenFormat(refreshToken)) {
      recordFailedAttempt(clientIp);
      strapi.log.warn(`[Security] Invalid token format from IP ${clientIp}`);
      return ctx.badRequest('Invalid token format');
    }

    try {
      // 1. Verify the Refresh Token
      const jwtService = strapi.plugin('users-permissions').service('jwt');
      let payload;

      try {
        payload = await jwtService.verify(refreshToken);
      } catch (verifyError) {
        recordFailedAttempt(clientIp);
        strapi.log.warn(`[Security] Token verification failed from IP ${clientIp}: ${verifyError.message}`);
        return ctx.badRequest('Invalid or expired refresh token');
      }

      // 2. Check if it's a valid Refresh Token type
      if (payload.type !== 'refresh') {
        recordFailedAttempt(clientIp);
        strapi.log.warn(`[Security] Wrong token type used for refresh from IP ${clientIp}`);
        return ctx.badRequest('Invalid token type');
      }

      // 3. Validate user ID in payload
      if (!payload.id || typeof payload.id !== 'number') {
        recordFailedAttempt(clientIp);
        return ctx.badRequest('Invalid token payload');
      }

      // 4. Check if user still exists/active
      const user = await strapi.entityService.findOne('plugin::users-permissions.user', payload.id);
      if (!user) {
        recordFailedAttempt(clientIp);
        strapi.log.warn(`[Security] Token refresh for non-existent user ${payload.id} from IP ${clientIp}`);
        return ctx.badRequest('User not found');
      }

      if (user.blocked) {
        recordFailedAttempt(clientIp);
        strapi.log.warn(`[Security] Token refresh attempted for blocked user ${user.email} from IP ${clientIp}`);
        return ctx.badRequest('User account is blocked');
      }

      // 5. Verify Token Version (Server-Side Invalidation Check)
      const currentVersion = user.tokenVersion || 1;
      if (payload.version && payload.version !== currentVersion) {
        recordFailedAttempt(clientIp);
        strapi.log.info(`[Security] Token refresh with old version for user ${user.email}`);
        return ctx.badRequest('Refresh token has been invalidated. Please log in again.');
      }

      // Success - Clear failed attempts
      clearFailedAttempts(clientIp);

      // 6. Issue NEW Access Token (1h)
      const newAccessToken = jwtService.issue({ id: user.id });

      // 7. Issue NEW Refresh Token (7d) with SAME version
      const newRefreshToken = jwtService.issue(
        {
          id: user.id,
          type: 'refresh',
          version: currentVersion,
        },
        { expiresIn: '7d' }
      );

      // Set new tokens as httpOnly cookies
      ctx.cookies.set('jwt', newAccessToken, AUTH_COOKIE_CONFIG.jwt);
      ctx.cookies.set('refreshToken', newRefreshToken, AUTH_COOKIE_CONFIG.refresh);

      strapi.log.debug(`[Auth] Token refreshed for user ${user.email} (httpOnly cookies)`);

      // Return tokens in body for backwards compatibility
      return ctx.send({
        jwt: newAccessToken,
        refreshToken: newRefreshToken,
        message: 'Token refreshed. New tokens set in httpOnly cookies.'
      });
    } catch (err) {
      recordFailedAttempt(clientIp);
      strapi.log.error(`[Security] Token refresh error from IP ${clientIp}:`, err);
      return ctx.badRequest('Token refresh failed');
    }
  },
};
