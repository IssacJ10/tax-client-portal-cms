
const { createStrapi } = require('@strapi/strapi');

async function seedBulk() {
    const strapi = await createStrapi({ distDir: './dist' }).load();

    try {
        console.log('--- Bulk Seeding Users and Filings ---');

        // 1. Get 2025 Tax Year
        const taxYear2025 = await strapi.db.query('api::tax-year.tax-year').findOne({
            where: { year: '2025' }
        });

        if (!taxYear2025) {
            console.error('Error: Tax Year 2025 not found. Please seed tax years first.');
            process.exit(1);
        }

        const role = await strapi.db.query('plugin::users-permissions.role').findOne({
            where: { type: 'authenticated' }
        });

        const usersData = [
            { email: 'john.doe@example.com', username: 'johndoe', firstName: 'John', lastName: 'Doe' },
            { email: 'jane.smith@example.com', username: 'janesmith', firstName: 'Jane', lastName: 'Smith' },
            { email: 'michael.brown@example.com', username: 'michaelb', firstName: 'Michael', lastName: 'Brown' },
            { email: 'emily.davis@example.com', username: 'emilyd', firstName: 'Emily', lastName: 'Davis' },
            { email: 'william.wilson@example.com', username: 'williamw', firstName: 'William', lastName: 'Wilson' },
            { email: 'olivia.taylor@example.com', username: 'oliviat', firstName: 'Olivia', lastName: 'Taylor' },
            { email: 'james.anderson@example.com', username: 'jamesa', firstName: 'James', lastName: 'Anderson' },
            { email: 'sophia.thomas@example.com', username: 'sophiat', firstName: 'Sophia', lastName: 'Thomas' },
            { email: 'robert.jackson@example.com', username: 'robertj', firstName: 'Robert', lastName: 'Jackson' },
            { email: 'isabella.white@example.com', username: 'isabellaw', firstName: 'Isabella', lastName: 'White' }
        ];

        for (let i = 0; i < usersData.length; i++) {
            const userData = usersData[i];

            // 2. Create User if not exists
            let user = await strapi.db.query('plugin::users-permissions.user').findOne({
                where: { email: userData.email }
            });

            if (!user) {
                user = await strapi.plugins['users-permissions'].services.user.add({
                    ...userData,
                    password: 'Password123!',
                    confirmed: true,
                    role: role.id
                });
                console.log(`Created User: ${user.email} (DocumentId: ${user.documentId})`);
            } else {
                console.log(`User already exists: ${user.email}`);
            }

            // 3. Create Filing for 2025
            const existingFiling = await strapi.db.query('api::filing.filing').findOne({
                where: {
                    user: user.id,
                    taxYear: taxYear2025.id
                }
            });

            if (!existingFiling) {
                const filing = await strapi.entityService.create('api::filing.filing', {
                    data: {
                        user: user.documentId,
                        taxYear: taxYear2025.documentId,
                        status: i % 2 === 0 ? 'In Progress' : 'Submitted',
                        progress: i % 2 === 0 ? 30 + (i * 5) : 100,
                        firstName: userData.firstName,
                        lastName: userData.lastName,
                        email: userData.email,
                        phoneNumber: `555-010${i}`,
                        sin: `123-456-78${i}`,
                        birthDate: `19${80 + i}-01-01`,
                        maritalStatus: i % 3 === 0 ? 'Married' : 'Single',
                        province: 'Ontario',
                        city: 'Toronto',
                        postalCode: `M5V 1J${i}`,
                        employmentStatus: 'Full-time',
                        employmentDetails: 'Software Engineer at Tech Corp',
                        currentAddress: `${100 + i} Main St, Toronto, ON`,
                        filingData: {
                            employmentIncome: 75000 + (i * 2000),
                            taxPaid: 15000 + (i * 500),
                            rrspContribution: 5000
                        },
                        spouse: i % 3 === 0 ? {
                            firstName: 'SpouseName',
                            lastName: userData.lastName,
                            birthDate: `1982-05-10`,
                            netIncome: 50000,
                            residencyStatus: 'Resident',
                            incomeOutsideCanada: 'No'
                        } : null,
                        dependents: i % 4 === 0 ? [
                            {
                                firstName: 'ChildFirst',
                                lastName: userData.lastName,
                                birthDate: '2015-08-20',
                                relationship: 'Child'
                            }
                        ] : []
                    }
                });
                console.log(`Created Filing for ${userData.email} (ID: ${filing.id})`);
            } else {
                console.log(`Filing already exists for ${userData.email} in 2025.`);
            }
        }

        console.log('--- Bulk Seeding Complete ---');

    } catch (error) {
        console.error('Seed Error:', error);
    }

    process.exit(0);
}

seedBulk();
