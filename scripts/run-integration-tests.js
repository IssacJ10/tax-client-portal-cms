/**
 * Strapi Integration Test Runner
 *
 * This script must be run with Strapi's context.
 * Run with: npm run strapi -- scripts/run-integration-tests.js
 * Or: node_modules/.bin/strapi scripts/run-integration-tests.js
 *
 * Alternatively, copy this to a Strapi lifecycle or run manually.
 */

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const NC = '\x1b[0m';

async function runIntegrationTests() {
  console.log(`${BLUE}========================================${NC}`);
  console.log(`${BLUE}  STRAPI INTEGRATION TESTS${NC}`);
  console.log(`${BLUE}========================================${NC}`);
  console.log('');
  console.log('These tests verify the lifecycle hooks block invalid submissions.');
  console.log('');

  // Check if strapi global exists
  if (typeof strapi === 'undefined') {
    console.log(`${RED}ERROR: This script must be run within Strapi context.${NC}`);
    console.log('');
    console.log('Options to run:');
    console.log('1. Add this to src/index.ts bootstrap() function');
    console.log('2. Create a custom Strapi command');
    console.log('3. Use the REST API with a valid JWT token');
    console.log('');
    console.log('For now, the UNIT TESTS have verified the validation logic works correctly.');
    console.log('The lifecycle hooks use this same validation service.');
    process.exit(1);
  }

  let passed = 0;
  let failed = 0;

  const test = (name, expected, actual) => {
    if (expected === actual) {
      console.log(`${GREEN}✓ PASS${NC}: ${name}`);
      passed++;
    } else {
      console.log(`${RED}✗ FAIL${NC}: ${name}`);
      console.log(`  Expected: ${expected}, Got: ${actual}`);
      failed++;
    }
  };

  try {
    // Get a test user
    const testUser = await strapi.query('plugin::users-permissions.user').findOne({
      where: { email: { $ne: null } },
    });

    if (!testUser) {
      console.log(`${YELLOW}No test user found. Skipping integration tests.${NC}`);
      return;
    }

    console.log(`Using test user: ${testUser.email}`);
    console.log('');

    // Get status IDs
    const underReviewStatus = await strapi.query('api::filing-status.filing-status').findOne({
      where: { statusCode: 'UNDER_REVIEW' },
    });
    const inProgressStatus = await strapi.query('api::filing-status.filing-status').findOne({
      where: { statusCode: 'IN_PROGRESS' },
    });

    if (!underReviewStatus) {
      console.log(`${RED}UNDER_REVIEW status not found. Aborting.${NC}`);
      return;
    }

    // Get PERSONAL filing type
    const personalType = await strapi.query('api::filing-type.filing-type').findOne({
      where: { type: 'PERSONAL' },
    });

    // Create a test filing
    console.log('Creating test filing...');
    const testFiling = await strapi.documents('api::filing.filing').create({
      data: {
        user: testUser.id,
        filingType: personalType?.id,
        filingStatus: inProgressStatus?.id,
        progress: 0,
      },
    });

    console.log(`Created filing: ${testFiling.documentId}`);
    console.log('');

    // Create an empty personal filing
    await strapi.documents('api::personal-filing.personal-filing').create({
      data: {
        filing: testFiling.documentId,
        type: 'primary',
        formData: {},
      },
    });

    // =============================================================================
    // TEST: Try to submit empty filing - should be REJECTED
    // =============================================================================
    console.log(`${YELLOW}TEST 1: Submit empty personal filing${NC}`);

    try {
      await strapi.documents('api::filing.filing').update({
        documentId: testFiling.documentId,
        data: {
          filingStatus: underReviewStatus.documentId || underReviewStatus.id,
        },
      });
      test('Empty filing should be REJECTED', 'REJECTED', 'ACCEPTED');
    } catch (error) {
      if (error.name === 'ValidationError' || error.message?.includes('required')) {
        test('Empty filing should be REJECTED', 'REJECTED', 'REJECTED');
      } else {
        console.log(`  Error: ${error.message}`);
        test('Empty filing should be REJECTED', 'REJECTED', `ERROR: ${error.name}`);
      }
    }

    // =============================================================================
    // TEST: Update with partial data, try to submit - should be REJECTED
    // =============================================================================
    console.log(`${YELLOW}TEST 2: Submit filing with only firstName${NC}`);

    // Update personal filing with partial data
    const personalFilings = await strapi.documents('api::personal-filing.personal-filing').findMany({
      filters: { filing: { documentId: testFiling.documentId } },
    });

    if (personalFilings.length > 0) {
      await strapi.documents('api::personal-filing.personal-filing').update({
        documentId: personalFilings[0].documentId,
        data: {
          firstName: 'John',
          formData: { firstName: 'John' },
        },
      });
    }

    try {
      await strapi.documents('api::filing.filing').update({
        documentId: testFiling.documentId,
        data: {
          filingStatus: underReviewStatus.documentId || underReviewStatus.id,
        },
      });
      test('Partial filing should be REJECTED', 'REJECTED', 'ACCEPTED');
    } catch (error) {
      if (error.name === 'ValidationError' || error.message?.includes('required') || error.message?.includes('missing')) {
        test('Partial filing should be REJECTED', 'REJECTED', 'REJECTED');
      } else {
        test('Partial filing should be REJECTED', 'REJECTED', `ERROR: ${error.name}`);
      }
    }

    // =============================================================================
    // TEST: Update with complete data, try to submit - should PASS
    // =============================================================================
    console.log(`${YELLOW}TEST 3: Submit complete personal filing${NC}`);

    if (personalFilings.length > 0) {
      await strapi.documents('api::personal-filing.personal-filing').update({
        documentId: personalFilings[0].documentId,
        data: {
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
          maritalStatus: 'SINGLE',
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
            maritalStatus: 'SINGLE',
          },
        },
      });
    }

    try {
      await strapi.documents('api::filing.filing').update({
        documentId: testFiling.documentId,
        data: {
          filingStatus: underReviewStatus.documentId || underReviewStatus.id,
        },
      });
      test('Complete filing should be ACCEPTED', 'ACCEPTED', 'ACCEPTED');
    } catch (error) {
      test('Complete filing should be ACCEPTED', 'ACCEPTED', `REJECTED: ${error.message}`);
    }

    // Cleanup
    console.log('');
    console.log('Cleaning up test filing...');
    try {
      await strapi.documents('api::filing.filing').delete({
        documentId: testFiling.documentId,
      });
      console.log('Test filing deleted.');
    } catch (e) {
      console.log('Could not delete test filing (may have cascade constraints)');
    }

    // Summary
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
      console.log(`${GREEN}ALL INTEGRATION TESTS PASSED! ✓${NC}`);
    } else {
      console.log(`${RED}SOME INTEGRATION TESTS FAILED! ✗${NC}`);
    }

  } catch (error) {
    console.log(`${RED}Test execution error:${NC}`, error);
  }
}

// Export for use in Strapi bootstrap
module.exports = runIntegrationTests;

// Also run if executed directly (won't work without Strapi context)
if (require.main === module) {
  runIntegrationTests();
}
