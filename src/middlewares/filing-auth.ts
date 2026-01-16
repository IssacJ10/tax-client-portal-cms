/**
 * Middleware to log permissions and bypass users-permissions for filing.findOne
 */

module.exports = (config, { strapi }) => {
    return async (ctx, next) => {
        console.log('[Auth Middleware]', {
            path: ctx.request.path,
            method: ctx.request.method,
            hasAuth: !!ctx.request.header.authorization
        });

        // If this is a GET /api/filings/:id request, bypass users-permissions
        if (ctx.request.method === 'GET' && ctx.request.path.startsWith('/api/filings/')) {
            // Extract token and verify manually
            const token = ctx.request.header.authorization?.replace('Bearer ', '');

            if (token) {
                try {
                    const decoded = await strapi.plugins['users-permissions'].services.jwt.verify(token);
                    const user = await strapi.query('plugin::users-permissions.user').findOne({
                        where: { id: decoded.id },
                        populate: ['role']
                    });

                    if (user) {
                        ctx.state.user = user;
                        console.log('[Auth Middleware] User authenticated:', user.email);
                    }
                } catch (error) {
                    console.log('[Auth Middleware] Token verification failed:', error.message);
                }
            }
        }

        await next();
    };
};
