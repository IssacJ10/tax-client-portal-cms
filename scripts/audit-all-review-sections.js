const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../src/config/questions_v2.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

console.log('\n========================================');
console.log('COMPREHENSIVE REVIEW SECTION AUDIT');
console.log('========================================\n');

// Get all steps that have conditional questions
const conditionalSteps = new Map();
const selectionFields = new Set(); // Fields that trigger conditional sections

config.questions.forEach(q => {
    if (q.conditional) {
        const parentId = q.conditional.parentQuestionId;
        const step = q.step;

        if (!conditionalSteps.has(parentId)) {
            conditionalSteps.set(parentId, new Set());
        }
        conditionalSteps.get(parentId).add(step);
        selectionFields.add(parentId);
    }

    // Track checkbox/multi-select fields
    if (q.type === 'checkbox' && q.name.includes('sources')) {
        selectionFields.add(q.name);
    }
});

console.log('SELECTION FIELDS THAT TRIGGER CONDITIONAL CONTENT:');
console.log('==================================================');
selectionFields.forEach(field => {
    const steps = conditionalSteps.get(field);
    if (steps) {
        console.log(`\n${field}:`);
        steps.forEach(step => {
            console.log(`  → ${step} step`);
        });
    }
});

// Get existing review sections
const existingReviewSections = new Set(config.review.sections.map(s => s.id));

console.log('\n\nEXISTING REVIEW SECTIONS:');
console.log('========================');
config.review.sections.forEach(s => {
    const conditional = s.conditional ? ` [CONDITIONAL: ${s.conditional.parentQuestionId}]` : '';
    console.log(`- ${s.id}: ${s.title}${conditional}`);
});

// Find fields by step
const fieldsByStep = new Map();
config.questions.forEach(q => {
    if (q.step) {
        if (!fieldsByStep.has(q.step)) {
            fieldsByStep.set(q.step, []);
        }
        fieldsByStep.get(q.step).push(q);
    }
});

// Identify missing review sections
console.log('\n\nMISSING REVIEW SECTIONS:');
console.log('========================');

const missingSections = [];

// Check income sources
['EMPLOYMENT_T4', 'SELF_EMPLOYMENT', 'RENTAL_INCOME', 'INVESTMENT_INCOME',
    'PENSION_INCOME', 'RRSP_WITHDRAWAL', 'OTHER_INCOME'].forEach(source => {
        const sectionId = source.toLowerCase() + '_details';
        if (!existingReviewSections.has(sectionId)) {
            missingSections.push({
                id: sectionId,
                title: source.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) + ' Details',
                parentField: 'income.sources',
                value: source
            });
        }
    });

// Check deduction sources
const deductionSources = [
    'RRSP', 'UNION_DUES', 'EMPLOYMENT_EXPENSES',
    'MOVING_EXPENSES', 'CHILDCARE', 'DISABILITY_SUPPORTS',
    'MEDICAL_EXPENSES', 'DONATIONS', 'HOME_OFFICE'
];

deductionSources.forEach(source => {
    const sectionId = source.toLowerCase() + '_details';
    if (!existingReviewSections.has(sectionId)) {
        missingSections.push({
            id: sectionId,
            title: source.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) + ' Details',
            parentField: 'deductions.sources',
            value: source
        });
    }
});

// Check work expenses
const workExpenseCategories = [
    'VEHICLE_EXPENSES', 'HOME_OFFICE_EXPENSES', 'SUPPLIES',
    'PROFESSIONAL_FEES', 'TRAVEL', 'MEALS_ENTERTAINMENT'
];

workExpenseCategories.forEach(category => {
    const sectionId = category.toLowerCase() + '_details';
    if (!existingReviewSections.has(sectionId)) {
        missingSections.push({
            id: sectionId,
            title: category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) + ' Details',
            parentField: 'workExpenses.categories',
            value: category
        });
    }
});

if (missingSections.length > 0) {
    console.log(`\nFound ${missingSections.length} potentially missing sections:\n`);
    missingSections.forEach(section => {
        console.log(`❌ ${section.id}`);
        console.log(`   Title: ${section.title}`);
        console.log(`   Condition: ${section.parentField} contains ${section.value}\n`);
    });
} else {
    console.log('\n✅ No missing sections detected!\n');
}

// Save the list for reference
fs.writeFileSync(
    path.join(__dirname, 'missing-review-sections.json'),
    JSON.stringify(missingSections, null, 2)
);

console.log('========================================');
console.log(`Audit complete. Found ${missingSections.length} missing sections.`);
console.log('========================================\n');
