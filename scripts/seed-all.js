/**
 * Combined seed script - Seeds all master data using REST API
 * Run with: node scripts/seed-all.js
 * 
 * Note: Make sure Strapi is running first!
 * 1. Start Strapi: npm run develop
 * 2. Then run: node scripts/seed-all.js
 */

const axios = require('axios');

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
const ADMIN_JWT = process.env.STRAPI_ADMIN_JWT || '8f91ca246441574864aa5457f3d3863d16182d31b2abfb4e25830ec6fc045fce4c431e94fda5dc6a409181224911b6749086132c181f88efe10608c49d7efe96caf3991b3c8a72d62842692891aae5ac5a44c37309ab96b2eedf741a9555ebae5ff66471de548b327dbd71bdca81e858bcf1ad5e32bc4b83ef398e530c9b586d';

// Import seed data (not functions)
const filingTypes = [
    { type: 'PERSONAL', displayName: 'T1 Personal Tax Return', description: 'Individual tax return for Canadian residents', isActive: true },
    { type: 'CORPORATE', displayName: 'T2 Corporate Tax Return', description: 'Tax return for incorporated businesses', isActive: true },
    { type: 'TRUST', displayName: 'T3 Trust Income Tax Return', description: 'Tax return for trusts and estates', isActive: true },
];

const filingStatuses = [
    { statusCode: 'NOT_STARTED', displayName: 'Not Started', description: 'Filing has been created but not yet started', color: '#9CA3AF', order: 1 },
    { statusCode: 'IN_PROGRESS', displayName: 'In Progress', description: 'User is actively working on the filing', color: '#3B82F6', order: 2 },
    { statusCode: 'UNDER_REVIEW', displayName: 'Under Review', description: 'Filing submitted and awaiting admin review', color: '#F59E0B', order: 3 },
    { statusCode: 'SUBMITTED', displayName: 'Submitted', description: 'Filing has been submitted to CRA', color: '#8B5CF6', order: 4 },
    { statusCode: 'APPROVED', displayName: 'Approved', description: 'Filing has been approved by admin', color: '#10B981', order: 5 },
    { statusCode: 'COMPLETED', displayName: 'Completed', description: 'Filing process fully completed', color: '#059669', order: 6 },
    { statusCode: 'REJECTED', displayName: 'Rejected', description: 'Filing has been rejected and needs correction', color: '#EF4444', order: 7 },
];

async function seedAll() {
    console.log('🌱 Starting master data seeding...\n');

    if (!ADMIN_JWT) {
        console.error('❌ Error: STRAPI_ADMIN_JWT not set.');
        console.log('Please set your admin JWT token as an environment variable:');
        console.log('export STRAPI_ADMIN_JWT="your-jwt-token-here"');
        console.log('\nYou can get your JWT from: Settings → API Tokens → Create new token\n');
        process.exit(1);
    }

    try {
        // Seed Filing Types
        console.log('📦 Seeding Filing Types...');
        for (const filingType of filingTypes) {
            try {
                const response = await axios.post(
                    `${STRAPI_URL}/api/filing-types`,
                    { data: filingType },
                    { headers: { 'Authorization': `Bearer ${ADMIN_JWT}`, 'Content-Type': 'application/json' } }
                );
                console.log(`  ✅ Created: ${filingType.displayName}`);
            } catch (error) {
                if (error.response?.status === 400 && error.response?.data?.error?.message?.includes('unique')) {
                    console.log(`  ⏭️  Already exists: ${filingType.displayName}`);
                } else {
                    throw error;
                }
            }
        }

        console.log('\n📦 Seeding Filing Statuses...');
        for (const status of filingStatuses) {
            try {
                const response = await axios.post(
                    `${STRAPI_URL}/api/filing-statuses`,
                    { data: status },
                    { headers: { 'Authorization': `Bearer ${ADMIN_JWT}`, 'Content-Type': 'application/json' } }
                );
                console.log(`  ✅ Created: ${status.displayName}`);
            } catch (error) {
                if (error.response?.status === 400 && error.response?.data?.error?.message?.includes('unique')) {
                    console.log(`  ⏭️  Already exists: ${status.displayName}`);
                } else {
                    throw error;
                }
            }
        }

        console.log('\n✅ All master data seeding completed successfully!');
    } catch (error) {
        console.error('\n❌ Error during seeding:', error.response?.data?.error?.message || error.message);
        if (error.response?.data) {
            console.error('Full error:', JSON.stringify(error.response.data, null, 2));
        }
        process.exit(1);
    }
}

seedAll();
