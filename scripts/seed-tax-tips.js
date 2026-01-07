/**
 * Seed data for Tax Tips
 * Run with: node scripts/seed-tax-tips.js
 */

const axios = require('axios');

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
const ADMIN_JWT = process.env.STRAPI_ADMIN_JWT || ''; // Get from Strapi admin settings

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

async function seedTaxTips() {
    console.log('🌱 Seeding Tax Tips...\n');

    if (!ADMIN_JWT) {
        console.error('❌ Error: STRAPI_ADMIN_JWT not set.');
        console.log('Please set your admin JWT token as an environment variable:');
        console.log('export STRAPI_ADMIN_JWT="your-jwt-token-here"');
        console.log('\nYou can get your JWT from: Settings → API Tokens → Create new token\n');
        process.exit(1);
    }

    try {
        for (const tip of sampleTips) {
            console.log(`📝 Creating: "${tip.title}"...`);

            const response = await axios.post(
                `${STRAPI_URL}/api/tax-tips`,
                { data: tip },
                {
                    headers: {
                        'Authorization': `Bearer ${ADMIN_JWT}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log(`✅ Created tip #${response.data.data.id}\n`);
        }

        console.log('🎉 Successfully seeded all tax tips!');
        console.log(`\nTotal tips created: ${sampleTips.length}`);
    } catch (error) {
        console.error('❌ Error seeding tax tips:', error.response?.data || error.message);
        process.exit(1);
    }
}

seedTaxTips();
