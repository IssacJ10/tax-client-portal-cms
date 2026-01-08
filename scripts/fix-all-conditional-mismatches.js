const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../src/config/questions_v2.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

console.log('\n========================================');
console.log('FIXING ALL CONDITIONAL MISMATCHES');
console.log('========================================\n');

let fixCount = 0;

// FIX 1: Change deductions.selected → deductions.sources
console.log('📋 FIX 1: Invalid Parent References');
console.log('='.repeat(60));

config.questions.forEach(q => {
    let fixed = false;

    // Fix conditional
    if (q.conditional?.parentQuestionId === 'deductions.selected') {
        console.log(`Fixing ${q.name || q.id}: deductions.selected → deductions.sources`);
        q.conditional.parentQuestionId = 'deductions.sources';
        fixed = true;
    }

    // Fix conditionalRequired
    if (q.validation?.conditionalRequired?.when?.parentQuestionId === 'deductions.selected') {
        console.log(`  Also fixed conditionalRequired validation`);
        q.validation.conditionalRequired.when.parentQuestionId = 'deductions.sources';
        fixed = true;
    }

    if (fixed) {
        fixCount++;
        console.log('');
    }
});

// FIX 2: Fix comma-separated values (should check hasAny or use proper operator)
console.log('\n📋 FIX 2: Comma-Separated Value Mismatches');
console.log('='.repeat(60));

config.questions.forEach(q => {
    if (q.conditional?.value === 'WORKED_FROM_HOME,TRAVEL_FOR_WORK,PURCHASED_SUPPLIES') {
        console.log(`Fixing ${q.name || q.id}:`);
        console.log(`  Old: contains "WORKED_FROM_HOME,TRAVEL_FOR_WORK,PURCHASED_SUPPLIES"`);
        console.log(`  New: operator changed to "hasAny" (checks if ANY value selected)`);

        // Change to hasAny operator (checks if field has any value)
        delete q.conditional.value;
        q.conditional.operator = 'hasAny';

        fixCount++;
        console.log('');
    }
});

fs.writeFileSync(configPath, JSON.stringify(config, null, 4), 'utf8');

console.log('========================================');
console.log(`✅ Fixed ${fixCount} conditional issues`);
console.log('========================================\n');

// Re-run audit to confirm
console.log('Running verification audit...\n');
const { execSync } = require('child_process');
try {
    execSync('node scripts/comprehensive-conditional-audit.js', { stdio: 'inherit' });
} catch (e) {
    console.log('Audit completed (see output above)');
}
