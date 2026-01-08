const fs = require('fs');
const path = require('path');

// Load the questions configuration
const configPath = path.join(__dirname, '../src/config/questions_v2.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

console.log('\n========================================');
console.log('REVIEW PAGE FIELD PATH AUDIT');
console.log('========================================\n');

// Build set of all actual question names
const questionNames = new Set();
config.questions.forEach(q => {
    questionNames.add(q.name);

    // Also add repeater field names with parent path
    if (q.type === 'repeater' && q.fields) {
        q.fields.forEach(field => {
            questionNames.add(`${q.name}.${field.name}`);
        });
    }
});

console.log(`Total question names in config: ${questionNames.size}\n`);

// Check review configuration
const mismatches = [];
const corrections = [];

if (config.review && config.review.sections) {
    config.review.sections.forEach(section => {
        if (!section.fields) return;

        section.fields.forEach(fieldPath => {
            if (!questionNames.has(fieldPath)) {
                // Field path doesn't exist
                const fieldParts = fieldPath.split('.');
                const lastPart = fieldParts[fieldParts.length - 1];

                // Try to find similar field
                const similar = Array.from(questionNames).filter(q =>
                    q.endsWith(`.${lastPart}`) || q === lastPart
                );

                mismatches.push({
                    section: section.id,
                    wrongPath: fieldPath,
                    suggestions: similar
                });

                console.log(`❌ Field not found: "${fieldPath}"`);
                console.log(`   Section: ${section.title} (${section.id})`);
                if (similar.length > 0) {
                    console.log(`   Suggestions:`);
                    similar.forEach(s => console.log(`     • ${s}`));

                    if (similar.length === 1) {
                        corrections.push({
                            section: section.id,
                            from: fieldPath,
                            to: similar[0]
                        });
                    }
                } else {
                    console.log(`   ⚠️  No similar fields found`);
                }
                console.log('');
            }
        });
    });
}

console.log('\n========================================');
console.log('SUMMARY');
console.log('========================================\n');
console.log(`Total mismatches found: ${mismatches.length}`);
console.log(`Auto-fixable (single suggestion): ${corrections.length}\n`);

if (corrections.length > 0) {
    console.log('Proposed Automatic Corrections:');
    console.log('--------------------------------');
    corrections.forEach((fix, i) => {
        console.log(`${i + 1}. "${fix.from}" → "${fix.to}"`);
    });
    console.log('\n');
}

// Write corrections to file for review
if (corrections.length > 0) {
    const correctionsPath = path.join(__dirname, 'review-path-corrections.json');
    fs.writeFileSync(correctionsPath, JSON.stringify(corrections, null, 2));
    console.log(`✅ Corrections saved to: ${correctionsPath}`);
}

if (mismatches.length === 0) {
    console.log('✅ All review paths are valid!');
} else {
    console.log(`⚠️  Please review the ${mismatches.length} mismatches above`);
}

console.log('\n========================================\n');
