async function checkUser() {
    const email = 'testuser@example.com';
    console.log(`Checking user with email: ${email}`);

    const user = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { email: email },
        populate: ['role']
    });

    if (!user) {
        console.log('User NOT found');
        const allUsers = await strapi.db.query('plugin::users-permissions.user').findMany({ limit: 5 });
        console.log('Sample of existing users:');
        allUsers.forEach(u => console.log(`- ${u.email} (Confirmed: ${u.confirmed}, Blocked: ${u.blocked})`));
    } else {
        console.log('User found:');
        console.log({
            id: user.id,
            username: user.username,
            email: user.email,
            confirmed: user.confirmed,
            blocked: user.blocked,
            role: user.role?.name
        });
    }
}

checkUser().then(() => console.log('CHECK DONE')).catch(err => console.error(err));
