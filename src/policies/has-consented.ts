/**
 * Policy to ensure user has consented to terms
 */
export default (policyContext, config, { strapi }) => {
    const user = policyContext.state.user;

    if (!user) {
        return false; // Not logged in
    }

    if (user.hasConsentedToTerms) {
        return true; // Allowed
    }

    // If attempting to create/update filing without consent
    return false;
};