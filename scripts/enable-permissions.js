require('dotenv').config();
const { createStrapi } = require('@strapi/strapi');

async function grantPermissions() {
    // Load Strapi
    const strapi = await createStrapi({ distDir: './dist' }).load();

    try {
        console.log('Finding Roles to update...');
        // Use Document Service
        const roles = await strapi.documents('plugin::users-permissions.role').findMany({
            filters: {
                type: {
                    $in: ['authenticated', 'admin_role']
                }
            }
        });

        if (!roles || roles.length === 0) {
            throw new Error('No target roles found');
        }

        const permissionsToEnable = [
            'api::tax-year.tax-year.find',
            'api::tax-year.tax-year.findOne',
            'api::filing.filing.find',
            'api::filing.filing.findOne',
            'api::filing.filing.create',
            'api::filing.filing.update',
            'plugin::users-permissions.user.me',
            'plugin::users-permissions.user.find',
            'plugin::users-permissions.user.findOne'
        ];

        for (const role of roles) {
            console.log(`Granting permissions to Role: ${role.name} (type: ${role.type}, id: ${role.id})...`);
            for (const action of permissionsToEnable) {
                // Check if permission exists using Document Service if available or DB query (permissions are often technical)
                // For simplicity and compatibility with technical tables, db.query is often very stable in scripts
                const existing = await strapi.db.query('plugin::users-permissions.permission').findOne({
                    where: { action, role: role.id }
                });

                if (!existing) {
                    await strapi.db.query('plugin::users-permissions.permission').create({
                        data: { action, role: role.id }
                    });
                    console.log(`  + Granted: ${action}`);
                } else {
                    console.log(`  = Already exists: ${action}`);
                }
            }
        }

        console.log('Permissions update complete.');

    } catch (error) {
        console.error('Permission Script Error:', error);
    }

    // Stop Strapi
    // process.exit(0); // Removing explicit exit can help ensures logs flush, but strapi.stop() is better if available, or just let node exit.
    process.exit(0);
}

grantPermissions();
