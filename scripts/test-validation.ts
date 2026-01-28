/**
 * Direct Validation Test Script
 *
 * Run with: npx ts-node scripts/test-validation.ts
 *
 * This tests the filing-validation service directly without needing HTTP auth.
 */

// Import the validation service
import filingValidationService from '../src/api/filing/services/filing-validation';

// Test colors for console
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const NC = '\x1b[0m'; // No Color

let passed = 0;
let failed = 0;

function test(name: string, expected: boolean, actual: boolean, details?: string) {
  if (expected === actual) {
    console.log(`${GREEN}✓ PASS${NC}: ${name}`);
    passed++;
  } else {
    console.log(`${RED}✗ FAIL${NC}: ${name}`);
    console.log(`  Expected isValid: ${expected}, Got: ${actual}`);
    if (details) console.log(`  Details: ${details}`);
    failed++;
  }
}

async function runTests() {
  console.log(`${BLUE}========================================${NC}`);
  console.log(`${BLUE}  FILING VALIDATION SERVICE TESTS${NC}`);
  console.log(`${BLUE}========================================${NC}`);
  console.log('');

  // =============================================================================
  // PERSONAL FILING TESTS
  // =============================================================================
  console.log(`${BLUE}--- PERSONAL FILING TESTS ---${NC}`);
  console.log('');

  // Test 1: Empty filing
  console.log(`${YELLOW}TEST 1: Empty personal filing (no data)${NC}`);
  let result = await filingValidationService.validateForSubmission(
    { personalFilings: [] },
    'PERSONAL'
  );
  test('Empty filing should be INVALID', false, result.isValid, result.errorMessage);

  // Test 2: Personal filing with no formData
  console.log(`${YELLOW}TEST 2: Personal filing with empty formData${NC}`);
  result = await filingValidationService.validateForSubmission(
    { personalFilings: [{ type: 'primary', formData: {} }] },
    'PERSONAL'
  );
  test('Empty formData should be INVALID', false, result.isValid, result.errorMessage);

  // Test 3: Only firstName provided
  console.log(`${YELLOW}TEST 3: Only firstName provided${NC}`);
  result = await filingValidationService.validateForSubmission(
    {
      personalFilings: [{
        type: 'primary',
        formData: { firstName: 'John' }
      }]
    },
    'PERSONAL'
  );
  test('Only firstName should be INVALID', false, result.isValid, result.errorMessage);

  // Test 4: First and last name, missing SIN
  console.log(`${YELLOW}TEST 4: Name provided, missing SIN${NC}`);
  result = await filingValidationService.validateForSubmission(
    {
      personalFilings: [{
        type: 'primary',
        formData: {
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: '1990-01-01',
          phoneNumber: '416-555-1234'
        }
      }]
    },
    'PERSONAL'
  );
  test('Missing SIN should be INVALID', false, result.isValid, result.errorMessage);

  // Test 5: All identity fields, missing address
  console.log(`${YELLOW}TEST 5: Identity complete, missing address${NC}`);
  result = await filingValidationService.validateForSubmission(
    {
      personalFilings: [{
        type: 'primary',
        formData: {
          firstName: 'John',
          lastName: 'Doe',
          sin: '123-456-789',
          dateOfBirth: '1990-01-01',
          phoneNumber: '416-555-1234'
        }
      }]
    },
    'PERSONAL'
  );
  test('Missing address should be INVALID', false, result.isValid, result.errorMessage);

  // Test 6: Partial address (missing city, province)
  console.log(`${YELLOW}TEST 6: Partial address (missing city, province, postalCode)${NC}`);
  result = await filingValidationService.validateForSubmission(
    {
      personalFilings: [{
        type: 'primary',
        formData: {
          firstName: 'John',
          lastName: 'Doe',
          sin: '123-456-789',
          dateOfBirth: '1990-01-01',
          phoneNumber: '416-555-1234',
          streetNumber: '123',
          streetName: 'Main St'
        }
      }]
    },
    'PERSONAL'
  );
  test('Partial address should be INVALID', false, result.isValid, result.errorMessage);

  // Test 7: Complete address, missing marital status
  console.log(`${YELLOW}TEST 7: Complete address, missing marital status${NC}`);
  result = await filingValidationService.validateForSubmission(
    {
      personalFilings: [{
        type: 'primary',
        formData: {
          firstName: 'John',
          lastName: 'Doe',
          sin: '123-456-789',
          dateOfBirth: '1990-01-01',
          phoneNumber: '416-555-1234',
          streetNumber: '123',
          streetName: 'Main St',
          city: 'Toronto',
          province: 'ON',
          postalCode: 'M5V1K2'
        }
      }]
    },
    'PERSONAL'
  );
  test('Missing marital status should be INVALID', false, result.isValid, result.errorMessage);

  // Test 8: ALL REQUIRED FIELDS - should PASS
  console.log(`${YELLOW}TEST 8: All required fields provided - should PASS${NC}`);
  result = await filingValidationService.validateForSubmission(
    {
      personalFilings: [{
        type: 'primary',
        formData: {
          firstName: 'John',
          lastName: 'Doe',
          sin: '123-456-789',
          dateOfBirth: '1990-01-01',
          phoneNumber: '416-555-1234',
          streetNumber: '123',
          streetName: 'Main St',
          city: 'Toronto',
          province: 'ON',
          postalCode: 'M5V1K2',
          maritalStatus: 'SINGLE'
        }
      }]
    },
    'PERSONAL'
  );
  test('Complete filing should be VALID', true, result.isValid, result.errorMessage);

  // Test 9: Nested personalInfo structure
  console.log(`${YELLOW}TEST 9: Nested personalInfo structure - should PASS${NC}`);
  result = await filingValidationService.validateForSubmission(
    {
      personalFilings: [{
        type: 'primary',
        formData: {
          personalInfo: {
            firstName: 'John',
            lastName: 'Doe',
            sin: '123-456-789',
            dateOfBirth: '1990-01-01',
            phoneNumber: '416-555-1234',
            streetNumber: '123',
            streetName: 'Main St',
            city: 'Toronto',
            province: 'ON',
            postalCode: 'M5V1K2',
            maritalStatus: 'SINGLE'
          }
        }
      }]
    },
    'PERSONAL'
  );
  test('Nested structure should be VALID', true, result.isValid, result.errorMessage);

  // =============================================================================
  // EDGE CASE TESTS
  // =============================================================================
  console.log('');
  console.log(`${BLUE}--- EDGE CASE TESTS ---${NC}`);
  console.log('');

  // Test 10: Empty string SIN
  console.log(`${YELLOW}TEST 10: Empty string SIN (not null, but "")${NC}`);
  result = await filingValidationService.validateForSubmission(
    {
      personalFilings: [{
        type: 'primary',
        formData: {
          firstName: 'John',
          lastName: 'Doe',
          sin: '',  // Empty string
          dateOfBirth: '1990-01-01',
          phoneNumber: '416-555-1234',
          streetNumber: '123',
          streetName: 'Main St',
          city: 'Toronto',
          province: 'ON',
          postalCode: 'M5V1K2',
          maritalStatus: 'SINGLE'
        }
      }]
    },
    'PERSONAL'
  );
  test('Empty string SIN should be INVALID', false, result.isValid, result.errorMessage);

  // Test 11: Null lastName
  console.log(`${YELLOW}TEST 11: Null lastName${NC}`);
  result = await filingValidationService.validateForSubmission(
    {
      personalFilings: [{
        type: 'primary',
        formData: {
          firstName: 'John',
          lastName: null,
          sin: '123-456-789',
          dateOfBirth: '1990-01-01',
          phoneNumber: '416-555-1234',
          streetNumber: '123',
          streetName: 'Main St',
          city: 'Toronto',
          province: 'ON',
          postalCode: 'M5V1K2',
          maritalStatus: 'SINGLE'
        }
      }]
    },
    'PERSONAL'
  );
  test('Null lastName should be INVALID', false, result.isValid, result.errorMessage);

  // Test 12: Multiple personal filings with one incomplete
  console.log(`${YELLOW}TEST 12: Primary complete, Spouse incomplete${NC}`);
  result = await filingValidationService.validateForSubmission(
    {
      personalFilings: [
        {
          type: 'primary',
          formData: {
            firstName: 'John',
            lastName: 'Doe',
            sin: '123-456-789',
            dateOfBirth: '1990-01-01',
            phoneNumber: '416-555-1234',
            streetNumber: '123',
            streetName: 'Main St',
            city: 'Toronto',
            province: 'ON',
            postalCode: 'M5V1K2',
            maritalStatus: 'MARRIED'
          }
        },
        {
          type: 'spouse',
          formData: {
            firstName: 'Jane'
            // Missing everything else
          }
        }
      ]
    },
    'PERSONAL'
  );
  test('Incomplete spouse should make filing INVALID', false, result.isValid, result.errorMessage);

  // =============================================================================
  // CORPORATE FILING TESTS
  // =============================================================================
  console.log('');
  console.log(`${BLUE}--- CORPORATE FILING TESTS ---${NC}`);
  console.log('');

  // Test 13: Empty corporate filing
  console.log(`${YELLOW}TEST 13: Empty corporate filing${NC}`);
  result = await filingValidationService.validateForSubmission(
    { corporateFiling: null },
    'CORPORATE'
  );
  test('Empty corporate filing should be INVALID', false, result.isValid, result.errorMessage);

  // Test 14: Corporate with only legal name
  console.log(`${YELLOW}TEST 14: Corporate with only legal name${NC}`);
  result = await filingValidationService.validateForSubmission(
    {
      corporateFiling: {
        formData: {
          legalName: 'Test Corp Inc.'
        }
      }
    },
    'CORPORATE'
  );
  test('Only legalName should be INVALID', false, result.isValid, result.errorMessage);

  // Test 15: Corporate missing business number
  console.log(`${YELLOW}TEST 15: Corporate missing business number${NC}`);
  result = await filingValidationService.validateForSubmission(
    {
      corporateFiling: {
        formData: {
          legalName: 'Test Corp Inc.',
          address: '123 Business St, Toronto, ON',
          incorporationDate: '2020-01-01',
          fiscalYearEnd: '2024-12-31'
        }
      }
    },
    'CORPORATE'
  );
  test('Missing business number should be INVALID', false, result.isValid, result.errorMessage);

  // Test 16: Complete corporate filing
  console.log(`${YELLOW}TEST 16: Complete corporate filing - should PASS${NC}`);
  result = await filingValidationService.validateForSubmission(
    {
      corporateFiling: {
        formData: {
          legalName: 'Test Corp Inc.',
          businessNumber: '123456789RC0001',
          address: '123 Business St, Toronto, ON',
          incorporationDate: '2020-01-01',
          fiscalYearEnd: '2024-12-31'
        }
      }
    },
    'CORPORATE'
  );
  test('Complete corporate filing should be VALID', true, result.isValid, result.errorMessage);

  // Test 17: Corporate with nested corpInfo
  console.log(`${YELLOW}TEST 17: Corporate with nested corpInfo structure${NC}`);
  result = await filingValidationService.validateForSubmission(
    {
      corporateFiling: {
        formData: {
          'corpInfo.legalName': 'Test Corp Inc.',
          'corpInfo.businessNumber': '123456789RC0001',
          'corpInfo.address': '123 Business St, Toronto, ON',
          'corpInfo.incorporationDate': '2020-01-01',
          'corpInfo.fiscalYearEnd': '2024-12-31'
        }
      }
    },
    'CORPORATE'
  );
  test('Nested corpInfo structure should be VALID', true, result.isValid, result.errorMessage);

  // =============================================================================
  // TRUST FILING TESTS
  // =============================================================================
  console.log('');
  console.log(`${BLUE}--- TRUST FILING TESTS ---${NC}`);
  console.log('');

  // Test 18: Empty trust filing
  console.log(`${YELLOW}TEST 18: Empty trust filing${NC}`);
  result = await filingValidationService.validateForSubmission(
    { trustFiling: null },
    'TRUST'
  );
  test('Empty trust filing should be INVALID', false, result.isValid, result.errorMessage);

  // Test 19: Trust missing account number
  console.log(`${YELLOW}TEST 19: Trust missing account number${NC}`);
  result = await filingValidationService.validateForSubmission(
    {
      trustFiling: {
        formData: {
          trustName: 'Smith Family Trust',
          creationDate: '2020-01-01'
        }
      }
    },
    'TRUST'
  );
  test('Missing account number should be INVALID', false, result.isValid, result.errorMessage);

  // Test 20: Complete trust filing
  console.log(`${YELLOW}TEST 20: Complete trust filing - should PASS${NC}`);
  result = await filingValidationService.validateForSubmission(
    {
      trustFiling: {
        formData: {
          trustName: 'Smith Family Trust',
          accountNumber: 'T12345678',
          creationDate: '2020-01-01'
        }
      }
    },
    'TRUST'
  );
  test('Complete trust filing should be VALID', true, result.isValid, result.errorMessage);

  // Test 21: Trust with nested trustInfo
  console.log(`${YELLOW}TEST 21: Trust with trustInfo.name mapping${NC}`);
  result = await filingValidationService.validateForSubmission(
    {
      trustFiling: {
        formData: {
          'trustInfo.name': 'Smith Family Trust',
          'trustInfo.accountNumber': 'T12345678',
          'trustInfo.creationDate': '2020-01-01'
        }
      }
    },
    'TRUST'
  );
  test('Nested trustInfo structure should be VALID', true, result.isValid, result.errorMessage);

  // =============================================================================
  // SUMMARY
  // =============================================================================
  console.log('');
  console.log(`${BLUE}========================================${NC}`);
  console.log(`${BLUE}  TEST SUMMARY${NC}`);
  console.log(`${BLUE}========================================${NC}`);
  console.log('');
  console.log(`Total Tests: ${passed + failed}`);
  console.log(`${GREEN}Passed: ${passed}${NC}`);
  console.log(`${RED}Failed: ${failed}${NC}`);
  console.log('');

  if (failed === 0) {
    console.log(`${GREEN}========================================${NC}`);
    console.log(`${GREEN}  ALL TESTS PASSED! ✓${NC}`);
    console.log(`${GREEN}========================================${NC}`);
    process.exit(0);
  } else {
    console.log(`${RED}========================================${NC}`);
    console.log(`${RED}  SOME TESTS FAILED! ✗${NC}`);
    console.log(`${RED}========================================${NC}`);
    process.exit(1);
  }
}

runTests().catch(console.error);
