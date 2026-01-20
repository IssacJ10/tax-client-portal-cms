/**
 * Security Headers Middleware
 * Adds essential security headers to all responses (similar to helmet.js)
 */

// Content Security Policy configuration
const CSP_DIRECTIVES = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Strapi admin needs these
  'style-src': ["'self'", "'unsafe-inline'"], // Strapi admin needs inline styles
  'img-src': ["'self'", 'data:', 'blob:', 'https:'],
  'font-src': ["'self'", 'data:'],
  'connect-src': [
    "'self'",
    'http://localhost:3000',
    'http://localhost:3001',
    'https://*.googleapis.com',
    'https://*.google.com',
  ],
  'frame-ancestors': ["'self'"], // Allow Strapi admin iframe
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'object-src': ["'none'"],
  'media-src': ["'self'", 'data:', 'blob:'],
  'worker-src': ["'self'", 'blob:'],
};

/**
 * Build CSP header string from directives
 */
function buildCspHeader(): string {
  return Object.entries(CSP_DIRECTIVES)
    .map(([directive, values]) => {
      if (values.length === 0) {
        return directive;
      }
      return `${directive} ${values.join(' ')}`;
    })
    .join('; ');
}

// Permissions Policy (formerly Feature-Policy)
const PERMISSIONS_POLICY = [
  'camera=()',
  'microphone=()',
  'geolocation=()',
  'payment=()',
  'usb=()',
  'accelerometer=()',
  'gyroscope=()',
  'magnetometer=()',
  'midi=()',
].join(', ');

// Paths that need relaxed security (Strapi admin)
const ADMIN_PATHS = [
  '/admin',
  '/content-manager',
  '/content-type-builder',
  '/upload/files',
];

module.exports = (config, { strapi }) => {
  return async (ctx, next) => {
    // Execute the request first
    await next();

    const path = ctx.request.path;
    const isAdminPath = ADMIN_PATHS.some((adminPath) => path.startsWith(adminPath));

    // Core security headers (applied to all responses)

    // Prevent MIME type sniffing
    ctx.set('X-Content-Type-Options', 'nosniff');

    // XSS Protection (legacy browsers)
    ctx.set('X-XSS-Protection', '1; mode=block');

    // Prevent clickjacking
    ctx.set('X-Frame-Options', isAdminPath ? 'SAMEORIGIN' : 'DENY');

    // Control referrer information
    ctx.set('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Restrict browser features
    ctx.set('Permissions-Policy', PERMISSIONS_POLICY);

    // Remove server identification
    ctx.remove('X-Powered-By');
    ctx.set('Server', 'secure-server');

    // Prevent browsers from caching sensitive data (for API responses)
    if (path.startsWith('/api/')) {
      ctx.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      ctx.set('Pragma', 'no-cache');
      ctx.set('Expires', '0');
    }

    // Content Security Policy
    // Apply stricter CSP for API endpoints, relaxed for admin
    if (!isAdminPath) {
      ctx.set('Content-Security-Policy', buildCspHeader());
    }

    // HTTP Strict Transport Security (HSTS)
    // Only apply in production
    if (process.env.NODE_ENV === 'production') {
      ctx.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }

    // Cross-Origin headers for API
    if (path.startsWith('/api/')) {
      // Prevent other sites from embedding API responses
      ctx.set('Cross-Origin-Resource-Policy', 'same-site');

      // Control opener behavior
      ctx.set('Cross-Origin-Opener-Policy', 'same-origin');
    }

    // Add security headers for file downloads
    if (ctx.response.type && (
      ctx.response.type.includes('application/pdf') ||
      ctx.response.type.includes('application/msword') ||
      ctx.response.type.includes('application/vnd.')
    )) {
      ctx.set('X-Download-Options', 'noopen');
      ctx.set('Content-Disposition', ctx.response.header['content-disposition'] || 'attachment');
    }
  };
};
