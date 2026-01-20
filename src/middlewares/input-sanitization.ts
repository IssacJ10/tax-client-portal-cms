/**
 * Input Sanitization Middleware
 * Protects against XSS, SQL injection, and other malicious input attacks
 */

// HTML entities to escape
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

// Dangerous patterns that indicate potential XSS attacks
const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi, // onclick=, onload=, etc.
  /data:\s*text\/html/gi,
  /<iframe/gi,
  /<object/gi,
  /<embed/gi,
  /<form/gi,
  /expression\s*\(/gi, // CSS expression
  /url\s*\(\s*['"]*\s*data:/gi,
  /<!--.*-->/g, // HTML comments
  /<!\[CDATA\[/gi,
];

// SQL injection patterns
const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE)\b.*\b(FROM|INTO|TABLE|DATABASE|WHERE|SET|VALUES)\b)/gi,
  /(\bOR\b\s+['"]?\d+['"]?\s*=\s*['"]?\d+['"]?)/gi, // OR 1=1
  /(\bAND\b\s+['"]?\d+['"]?\s*=\s*['"]?\d+['"]?)/gi, // AND 1=1
  /(--\s*$|;\s*--)/gm, // SQL comments
  /(\b(WAITFOR|DELAY|SLEEP)\b)/gi, // Time-based injection
  /(';\s*(DROP|DELETE|UPDATE|INSERT))/gi, // Chained queries
  /(UNION\s+ALL\s+SELECT)/gi,
  /(\bINTO\s+OUTFILE\b)/gi,
  /(\bLOAD_FILE\b)/gi,
];

// NoSQL injection patterns
const NOSQL_INJECTION_PATTERNS = [
  /\$where\s*:/gi,
  /\$gt\s*:/gi,
  /\$lt\s*:/gi,
  /\$ne\s*:/gi,
  /\$regex\s*:/gi,
  /\$or\s*:\s*\[/gi,
  /\$and\s*:\s*\[/gi,
];

// Path traversal patterns
const PATH_TRAVERSAL_PATTERNS = [
  /\.\.[\/\\]/g,
  /%2e%2e[\/\\]/gi,
  /\.\.%2f/gi,
  /%2e%2e%2f/gi,
];

// Maximum input lengths
const MAX_LENGTHS = {
  string: 10000,
  name: 100,
  email: 254,
  phone: 20,
  address: 500,
  notes: 5000,
  filename: 255,
};

/**
 * Escape HTML special characters
 */
function escapeHtml(str: string): string {
  return str.replace(/[&<>"'`=\/]/g, (char) => HTML_ENTITIES[char] || char);
}

/**
 * Check for XSS patterns
 */
function containsXssPatterns(value: string): boolean {
  return XSS_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * Check for SQL injection patterns
 */
function containsSqlInjection(value: string): boolean {
  return SQL_INJECTION_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * Check for NoSQL injection patterns
 */
function containsNoSqlInjection(value: string): boolean {
  return NOSQL_INJECTION_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * Check for path traversal attempts
 */
function containsPathTraversal(value: string): boolean {
  return PATH_TRAVERSAL_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * Strip dangerous HTML tags
 */
function stripDangerousHtml(str: string): string {
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
    .replace(/<object[^>]*>.*?<\/object>/gi, '')
    .replace(/<embed[^>]*>/gi, '')
    .replace(/<form[^>]*>.*?<\/form>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/data:\s*text\/html/gi, '');
}

/**
 * Sanitize a string value
 */
function sanitizeString(value: string, fieldName?: string): string {
  // Determine max length based on field name
  let maxLength = MAX_LENGTHS.string;
  if (fieldName) {
    const lowerField = fieldName.toLowerCase();
    if (lowerField.includes('name') || lowerField.includes('first') || lowerField.includes('last')) {
      maxLength = MAX_LENGTHS.name;
    } else if (lowerField.includes('email')) {
      maxLength = MAX_LENGTHS.email;
    } else if (lowerField.includes('phone')) {
      maxLength = MAX_LENGTHS.phone;
    } else if (lowerField.includes('address')) {
      maxLength = MAX_LENGTHS.address;
    } else if (lowerField.includes('notes') || lowerField.includes('comment') || lowerField.includes('description')) {
      maxLength = MAX_LENGTHS.notes;
    }
  }

  // Truncate to max length
  let sanitized = value.slice(0, maxLength);

  // Strip dangerous HTML
  sanitized = stripDangerousHtml(sanitized);

  // Escape remaining HTML characters
  sanitized = escapeHtml(sanitized);

  // Trim whitespace
  sanitized = sanitized.trim();

  return sanitized;
}

/**
 * Recursively sanitize an object
 */
function sanitizeObject(obj: Record<string, unknown>, parentKey?: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = parentKey ? `${parentKey}.${key}` : key;

    if (typeof value === 'string') {
      result[key] = sanitizeString(value, key);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item, index) => {
        if (typeof item === 'string') {
          return sanitizeString(item, `${fullKey}[${index}]`);
        } else if (typeof item === 'object' && item !== null) {
          return sanitizeObject(item as Record<string, unknown>, `${fullKey}[${index}]`);
        }
        return item;
      });
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeObject(value as Record<string, unknown>, fullKey);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Check if any string in an object contains dangerous patterns
 */
function containsDangerousPatterns(obj: unknown, path: string = ''): { dangerous: boolean; reason?: string; path?: string } {
  if (typeof obj === 'string') {
    if (containsXssPatterns(obj)) {
      return { dangerous: true, reason: 'XSS pattern detected', path };
    }
    if (containsSqlInjection(obj)) {
      return { dangerous: true, reason: 'SQL injection pattern detected', path };
    }
    if (containsNoSqlInjection(obj)) {
      return { dangerous: true, reason: 'NoSQL injection pattern detected', path };
    }
    if (containsPathTraversal(obj)) {
      return { dangerous: true, reason: 'Path traversal attempt detected', path };
    }
  } else if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const result = containsDangerousPatterns(obj[i], `${path}[${i}]`);
      if (result.dangerous) return result;
    }
  } else if (typeof obj === 'object' && obj !== null) {
    for (const [key, value] of Object.entries(obj)) {
      const result = containsDangerousPatterns(value, path ? `${path}.${key}` : key);
      if (result.dangerous) return result;
    }
  }

  return { dangerous: false };
}

/**
 * Sanitize filename to prevent directory traversal
 */
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/\.\./g, '') // Remove path traversal
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '') // Remove dangerous characters
    .slice(0, MAX_LENGTHS.filename);
}

// Paths that should be excluded from sanitization (e.g., binary uploads, OAuth callbacks)
const SANITIZATION_EXCLUDED_PATHS = [
  '/api/upload',
  '/upload',
  '/api/connect', // OAuth callbacks - codes contain special characters that must not be escaped
];

// Paths that require stricter validation
const SANITIZATION_STRICT_PATHS = [
  '/api/auth/',
  '/api/token/',
  '/api/users-permissions/',
];

module.exports = (config, { strapi }) => {
  return async (ctx, next) => {
    const path = ctx.request.path;
    const method = ctx.request.method;

    // Skip sanitization for excluded paths (file uploads handled separately)
    if (SANITIZATION_EXCLUDED_PATHS.some((excluded) => path.startsWith(excluded))) {
      // Still validate filenames in upload requests
      if (ctx.request.files) {
        for (const [key, file] of Object.entries(ctx.request.files)) {
          const files = Array.isArray(file) ? file : [file];
          for (const f of files) {
            if (f.originalFilename) {
              f.originalFilename = sanitizeFilename(f.originalFilename);
            }
          }
        }
      }
      return next();
    }

    // Only process POST, PUT, PATCH requests with body data
    if (['POST', 'PUT', 'PATCH'].includes(method) && ctx.request.body) {
      const body = ctx.request.body;

      // Check for dangerous patterns
      const dangerCheck = containsDangerousPatterns(body);
      if (dangerCheck.dangerous) {
        strapi.log.warn(`[Security] Blocked malicious request: ${dangerCheck.reason} at ${dangerCheck.path}`, {
          ip: ctx.request.ip,
          path: path,
          method: method,
          userAgent: ctx.request.header['user-agent'],
        });

        ctx.status = 400;
        ctx.body = {
          error: {
            status: 400,
            name: 'ValidationError',
            message: 'Invalid input detected. Please check your data and try again.',
          },
        };
        return;
      }

      // Sanitize the request body
      if (typeof body === 'object' && body !== null) {
        ctx.request.body = sanitizeObject(body);
      }
    }

    // Sanitize query parameters
    if (ctx.query && Object.keys(ctx.query).length > 0) {
      const queryCheck = containsDangerousPatterns(ctx.query);
      if (queryCheck.dangerous) {
        strapi.log.warn(`[Security] Blocked malicious query params: ${queryCheck.reason}`, {
          ip: ctx.request.ip,
          path: path,
          query: ctx.query,
        });

        ctx.status = 400;
        ctx.body = {
          error: {
            status: 400,
            name: 'ValidationError',
            message: 'Invalid query parameters.',
          },
        };
        return;
      }

      // Sanitize query params
      const sanitizedQuery: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(ctx.query)) {
        if (typeof value === 'string') {
          sanitizedQuery[key] = sanitizeString(value, key);
        } else if (Array.isArray(value)) {
          sanitizedQuery[key] = value.map((v) => (typeof v === 'string' ? sanitizeString(v) : v));
        } else {
          sanitizedQuery[key] = value;
        }
      }
      ctx.query = sanitizedQuery;
    }

    await next();
  };
};
