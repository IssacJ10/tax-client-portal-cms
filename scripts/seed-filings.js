
const { createStrapi } = require('@strapi/strapi');

async function seedFilings() {
    const strapi = await createStrapi({ distDir: './dist' }).load();

    try {
        console.log('--- Seeding Filings ---');

        // 1. Get Tax Years
        const taxYears = await strapi.entityService.findMany('api::tax-year.tax-year');
        if (taxYears.length === 0) {
            console.error('Error: No tax years found.');
            process.exit(1);
        }

        const taxYear2024 = taxYears.find(y => y.year === '2024');
        const taxYear2025 = taxYears.find(y => y.year === '2025');

        // 2. Get User
        const user = await strapi.db.query('plugin::users-permissions.user').findOne({
            where: { email: 'niju@uk.com' }
        });
        if (!user) {
            console.error('Error: User niju@uk.com not found.');
            process.exit(1);
        }

        // 3. Define Seed Data
        const seedData = [
            {
                user: user.documentId,
                taxYear: taxYear2024.documentId,
                status: 'Submitted',
                progress: 100,
                firstName: 'Niju',
                lastName: 'Thomas',
                email: 'niju@uk.com',
                phoneNumber: '1234567890',
                province: 'Ontario',
                city: 'Toronto',
                employmentStatus: 'Employed',
                filingData: {
                    t4_count: 2,
                    total_income: 85000,
                    rrsp_contribution: 5000
                },
                confirmationNumber: 'TAX-2024-ABC-123'
            },
            {
                user: user.documentId,
                taxYear: taxYear2025.documentId,
                status: 'In Progress',
                progress: 45,
                firstName: 'Niju',
                lastName: 'Thomas',
                email: 'niju@uk.com',
                province: 'Ontario',
                city: 'Toronto',
                filingData: {
                    preliminary: true,
                    sources: ['T4', 'Rental']
                }
            },
            {
                user: user.documentId,
                taxYear: taxYear2025.documentId,
                status: 'Not Started',
                progress: 0,
                firstName: 'Niju',
                lastName: 'Thomas',
                email: 'niju@uk.com',
                filingData: {}
            }
        ];

        for (const data of seedData) {
            const existing = await strapi.entityService.findMany('api::filing.filing', {
                filters: {
                    user: user.id,
                    taxYear: (data.taxYear === taxYear2024.documentId ? taxYear2024.id : taxYear2025.id),
                    status: data.status
                }
            });

            if (existing.length === 0) {
                const filing = await strapi.entityService.create('api::filing.filing', {
                    data: data
                });
                console.log(`Created filing for ${data.status} status (ID: ${filing.id})`);
            } else {
                console.log(`Filing for ${data.status} already exists.`);
            }
        }

        console.log('--- Seed Filings Complete ---');

    } catch (error) {
        console.error('Seed Error:', error);
    }

    process.exit(0);
}

seedFilings();
