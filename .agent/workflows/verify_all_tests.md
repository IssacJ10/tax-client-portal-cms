---
description: Run full regression test suite to ensure comprehensive stability
---
# Verify All Tests

After completing any functional changes or bug fixes, you MUST run the full test suite to ensure no regressions were introduced.

1.  **Run All Tests**
    Execute the following command to run all test suites sequentially (in-band) with the correct environment variables:
    ```bash
    npm test
    ```
    // turbo

2.  **Verify Results**
    - Ensure all test suites pass (Green).
    - If any test fails, debug and fix the specific regression before marking the task as complete.
    - Do NOT suppress or skip tests to force a pass.

3.  **Audit**
    - Check if the new functionality requires *new* tests.
    - If so, create them before considering the task done.

4.  **Feature Specific Checks**
    - **Dashboard**: Verify "Start Filing" creates a new entry in Strapi (`api::filing.filing`). 
    - Verify "Resume" loads the existing entry.
