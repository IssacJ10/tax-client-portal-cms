const { createStrapi } = require('@strapi/strapi');

async function seedData() {
    // Load Strapi
    const strapi = await createStrapi({ distDir: './dist' }).load();

    try {
        console.log('--- Starting Seeding (90 Users & 90 Filings) ---');

        // 1. Get latest 3 tax years
        const taxYears = await strapi.documents('api::tax-year.tax-year').findMany({
            sort: 'year:desc',
            limit: 3
        });

        if (taxYears.length < 3) {
            console.error('Error: Need at least 3 tax years in the database.');
            process.exit(1);
        }

        console.log(`Seeding for years: ${taxYears.map(t => t.year).join(', ')}`);

        let userCount = 0;
        for (const ty of taxYears) {
            console.log(`\nProcessing Year: ${ty.year}`);

            for (let i = 1; i <= 30; i++) {
                userCount++;
                const email = `testuser${userCount}@jjelevate.com`;
                const username = `user${userCount}`;

                // a. Create or Find User
                let testUser = await strapi.db.query('plugin::users-permissions.user').findOne({
                    where: { email }
                });

                if (!testUser) {
                    testUser = await strapi.service('plugin::users-permissions.user').add({
                        username: username,
                        email: email,
                        password: 'Password123!',
                        confirmed: true,
                        role: 1 // Authenticated role
                    });
                }

                // b. Create Complete Filing
                const filingStatus = i % 5 === 0 ? 'Approved' : (i % 3 === 0 ? 'Submitted' : 'In Progress');
                const progress = 40 + (i % 60);

                await strapi.documents('api::filing.filing').create({
                    data: {
                        user: testUser.id,
                        taxYear: ty.documentId,
                        filingStatus: filingStatus,
                        progress: progress,
                        firstName: `John${userCount}`,
                        lastName: `Doe${userCount}`,
                        email: email,
                        phoneNumber: `555-01${userCount.toString().padStart(2, '0')}`,
                        birthDate: '1990-01-01',
                        maritalStatus: 'SINGLE',
                        province: 'Ontario',
                        city: 'Toronto',
                        postalCode: 'M5V 2L7',
                        employmentStatus: 'Employed',
                        employmentDetails: 'Software Engineer at Tech Corp',
                        isFirstTimeFiler: 'No',
                        currentAddress: '123 Fake Street, Toronto, ON',
                        filingData: {
                            income: 75000 + (i * 1000),
                            deductions: 5000 + (i * 200),
                            notes: 'System generated seed data'
                        }
                    }
                });

                if (userCount % 10 === 0) {
                    console.log(`  Seeded ${userCount} records...`);
                }
            }
        }

        console.log('\n--- Seeding Completed Successfully ---');
        console.log(`Total: 90 Users and 90 Filings created.`);

    } catch (error) {
        console.error('Seeding Error:', error);
    }

    process.exit(0);
}

seedData();
