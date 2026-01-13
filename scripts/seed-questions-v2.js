
const { createStrapi } = require('@strapi/strapi');
const path = require('path');
const fs = require('fs');

async function seed() {
    console.log('🚀 Loading Strapi...');
    const strapi = await createStrapi({ distDir: './dist' }).load();

    try {
        console.log('📦 Loading src/config/questions_v2.json...');
        const questionsV2Path = path.join(__dirname, '../src/config/questions_v2.json');

        if (!fs.existsSync(questionsV2Path)) {
            console.error(`❌ File not found: ${questionsV2Path}`);
            process.exit(1);
        }

        const questionsV2 = JSON.parse(fs.readFileSync(questionsV2Path, 'utf8'));

        console.log('🔍 Finding Tax Year 2024...');
        const taxYears = await strapi.documents('api::tax-year.tax-year').findMany({
            filters: { year: '2024' }
        });

        if (!taxYears || taxYears.length === 0) {
            console.log('❌ Tax Year 2024 not found.');
            return;
        }

        const taxYear = taxYears[0];
        console.log(`✅ Found Tax Year: ${taxYear.year}`);

        console.log('🔄 Updating with new questions...');
        await strapi.documents('api::tax-year.tax-year').update({
            documentId: taxYear.documentId,
            data: {
                filingQuestions: questionsV2
            }
        });

        console.log('✅ Tax Year updated successfully!');

    } catch (error) {
        console.error('❌ Seed Error:', error);
    }

    process.exit(0);
}

seed();
