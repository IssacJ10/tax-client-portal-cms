/**
 * SIMPLE MANUAL SEED - Just copy-paste these into Strapi UI
 * Go to Content Manager → Tax tips → Create new entry
 * Copy each tip below and paste values into the form
 */

const sampleTips = [
    {
        title: "Maximize Your RRSP Contributions",
        description: "Contributing to your RRSP before the March 1st deadline can reduce your taxable income and increase your refund. Even small contributions add up!",
        icon: "calculator",
        category: "deduction",
        externalLink: "https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/rrsps-related-plans.html",
        isActive: true,
        displayOrder: 1
    },
    {
        title: "Don't Forget Medical Expenses",
        description: "You can claim medical expenses that exceed 3% of your net income. Keep all receipts for prescriptions, dental work, and medical devices.",
        icon: "shield",
        category: "deduction",
        externalLink: "",
        isActive: true,
        displayOrder: 2
    },
    {
        title: "April 30th Filing Deadline",
        description: "Most Canadians must file their tax return by April 30, 2025. File early to get your refund faster and avoid penalties for late filing.",
        icon: "lightbulb",
        category: "deadline",
        externalLink: "",
        isActive: true,
        displayOrder: 3
    },
    {
        title: "Home Office Deduction",
        description: "If you work from home, you may be eligible to claim a portion of your housing costs. Use the simplified method or detailed method based on your situation.",
        icon: "document",
        category: "strategy",
        externalLink: "https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/deductions-credits-expenses/line-229-other-employment-expenses/work-space-home-expenses.html",
        isActive: true,
        displayOrder: 4
    },
    {
        title: "Track Your Charitable Donations",
        description: "Donations to registered charities can provide significant tax credits. Make sure you have official receipts for all donations over $20.",
        icon: "trending",
        category: "general",
        externalLink: "",
        isActive: true,
        displayOrder: 5
    },
    {
        title: "Self-Employed? June 15 Deadline",
        description: "If you're self-employed, your filing deadline is June 15, 2025. However, any taxes owed are still due by April 30 to avoid interest charges.",
        icon: "calculator",
        category: "deadline",
        externalLink: "",
        isActive: true,
        displayOrder: 6
    }
];

console.log('📋 COPY-PASTE THESE INTO STRAPI UI:\n');
console.log('Go to: http://localhost:1337/admin/content-manager/collection-types/api::tax-tip.tax-tip\n');
console.log('Click "Create new entry" for each tip below:\n');

sampleTips.forEach((tip, index) => {
    console.log(`\n========== TIP #${index + 1} ==========`);
    console.log(`Title: ${tip.title}`);
    console.log(`Description: ${tip.description}`);
    console.log(`Icon: ${tip.icon}`);
    console.log(`Category: ${tip.category}`);
    console.log(`External Link: ${tip.externalLink || '(leave empty)'}`);
    console.log(`Is Active: ✓ (check the box)`);
    console.log(`Display Order: ${tip.displayOrder}`);
});

console.log('\n\n✅ After adding all 6 tips, they will appear on your dashboard!');
