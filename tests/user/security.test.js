const fs = require('fs');
const path = require('path');

describe('User Schema Security', () => {
    // Fix: Go up 2 levels from /tests/user to reach project root, then into src
    const schemaPath = path.resolve(__dirname, '../../src/extensions/users-permissions/content-types/user/schema.json');

    test('User schema exists', () => {
        expect(fs.existsSync(schemaPath)).toBe(true);
    });

    test('Enforces strict regex on firstName and lastName', () => {
        const schemaContent = fs.readFileSync(schemaPath, 'utf8');
        const schema = JSON.parse(schemaContent);
        // Note: The regex string in JSON has double backslash, but here we expect the parsed string
        // In JSON file: "^[a-zA-Z \\-']+$" (where \ is escaped)
        // Parsed in JS: "^[a-zA-Z \-']+$"
        const strictRegex = "^[a-zA-Z \\-']+$";

        expect(schema.attributes.firstName.regex).toBe(strictRegex);
        expect(schema.attributes.lastName.regex).toBe(strictRegex);
    });
});
