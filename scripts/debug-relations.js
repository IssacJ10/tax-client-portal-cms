
const Strapi = require('@strapi/strapi');

async function debugRelations() {
    const strapi = await Strapi.compile();
    await strapi.start();

    console.log('--- DEBUG START ---');

    // 1. Get a recent filing
    const filings = await strapi.documents('api::filing.filing').findMany({
        sort: 'updatedAt:desc',
        limit: 1,
        populate: ['filingType', 'user']
    });

    if (filings.length === 0) {
        console.log('No filings found.');
        process.exit(0);
    }

    const filing = filings[0];
    console.log('Recent Filing ID:', filing.documentId);
    console.log('Filing Type Relation:', filing.filingType);
    const typeStr = filing.filingType?.type || 'UNKNOWN';
    console.log('Resolved Type String:', typeStr);

    // 2. Check for child record based on type
    if (typeStr === 'PERSONAL') {
        const children = await strapi.documents('api::personal-filing.personal-filing').findMany({
            filters: { filing: { documentId: filing.documentId } }
        });
        console.log('Found Personal Filings:', children.length);
        if (children.length > 0) console.log('Child Data:', JSON.stringify(children[0], null, 2));
    } else if (typeStr === 'CORPORATE') {
        const children = await strapi.documents('api::corporate-filing.corporate-filing').findMany({
            filters: { filing: { documentId: filing.documentId } }
        });
        console.log('Found Corporate Filings:', children.length);
    } else {
        console.log('Checking Trust not implemented in debug script yet.');
    }

    console.log('--- DEBUG END ---');
    process.exit(0);
}

debugRelations();
