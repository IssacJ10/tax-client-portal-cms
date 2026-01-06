require('dotenv').config();
const { createStrapi } = require('@strapi/strapi');

async function createAdminRole() {
    const strapi = await createStrapi({ distDir: './dist' }).load();

    try {
        console.log('--- Creating Admin Role and User ---');

        // 1. Create or find Admin role using Document Service
        const roles = await strapi.documents('plugin::users-permissions.role').findMany({
            filters: { name: 'Admin' }
        });
        let adminRole = roles[0];

        if (!adminRole) {
            adminRole = await strapi.documents('plugin::users-permissions.role').create({
                data: {
                    name: 'Admin',
                    description: 'Administrative role for Client Dashboard',
                    type: 'admin_role'
                }
            });
            console.log(`Created Role: ${adminRole.name}`);
        } else {
            console.log(`Role already exists: ${adminRole.name}`);
        }

        // 2. Create Admin User using Document Service
        const adminEmail = 'admin@jjelevate.com';
        const users = await strapi.documents('plugin::users-permissions.user').findMany({
            filters: { email: adminEmail }
        });
        let adminUser = users[0];

        if (!adminUser) {
            adminUser = await strapi.plugins['users-permissions'].services.user.add({
                username: 'admin',
                email: adminEmail,
                password: 'AdminPassword123!',
                confirmed: true,
                role: adminRole.id,
                isActive: true,
                firstName: 'App',
                lastName: 'Admin'
            });
            console.log(`Created Admin User: ${adminUser.email}`);
        } else {
            console.log(`Admin User already exists: ${adminUser.email}`);
        }

        // 3. Grant Permissions to Admin Role (Simplified for now - grant all to filing and tax-year)
        // In Strapi v5, permissions are handled slightly differently via query, but entity service is preferred.
        // For simplicity in a seed script, we mainly need the user and role created first.
        // Actual permissions can be enabled via the Strapi Admin UI or another script if needed.

        console.log('--- Backend Prep Complete ---');

    } catch (error) {
        console.error('Prep Error:', error);
    }

    process.exit(0);
}

createAdminRole();
