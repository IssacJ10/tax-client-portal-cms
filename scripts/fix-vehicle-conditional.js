const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../src/config/questions_v2.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

console.log('\n========================================');
console.log('FIXING VEHICLE EXPENSES CONDITIONALS');
console.log('========================================\n');

let fixedCount = 0;

config.questions.forEach(q => {
    // Find vehicle expense questions
    if (q.name && q.name.startsWith('vehicleExpenses.')) {
        // Check if it has the wrong conditional
        if (q.conditional &&
            q.conditional.parentQuestionId === 'workExpenses.expenseTypes' &&
            q.conditional.value === 'TRAVEL') {

            console.log(`Fixing: ${q.name}`);
            console.log(`  Old: workExpenses.expenseTypes contains TRAVEL`);
            console.log(`  New: workExpenses.categories contains TRAVEL_FOR_WORK`);

            // Update to correct field and value
            q.conditional.parentQuestionId = 'workExpenses.categories';
            q.conditional.value = 'TRAVEL_FOR_WORK';

            // Also update conditionalRequired if present
            if (q.validation && q.validation.conditionalRequired) {
                q.validation.conditionalRequired.when.parentQuestionId = 'workExpenses.categories';
                q.validation.conditionalRequired.when.value = 'TRAVEL_FOR_WORK';
                console.log(`  Also fixed conditionalRequired validation`);
            }

            fixedCount++;
            console.log('');
        }
    }
});

fs.writeFileSync(configPath, JSON.stringify(config, null, 4), 'utf8');

console.log('========================================');
console.log(`✅ Fixed ${fixedCount} vehicle expense questions`);
console.log('========================================\n');
