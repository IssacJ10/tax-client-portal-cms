const { createStrapi } = require("@strapi/strapi");

async function diagnose() {
    const strapi = await createStrapi().load();
    console.log("Strapi loaded. Testing filings find...");

    try {
        // Simulate the query from the dashboard
        // Filters: { user: 1 } (assuming admin@jjelevate.com is ID 1)
        const query = {
            filters: {
                // isAdmin is true for the admin user
            },
            populate: ['taxYear']
        };

        console.log("Querying with:", JSON.stringify(query, null, 2));

        // Testing Document Service findMany
        console.log("Testing strapi.documents('api::filing.filing').findMany...");
        const results = await strapi.documents('api::filing.filing').findMany(query);
        console.log("Success! Found:", results.length, "records");

        // Testing Core Service find (which I used in the controller)
        console.log("Testing strapi.service('api::filing.filing').find...");
        const serviceResults = await strapi.service('api::filing.filing').find(query);
        console.log("Service Success!");

    } catch (err) {
        console.error("DIAGNOSTIC FAILED:");
        console.error(err);
        if (err.details) console.error("Details:", JSON.stringify(err.details, null, 2));
    } finally {
        // strapi.stop(); // Don't stop if we want to keep the dev server running, 
        // but this is a separate process.
        process.exit(0);
    }
}

diagnose();
