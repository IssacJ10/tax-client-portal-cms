const fs = require('fs');
const path = require('path');

// Load the questions configuration
const configPath = path.join(__dirname, '../src/config/questions_v2.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

let fixCount = 0;
const report = [];

// Function to fix a question
function fixQuestion(question) {
    // Only fix if it has BOTH conditional AND validation.required = true
    if (question.conditional && question.validation?.required === true) {
        report.push({
            id: question.id,
            name: question.name,
            label: question.label,
            condition: question.conditional
        });

        // Convert required: true to conditionalRequired with the same condition
        delete question.validation.required;
        question.validation.conditionalRequired = {
            when: question.conditional
        };

        fixCount++;
    }
}

// Process all questions
if (config.questions && Array.isArray(config.questions)) {
    config.questions.forEach(question => {
        fixQuestion(question);

        // Also check repeater fields
        if (question.type === 'repeater' && question.fields) {
            question.fields.forEach(field => {
                // Repeater fields might also have conditional logic
                if (field.conditional && field.validation?.required === true) {
                    report.push({
                        id: `${question.id}.${field.name}`,
                        name: `${question.name}.${field.name}`,
                        label: field.label,
                        condition: field.conditional
                    });

                    delete field.validation.required;
                    field.validation.conditionalRequired = {
                        when: field.conditional
                    };

                    fixCount++;
                }
            });
        }
    });
}

// Write updated configuration
fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');

// Write report
console.log('\n========================================');
console.log('CONDITIONAL VALIDATION FIX REPORT');
console.log('========================================\n');
console.log(`Total fields fixed: ${fixCount}\n`);

console.log('Fixed Fields:\n');
report.forEach((item, index) => {
    console.log(`${index + 1}. ${item.label} (${item.name})`);
    console.log(`   Condition: ${item.condition.parentQuestionId} ${item.condition.operator} ${item.condition.value || item.condition.values}`);
    console.log('');
});

console.log('\n========================================');
console.log('✅ Configuration updated successfully!');
console.log('========================================\n');
