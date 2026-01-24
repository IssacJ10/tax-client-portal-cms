/**
 * Backend Validation Utilities
 * Comprehensive field-level validation for tax filing data
 * This is the LAST LINE OF DEFENSE - never trust client-side validation alone
 */

// Note: errors import removed - validation functions return error arrays instead of throwing

// ============================================
// REGEX PATTERNS
// ============================================

const PATTERNS = {
  // Names: letters, spaces, hyphens, apostrophes, periods (for initials)
  NAME: /^[a-zA-ZÀ-ÿ\s\-'.]+$/,

  // Email: standard RFC 5322 simplified
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,

  // Canadian phone: various formats
  PHONE: /^[\d\s\-().+]{7,20}$/,

  // Canadian SIN: 9 digits (with or without spaces/dashes)
  SIN: /^\d{3}[\s\-]?\d{3}[\s\-]?\d{3}$/,

  // Canadian postal code: A1A 1A1 format
  POSTAL_CODE: /^[A-Za-z]\d[A-Za-z][\s\-]?\d[A-Za-z]\d$/,

  // Date: YYYY-MM-DD format
  DATE: /^\d{4}-\d{2}-\d{2}$/,

  // Currency: numbers with optional decimal
  CURRENCY: /^-?\d+(\.\d{1,2})?$/,

  // Year: 4-digit year
  YEAR: /^\d{4}$/,

  // GST/HST number: 9 digits + 2 letters + 4 digits
  GST_NUMBER: /^\d{9}[A-Za-z]{2}\d{4}$/,

  // Safe string: no script tags, SQL keywords
  SAFE_STRING: /^[^<>]*$/,

  // Alphanumeric with spaces
  ALPHANUMERIC: /^[a-zA-Z0-9\s]+$/,
};

// ============================================
// VALIDATION RULES BY FIELD TYPE
// ============================================

const FIELD_RULES: Record<string, {
  pattern?: RegExp;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  enum?: string[];
  custom?: (value: any) => boolean;
  message: string;
}> = {
  // Personal Info
  firstName: {
    pattern: PATTERNS.NAME,
    minLength: 1,
    maxLength: 50,
    message: 'First name must contain only letters, spaces, hyphens, and apostrophes (1-50 characters)',
  },
  lastName: {
    pattern: PATTERNS.NAME,
    minLength: 1,
    maxLength: 50,
    message: 'Last name must contain only letters, spaces, hyphens, and apostrophes (1-50 characters)',
  },
  middleName: {
    pattern: PATTERNS.NAME,
    maxLength: 50,
    message: 'Middle name must contain only letters, spaces, hyphens, and apostrophes',
  },
  email: {
    pattern: PATTERNS.EMAIL,
    maxLength: 254,
    message: 'Invalid email address format',
  },
  phoneNumber: {
    pattern: PATTERNS.PHONE,
    message: 'Invalid phone number format',
  },
  sin: {
    pattern: PATTERNS.SIN,
    message: 'SIN must be 9 digits in format XXX-XXX-XXX or XXXXXXXXX',
  },
  dateOfBirth: {
    pattern: PATTERNS.DATE,
    custom: (value) => {
      const date = new Date(value);
      const now = new Date();
      const minDate = new Date('1900-01-01');
      return date >= minDate && date <= now;
    },
    message: 'Date of birth must be a valid date between 1900 and today',
  },

  // Address
  streetNumber: {
    maxLength: 20,
    message: 'Street number must be 20 characters or less',
  },
  streetName: {
    pattern: PATTERNS.SAFE_STRING,
    maxLength: 200,
    message: 'Street name contains invalid characters',
  },
  apartmentNumber: {
    maxLength: 20,
    message: 'Apartment number must be 20 characters or less',
  },
  city: {
    pattern: PATTERNS.NAME,
    maxLength: 100,
    message: 'City must contain only letters, spaces, and hyphens',
  },
  province: {
    maxLength: 50,
    message: 'Invalid province',
  },
  postalCode: {
    pattern: PATTERNS.POSTAL_CODE,
    message: 'Postal code must be in format A1A 1A1',
  },

  // Status & Residency
  statusInCanada: {
    enum: ['CANADIAN_CITIZEN', 'PERMANENT_RESIDENT', 'TEMPORARY_RESIDENT', 'PROTECTED_PERSON'],
    message: 'Invalid status in Canada',
  },
  maritalStatus: {
    enum: ['SINGLE', 'MARRIED', 'COMMON_LAW', 'SEPARATED', 'DIVORCED', 'WIDOWED'],
    message: 'Invalid marital status',
  },
  maritalStatusChanged: {
    enum: ['Yes', 'No'],
    message: 'Marital status changed must be Yes or No',
  },

  // Enums for YES/NO fields
  yesNo: {
    enum: ['YES', 'NO', 'Yes', 'No'],
    message: 'Value must be YES or NO',
  },

  // Financial fields
  currency: {
    pattern: PATTERNS.CURRENCY,
    min: -999999999.99,
    max: 999999999.99,
    message: 'Invalid currency amount',
  },

  // Year fields
  year: {
    pattern: PATTERNS.YEAR,
    min: 1900,
    max: new Date().getFullYear() + 1,
    message: 'Invalid year',
  },

  // Vehicle expenses
  vehicleYear: {
    min: 1900,
    max: new Date().getFullYear() + 1,
    message: 'Vehicle year must be between 1900 and next year',
  },

  // GST Number
  gstNumber: {
    pattern: PATTERNS.GST_NUMBER,
    message: 'GST number must be in format 123456789RT0001',
  },

  // Notes/text fields
  additionalNotes: {
    maxLength: 5000,
    pattern: PATTERNS.SAFE_STRING,
    message: 'Additional notes must be 5000 characters or less and cannot contain HTML tags',
  },
};

// ============================================
// VALIDATION FUNCTIONS
// ============================================

/**
 * Validate a single field value
 */
export function validateField(
  fieldName: string,
  value: any,
  customRule?: keyof typeof FIELD_RULES
): { valid: boolean; error?: string } {
  // Skip validation for null/undefined (handled by required check)
  if (value === null || value === undefined || value === '') {
    return { valid: true };
  }

  // Get the rule (custom or by field name)
  const ruleName = customRule || fieldName;
  const rule = FIELD_RULES[ruleName];

  if (!rule) {
    // No specific rule, just check for safe string
    if (typeof value === 'string' && !PATTERNS.SAFE_STRING.test(value)) {
      return { valid: false, error: `${fieldName} contains invalid characters` };
    }
    return { valid: true };
  }

  // String validations
  if (typeof value === 'string') {
    // Min length
    if (rule.minLength !== undefined && value.length < rule.minLength) {
      return { valid: false, error: rule.message };
    }

    // Max length
    if (rule.maxLength !== undefined && value.length > rule.maxLength) {
      return { valid: false, error: rule.message };
    }

    // Pattern
    if (rule.pattern && !rule.pattern.test(value)) {
      return { valid: false, error: rule.message };
    }

    // Enum
    if (rule.enum && !rule.enum.includes(value)) {
      return { valid: false, error: rule.message };
    }
  }

  // Number validations
  if (typeof value === 'number') {
    if (rule.min !== undefined && value < rule.min) {
      return { valid: false, error: rule.message };
    }
    if (rule.max !== undefined && value > rule.max) {
      return { valid: false, error: rule.message };
    }
  }

  // Custom validation
  if (rule.custom && !rule.custom(value)) {
    return { valid: false, error: rule.message };
  }

  return { valid: true };
}

/**
 * Validate YES/NO enum fields
 */
export function validateYesNo(fieldName: string, value: any): { valid: boolean; error?: string } {
  return validateField(fieldName, value, 'yesNo');
}

/**
 * Validate currency fields
 */
export function validateCurrency(fieldName: string, value: any): { valid: boolean; error?: string } {
  if (value === null || value === undefined || value === '') {
    return { valid: true };
  }

  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) {
    return { valid: false, error: `${fieldName} must be a valid number` };
  }

  return validateField(fieldName, numValue, 'currency');
}

