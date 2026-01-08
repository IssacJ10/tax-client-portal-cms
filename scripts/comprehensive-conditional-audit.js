const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../src/config/questions_v2.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

console.log('\n========================================');
console.log('COMPREHENSIVE CONDITIONAL AUDIT');
console.log('========================================\n');

// Build a map of all questions by name
const questionsByName = new Map();
const questionsByStep = new Map();

config.questions.forEach(q => {
    if (q.name) {
        questionsByName.set(q.name, q);
    }
    if (q.step) {
        if (!questionsByStep.has(q.step)) {
            questionsByStep.set(q.step, []);
        }
        questionsByStep.get(q.step).push(q);
    }
});

console.log(`Total questions: ${config.questions.length}`);
console.log(`Unique field names: ${questionsByName.size}`);
console.log(`Steps: ${questionsByStep.size}\n`);

// AUDIT 1: Check for non-existent parentQuestionId references
console.log('📋 AUDIT 1: Non-existent Parent Question References');
console.log('='.repeat(60));
const invalidParents = [];

config.questions.forEach(q => {
    if (q.conditional && q.conditional.parentQuestionId) {
        const parentId = q.conditional.parentQuestionId;
        if (!questionsByName.has(parentId)) {
            invalidParents.push({
                question: q.name || q.id,
                missingParent: parentId,
                questionId: q.id
            });
        }
    }

    // Also check conditionalRequired
    if (q.validation?.conditionalRequired?.when?.parentQuestionId) {
        const parentId = q.validation.conditionalRequired.when.parentQuestionId;
        if (!questionsByName.has(parentId)) {
            invalidParents.push({
                question: q.name || q.id,
                missingParent: parentId,
                questionId: q.id,
                type: 'conditionalRequired'
            });
        }
    }
});

if (invalidParents.length > 0) {
    console.log(`❌ Found ${invalidParents.length} references to non-existent parent questions:\n`);
    invalidParents.forEach(issue => {
        console.log(`  ${issue.question} (${issue.questionId})`);
        console.log(`    → References non-existent: ${issue.missingParent}`);
        if (issue.type) console.log(`    → In: ${issue.type}`);
        console.log('');
    });
} else {
    console.log('✅ All parent question references are valid\n');
}

// AUDIT 2: Check for value mismatches (like the vehicle bug)
console.log('\n📋 AUDIT 2: Conditional Value Mismatches');
console.log('='.repeat(60));
const valueMismatches = [];

config.questions.forEach(q => {
    if (q.conditional && q.conditional.parentQuestionId && q.conditional.value) {
        const parent = questionsByName.get(q.conditional.parentQuestionId);

        if (parent) {
            // Check if parent is a checkbox/radio with options
            if (parent.options && Array.isArray(parent.options)) {
                const parentValues = parent.options.map(opt =>
                    typeof opt === 'string' ? opt : opt.value
                );

                // Check if the conditional value exists in parent's options
                if (!parentValues.includes(q.conditional.value)) {
                    valueMismatches.push({
                        question: q.name || q.id,
                        parent: q.conditional.parentQuestionId,
                        conditionalValue: q.conditional.value,
                        availableValues: parentValues,
                        questionId: q.id
                    });
                }
            }
        }
    }
});

if (valueMismatches.length > 0) {
    console.log(`❌ Found ${valueMismatches.length} conditional value mismatches:\n`);
    valueMismatches.forEach(issue => {
        console.log(`  ${issue.question} (${issue.questionId})`);
        console.log(`    → Checks for: ${issue.parent} contains "${issue.conditionalValue}"`);
        console.log(`    → Available values: ${issue.availableValues.join(', ')}`);
        console.log(`    → MISMATCH: Value "${issue.conditionalValue}" not in parent's options!`);
        console.log('');
    });
} else {
    console.log('✅ All conditional values match parent question options\n');
}

// AUDIT 3: Check for circular dependencies
console.log('\n📋 AUDIT 3: Circular Conditional Dependencies');
console.log('='.repeat(60));
const circularDeps = [];

