const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../src/config/questions_v2.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Helper to update validation
function updateValidation(questionId, updates) {
    const question = config.questions.find(q => q.id === questionId);
    if (question) {
        if (!question.validation) question.validation = {};
        Object.assign(question.validation, updates);
        console.log(`Updated ${questionId} with`, updates);
    } else {
        console.warn(`Question ${questionId} not found`);
    }
}

// 1. Personal Info
updateValidation('q_dob', {
    minDate: "1900-01-01",
    maxDate: "today"
});
updateValidation('q_date_became_resident', {
    maxDate: "today",
    minDateRef: "personalInfo.dateOfBirth"
});

// 2. Spouse Info
updateValidation('q_spouse_dob', {
    minDate: "1900-01-01",
    maxDate: "today"
});
updateValidation('q_spouse_entry_date', {
    maxDate: "today",
    minDateRef: "spouse.dateOfBirth"
});
updateValidation('q_spouse_resident_date', {
    maxDate: "today",
    minDateRef: "spouse.dateOfBirth"
});

// 3. Dependents (Nested Repeater Fields)
const dependentsQ = config.questions.find(q => q.id === 'q_dependants');
if (dependentsQ && dependentsQ.fields) {
    const dobField = dependentsQ.fields.find(f => f.name === 'dateOfBirth');
    if (dobField) {
        dobField.validation = { ...dobField.validation, maxDate: "today", minDate: "2000-01-01" };
        console.log('Updated Dependent DOB');
    }
    const residentField = dependentsQ.fields.find(f => f.name === 'dateBecameResident');
    if (residentField) {
        residentField.validation = { ...residentField.validation, maxDate: "today" };
        console.log('Updated Dependent Resident Date');
    }
}

// Write back
fs.writeFileSync(configPath, JSON.stringify(config, null, 4));
console.log('questions_v2.json updated successfully');
