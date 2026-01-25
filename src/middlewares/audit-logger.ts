/**
 * Audit Logger Middleware
 * Logs all security-relevant operations for compliance and forensics
 */

interface AuditLogEntry {
  timestamp: string;
  eventType: string;
  userId?: string | number;
  userEmail?: string;
  ip: string;
  userAgent?: string;
  method: string;
  path: string;
  statusCode?: number;
  duration?: number;
  resourceType?: string;
  resourceId?: string;
  action?: string;
  details?: Record<string, any>;
  success: boolean;
  errorMessage?: string;
}

// Security-sensitive paths that should always be logged
const AUDIT_PATHS = [
  '/api/auth/',
  '/api/token/',
  '/api/users/',
  '/api/filings/',
  '/api/personal-filings/',
  '/api/corporate-filings/',
  '/api/trust-filings/',
  '/api/payments/',
  '/api/documents/',
  '/upload',
];

// Sensitive fields that should be masked in logs
const SENSITIVE_FIELDS = [
  'password',
  'sin',
  'socialInsuranceNumber',
  'token',
  'refreshToken',
  'jwt',
  'secret',
  'apiKey',
  'creditCard',
  'cardNumber',
  'cvv',
  'ssn',
];

/**
 * Mask sensitive data in objects
 */
function maskSensitiveData(obj: any, depth = 0): any {
  if (depth > 5) return '[MAX_DEPTH]'; // Prevent infinite recursion

  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => maskSensitiveData(item, depth + 1));
  }

  const masked: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();

    // Check if field is sensitive
    const isSensitive = SENSITIVE_FIELDS.some(field =>
      lowerKey.includes(field.toLowerCase())
    );

    if (isSensitive) {
      masked[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      masked[key] = maskSensitiveData(value, depth + 1);
    } else {
      masked[key] = value;
    }
  }
  return masked;
}

/**
 * Get client IP from request
 */
function getClientIpAddress(ctx: any): string {
  return ctx.request.header['x-forwarded-for']?.split(',')[0]?.trim()
    || ctx.request.header['x-real-ip']
    || ctx.request.ip
    || 'unknown';
}

/**
 * Extract resource type and ID from path
 */
function extractResource(path: string): { type?: string; id?: string } {
  const matches = path.match(/\/api\/([a-z\-]+)s?\/([a-zA-Z0-9]+)?/);
  if (matches) {
    return {
      type: matches[1],
      id: matches[2],
    };
  }
  return {};
}

/**
 * Determine action from method
 */
function getAction(method: string): string {
  switch (method) {
    case 'GET': return 'READ';
    case 'POST': return 'CREATE';
    case 'PUT': return 'UPDATE';
    case 'PATCH': return 'UPDATE';
    case 'DELETE': return 'DELETE';
    default: return method;
  }
}

/**
 * Should this request be audited?
 */
function shouldAudit(path: string, method: string): boolean {
  // Always audit auth-related paths
  if (AUDIT_PATHS.some(auditPath => path.startsWith(auditPath))) {
    return true;
  }

  // Audit all write operations
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return true;
  }

  // Skip GET requests to non-sensitive paths
  return false;
}

module.exports = (config: any, { strapi }: { strapi: any }) => {
  return async (ctx: any, next: () => Promise<void>) => {
    const startTime = Date.now();
    const path = ctx.request.path;
    const method = ctx.request.method;

    // Skip if not auditable
    if (!shouldAudit(path, method)) {
      return next();
    }

    // Get user info from context (set by auth middleware)
    const user = ctx.state?.user;
    const resource = extractResource(path);

    // Create initial log entry
    const logEntry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      eventType: 'API_REQUEST',
      userId: user?.id,
      userEmail: user?.email,
      ip: getClientIpAddress(ctx),
      userAgent: ctx.request.header['user-agent'],
      method,
      path,
      resourceType: resource.type,
      resourceId: resource.id,
      action: getAction(method),
      success: false,
    };

    // Special handling for auth events
    if (path.includes('/auth/local')) {
      logEntry.eventType = path.includes('register') ? 'USER_REGISTER' : 'USER_LOGIN';
      // Don't log email from body for failed logins (could be enumeration attack)
    } else if (path.includes('/auth/forgot-password')) {
      logEntry.eventType = 'PASSWORD_RESET_REQUEST';
    } else if (path.includes('/token/refresh')) {
      logEntry.eventType = 'TOKEN_REFRESH';
    } else if (path.includes('/token/revoke') || path.includes('logout')) {
      logEntry.eventType = 'USER_LOGOUT';
    } else if (path.includes('/documents/upload')) {
      logEntry.eventType = 'SECURE_FILE_UPLOAD';
    } else if (path.includes('/documents/') && path.includes('/admin-download')) {
      logEntry.eventType = 'ADMIN_FILE_DOWNLOAD';
    } else if (path.includes('/documents/') && path.includes('/download')) {
      logEntry.eventType = 'SECURE_FILE_DOWNLOAD';
    } else if (path.includes('/documents/') && method === 'DELETE') {
      logEntry.eventType = 'SECURE_FILE_DELETE';
    } else if (path.includes('/upload')) {
      logEntry.eventType = 'FILE_UPLOAD';
    } else if (path.includes('/personal-filing')) {
      logEntry.eventType = 'PERSONAL_FILING_ACCESS';
    } else if (path.includes('/corporate-filing')) {
      logEntry.eventType = 'CORPORATE_FILING_ACCESS';
    } else if (path.includes('/trust-filing')) {
      logEntry.eventType = 'TRUST_FILING_ACCESS';
    } else if (path.includes('/payment')) {
      logEntry.eventType = 'PAYMENT_ACCESS';
    }

    try {
      // Execute the request
      await next();

      // Update log entry with response info
      logEntry.statusCode = ctx.status;
      logEntry.duration = Date.now() - startTime;
      logEntry.success = ctx.status >= 200 && ctx.status < 400;

      // Log successful auth events with masked details
      if (logEntry.success && ['USER_LOGIN', 'USER_REGISTER'].includes(logEntry.eventType)) {
        const responseUser = ctx.body?.user;
        if (responseUser) {
          logEntry.userId = responseUser.id;
          logEntry.userEmail = responseUser.email;
        }
      }

      // Log the entry
      if (logEntry.success) {
        strapi.log.info(`[AUDIT] ${logEntry.eventType}`, maskSensitiveData(logEntry));
      } else {
        strapi.log.warn(`[AUDIT] ${logEntry.eventType} - FAILED`, maskSensitiveData(logEntry));
      }

    } catch (error: any) {
      // Log failed requests
      logEntry.statusCode = ctx.status || 500;
      logEntry.duration = Date.now() - startTime;
      logEntry.success = false;
      logEntry.errorMessage = error.message;

      strapi.log.error(`[AUDIT] ${logEntry.eventType} - ERROR`, {
        ...maskSensitiveData(logEntry),
        errorStack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });

      // Re-throw to let error handlers process it
      throw error;
    }

    // Store audit log in database for compliance (optional - uncomment if needed)
    // try {
    //   await strapi.db.query('api::audit-log.audit-log').create({
    //     data: maskSensitiveData(logEntry),
    //   });
    // } catch (dbError) {
    //   strapi.log.error('[AUDIT] Failed to store audit log:', dbError);
    // }
  };
};

// Export utilities for use in other modules
module.exports.maskSensitiveData = maskSensitiveData;
module.exports.getClientIpAddress = getClientIpAddress;
