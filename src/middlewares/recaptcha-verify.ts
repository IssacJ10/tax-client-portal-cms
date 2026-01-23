/**
 * reCAPTCHA v3 Verification Middleware
 *
 * Verifies Google reCAPTCHA tokens on protected endpoints to prevent bot attacks.
 * This middleware intercepts requests to auth endpoints and verifies the reCAPTCHA token.
 *
 * Configuration:
 * - Set RECAPTCHA_SECRET_KEY in your .env file
 * - Set RECAPTCHA_MIN_SCORE (optional, defaults to 0.5)
 *
 * Protected endpoints:
 * - POST /api/auth/local (login)
 * - POST /api/auth/local/register (registration)
 * - POST /api/auth/forgot-password (password reset)
 */

interface RecaptchaResponse {
  success: boolean;
  score?: number;
  action?: string;
  challenge_ts?: string;
  hostname?: string;
  'error-codes'?: string[];
}

// Endpoints that require reCAPTCHA verification
const PROTECTED_ENDPOINTS = [
  '/api/auth/local',
  '/api/auth/local/register',
  '/api/auth/forgot-password',
];

/**
 * Verify reCAPTCHA token with Google's API
 */
async function verifyRecaptchaToken(
  token: string,
  secretKey: string,
  expectedAction?: string
): Promise<{ valid: boolean; score?: number; error?: string }> {
  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        secret: secretKey,
        response: token,
      }),
    });

    const data = await response.json() as RecaptchaResponse;

    if (!data.success) {
      const errorCodes = data['error-codes']?.join(', ') || 'Unknown error';
      return { valid: false, error: `reCAPTCHA verification failed: ${errorCodes}` };
    }

    // Check if action matches (if expected action is provided)
    if (expectedAction && data.action !== expectedAction) {
      return {
        valid: false,
        score: data.score,
        error: `reCAPTCHA action mismatch: expected ${expectedAction}, got ${data.action}`,
      };
    }

    return { valid: true, score: data.score };
  } catch (error: any) {
    return { valid: false, error: `reCAPTCHA verification error: ${error.message}` };
  }
}

/**
 * Get expected action from endpoint path
 */
function getExpectedAction(path: string): string {
  if (path.includes('/register')) return 'register';
  if (path.includes('/forgot-password')) return 'forgot_password';
  if (path.includes('/auth/local')) return 'login';
  return 'unknown';
}

module.exports = (config: any, { strapi }: { strapi: any }) => {
  return async (ctx: any, next: () => Promise<void>) => {
    const path = ctx.request.path;
    const method = ctx.request.method;

    // Only check POST requests to protected endpoints
    if (method !== 'POST') {
      return next();
    }

    // Check if this endpoint requires reCAPTCHA
    const isProtected = PROTECTED_ENDPOINTS.some(endpoint => path.startsWith(endpoint));
    if (!isProtected) {
      return next();
    }

    // Get secret key from environment
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;

    // If no secret key is configured, skip verification (development mode)
    if (!secretKey) {
      strapi.log.warn('[reCAPTCHA] No secret key configured. Skipping verification (development mode).');
      return next();
    }

    // Get token from request body
    const token = ctx.request.body?.recaptchaToken;

    if (!token) {
      strapi.log.warn('[reCAPTCHA] No token provided for protected endpoint:', path);
      ctx.status = 400;
      ctx.body = {
        error: {
          status: 400,
          name: 'ValidationError',
          message: 'reCAPTCHA verification required',
          details: { field: 'recaptchaToken' },
        },
      };
      return;
    }

    // Verify the token
    const expectedAction = getExpectedAction(path);
    const result = await verifyRecaptchaToken(token, secretKey, expectedAction);

    if (!result.valid) {
      strapi.log.warn('[reCAPTCHA] Verification failed:', {
        path,
        error: result.error,
        score: result.score,
      });
      ctx.status = 403;
      ctx.body = {
        error: {
          status: 403,
          name: 'ForbiddenError',
          message: 'reCAPTCHA verification failed. Please try again.',
          details: { reason: 'bot_detected' },
        },
      };
      return;
    }

    // Check score threshold (reCAPTCHA v3 returns a score from 0.0 to 1.0)
    const minScore = parseFloat(process.env.RECAPTCHA_MIN_SCORE || '0.5');
    if (result.score !== undefined && result.score < minScore) {
      strapi.log.warn('[reCAPTCHA] Low score detected:', {
        path,
        score: result.score,
        threshold: minScore,
      });
      ctx.status = 403;
      ctx.body = {
        error: {
          status: 403,
          name: 'ForbiddenError',
          message: 'Security verification failed. Please try again.',
          details: { reason: 'low_score' },
        },
      };
      return;
    }

    // Log successful verification
    strapi.log.info('[reCAPTCHA] Verification successful:', {
      path,
      action: expectedAction,
      score: result.score,
    });

    // Remove recaptchaToken from body before passing to next middleware
    // (so it doesn't get stored in the database)
    if (ctx.request.body?.recaptchaToken) {
      delete ctx.request.body.recaptchaToken;
    }

    return next();
  };
};
