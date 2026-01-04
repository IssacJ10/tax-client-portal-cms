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
        const regexStr = "^[a-zA-Z \\-']+$";
        const strictRegex = new RegExp(regexStr);

        expect(schema.attributes.firstName.regex).toBe(regexStr);
        expect(schema.attributes.lastName.regex).toBe(regexStr);

        // Functional Verification
        const validNames = ["John", "Jane Doe", "O'Reilly", "Jean-Luc", "Sarah James"];
        const invalidNames = ["John123", "John!", "John<script>", "SELECT *", "admin@example", ""];

        validNames.forEach(name => {
            expect(strictRegex.test(name)).toBe(true);
        });

        invalidNames.forEach(name => {
            expect(strictRegex.test(name)).toBe(false);
        });
    });
});
