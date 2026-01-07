'use strict';

/**
 * Consent routes
 */

module.exports = {
    routes: [
        {
            method: 'POST',
            path: '/consent/confirm',
            handler: 'consent.confirm',
            config: {
                policies: [],
                middlewares: [],
            },
        },
    ],
};
