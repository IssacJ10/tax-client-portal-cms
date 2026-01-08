const fs = require('fs');
const path = require('path');

// Load the questions configuration
const configPath = path.join(__dirname, '../src/config/questions_v2.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

console.log('\n========================================');
console.log('FIXING REVIEW PAGE DISPLAY ISSUES');
console.log('========================================\n');

// Find the dependents section in review config
const dependentsSection = config.review.sections.find(s => s.id === 'dependents');

if (dependentsSection) {
    // Add format types for fields
    if (!dependentsSection.format) {
        dependentsSection.format = {};
    }

    // Add format for boolean/radio fields that show YES/NO
    dependentsSection.format['isClaimingDTC'] = 'boolean';
    dependentsSection.format['dateOfBirth'] = 'date';

    console.log('✓ Added format types to dependents section');
}

// Find the dependants repeater to get field labels
const dependantsRepeater = config.questions.find(q => q.name === 'dependants.list' && q.type === 'repeater');

if (dependantsRepeater && dependantsRepeater.fields) {
    console.log('\n✓ Found dependants repeater with fields:');
    dependantsRepeater.fields.forEach(field => {
        console.log(`  - ${field.name}: ${field.label}`);
    });
}

// Write updated configuration
fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');

console.log('\n========================================');
console.log('✅ Review config updated');
console.log('========================================\n');
