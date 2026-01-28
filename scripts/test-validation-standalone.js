/**
 * Standalone Validation Test Script
 *
 * Run with: node scripts/test-validation-standalone.js
 *
 * This tests the filing-validation logic directly.
 */

// Test colors for console
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const NC = '\x1b[0m'; // No Color

let passed = 0;
let failed = 0;

// =============================================================================
// VALIDATION SERVICE CODE (copied from filing-validation.ts)
// =============================================================================

const PERSONAL_REQUIRED_FIELDS = {
  'firstName': 'First Name',
  'lastName': 'Last Name',
  'sin': 'Social Insurance Number (SIN)',
  'dateOfBirth': 'Date of Birth',
  'phoneNumber': 'Phone Number',
  'streetNumber': 'Street Number',
  'streetName': 'Street Name',
  'city': 'City',
  'province': 'Province',
  'postalCode': 'Postal Code',
  'maritalStatus': 'Marital Status',
};

const CORPORATE_REQUIRED_FIELDS = {
  'legalName': 'Corporation Legal Name',
  'businessNumber': 'Business Number',
  'address': 'Business Address',
  'incorporationDate': 'Incorporation Date',
  'fiscalYearEnd': 'Fiscal Year End',
};

const TRUST_REQUIRED_FIELDS = {
  'trustName': 'Trust Name',
  'accountNumber': 'Trust Account Number',
  'creationDate': 'Trust Creation Date',
};

