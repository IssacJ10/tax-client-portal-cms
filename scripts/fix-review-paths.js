const fs = require('fs');
const path = require('path');

// Load the questions configuration
const configPath = path.join(__dirname, '../src/config/questions_v2.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

console.log('\n========================================');
console.log('FIXING REVIEW PAGE FIELD PATHS');
console.log('========================================\n');

const fixes = [
    // Personal Info section
    { from: 'personalInfo.maritalStatus', to: 'maritalStatus.status' },

    // Contact Details section
    { from: 'personalInfo.phone', to: 'personalInfo.phoneNumber' },
    { from: 'personalInfo.address.street', to: 'personalInfo.streetName' },  // Or streetNumber + streetName combined
    { from: 'personalInfo.address.city', to: 'personalInfo.city' },

    // Dependents section (repeater)
    { from: 'firstName', to: 'fullName' },  // Depends field name
    { from: 'lastName', to: 'fullName' },   // Combined into fullName
    { from: 'relationship', to: 'relationship' },  // This is correct in repeater context
    { from: 'dateOfBirth', to: 'dateOfBirth' },   // This is correct in repeater context

    // Deductions section
    { from: 'deductions.selected', to: 'deductions.sources' }
];

let fixCount = 0;

config.review.sections.forEach(section => {
    if (!section.fields) return;

    section.fields = section.fields.map(fieldPath => {
        const fix = fixes.find(f => f.from === fieldPath);
        if (fix) {
            console.log(`✓ ${section.id}: "${fix.from}" → "${fix.to}"`);
            fixCount++;
            return fix.to;
        }
        return fieldPath;
    });
});

// Special handling for dependents - it's a repeater section
const dependentsSection = config.review.sections.find(s => s.id === 'dependents');
if (dependentsSection) {
    // For repeater sections, fields should match repeater field names
    dependentsSection.isRepeater = true;
    dependentsSection.dataPath = 'dependants.list';  // The actual repeater field name
    dependentsSection.fields = ['fullName', 'relationship', 'dateOfBirth', 'isClaimingDTC'];
    console.log(`✓ Updated dependents section to use repeater format`);
    fixCount++;
}

// Write updated configuration
fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');

console.log('\n========================================');
console.log(`✅ Fixed ${fixCount} review field paths`);
console.log('========================================\n');
