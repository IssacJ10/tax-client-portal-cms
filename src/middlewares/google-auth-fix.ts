export default (config, { strapi }) => {
    return async (ctx, next) => {
        // Check if this is the Google callback URL
        if (ctx.method === 'GET' && ctx.path === '/api/connect/google/callback') {
            strapi.log.info('[[GOOGLE_MIDDLEWARE]] Intercepting Google Callback');

            try {
                const { code } = ctx.query;
                if (!code) throw new Error('No code provided');

                // 1. Manually Exchange Code for Access Token
                // This avoids Strapi's internal redirect_uri mismatch issues
                const params = new URLSearchParams();
                params.append('code', code as string);
                params.append('client_id', process.env.GOOGLE_CLIENT_ID || '');
                params.append('client_secret', process.env.GOOGLE_CLIENT_SECRET || '');
                params.append('redirect_uri', 'http://localhost:1337/api/connect/google/callback');
                params.append('grant_type', 'authorization_code');

                const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: params.toString(),
                });

                if (!tokenRes.ok) {
                    const errorText = await tokenRes.text();
                    const status = tokenRes.status;
                    console.error(`Google Token Exchange Failed: ${status}`, errorText); // Console error for debugging
                    throw new Error(`Google Token Exchange Failed: ${status} ${errorText}`);
                }

                const tokenData = await tokenRes.json() as any;
                const accessToken = tokenData.access_token;

                strapi.log.info('[[GOOGLE_MIDDLEWARE]] Manual Token Exchange Successful');

                // 2. Fetch User Profile from Google directly to ensure we get names
                const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                    headers: { Authorization: `Bearer ${accessToken}` }
                });
                const profile = await profileRes.json() as any;

                // 3. Delegate to Strapi Providers Service
                const providersService = strapi.plugin('users-permissions').service('providers');
                let user = await providersService.connect('google', { access_token: accessToken });

                if (!user) {
                    throw new Error('User not found after mapping google profile');
                }

                // 4. Force Update User Profile (FirstName/LastName)
                // Strapi's default provider might not map these fields automatically
                if (!user.firstName || !user.lastName) {
                    strapi.log.info(`[[GOOGLE_MIDDLEWARE]] Updating user ${user.id} with Google Profile data`);
                    user = await strapi.entityService.update('plugin::users-permissions.user', user.id, {
                        data: {
                            firstName: profile.given_name || user.username,
                            lastName: profile.family_name || 'Mapped',
                            // We can also set confirmed to true if not already
                            confirmed: true
                        }
                    });
                }

                // 3. Issue JWT
                const jwtService = strapi.plugin('users-permissions').service('jwt');
                const jwt = jwtService.issue({ id: user.id });

                strapi.log.info(`[[GOOGLE_MIDDLEWARE]] Success! Redirecting to frontend with JWT.`);

                // 4. Force Redirect to Frontend
                ctx.status = 302;
                ctx.redirect(`http://localhost:3000/connect/google/redirect?jwt=${jwt}`);

                return;

            } catch (error) {
                strapi.log.error('[[GOOGLE_MIDDLEWARE]] Error:', error);

                // Redirect with error
                ctx.status = 302;
                ctx.redirect(`http://localhost:3000/connect/google/redirect?error=${encodeURIComponent(error.message || 'Unknown error')}`);
                return;
            }
        }

        // Pass through for all other requests
        await next();
    };
};
