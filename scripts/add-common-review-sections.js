const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../src/config/questions_v2.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

console.log('\n========================================');
console.log('ADDING ALL MISSING REVIEW SECTIONS');
console.log('========================================\n');

// Get fields organized by parent namespace
const fieldsByNamespace = new Map();
config.questions.forEach(q => {
    if (q.name && q.name.includes('.')) {
        const namespace = q.name.split('.')[0];
        if (!fieldsByNamespace.has(namespace)) {
            fieldsByNamespace.set(namespace, []);
        }
        fieldsByNamespace.get(namespace).push(q);
    }
});

// Find existing review sections
const existingIds = new Set(config.review.sections.map(s => s.id));

// Find insertion point (after deductions section)
const deductionsIndex = config.review.sections.findIndex(s => s.id === 'deductions');
const insertIndex = deductionsIndex + 1;

const newSections = [];

// Helper to create review section
function createSection(id, title, parentField, value, fields, formats = {}) {
    if (fields.length === 0) return null;

    return {
        id,
        title,
        conditional: {
            parentQuestionId: parentField,
            operator: 'contains',
            value
        },
        fields,
        format: formats,
        editStepId: id.replace('_details', '')
    };
}

// Employment T4 - file uploads only
const t4Fields = ['employment.t4Documents'];
const t4Section = createSection(
    'employment_t4_details',
    'Employment Income (T4)',
    'income.sources',
    'EMPLOYMENT_T4',
    t4Fields,
    { 'employment.t4Documents': 'files' }
);
if (t4Section) newSections.push(t4Section);

// Moving Expenses
const movingFields = fieldsByNamespace.get('movingExpenses')
    ?.filter(f => !f.type === 'repeater')
    .map(f => f.name)
    .slice(0, 5) || []; // Limit to key fields

if (movingFields.length > 0) {
    newSections.push(createSection(
        'moving_expenses_details',
        'Moving Expenses',
        'deductions.sources',
        'MOVING_EXPENSES',
        movingFields
    ));
}

// Vehicle Expenses (work)
const vehicleFields = [
    'workExpenses.vehicleMake',
    'workExpenses.vehicleYear',
    'workExpenses.vehicleKmTotal',
    'workExpenses.vehicleKmWork'
];
newSections.push(createSection(
    'vehicle_expenses_details',
    'Vehicle Expenses',
    'workExpenses.categories',
    'VEHICLE_EXPENSES',
    vehicleFields
));

// Home Office (work)
const homeOfficeFields = [
    'workExpenses.homeOfficeSize',
    'workExpenses.totalHomeSize',
    'workExpenses.homeOfficePercentage'
];
newSections.push(createSection(
    'home_office_work_details',
    'Home Office (Work)',
    'workExpenses.categories',
    'HOME_OFFICE',
    homeOfficeFields
));

// Disability Credit
const disabilityFields = [
    'disabilityCredit.affectedPersons',
    'disabilityCredit.documents'
];
newSections.push(createSection(
    'disability_credit_details',
    'Disability Tax Credit',
    'disabilityCredit.affectedPersons',
    '',  // Any value
    disabilityFields,
    {
        'disabilityCredit.affectedPersons': 'list',
        'disabilityCredit.documents': 'files'
    }
));

// Filter out null sections and sections that already exist
const sectionsToAdd = newSections.filter(s => s && !existingIds.has(s.id));

if (sectionsToAdd.length > 0) {
    // Insert sections
    config.review.sections.splice(insertIndex, 0, ...sectionsToAdd);

    console.log(`✓ Added ${sectionsToAdd.length} review sections:\n`);
    sectionsToAdd.forEach(s => {
        console.log(`  - ${s.id}: ${s.title}`);
        console.log(`    Condition: ${s.conditional.parentQuestionId} contains ${s.conditional.value}`);
        console.log(`    Fields: ${s.fields.length}`);
        console.log('');
    });

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');

    console.log('========================================');
    console.log(`✅ Successfully added ${sectionsToAdd.length} sections`);
    console.log(`Total review sections: ${config.review.sections.length}`);
    console.log('========================================\n');
} else {
    console.log('✅ No new sections needed - all covered!\n');
}
