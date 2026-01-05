
const { createStrapi } = require('@strapi/strapi');

async function resetFiling() {
    const strapi = await createStrapi({ distDir: './dist' }).load();

    const userQuery = 'issac';
    const year = '2025';

    try {
        console.log(`Searching for user matching "${userQuery}"...`);

        const users = await strapi.db.query('plugin::users-permissions.user').findMany({
            where: {
                $or: [
                    { username: { $contains: userQuery } },
                    { email: { $contains: userQuery } }
                ]
            }
        });

        if (users.length === 0) {
            console.log('No user found.');
            process.exit(1);
        }

        const user = users[0];
        console.log(`Found User: ${user.username} (${user.email}) [ID: ${user.id}]`);

        // Find Tax Year ID for 2025
        const taxYears = await strapi.entityService.findMany('api::tax-year.tax-year', {
            filters: { year: year }
        });

        // Even if tax year config is missing, we might have a filing linked to just the number if logic was loose, but usually it links to ID.
        // Let's find filing by user and populate taxYear to check year.

        console.log(`Searching for filings for Year ${year}...`);
        const filings = await strapi.entityService.findMany('api::filing.filing', {
            filters: {
                user: user.id,
                // We can filter by related taxYear field
                taxYear: {
                    year: year
                }
            },
            populate: ['taxYear']
        });

        if (filings.length === 0) {
            console.log(`No filings found for ${year}.`);
        } else {
            for (const filing of filings) {
                console.log(`Deleting Filing ID: ${filing.id} (Status: ${filing.status})`);
                await strapi.entityService.delete('api::filing.filing', filing.id);
            }
            console.log('Reset Complete.');
        }

    } catch (error) {
        console.error('Reset Error:', error);
    }

    process.exit(0);
}

resetFiling();