/**
 * Validate a date field
 */
export function validateDate(fieldName: string, value: any, options?: {
  minDate?: Date;
  maxDate?: Date;
  allowFuture?: boolean;
}): { valid: boolean; error?: string } {
  if (value === null || value === undefined || value === '') {
    return { valid: true };
  }

  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return { valid: false, error: `${fieldName} must be a valid date` };
  }

  const minDate = options?.minDate || new Date('1900-01-01');
  const maxDate = options?.maxDate || (options?.allowFuture ? new Date('2100-01-01') : new Date());

  if (date < minDate || date > maxDate) {
    return { valid: false, error: `${fieldName} must be between ${minDate.toISOString().split('T')[0]} and ${maxDate.toISOString().split('T')[0]}` };
  }

  return { valid: true };
}

/**
 * Validate an array of values
 */
export function validateArray(
  fieldName: string,
  value: any,
  allowedValues?: string[],
  maxItems?: number
): { valid: boolean; error?: string } {
  if (value === null || value === undefined) {
    return { valid: true };
  }

  if (!Array.isArray(value)) {
    return { valid: false, error: `${fieldName} must be an array` };
  }

  if (maxItems && value.length > maxItems) {
    return { valid: false, error: `${fieldName} cannot have more than ${maxItems} items` };
  }

  if (allowedValues) {
    const invalidItems = value.filter(v => !allowedValues.includes(v));
    if (invalidItems.length > 0) {
      return { valid: false, error: `${fieldName} contains invalid values: ${invalidItems.join(', ')}` };
    }
  }

  return { valid: true };
}

