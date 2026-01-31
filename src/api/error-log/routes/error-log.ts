/**
 * error-log router
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::error-log.error-log', {
    config: {
        create: {
            // Allow unauthenticated access for error logging from client
            auth: false,
        },
        // find, findOne, update, delete use default auth (authenticated)
    },
});
