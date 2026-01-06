
const { createStrapi } = require('@strapi/strapi');

async function seed() {
    const strapi = await createStrapi({ distDir: './dist' }).load();

    try {
        const yearsToSeed = ['2024', '2025'];
        const questions = require('./questions.json');

        for (const year of yearsToSeed) {
            const existingYear = await strapi.entityService.findMany('api::tax-year.tax-year', {
                filters: { year: year }
            });

            if (existingYear.length === 0) {
                console.log(`Seeding ${year} Tax Year...`);
                await strapi.entityService.create('api::tax-year.tax-year', {
                    data: {
                        year: year,
                        isActive: true,
                        isCurrent: year === '2025', // Make 2025 current? Or just default to false/true based on logic. Let's say 2024 is current? No, 2025 is future/current.
                        filingDeadline: `${parseInt(year) + 1}-04-30`,
                        instructions: 'Please provide all relevant tax slips.',
                        filingQuestions: questions
                    }
                });
                console.log(`Seed Complete: ${year} Tax Year created.`);
            } else {
                console.log(`Tax Year ${year} exists. Updating questions...`);
                // existingYear is an array, get the first item
                const id = existingYear[0].id;
                await strapi.entityService.update('api::tax-year.tax-year', id, {
                    data: {
                        filingQuestions: questions
                    }
                });
                console.log(`Tax Year ${year} updated with new questions.`);
            }
        }

    } catch (error) {
        console.error('Seed Error:', error);
    }

    process.exit(0);
}

seed();