// ============================================
// BUSINESS RULE VALIDATION
// ============================================

/**
 * Business rules that define when conditional sections are allowed
 * These mirror the frontend wizard conditional logic
 */
const BUSINESS_RULES = {
  // Vehicle expenses require TRAVEL_FOR_WORK in workExpenses.categories
  vehicleExpenses: {
    triggerField: 'workExpenses.categories',
    triggerValue: 'TRAVEL_FOR_WORK',
    operator: 'contains',
    errorMessage: 'Vehicle expenses can only be submitted if you indicated travel for work',
  },
  // Home office requires WORKED_FROM_HOME in workExpenses.categories
  homeOffice: {
    triggerField: 'workExpenses.categories',
    triggerValue: 'WORKED_FROM_HOME',
    operator: 'contains',
    errorMessage: 'Home office expenses can only be submitted if you indicated working from home',
  },
  // Rental income requires RENTAL_INCOME in incomeSources
  rentalIncome: {
    triggerField: 'incomeSources',
    triggerValue: 'RENTAL_INCOME',
    operator: 'contains',
    errorMessage: 'Rental income details can only be submitted if you indicated rental income',
  },
  // Self-employment requires SELF_EMPLOYMENT in incomeSources
  selfEmployment: {
    triggerField: 'incomeSources',
    triggerValue: 'SELF_EMPLOYMENT',
    operator: 'contains',
    errorMessage: 'Self-employment details can only be submitted if you indicated self-employment income',
  },
  // Spouse requires MARRIED or COMMON_LAW marital status
  spouse: {
    triggerField: 'maritalStatus',
    triggerValue: ['MARRIED', 'COMMON_LAW'],
    operator: 'in',
    errorMessage: 'Spouse details can only be submitted if marital status is Married or Common-Law',
  },
  // Moving expenses require MOVING_EXPENSES in deductionSources
  movingExpenses: {
    triggerField: 'deductionSources',
    triggerValue: 'MOVING_EXPENSES',
    operator: 'contains',
    errorMessage: 'Moving expenses can only be submitted if you indicated moving expenses deduction',
  },
};

