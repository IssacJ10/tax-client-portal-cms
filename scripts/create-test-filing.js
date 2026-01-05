
const { createStrapi } = require('@strapi/strapi');

async function createTestFiling() {
    const strapi = await createStrapi({ distDir: './dist' }).load();

    try {
        console.log('--- Creating Fresh Test Filing ---');

        // 1. Find the 2025 Tax Year
        const taxYear2025 = await strapi.db.query('api::tax-year.tax-year').findOne({
            where: { year: '2025' }
        });

        if (!taxYear2025) {
            console.error('Error: Tax Year 2025 not found. Please run seed-tax-year.js first.');
            process.exit(1);
        }
        console.log(`Found Tax Year 2025: ${taxYear2025.documentId} (ID: ${taxYear2025.id})`);

        // 2. Find a User (first one)
        const user = await strapi.db.query('plugin::users-permissions.user').findOne({});
        if (!user) {
            console.error('Error: No users found.');
            process.exit(1);
        }
        console.log(`Found User: ${user.email}`);

        // 3. Create Filing
        const filing = await strapi.entityService.create('api::filing.filing', {
            data: {
                user: user.documentId, // v5 uses documentId for relations usually, or id? dependent on version. entityService uses docId in v5.
                taxYear: taxYear2025.documentId,
                status: 'In Progress',
                filingData: { generated: true }
            }
        });

        console.log(`Created Filing (ID: ${filing.id}, DocumentId: ${filing.documentId}) linked to Tax Year 2025`);
        console.log('Please check the Admin Panel now.');

    } catch (error) {
        console.error('Creation Error:', error);
    }

    process.exit(0);
}

createTestFiling();
