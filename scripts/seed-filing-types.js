/**
 * Seed script for Filing Types master table using REST API
 * Run with: node scripts/seed-filing-types.js
 * 
 * Note: Make sure Strapi is running first!
 * 1. Start Strapi: npm run develop
 * 2. Then run: node scripts/seed-filing-types.js
 */

const axios = require('axios');

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
const ADMIN_JWT = process.env.STRAPI_ADMIN_JWT || '8f91ca246441574864aa5457f3d3863d16182d31b2abfb4e25830ec6fc045fce4c431e94fda5dc6a409181224911b6749086132c181f88efe10608c49d7efe96caf3991b3c8a72d62842692891aae5ac5a44c37309ab96b2eedf741a9555ebae5ff66471de548b327dbd71bdca81e858bcf1ad5e32bc4b83ef398e530c9b586d';

const filingTypes = [
    {
        type: 'PERSONAL',
        displayName: 'T1 Personal Tax Return',
        description: 'Individual tax return for Canadian residents',
        isActive: true,
    },
    {
        type: 'CORPORATE',
        displayName: 'T2 Corporate Tax Return',
        description: 'Tax return for incorporated businesses',
        isActive: true,
    },
    {
        type: 'TRUST',
        displayName: 'T3 Trust Income Tax Return',
        description: 'Tax return for trusts and estates',
        isActive: true,
    },
];

async function seedFilingTypes() {
    console.log('🌱 Seeding Filing Types...\n');

    if (!ADMIN_JWT) {
        console.error('❌ Error: STRAPI_ADMIN_JWT not set.');
        console.log('Please set your admin JWT token as an environment variable:');
        console.log('export STRAPI_ADMIN_JWT="your-jwt-token-here"');
        console.log('\nYou can get your JWT from: Settings → API Tokens → Create new token\n');
        process.exit(1);
    }

    try {
        for (const filingType of filingTypes) {
            console.log(`📝 Creating: "${filingType.displayName}"...`);

            const response = await axios.post(
                `${STRAPI_URL}/api/filing-types`,
                { data: filingType },
                {
                    headers: {
                        'Authorization': `Bearer ${ADMIN_JWT}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log(`✅ Created filing type #${response.data.data.id}\n`);
        }

        console.log('🎉 Successfully seeded all filing types!');
        console.log(`\nTotal types created: ${filingTypes.length}`);
    } catch (error) {
        console.error('❌ Error seeding filing types:', error.response?.data?.error?.message || error.message);
        if (error.response?.data) {
            console.error('Full error:', JSON.stringify(error.response.data, null, 2));
        }
        process.exit(1);
    }
}

seedFilingTypes();