/**
 * Helper to get nested field value from data object
 * Supports dot notation like 'workExpenses.categories'
 */
function getNestedValue(data: Record<string, any>, path: string): any {
  const parts = path.split('.');
  let value = data;
  for (const part of parts) {
    if (value === null || value === undefined) return undefined;
    value = value[part];
  }
  return value;
}

/**
 * Check if a conditional section is allowed based on business rules
 */
function isSectionAllowed(
  sectionName: string,
  data: Record<string, any>
): { allowed: boolean; error?: string } {
  const rule = BUSINESS_RULES[sectionName as keyof typeof BUSINESS_RULES];
  if (!rule) {
    return { allowed: true }; // No rule means always allowed
  }

  const triggerValue = getNestedValue(data, rule.triggerField);

  switch (rule.operator) {
    case 'contains':
      // Check if array contains the trigger value
      if (Array.isArray(triggerValue)) {
        if (triggerValue.includes(rule.triggerValue as string)) {
          return { allowed: true };
        }
      }
      return { allowed: false, error: rule.errorMessage };

    case 'in':
      // Check if value is one of the allowed values
      const allowedValues = rule.triggerValue as string[];
      if (allowedValues.includes(triggerValue)) {
        return { allowed: true };
      }
      return { allowed: false, error: rule.errorMessage };

    case 'equals':
      if (triggerValue === rule.triggerValue) {
        return { allowed: true };
      }
      return { allowed: false, error: rule.errorMessage };

    default:
      return { allowed: true };
  }
}

/**
 * Check if conditional section data is present without meeting conditions
 * Returns true if data should be rejected
 */
function hasUnauthorizedConditionalData(
  sectionName: string,
  sectionData: any,
  fullData: Record<string, any>
): { unauthorized: boolean; error?: string } {
  // If section data is empty/null/undefined, it's fine
  if (sectionData === null || sectionData === undefined) {
    return { unauthorized: false };
  }

  // If it's an object, check if it has any meaningful data
  if (typeof sectionData === 'object' && !Array.isArray(sectionData)) {
    const hasData = Object.values(sectionData).some(v =>
      v !== null && v !== undefined && v !== '' && v !== false
    );
    if (!hasData) {
      return { unauthorized: false };
    }
  }

  // Check if the section is allowed
  const { allowed, error } = isSectionAllowed(sectionName, fullData);
  if (!allowed) {
    return { unauthorized: true, error };
  }

  return { unauthorized: false };
}

/**
 * Validate business rules for conditional sections
 * Returns array of validation errors for unauthorized data
 */
export function validateBusinessRules(data: Record<string, any>): string[] {
  const errors: string[] = [];

  // Check each conditional section
  const conditionalSections = [
    'vehicleExpenses',
    'homeOffice',
    'rentalIncome',
    'selfEmployment',
    'spouse',
    'movingExpenses',
  ];

  for (const section of conditionalSections) {
    const sectionData = data[section];
    const result = hasUnauthorizedConditionalData(section, sectionData, data);
    if (result.unauthorized && result.error) {
      errors.push(result.error);
    }
  }

  return errors;
}

/**
 * Strip unauthorized conditional data from the payload
 * Use this to sanitize data before saving (alternative to rejecting)
 */
export function stripUnauthorizedConditionalData(data: Record<string, any>): Record<string, any> {
  const sanitized = { ...data };

  const conditionalSections = [
    'vehicleExpenses',
    'homeOffice',
    'rentalIncome',
    'selfEmployment',
    'spouse',
    'movingExpenses',
  ];

  for (const section of conditionalSections) {
    if (sanitized[section]) {
      const { allowed } = isSectionAllowed(section, data);
      if (!allowed) {
        // Remove unauthorized section data
        delete sanitized[section];
        console.log(`[BusinessRules] Stripped unauthorized ${section} data`);
      }
    }
  }

  return sanitized;
}

// ============================================
// PERSONAL FILING VALIDATION
// ============================================

