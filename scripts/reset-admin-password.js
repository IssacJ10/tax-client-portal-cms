
const { createStrapi } = require('@strapi/strapi');

async function resetPassword() {
    const strapi = await createStrapi({ distDir: './dist' }).load();

    const email = 'admin@citysoftsolutions.com';
    const newPassword = 'Password123!';

    try {
        console.log(`Searching for admin user: ${email}...`);

        // Find the user using direct DB query for safety
        const user = await strapi.db.query('admin::user').findOne({
            where: { email }
        });

        if (!user) {
            console.error('Error: Admin user not found with that email.');
            process.exit(1);
        }

        console.log(`User found (ID: ${user.id}). Resetting password...`);

        // Update password using Query Engine
        const hashedPassword = await strapi.admin.services.auth.hashPassword(newPassword);

        await strapi.db.query('admin::user').update({
            where: { id: user.id },
            data: { password: hashedPassword }
        });

        console.log('----------------------------------------');
        console.log('SUCCESS: Password reset successfully.');
        console.log(`Email: ${email}`);
        console.log(`New Password: ${newPassword}`);
        console.log('----------------------------------------');

    } catch (error) {
        console.error('Reset Error:', error);
    }

    process.exit(0);
}

resetPassword();
