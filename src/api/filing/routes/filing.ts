/**
 * filing router with consent policy
 */

module.exports = {
    routes: [
        {
            method: 'GET',
            path: '/filings',
            handler: 'filing.find',
            config: {
                policies: [], // No consent required to VIEW existing filings
            },
        },
        {
            method: 'GET',
            path: '/filings/:id',
            handler: 'filing.findOne',
            config: {
                policies: [], // No consent required to VIEW a specific filing
            },
        },
        {
            method: 'POST',
            path: '/filings',
            handler: 'filing.create',
            config: {
                policies: ['global::has-consented'], // MUST consent to CREATE
            },
        },
        {
            method: 'PUT',
            path: '/filings/:id',
            handler: 'filing.update',
            config: {
                policies: ['global::has-consented'], // MUST consent to UPDATE
            },
        },
        {
            method: 'DELETE',
            path: '/filings/:id',
            handler: 'filing.delete',
            config: {
                policies: ['global::has-consented'], // MUST consent to DELETE
            },
        },
        // Custom action for starting a filing (alias for create)
        {
            method: 'POST',
            path: '/filings/start',
            handler: 'filing.startFiling',
            config: {
                policies: ['global::has-consented'],
            },
        },
    ],
};
