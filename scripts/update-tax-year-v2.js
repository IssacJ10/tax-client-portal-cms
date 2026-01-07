/**
 * Update Tax Year Script - Use V2 JSON Format
 * Run: node scripts/update-tax-year-v2.js
 */

const fs = require('fs');
const path = require('path');

async function updateTaxYear() {
    try {
        console.log('🚀 Starting Tax Year V2 Update...\n');

        // Load questions_v2.json
        console.log('📦 Loading questions_v2.json...');
        const questionsV2Path = path.join(__dirname, '../src/config/questions_v2.json');
        const questionsV2 = JSON.parse(fs.readFileSync(questionsV2Path, 'utf8'));

        console.log('✅ Loaded V2 config:');
        console.log(`   - Header: ${questionsV2.header?.title}`);
        console.log(`   - Questions: ${questionsV2.questions?.length}`);
        console.log(`   - Steps: ${questionsV2.steps?.length}\n`);

        // Import Strapi
        console.log('🔌 Connecting to Strapi...');
        const strapi = require('../src/index.js');

        await strapi.load();
        console.log('✅ Strapi connected\n');

        // Find Tax Year 2024
        console.log('🔍 Finding Tax Year 2024...');
        const taxYears = await strapi.documents('api::tax-year.tax-year').findMany({
            filters: { year: '2024' }
        });

        if (!taxYears || taxYears.length === 0) {
            console.log('❌ Tax Year 2024 not found.');
            console.log('💡 Please create it in Strapi admin first, then run this script again.\n');
            process.exit(1);
        }

        const taxYear = taxYears[0];
        console.log(`✅ Found: ${taxYear.year} (ID: ${taxYear.documentId})\n`);

        // Update with V2 format
        console.log('🔄 Updating filingQuestions with V2 format...');
        await strapi.documents('api::tax-year.tax-year').update({
            documentId: taxYear.documentId,
            data: {
                filingQuestions: questionsV2
            }
        });

        console.log('✅ Tax Year updated successfully!\n');
        console.log('📊 Summary:');
        console.log('   - Format: V2 (native question-based)');
        console.log('   - Dynamic Headers: ✓');
        console.log('   - Conditional Logic: ✓');
        console.log('   - Auto-Migration: Not needed anymore\n');

        console.log('🎉 Done! Tax Year 2024 is now using questions_v2.json\n');

        await strapi.destroy();
        process.exit(0);

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error);
        process.exit(1);
    }
}

updateTaxYear();
