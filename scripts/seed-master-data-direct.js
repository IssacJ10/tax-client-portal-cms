/**
 * Seed master data directly using Strapi entity service
 * Run with: npm run strapi -- seed-master-data
 * Or: node scripts/seed-master-data-direct.js
 */

async function seedMasterData() {
    const Strapi = require('@strapi/strapi');

    console.log('🌱 Starting master data seeding with direct database access...\n');

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

    try {
        // Load Strapi instance
        const appContext = await Strapi({ distDir: './dist' }).load();
        const strapi = appContext;

        console.log('📦 Seeding Filing Types...');
        for (const filingType of filingTypes) {
            try {
                // Check if it exists
                const existing = await strapi.db.query('api::filing-type.filing-type').findOne({
                    where: { type: filingType.type }
                });

                if (existing) {
                    console.log(`  ⏭️  Already exists: ${filingType.displayName} (ID: ${existing.id})`);
                } else {
                    const created = await strapi.db.query('api::filing-type.filing-type').create({
                        data: filingType
                    });
                    console.log(`  ✅ Created: ${filingType.displayName} (ID: ${created.id})`);
                }
            } catch (error) {
                console.error(`  ❌ Error with ${filingType.displayName}:`, error.message);
            }
        }

        console.log('\n📦 Seeding Filing Statuses...');
        for (const status of filingStatuses) {
            try {
                // Check if it exists
                const existing = await strapi.db.query('api::filing-status.filing-status').findOne({
                    where: { statusCode: status.statusCode }
                });

                if (existing) {
                    console.log(`  ⏭️  Already exists: ${status.displayName} (ID: ${existing.id})`);
                } else {
                    const created = await strapi.db.query('api::filing-status.filing-status').create({
                        data: status
                    });
                    console.log(`  ✅ Created: ${status.displayName} (ID: ${created.id})`);
                }
            } catch (error) {
                console.error(`  ❌ Error with ${status.displayName}:`, error.message);
            }
        }

        console.log('\n✅ All master data seeding completed successfully!');
        console.log('📝 You can now view the data in Strapi Admin: http://localhost:1337/admin');

        // Cleanup
        await appContext.destroy();
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Fatal error:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    seedMasterData();
}

module.exports = { seedMasterData };
