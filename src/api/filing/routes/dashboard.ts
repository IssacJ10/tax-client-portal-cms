module.exports = {
    routes: [
        {
            method: 'GET',
            path: '/dashboard/filings',
            handler: 'dashboard.find',
            config: {
                policies: [],
                middlewares: [],
            },
        },
        {
            method: 'GET',
            path: '/dashboard/filings/:id',
            handler: 'dashboard.findOne',
            config: {
                policies: [],
                middlewares: [],
            },
        },
        {
            method: 'PUT',
            path: '/dashboard/filings/:id',
            handler: 'dashboard.update',
            config: {
                policies: [],
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
    ],
};
