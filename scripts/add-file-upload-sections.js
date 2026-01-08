const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../src/config/questions_v2.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

console.log('\n========================================');
console.log('ADDING FILE UPLOAD & AMOUNT SECTIONS');
console.log('========================================\n');

const existingIds = new Set(config.review.sections.map(s => s.id));

// Find insertion point (after financial sources)
const financialIndex = config.review.sections.findIndex(s => s.id === 'financial_sources');

const newSections = [];

// Investment Income
if (!existingIds.has('investment_income_details')) {
    newSections.push({
        id: 'investment_income_details',
        title: 'Investment Income',
        conditional: {
            parentQuestionId: 'income.sources',
            operator: 'contains',
            value: 'INVESTMENT_INCOME'
        },
        fields: [
            'investment.t3Documents',
            'investment.t5Documents',
            'investment.otherDocuments'
        ],
        format: {
            'investment.t3Documents': 'files',
            'investment.t5Documents': 'files',
            'investment.otherDocuments': 'files'
        },
        editStepId: 'investment_income'
    });
}

// Pension Income
if (!existingIds.has('pension_income_details')) {
    newSections.push({
        id: 'pension_income_details',
        title: 'Pension Income',
        conditional: {
            parentQuestionId: 'income.sources',
            operator: 'contains',
            value: 'PENSION_INCOME'
        },
        fields: [
            'pension.pensionDocuments',
            'pension.oasDocuments'
        ],
        format: {
            'pension.pensionDocuments': 'files',
            'pension.oasDocuments': 'files'
        },
        editStepId: 'pension_income'
    });
}

// RRSP Withdrawals
if (!existingIds.has('rrsp_withdrawal_details')) {
    newSections.push({
        id: 'rrsp_withdrawal_details',
        title: 'RRSP Withdrawals',
        conditional: {
            parentQuestionId: 'income.sources',
            operator: 'contains',
            value: 'RRSP_WITHDRAWAL'
        },
        fields: [
            'rrspWithdrawal.totalAmount',
            'rrspWithdrawal.documents'
        ],
        format: {
            'rrspWithdrawal.totalAmount': 'currency',
            'rrspWithdrawal.documents': 'files'
        },
        editStepId: 'rrsp_withdrawal'
    });
}

// Other Income
if (!existingIds.has('other_income_details')) {
    newSections.push({
        id: 'other_income_details',
        title: 'Other Income',
        conditional: {
            parentQuestionId: 'income.sources',
            operator: 'contains',
            value: 'OTHER_INCOME'
        },
        fields: [
            'otherIncome.description',
            'otherIncome.amount',
            'otherIncome.documents'
        ],
        format: {
            'otherIncome.amount': 'currency',
            'otherIncome.documents': 'files'
        },
        editStepId: 'other_income'
    });
}

// RRSP Contributions (Deduction)
if (!existingIds.has('rrsp_contributions_details')) {
    newSections.push({
        id: 'rrsp_contributions_details',
        title: 'RRSP Contributions',
        conditional: {
            parentQuestionId: 'deductions.sources',
            operator: 'contains',
            value: 'RRSP'
        },
        fields: [
            'rrsp.contributionAmount',
            'rrsp.receipts'
        ],
        format: {
            'rrsp.contributionAmount': 'currency',
            'rrsp.receipts': 'files'
        },
        editStepId: 'rrsp_deductions'
    });
}

// Union Dues
if (!existingIds.has('union_dues_details')) {
    newSections.push({
        id: 'union_dues_details',
        title: 'Union Dues',
        conditional: {
            parentQuestionId: 'deductions.sources',
            operator: 'contains',
            value: 'UNION_DUES'
        },
        fields: [
            'unionDues.totalAmount',
            'unionDues.receipts'
        ],
        format: {
            'unionDues.totalAmount': 'currency',
            'unionDues.receipts': 'files'
        },
        editStepId: 'union_dues'
    });
}

if (newSections.length > 0) {
    // Insert after financial_sources
    config.review.sections.splice(financialIndex + 1, 0, ...newSections);

    console.log(`✓ Added ${newSections.length} file upload & amount sections:\n`);
    newSections.forEach(s => {
        console.log(`  - ${s.id}: ${s.title}`);
        console.log(`    Fields: ${s.fields.join(', ')}`);
        console.log('');
    });

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');

    console.log('========================================');
    console.log(`✅ Successfully added ${newSections.length} sections`);
    console.log(`Total review sections: ${config.review.sections.length}`);
    console.log('========================================\n');
} else {
    console.log('✅ All sections already exist!\n');
}
