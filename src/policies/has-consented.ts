/**
 * Policy to ensure user has consented to terms
 */
export default (policyContext, config, { strapi }) => {
    const user = policyContext.state.user;

    if (!user) {
        return false; // Not logged in
    }

    const isAdmin = user.role?.type === 'admin' || user.role?.type === 'admin_role' || user.role?.name === 'Admin';

    console.log(`[Policy Check] User: ${user.email}, RoleName: ${user.role?.name}, RoleType: ${user.role?.type}, Consented: ${user.hasConsentedToTerms}, isAdmin: ${isAdmin}`);

    if (user.hasConsentedToTerms || isAdmin) {
        return true; // Allowed
    }

    console.log(`[Policy Block] User ${user.email} blocked - no consent and not admin`);
    return false;
};