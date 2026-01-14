module.exports = {
    routes: [
        {
            method: 'GET',
            path: '/dashboard/filings',
            handler: 'dashboard.find',
            config: {
                policies: ['global::has-consented'],
                middlewares: [],
            },
        },
        {
            method: 'GET',
            path: '/dashboard/filings/:id',
            handler: 'dashboard.findOne',
            config: {
                policies: ['global::has-consented'],
                middlewares: [],
            },
        },
        {
            method: 'PUT',
            path: '/dashboard/filings/:id',
            handler: 'dashboard.update',
            config: {
                policies: ['global::has-consented'],
                middlewares: [],
            },
        },
        {
            method: 'GET',
            path: '/dashboard/tax-years',
            handler: 'dashboard.getTaxYears',
            config: {
                policies: [],
                middlewares: [],
            },
        },
        {
            method: 'POST',
            path: '/dashboard/consent',
            handler: 'dashboard.confirmConsent',
            config: {
                policies: [], // No consent policy - this IS the consent endpoint!
                middlewares: [],
            },
        },
        {
            method: 'GET',
            path: '/dashboard/debug-user',
            handler: 'dashboard.debugUser',
            config: {
                auth: false,
                policies: [],
                middlewares: [],
            },
        },
    ],
};
