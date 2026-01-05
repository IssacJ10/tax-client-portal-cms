
const { createStrapi } = require('@strapi/strapi');

async function debugTaxYears() {
    const strapi = await createStrapi({ distDir: './dist' }).load();

    try {
        console.log('Fetching all Tax Years...');
        const years = await strapi.entityService.findMany('api::tax-year.tax-year', {
            sort: { year: 'desc' },
            filters: {} // fetch all
        });

        console.log(`Found ${years.length} tax years.`);
        years.forEach(y => {
            console.log(`Year: "${y.year}" (Type: ${typeof y.year}) | Deadline: "${y.filingDeadline}" | Instructions: "${y.instructions ? 'Yes' : 'No'}" | Active: ${y.isActive}`);
        });

    } catch (error) {
        console.error('Debug Error:', error);
    }

    process.exit(0);
}

debugTaxYears();
