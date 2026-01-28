/**
 * Filing Validation Service
 *
 * Server-side validation to ensure all required fields are filled before submission.
 * This is a critical security layer that cannot be bypassed by client-side manipulation.
 */

// Personal filing required fields (at minimum, these must be filled for primary filer)
const PERSONAL_REQUIRED_FIELDS = {
  // Personal Info - always required
  'firstName': 'First Name',
  'lastName': 'Last Name',
  'sin': 'Social Insurance Number (SIN)',
  'dateOfBirth': 'Date of Birth',
  'phoneNumber': 'Phone Number',

  // Address - always required
  'streetNumber': 'Street Number',
  'streetName': 'Street Name',
  'city': 'City',
  'province': 'Province',
  'postalCode': 'Postal Code',

  // Status - always required
  'maritalStatus': 'Marital Status',
};

// Corporate filing required fields
const CORPORATE_REQUIRED_FIELDS = {
  'legalName': 'Corporation Legal Name',
  'businessNumber': 'Business Number',
  'address': 'Business Address',
  'incorporationDate': 'Incorporation Date',
  'fiscalYearEnd': 'Fiscal Year End',
};

// Trust filing required fields
const TRUST_REQUIRED_FIELDS = {
  'trustName': 'Trust Name',
  'accountNumber': 'Trust Account Number',
  'creationDate': 'Trust Creation Date',
};

/**
 * Check if a value is considered "filled" (not empty)
 */
function isFieldFilled(value: any): boolean {
  if (value === undefined || value === null) return false;
  if (value === '') return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

/**
 * Validate personal filing formData against required fields
 */
function validatePersonalFiling(formData: Record<string, any>): { isValid: boolean; missingFields: string[] } {
  const missingFields: string[] = [];

  if (!formData) {
    return { isValid: false, missingFields: Object.values(PERSONAL_REQUIRED_FIELDS) };
  }

  // Check each required field
  for (const [fieldKey, fieldLabel] of Object.entries(PERSONAL_REQUIRED_FIELDS)) {
    // Check both direct key and nested personalInfo key
    const directValue = formData[fieldKey];
    const nestedValue = formData.personalInfo?.[fieldKey] || formData[`personalInfo.${fieldKey}`];

    // For address fields, also check nested address object
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

/**
 * Validate corporate filing formData against required fields
 */
function validateCorporateFiling(formData: Record<string, any>): { isValid: boolean; missingFields: string[] } {
  const missingFields: string[] = [];

  if (!formData) {
    return { isValid: false, missingFields: Object.values(CORPORATE_REQUIRED_FIELDS) };
  }

  for (const [fieldKey, fieldLabel] of Object.entries(CORPORATE_REQUIRED_FIELDS)) {
    // Check both direct key and nested corpInfo key
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

/**
 * Validate trust filing formData against required fields
 */
function validateTrustFiling(formData: Record<string, any>): { isValid: boolean; missingFields: string[] } {
  const missingFields: string[] = [];

  if (!formData) {
    return { isValid: false, missingFields: Object.values(TRUST_REQUIRED_FIELDS) };
  }

  for (const [fieldKey, fieldLabel] of Object.entries(TRUST_REQUIRED_FIELDS)) {
    // Check both direct key and nested trustInfo key
    const directValue = formData[fieldKey];
    const nestedValue = formData.trustInfo?.[fieldKey] || formData[`trustInfo.${fieldKey}`];

    // Also check for name vs trustName mapping
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

export default {
  /**
   * Validate a filing before submission
   * @param filing - The filing object with its related data
   * @param filingType - 'PERSONAL', 'CORPORATE', or 'TRUST'
   * @returns Validation result with details
   */
  async validateForSubmission(
    filing: any,
    filingType: 'PERSONAL' | 'CORPORATE' | 'TRUST'
  ): Promise<{
    isValid: boolean;
    errors: { person?: string; missingFields: string[] }[];
    totalMissingFields: number;
    errorMessage: string;
  }> {
    const errors: { person?: string; missingFields: string[] }[] = [];
    let totalMissingFields = 0;

    try {
      if (filingType === 'PERSONAL') {
        // Validate all personal filings (primary, spouse, dependents)
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
        // Validate corporate filing
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
        // Validate trust filing
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

    } catch (error) {
      strapi.log.error('Filing validation error:', error);
      return {
        isValid: false,
        errors: [{ missingFields: ['Validation error occurred'] }],
        totalMissingFields: 1,
        errorMessage: 'An error occurred during validation. Please try again.'
      };
    }
  }
};
