
const { createStrapi } = require('@strapi/strapi');

async function deleteAllFilings() {
    const strapi = await createStrapi({ distDir: './dist' }).load();

    try {
        console.log('Deleting all entries in api::filing.filing ...');

        // Using Query Engine for bulk delete
        const result = await strapi.db.query('api::filing.filing').deleteMany({
            where: {}
        });

        console.log(`Successfully deleted ${result.count} filing(s).`);

    } catch (error) {
        console.error('Delete Error:', error);
    }

    process.exit(0);
}

deleteAllFilings();
