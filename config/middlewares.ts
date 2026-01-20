export default [
  'strapi::logger',
  'strapi::errors',
  // Security middleware with helmet-like configuration
  {
    name: 'strapi::security',
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:', 'blob:', 'https:'],
          'font-src': ["'self'", 'data:'],
          'connect-src': ["'self'", 'http://localhost:3000', 'http://localhost:3001'],
          'frame-ancestors': ["'self'"],
          'object-src': ["'none'"],
          upgradeInsecureRequests: null, // Disabled for local development
        },
      },
      xssFilter: true,
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
      },
      frameguard: {
        action: 'sameorigin',
      },
      referrerPolicy: {
        policy: 'strict-origin-when-cross-origin',
      },
    },
  },
  // CORS - Restrictive configuration
  {
    name: 'strapi::cors',
    config: {
      // Only allow specific origins (add production domains as needed)
      origin: [
        'http://localhost:3000',
        'http://localhost:3001',
        // Add production frontend URL here
        // process.env.FRONTEND_URL,
      ].filter(Boolean),
      // Specific allowed headers
      headers: [
        'Content-Type',
        'Authorization',
        'X-CSRF-Token',
        'X-Requested-With',
        'Accept',
        'Origin',
      ],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      credentials: true,
      maxAge: 86400, // 24 hours
    },
  },
  'strapi::poweredBy',
  'strapi::query',
  // Body parser with size limits to prevent DoS
  {
    name: 'strapi::body',
    config: {
      formLimit: '2mb', // Form data size limit
      jsonLimit: '2mb', // JSON body size limit
      textLimit: '2mb', // Text body size limit
      formidable: {
        maxFileSize: 10 * 1024 * 1024, // 10MB max file size
      },
    },
  },
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
  // Security middlewares (order matters)
  'global::rate-limiter', // Rate limiting - apply early
  'global::input-sanitization', // Input sanitization
  'global::security-headers', // Security headers
  // Custom auth middlewares
  'global::filing-auth', // Custom Filing Auth Middleware
  'global::google-auth-fix', // Custom Google Auth Interceptor
  'global::local-auth-refresh', // Custom Local Auth Refresh
];
