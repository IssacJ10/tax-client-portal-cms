module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/auth/me',
      handler: 'auth-session.me',
      config: {
        policies: [],
        middlewares: [],
        auth: false, // Public endpoint - auth verified manually via cookie/header
        description: 'Get current authenticated user from httpOnly cookie or header',
      },
    },
  ],
};
