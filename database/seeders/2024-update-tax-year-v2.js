/**
 * Strapi Database Seeder - Update Tax Year to use V2 JSON
 * Run this script to update the Tax Year with the new questions_v2.json format
 */

const fs = require('fs');
const path = require('path');

module.exports = {
    async up(params) {
        const { strapi } = params;

        try {
            console.log('📦 Loading questions_v2.json...');
            const questionsV2Path = path.join(__dirname, '../../config/questions_v2.json');
            const questionsV2 = JSON.parse(fs.readFileSync(questionsV2Path, 'utf8'));

            console.log('🔍 Finding Tax Year 2024...');

            // Find the tax year record
            const taxYears = await strapi.documents('api::tax-year.tax-year').findMany({
                filters: { year: '2024' }
            });

            if (!taxYears || taxYears.length === 0) {
                console.log('❌ Tax Year 2024 not found. Please create it first.');
                return;
            }

            const taxYear = taxYears[0];
            console.log(`✅ Found Tax Year: ${taxYear.year} (ID: ${taxYear.documentId})`);

            console.log('🔄 Updating with questions_v2.json...');

            // Update the tax year with V2 format
            await strapi.documents('api::tax-year.tax-year').update({
                documentId: taxYear.documentId,
                data: {
                    filingQuestions: questionsV2
                }
            });

            console.log('✅ Tax Year updated successfully with V2 format!');
            console.log('📊 New structure:');
            console.log(`   - Header: ${questionsV2.header?.title}`);
            console.log(`   - Questions: ${questionsV2.questions?.length}`);
            console.log(`   - Steps: ${questionsV2.steps?.length}`);

        } catch (error) {
            console.error('❌ Error updating tax year:', error);
            throw error;
        }
    },

    async down() {
        console.log('⚠️  Rollback not implemented. Please restore from backup if needed.');
    }
};
