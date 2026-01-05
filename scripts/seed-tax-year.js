
const { createStrapi } = require('@strapi/strapi');

async function seed() {
    const strapi = await createStrapi({ distDir: './dist' }).load();

    try {
        const existingYear = await strapi.entityService.findMany('api::tax-year.tax-year', {
            filters: { year: '2024' }
        });

        if (existingYear.length === 0) {
            console.log('Seeding 2024 Tax Year...');
            await strapi.entityService.create('api::tax-year.tax-year', {
                data: {
                    year: '2024',
                    isActive: true,
                    isCurrent: true,
                    filingDeadline: '2025-04-30',
                    instructions: 'Please provide all T4 and medical slips.'
                }
            });
            console.log('Seed Complete: 2024 Tax Year created.');
        } else {
            console.log('Tax Year 2024 already exists.');
        }
    } catch (error) {
        console.error('Seed Error:', error);
    }

    process.exit(0);
}

seed();
