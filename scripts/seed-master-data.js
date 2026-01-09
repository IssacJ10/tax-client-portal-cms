/**
 * Combined seed script - Seeds all master data using Content Manager API
 * Run with: node scripts/seed-master-data.js
 */

const axios = require('axios');

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
const ADMIN_JWT = '4119a9f921d475ce10148eb8aa899fc3c03001d7c46bf52cc910fcec3042ce821502be46fe34520b855061b56aadb2f6b76b7d97bebe766535180ad8adf62536ab48f4b865cc2471baaae5e7fc40871e3834dcd1c6cc85f31cf69ca22d0c8a999563d065d5641210d903529ee31a235ac6e808541c4567297edac2b83ad67529';

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

    try {
        console.log('📦 Seeding Filing Types...');
        for (const filingType of filingTypes) {
            try {
                const response = await axios.post(
                    `${STRAPI_URL}/content-manager/collection-types/api::filing-type.filing-type`,
                    filingType,
                    { headers: { 'Authorization': `Bearer ${ADMIN_JWT}`, 'Content-Type': 'application/json' } }
                );
                console.log(`  ✅ Created: ${filingType.displayName} (ID: ${response.data.id})`);
            } catch (error) {
                if (error.response?.status === 400 && error.response?.data?.error?.message?.includes('unique')) {
                    console.log(`  ⏭️  Already exists: ${filingType.displayName}`);
                } else {
                    console.error(`  ❌ Error creating ${filingType.displayName}:`, error.response?.data?.error?.message || error.message);
                }
            }
        }

        console.log('\n📦 Seeding Filing Statuses...');
        for (const status of filingStatuses) {
            try {
                const response = await axios.post(
                    `${STRAPI_URL}/content-manager/collection-types/api::filing-status.filing-status`,
                    status,
                    { headers: { 'Authorization': `Bearer ${ADMIN_JWT}`, 'Content-Type': 'application/json' } }
                );
                console.log(`  ✅ Created: ${status.displayName} (ID: ${response.data.id})`);
            } catch (error) {
                if (error.response?.status === 400 && error.response?.data?.error?.message?.includes('unique')) {
                    console.log(`  ⏭️  Already exists: ${status.displayName}`);
                } else {
                    console.error(`  ❌ Error creating ${status.displayName}:`, error.response?.data?.error?.message || error.message);
                }
            }
        }

        console.log('\n✅ All master data seeding completed successfully!');
        console.log('\n📝 Next: Refresh your Strapi admin panel to see the new content types and data.');
    } catch (error) {
        console.error('\n❌ Error during seeding:', error.response?.data?.error?.message || error.message);
        if (error.response?.data) {
            console.error('Full error:', JSON.stringify(error.response.data, null, 2));
        }
        process.exit(1);
    }
}

seedAll();