function checkCircular(questionName, visited = new Set()) {
    if (visited.has(questionName)) {
        return Array.from(visited);
    }

    visited.add(questionName);
    const question = questionsByName.get(questionName);

    if (question?.conditional?.parentQuestionId) {
        return checkCircular(question.conditional.parentQuestionId, visited);
    }

    return null;
}

questionsByName.forEach((q, name) => {
    if (q.conditional?.parentQuestionId) {
        const circular = checkCircular(name);
        if (circular && circular.length > 1) {
            circularDeps.push({
                chain: circular,
                question: name
            });
        }
    }
});

if (circularDeps.length > 0) {
    console.log(`⚠️  Found ${circularDeps.length} potential circular dependencies:\n`);
    circularDeps.forEach(issue => {
        console.log(`  Chain: ${issue.chain.join(' → ')}`);
        console.log('');
    });
} else {
    console.log('✅ No circular dependencies detected\n');
}

// AUDIT 4: Check for operator/value type mismatches
console.log('\n📋 AUDIT 4: Operator/Value Type Mismatches');
console.log('='.repeat(60));
const operatorMismatches = [];

config.questions.forEach(q => {
    if (q.conditional) {
        const { operator, value, parentQuestionId } = q.conditional;
        const parent = questionsByName.get(parentQuestionId);

        if (parent) {
            // "contains" operator should only be used with array/checkbox fields
            if (operator === 'contains' && parent.type !== 'checkbox') {
                operatorMismatches.push({
                    question: q.name || q.id,
                    issue: `Uses "contains" operator but parent "${parentQuestionId}" is type "${parent.type}", not checkbox`,
                    questionId: q.id
                });
            }

            // "equals" operator with checkbox doesn't make sense
            if (operator === 'equals' && parent.type === 'checkbox') {
                operatorMismatches.push({
                    question: q.name || q.id,
                    issue: `Uses "equals" operator but parent "${parentQuestionId}" is checkbox (should use "contains")`,
                    questionId: q.id
                });
            }
        }
    }
});

if (operatorMismatches.length > 0) {
    console.log(`⚠️  Found ${operatorMismatches.length} operator/type mismatches:\n`);
    operatorMismatches.forEach(issue => {
        console.log(`  ${issue.question} (${issue.questionId})`);
        console.log(`    → ${issue.issue}`);
        console.log('');
    });
} else {
    console.log('✅ All operators match their parent question types\n');
}

// Summary
console.log('\n========================================');
console.log('AUDIT SUMMARY');
console.log('========================================');
console.log(`Invalid parent references: ${invalidParents.length}`);
console.log(`Value mismatches: ${valueMismatches.length}`);
console.log(`Circular dependencies: ${circularDeps.length}`);
console.log(`Operator mismatches: ${operatorMismatches.length}`);

const totalIssues = invalidParents.length + valueMismatches.length + circularDeps.length + operatorMismatches.length;

if (totalIssues === 0) {
    console.log('\n✅ ✅ ✅ NO ISSUES FOUND - Configuration is clean! ✅ ✅ ✅');
} else {
    console.log(`\n⚠️  TOTAL ISSUES FOUND: ${totalIssues}`);
    console.log('\nRecommendation: Review and fix these issues to prevent runtime bugs.');
}

console.log('========================================\n');

// Save detailed report
const report = {
    timestamp: new Date().toISOString(),
    invalidParents,
    valueMismatches,
    circularDeps,
    operatorMismatches,
    summary: {
        totalQuestions: config.questions.length,
        totalIssues,
        invalidParents: invalidParents.length,
        valueMismatches: valueMismatches.length,
        circularDeps: circularDeps.length,
        operatorMismatches: operatorMismatches.length
    }
};

fs.writeFileSync(
    path.join(__dirname, 'conditional-audit-report.json'),
    JSON.stringify(report, null, 2)
);

console.log('📄 Detailed report saved to: scripts/conditional-audit-report.json\n');
