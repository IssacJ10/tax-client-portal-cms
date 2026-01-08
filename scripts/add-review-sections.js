const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../src/config/questions_v2.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

console.log('\n========================================');
console.log('ADDING MISSING REVIEW SECTIONS');
console.log('========================================\n');

// Find the index where we want to insert new sections (after income_selection)
const financialSourcesIndex = config.review.sections.findIndex(s => s.id === 'financial_sources');

if (financialSourcesIndex !== -1) {
    const newSections = [];

    // Add Self-Employment details section
    newSections.push({
        id: 'self_employment_details',
        title: 'Self-Employment Details',
        conditional: {
            parentQuestionId: 'income.sources',
            operator: 'contains',
            value: 'SELF_EMPLOYMENT'
        },
        fields: [
            'selfEmployment.needsBookkeeping',
            'selfEmployment.gstRegistered',
            'selfEmployment.hasCapitalAssets'
        ],
        format: {
            'selfEmployment.needsBookkeeping': 'boolean',
            'selfEmployment.gstRegistered': 'boolean',
            'selfEmployment.hasCapitalAssets': 'boolean'
        },
        editStepId: 'self_employment'
    });

    // Add Rental Income details section
    newSections.push({
        id: 'rental_income_details',
        title: 'Rental Income Details',
        conditional: {
            parentQuestionId: 'income.sources',
            operator: 'contains',
            value: 'RENTAL_INCOME'
        },
        fields: [
            'rentalIncome.propertyAddress',
            'rentalIncome.propertyType',
            'rentalIncome.ownershipPercentage',
            'rentalIncome.rentalStartDate',
            'rentalIncome.totalRentReceived'
        ],
        format: {
            'rentalIncome.rentalStartDate': 'date',
            'rentalIncome.totalRentReceived': 'currency'
        },
        editStepId: 'rental_income'
    });

    // Insert after financial_sources section
    config.review.sections.splice(financialSourcesIndex + 1, 0, ...newSections);

    console.log('✓ Added Self-Employment Details section');
    console.log('✓ Added Rental Income Details section');
}

// Fix deductions format (wrong field name)
const deductionsSection = config.review.sections.find(s => s.id === 'deductions');
if (deductionsSection && deductionsSection.format) {
    delete deductionsSection.format['deductions.selected'];
    deductionsSection.format['deductions.sources'] = 'list';
    console.log('✓ Fixed deductions format field name');
}

fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');

console.log('\n========================================');
console.log('✅ Review sections updated');
console.log(`Total sections: ${config.review.sections.length}`);
console.log('========================================\n');