function isFieldFilled(value) {
  if (value === undefined || value === null) return false;
  if (value === '') return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

function validatePersonalFiling(formData) {
  const missingFields = [];

  if (!formData) {
    return { isValid: false, missingFields: Object.values(PERSONAL_REQUIRED_FIELDS) };
  }

  for (const [fieldKey, fieldLabel] of Object.entries(PERSONAL_REQUIRED_FIELDS)) {
    const directValue = formData[fieldKey];
    const nestedValue = formData.personalInfo?.[fieldKey] || formData[`personalInfo.${fieldKey}`];
    const addressValue = formData.personalInfo?.address?.[fieldKey];

    if (!isFieldFilled(directValue) && !isFieldFilled(nestedValue) && !isFieldFilled(addressValue)) {
      missingFields.push(fieldLabel);
    }
  }

  return {
    isValid: missingFields.length === 0,
    missingFields
  };
}

function validateCorporateFiling(formData) {
  const missingFields = [];

  if (!formData) {
    return { isValid: false, missingFields: Object.values(CORPORATE_REQUIRED_FIELDS) };
  }

  for (const [fieldKey, fieldLabel] of Object.entries(CORPORATE_REQUIRED_FIELDS)) {
    const directValue = formData[fieldKey];
    const nestedValue = formData.corpInfo?.[fieldKey] || formData[`corpInfo.${fieldKey}`];

    if (!isFieldFilled(directValue) && !isFieldFilled(nestedValue)) {
      missingFields.push(fieldLabel);
    }
  }

  return {
    isValid: missingFields.length === 0,
    missingFields
  };
}

function validateTrustFiling(formData) {
  const missingFields = [];

  if (!formData) {
    return { isValid: false, missingFields: Object.values(TRUST_REQUIRED_FIELDS) };
  }

  for (const [fieldKey, fieldLabel] of Object.entries(TRUST_REQUIRED_FIELDS)) {
    const directValue = formData[fieldKey];
    const nestedValue = formData.trustInfo?.[fieldKey] || formData[`trustInfo.${fieldKey}`];

    // Handle trustInfo.name -> trustName mapping
    if (fieldKey === 'trustName') {
      const nameValue = formData.trustInfo?.name || formData['trustInfo.name'];
      if (isFieldFilled(nameValue)) continue;
    }

    if (!isFieldFilled(directValue) && !isFieldFilled(nestedValue)) {
      missingFields.push(fieldLabel);
    }
  }

  return {
    isValid: missingFields.length === 0,
    missingFields
  };
}

function validateForSubmission(filing, filingType) {
  const errors = [];
  let totalMissingFields = 0;

  if (filingType === 'PERSONAL') {
    const personalFilings = filing.personalFilings || [];

    if (personalFilings.length === 0) {
      return {
        isValid: false,
        errors: [{ person: 'Primary Filer', missingFields: Object.values(PERSONAL_REQUIRED_FIELDS) }],
        totalMissingFields: Object.keys(PERSONAL_REQUIRED_FIELDS).length,
        errorMessage: 'No personal filing data found. Please complete your tax information.'
      };
    }

    for (const pf of personalFilings) {
      const formData = pf.formData || {};
      const result = validatePersonalFiling(formData);

      if (!result.isValid) {
        const personType = pf.type === 'primary' ? 'Primary Filer' :
                         pf.type === 'spouse' ? 'Spouse' :
                         `Dependent (${formData.firstName || 'unnamed'})`;

        errors.push({
          person: personType,
          missingFields: result.missingFields
        });
        totalMissingFields += result.missingFields.length;
      }
    }

  } else if (filingType === 'CORPORATE') {
    const corporateFiling = filing.corporateFiling || filing.corporateFilings?.[0];

    if (!corporateFiling) {
      return {
        isValid: false,
        errors: [{ person: 'Corporate Filing', missingFields: Object.values(CORPORATE_REQUIRED_FIELDS) }],
        totalMissingFields: Object.keys(CORPORATE_REQUIRED_FIELDS).length,
        errorMessage: 'No corporate filing data found. Please complete your corporation information.'
      };
    }

    const formData = corporateFiling.formData || corporateFiling;
    const result = validateCorporateFiling(formData);

    if (!result.isValid) {
      errors.push({
        person: 'Corporate Filing',
        missingFields: result.missingFields
      });
      totalMissingFields += result.missingFields.length;
    }

  } else if (filingType === 'TRUST') {
    const trustFiling = filing.trustFiling || filing.trustFilings?.[0];

    if (!trustFiling) {
      return {
        isValid: false,
        errors: [{ person: 'Trust Filing', missingFields: Object.values(TRUST_REQUIRED_FIELDS) }],
        totalMissingFields: Object.keys(TRUST_REQUIRED_FIELDS).length,
        errorMessage: 'No trust filing data found. Please complete your trust information.'
      };
    }

    const formData = trustFiling.formData || trustFiling;
    const result = validateTrustFiling(formData);

    if (!result.isValid) {
      errors.push({
        person: 'Trust Filing',
        missingFields: result.missingFields
      });
      totalMissingFields += result.missingFields.length;
    }
  }

  // Build error message
  let errorMessage = '';
  if (errors.length > 0) {
    const firstError = errors[0];
    const fieldList = firstError.missingFields.slice(0, 3).join(', ');
    const moreCount = firstError.missingFields.length > 3
      ? ` and ${firstError.missingFields.length - 3} more`
      : '';

    errorMessage = errors.length > 1
      ? `${firstError.person} is missing required fields (${fieldList}${moreCount}), and ${errors.length - 1} other person(s) have incomplete information. Total: ${totalMissingFields} missing fields.`
      : `${firstError.person} is missing required fields: ${fieldList}${moreCount}.`;
  }

  return {
    isValid: errors.length === 0,
    errors,
    totalMissingFields,
    errorMessage
  };
}

// =============================================================================
// TEST RUNNER
// =============================================================================

function test(name, expected, actual, details) {
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

function runTests() {
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
  let result = validateForSubmission({ personalFilings: [] }, 'PERSONAL');
  test('Empty filing should be INVALID', false, result.isValid, result.errorMessage);

  // Test 2: Personal filing with no formData
  console.log(`${YELLOW}TEST 2: Personal filing with empty formData${NC}`);
  result = validateForSubmission({ personalFilings: [{ type: 'primary', formData: {} }] }, 'PERSONAL');
  test('Empty formData should be INVALID', false, result.isValid, result.errorMessage);

  // Test 3: Only firstName provided
  console.log(`${YELLOW}TEST 3: Only firstName provided${NC}`);
  result = validateForSubmission({
    personalFilings: [{
      type: 'primary',
      formData: { firstName: 'John' }
    }]
  }, 'PERSONAL');
  test('Only firstName should be INVALID', false, result.isValid, result.errorMessage);

  // Test 4: First and last name, missing SIN
  console.log(`${YELLOW}TEST 4: Name provided, missing SIN${NC}`);
  result = validateForSubmission({
    personalFilings: [{
      type: 'primary',
      formData: {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1990-01-01',
        phoneNumber: '416-555-1234'
      }
    }]
  }, 'PERSONAL');
  test('Missing SIN should be INVALID', false, result.isValid, result.errorMessage);

  // Test 5: All identity fields, missing address
  console.log(`${YELLOW}TEST 5: Identity complete, missing address${NC}`);
  result = validateForSubmission({
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
  }, 'PERSONAL');
  test('Missing address should be INVALID', false, result.isValid, result.errorMessage);

  // Test 6: Partial address (missing city, province)
  console.log(`${YELLOW}TEST 6: Partial address (missing city, province, postalCode)${NC}`);
  result = validateForSubmission({
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
  }, 'PERSONAL');
  test('Partial address should be INVALID', false, result.isValid, result.errorMessage);

  // Test 7: Complete address, missing marital status
  console.log(`${YELLOW}TEST 7: Complete address, missing marital status${NC}`);
  result = validateForSubmission({
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
  }, 'PERSONAL');
  test('Missing marital status should be INVALID', false, result.isValid, result.errorMessage);

  // Test 8: ALL REQUIRED FIELDS - should PASS
  console.log(`${YELLOW}TEST 8: All required fields provided - should PASS${NC}`);
  result = validateForSubmission({
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
  }, 'PERSONAL');
  test('Complete filing should be VALID', true, result.isValid, result.errorMessage);

  // Test 9: Nested personalInfo structure
  console.log(`${YELLOW}TEST 9: Nested personalInfo structure - should PASS${NC}`);
  result = validateForSubmission({
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
  }, 'PERSONAL');
  test('Nested structure should be VALID', true, result.isValid, result.errorMessage);

  // =============================================================================
  // EDGE CASE TESTS
  // =============================================================================
  console.log('');
  console.log(`${BLUE}--- EDGE CASE TESTS ---${NC}`);
  console.log('');

  // Test 10: Empty string SIN
  console.log(`${YELLOW}TEST 10: Empty string SIN (not null, but "")${NC}`);
  result = validateForSubmission({
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
  }, 'PERSONAL');
  test('Empty string SIN should be INVALID', false, result.isValid, result.errorMessage);

  // Test 11: Null lastName
  console.log(`${YELLOW}TEST 11: Null lastName${NC}`);
  result = validateForSubmission({
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
  }, 'PERSONAL');
  test('Null lastName should be INVALID', false, result.isValid, result.errorMessage);

  // Test 12: Multiple personal filings with one incomplete
  console.log(`${YELLOW}TEST 12: Primary complete, Spouse incomplete${NC}`);
  result = validateForSubmission({
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
  }, 'PERSONAL');
  test('Incomplete spouse should make filing INVALID', false, result.isValid, result.errorMessage);

  // =============================================================================
  // CORPORATE FILING TESTS
  // =============================================================================
  console.log('');
  console.log(`${BLUE}--- CORPORATE FILING TESTS ---${NC}`);
  console.log('');

  // Test 13: Empty corporate filing
  console.log(`${YELLOW}TEST 13: Empty corporate filing${NC}`);
  result = validateForSubmission({ corporateFiling: null }, 'CORPORATE');
  test('Empty corporate filing should be INVALID', false, result.isValid, result.errorMessage);

  // Test 14: Corporate with only legal name
  console.log(`${YELLOW}TEST 14: Corporate with only legal name${NC}`);
  result = validateForSubmission({
    corporateFiling: {
      formData: {
        legalName: 'Test Corp Inc.'
      }
    }
  }, 'CORPORATE');
  test('Only legalName should be INVALID', false, result.isValid, result.errorMessage);

  // Test 15: Corporate missing business number
  console.log(`${YELLOW}TEST 15: Corporate missing business number${NC}`);
  result = validateForSubmission({
    corporateFiling: {
      formData: {
        legalName: 'Test Corp Inc.',
        address: '123 Business St, Toronto, ON',
        incorporationDate: '2020-01-01',
        fiscalYearEnd: '2024-12-31'
      }
    }
  }, 'CORPORATE');
  test('Missing business number should be INVALID', false, result.isValid, result.errorMessage);

  // Test 16: Complete corporate filing
  console.log(`${YELLOW}TEST 16: Complete corporate filing - should PASS${NC}`);
  result = validateForSubmission({
    corporateFiling: {
      formData: {
        legalName: 'Test Corp Inc.',
        businessNumber: '123456789RC0001',
        address: '123 Business St, Toronto, ON',
        incorporationDate: '2020-01-01',
        fiscalYearEnd: '2024-12-31'
      }
    }
  }, 'CORPORATE');
  test('Complete corporate filing should be VALID', true, result.isValid, result.errorMessage);

  // Test 17: Corporate with nested corpInfo
  console.log(`${YELLOW}TEST 17: Corporate with nested corpInfo structure${NC}`);
  result = validateForSubmission({
    corporateFiling: {
      formData: {
        'corpInfo.legalName': 'Test Corp Inc.',
        'corpInfo.businessNumber': '123456789RC0001',
        'corpInfo.address': '123 Business St, Toronto, ON',
        'corpInfo.incorporationDate': '2020-01-01',
        'corpInfo.fiscalYearEnd': '2024-12-31'
      }
    }
  }, 'CORPORATE');
  test('Nested corpInfo structure should be VALID', true, result.isValid, result.errorMessage);

  // =============================================================================
  // TRUST FILING TESTS
  // =============================================================================
  console.log('');
  console.log(`${BLUE}--- TRUST FILING TESTS ---${NC}`);
  console.log('');

  // Test 18: Empty trust filing
  console.log(`${YELLOW}TEST 18: Empty trust filing${NC}`);
  result = validateForSubmission({ trustFiling: null }, 'TRUST');
  test('Empty trust filing should be INVALID', false, result.isValid, result.errorMessage);

  // Test 19: Trust missing account number
  console.log(`${YELLOW}TEST 19: Trust missing account number${NC}`);
  result = validateForSubmission({
    trustFiling: {
      formData: {
        trustName: 'Smith Family Trust',
        creationDate: '2020-01-01'
      }
    }
  }, 'TRUST');
  test('Missing account number should be INVALID', false, result.isValid, result.errorMessage);

  // Test 20: Complete trust filing
  console.log(`${YELLOW}TEST 20: Complete trust filing - should PASS${NC}`);
  result = validateForSubmission({
    trustFiling: {
      formData: {
        trustName: 'Smith Family Trust',
        accountNumber: 'T12345678',
        creationDate: '2020-01-01'
      }
    }
  }, 'TRUST');
  test('Complete trust filing should be VALID', true, result.isValid, result.errorMessage);

  // Test 21: Trust with nested trustInfo
  console.log(`${YELLOW}TEST 21: Trust with trustInfo.name mapping${NC}`);
  result = validateForSubmission({
    trustFiling: {
      formData: {
        'trustInfo.name': 'Smith Family Trust',
        'trustInfo.accountNumber': 'T12345678',
        'trustInfo.creationDate': '2020-01-01'
      }
    }
  }, 'TRUST');
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

runTests();
