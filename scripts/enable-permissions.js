
const { createStrapi } = require('@strapi/strapi');

async function grantPermissions() {
    // Load Strapi
    const strapi = await createStrapi({ distDir: './dist' }).load();

    try {
        console.log('Finding Authenticated Role...');
        const authenticatedRole = await strapi.entityService.findMany('plugin::users-permissions.role', {
            filters: { type: 'authenticated' }
        });

        if (!authenticatedRole || authenticatedRole.length === 0) {
            throw new Error('Authenticated role not found');
        }

        const roleId = authenticatedRole[0].id;
        const permissionsToEnable = [
            'api::tax-year.tax-year.find',
            'api::tax-year.tax-year.findOne',
            'api::filing.filing.find',
            'api::filing.filing.findOne',
            'api::filing.filing.create',
            // Ensure User can update their own profile if needed (already enabled likely)
            'plugin::users-permissions.user.me',
            'plugin::users-permissions.user.find'
        ];

        console.log(`Granting permissions to Role ${roleId}...`);

        for (const action of permissionsToEnable) {
            // Check if permission exists
            const existing = await strapi.entityService.findMany('plugin::users-permissions.permission', {
                filters: { action, role: roleId }
            });

            if (existing.length === 0) {
                await strapi.entityService.create('plugin::users-permissions.permission', {
                    data: { action, role: roleId }
                });
                console.log(`+ Granted: ${action}`);
            } else {
                console.log(`= Already exists: ${action}`);
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
