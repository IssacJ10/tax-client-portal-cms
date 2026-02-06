'use strict';

/**
 * Auth Session Controller
 * Provides /api/auth/me endpoint for httpOnly cookie authentication
 *
 * This endpoint verifies the JWT from the httpOnly cookie and returns
 * the current user. Used by the frontend to check authentication status
 * on page load/refresh.
 */

module.exports = {
  /**
   * GET /api/auth/me
   * Returns the current authenticated user from the JWT cookie
   */
  async me(ctx) {
    // First, try to get JWT from httpOnly cookie
    const jwtFromCookie = ctx.cookies.get('jwt');

    // Fall back to Authorization header for backwards compatibility
    const authHeader = ctx.request.header.authorization;
    const jwtFromHeader = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : null;

    const jwt = jwtFromCookie || jwtFromHeader;

    if (!jwt) {
      ctx.status = 401;
      return ctx.send({
        error: {
          status: 401,
          name: 'UnauthorizedError',
          message: 'No authentication token found',
        },
      });
    }

    try {
      // Verify the JWT
      const jwtService = strapi.plugin('users-permissions').service('jwt');
      const payload = await jwtService.verify(jwt);

      if (!payload || !payload.id) {
        ctx.status = 401;
        return ctx.send({
          error: {
            status: 401,
            name: 'UnauthorizedError',
            message: 'Invalid token',
          },
        });
      }

      // Get the user
      const user = await strapi.entityService.findOne(
        'plugin::users-permissions.user',
        payload.id,
        {
          populate: ['role'],
        }
      );

      if (!user) {
        ctx.status = 401;
        return ctx.send({
          error: {
            status: 401,
            name: 'UnauthorizedError',
            message: 'User not found',
          },
        });
      }

      if (user.blocked) {
        ctx.status = 401;
        return ctx.send({
          error: {
            status: 401,
            name: 'UnauthorizedError',
            message: 'User account is blocked',
          },
        });
      }

      // Sanitize and return user
      const sanitizedUser = await strapi
        .plugin('users-permissions')
        .service('user')
        .sanitizeOutput(user, ctx);

      return ctx.send({
        user: sanitizedUser,
        authenticated: true,
      });
    } catch (err: any) {
      strapi.log.debug(`[Auth] Token verification failed: ${err.message}`);

      // Token expired or invalid
      ctx.status = 401;
      return ctx.send({
        error: {
          status: 401,
          name: 'UnauthorizedError',
          message: 'Token expired or invalid',
        },
      });
    }
  },
};