/**
 * Validate personal filing data
 * Returns array of validation errors
 */
export function validatePersonalFilingData(data: Record<string, any>): string[] {
  const errors: string[] = [];

  // Helper to add error if validation fails
  const check = (result: { valid: boolean; error?: string }) => {
    if (!result.valid && result.error) {
      errors.push(result.error);
    }
  };

  // ============================================
  // BUSINESS RULE VALIDATION (Conditional Sections)
  // ============================================
  const businessRuleErrors = validateBusinessRules(data);
  errors.push(...businessRuleErrors);

  // Personal Info
  check(validateField('firstName', data.firstName));
  check(validateField('lastName', data.lastName));
  check(validateField('middleName', data.middleName));
  check(validateField('email', data.email));
  check(validateField('phoneNumber', data.phoneNumber));
  check(validateField('sin', data.sin));
  check(validateDate('dateOfBirth', data.dateOfBirth));

  // Address
  check(validateField('streetNumber', data.streetNumber));
  check(validateField('streetName', data.streetName));
  check(validateField('apartmentNumber', data.apartmentNumber));
  check(validateField('city', data.city));
  check(validateField('province', data.province));
  check(validateField('postalCode', data.postalCode));

  // Status
  check(validateField('statusInCanada', data.statusInCanada));
  check(validateField('maritalStatus', data.maritalStatus));
  check(validateField('maritalStatusChanged', data.maritalStatusChanged));
  check(validateDate('maritalStatusChangeDate', data.maritalStatusChangeDate));
  check(validateDate('dateBecameResident', data.dateBecameResident));

  // YES/NO fields
  const yesNoFields = [
    'livedOutsideCanada',
    'becameResidentThisYear',
  ];
  yesNoFields.forEach(field => {
    if (data[field]) {
      check(validateYesNo(field, data[field]));
    }
  });

  // Currency fields
  check(validateCurrency('worldIncome', data.worldIncome));

  // Additional notes
  check(validateField('additionalNotes', data.additionalNotes));

  // Validate nested components
  if (data.vehicleExpenses) {
    check(validateVehicleExpenses(data.vehicleExpenses));
  }

  if (data.selfEmployment) {
    check(validateSelfEmployment(data.selfEmployment));
  }

  if (data.spouse) {
    check(validateSpouseInfo(data.spouse));
  }

  if (data.dependents && Array.isArray(data.dependents)) {
    data.dependents.forEach((dep: any, index: number) => {
      const depErrors = validateDependentInfo(dep);
      if (!depErrors.valid && depErrors.error) {
        errors.push(`Dependent ${index + 1}: ${depErrors.error}`);
      }
    });
  }

  return errors;
}

/**
 * Validate vehicle expenses component
 */
export function validateVehicleExpenses(data: Record<string, any>): { valid: boolean; error?: string } {
  const errors: string[] = [];

  // If NA is checked, skip other validations
  if (data.notApplicable === true) {
    return { valid: true };
  }

  // Vehicle info
  if (data.make && !PATTERNS.SAFE_STRING.test(data.make)) {
    errors.push('Vehicle make contains invalid characters');
  }
  if (data.model && !PATTERNS.SAFE_STRING.test(data.model)) {
    errors.push('Vehicle model contains invalid characters');
  }
  if (data.year) {
    const yearResult = validateField('vehicleYear', data.year, 'vehicleYear');
    if (!yearResult.valid) errors.push(yearResult.error!);
  }

  // Date validation
  if (data.purchaseDate) {
    const dateResult = validateDate('purchaseDate', data.purchaseDate);
    if (!dateResult.valid) errors.push(dateResult.error!);
  }

  // Currency fields
  const currencyFields = [
    'purchaseCost', 'monthlyFuel', 'monthlyInsurance', 'monthlyMaintenance',
    'monthlyLicense', 'monthlyParking', 'monthlyLease', 'monthlyLoanInterest',
    'monthlyRides', 'monthlyOther', 'uccStartOfYear'
  ];

  currencyFields.forEach(field => {
    if (data[field] !== undefined && data[field] !== null) {
      const result = validateCurrency(field, data[field]);
      if (!result.valid) errors.push(result.error!);
    }
  });

  // KM fields (should be positive numbers)
  const kmFields = ['totalKmDriven', 'kmDrivenThisYear', 'kmDrivenForWork'];
  kmFields.forEach(field => {
    if (data[field] !== undefined && data[field] !== null) {
      if (typeof data[field] !== 'number' || data[field] < 0) {
        errors.push(`${field} must be a positive number`);
      }
    }
  });

  return errors.length > 0
    ? { valid: false, error: errors.join('; ') }
    : { valid: true };
}

