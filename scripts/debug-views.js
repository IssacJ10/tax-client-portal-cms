
const { createStrapi } = require('@strapi/strapi');

async function debugViews() {
    const strapi = await createStrapi({ distDir: './dist' }).load();

    try {
        console.log('--- Debugging Content Manager Views ---');

        const coreStore = strapi.store({
            type: 'plugin',
            name: 'content-manager',
        });

        const taxYearKey = 'configuration_content_types::api::tax-year.tax-year';
        const filingKey = 'configuration_content_types::api::filing.filing';

        const taxYearConfig = await coreStore.get({ key: taxYearKey });
        const filingConfig = await coreStore.get({ key: filingKey });

        console.log('\n[Tax Year Configuration]');
        if (taxYearConfig) {
            console.log('Settings mainField:', taxYearConfig.settings?.mainField);
            console.log('Metadatas year edit:', JSON.stringify(taxYearConfig.metadatas?.year?.edit || {}, null, 2));
        } else {
            console.log('NOT FOUND');
        }

        console.log('\n[Filing Configuration]');
        if (filingConfig) {
            console.log('Settings mainField:', filingConfig.settings?.mainField);
            console.log('Metadatas taxYear edit:', JSON.stringify(filingConfig.metadatas?.taxYear?.edit || {}, null, 2));
            console.log('Metadatas taxYear list:', JSON.stringify(filingConfig.metadatas?.taxYear?.list || {}, null, 2));
        } else {
            console.log('NOT FOUND');
        }

    } catch (error) {
        console.error('Debug Error:', error);
    }

    process.exit(0);
}

debugViews();
