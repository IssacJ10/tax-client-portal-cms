const { createStrapi } = require('@strapi/strapi');

async function createUsers() {
    console.log("🚀 Creating Standard Test Users...");
    const strapi = await createStrapi({ distDir: './dist' }).load();
    await strapi.server.mount();

    const timestamp = Date.now();
    const commonPassword = 'Password123!';

    // Get authenticated role
    const authenticatedRole = await strapi.documents('plugin::users-permissions.role').findMany({ filters: { type: 'authenticated' } });
    const roleId = authenticatedRole[0].documentId;

    const users = [
        { alias: 'personal', type: 'PERSONAL' },
        { alias: 'corp', type: 'CORPORATE' },
        { alias: 'trust', type: 'TRUST' }
    ];

    for (const u of users) {
        const username = `browser_${u.alias}_${timestamp}`;
        const email = `browser_${u.alias}_${timestamp}@test.com`;

        try {
            const created = await strapi.documents('plugin::users-permissions.user').create({
                data: {
                    username,
                    email,
                    password: commonPassword,
                    confirmed: true,
                    blocked: false,
                    role: roleId,
                    firstName: `Browser ${u.alias}`,
                    lastName: 'Tester',
                    hasConsentedToTerms: true // Pre-consent
                }
            });
            console.log(`✅ Created User: ${email} / ${commonPassword}`);
        } catch (e) {
            console.log(`⚠️ User ${username} might already exist or failed: ${e.message}`);
        }
    }

    /* 
       Wait! The 'filing' controller logic relies on 'filingType' to enforce unique filings per tax year.
       We don't need to seed filings here. The Browser Test will CREATE them via the UI.
       We just need the Users.
    */

    // strapi.server.httpServer.close();
    process.exit(0);
}

createUsers();