/**
 * Validate self-employment component
 */
export function validateSelfEmployment(data: Record<string, any>): { valid: boolean; error?: string } {
  const errors: string[] = [];

  if (data.gstNumber) {
    const gstResult = validateField('gstNumber', data.gstNumber);
    if (!gstResult.valid) errors.push(gstResult.error!);
  }

  // Validate capital assets array
  if (data.capitalAssets && Array.isArray(data.capitalAssets)) {
    data.capitalAssets.forEach((asset: any, index: number) => {
      if (asset.description && !PATTERNS.SAFE_STRING.test(asset.description)) {
        errors.push(`Capital asset ${index + 1} description contains invalid characters`);
      }
      if (asset.cost !== undefined) {
        const costResult = validateCurrency(`capitalAssets[${index}].cost`, asset.cost);
        if (!costResult.valid) errors.push(costResult.error!);
      }
    });
  }

  return errors.length > 0
    ? { valid: false, error: errors.join('; ') }
    : { valid: true };
}

/**
 * Validate spouse info component
 */
export function validateSpouseInfo(data: Record<string, any>): { valid: boolean; error?: string } {
  const errors: string[] = [];

  if (data.firstName) {
    const result = validateField('firstName', data.firstName);
    if (!result.valid) errors.push(`Spouse first name: ${result.error}`);
  }
  if (data.lastName) {
    const result = validateField('lastName', data.lastName);
    if (!result.valid) errors.push(`Spouse last name: ${result.error}`);
  }
  if (data.sin) {
    const result = validateField('sin', data.sin);
    if (!result.valid) errors.push(`Spouse SIN: ${result.error}`);
  }
  if (data.dateOfBirth) {
    const result = validateDate('dateOfBirth', data.dateOfBirth);
    if (!result.valid) errors.push(`Spouse date of birth: ${result.error}`);
  }

  return errors.length > 0
    ? { valid: false, error: errors.join('; ') }
    : { valid: true };
}

/**
 * Validate dependent info component
 */
export function validateDependentInfo(data: Record<string, any>): { valid: boolean; error?: string } {
  const errors: string[] = [];

  if (data.firstName) {
    const result = validateField('firstName', data.firstName);
    if (!result.valid) errors.push(result.error!);
  }
  if (data.lastName) {
    const result = validateField('lastName', data.lastName);
    if (!result.valid) errors.push(result.error!);
  }
  if (data.sin) {
    const result = validateField('sin', data.sin);
    if (!result.valid) errors.push(result.error!);
  }
  if (data.dateOfBirth) {
    const result = validateDate('dateOfBirth', data.dateOfBirth);
    if (!result.valid) errors.push(result.error!);
  }

  return errors.length > 0
    ? { valid: false, error: errors.join('; ') }
    : { valid: true };
}

// ============================================
// EXPORTS
// ============================================

export default {
  validateField,
  validateYesNo,
  validateCurrency,
  validateDate,
  validateArray,
  validatePersonalFilingData,
  validateBusinessRules,
  stripUnauthorizedConditionalData,
  validateVehicleExpenses,
  validateSelfEmployment,
  validateSpouseInfo,
  validateDependentInfo,
  PATTERNS,
  FIELD_RULES,
  BUSINESS_RULES,
};
