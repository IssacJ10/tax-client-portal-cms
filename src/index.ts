import { errors } from '@strapi/utils';

const { ApplicationError } = errors;

const NAME_REGEX = /^[a-zA-Z \-']+$/;

const validateName = (value: string, fieldName: string) => {
  if (value && !NAME_REGEX.test(value)) {
    throw new ApplicationError(`${fieldName} can only contain letters, spaces, hyphens, and apostrophes.`);
  }
};

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/* { strapi }: { strapi: Core.Strapi } */) { },

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }) {
    console.log('[[BOOTSTRAP]] JJElevate Admin starting...');

    // 1. LIFECYCLE HOOKS
    strapi.db.lifecycles.subscribe({
      models: ['plugin::users-permissions.user'],
      async beforeCreate(event) {
        const { data } = event.params;
        validateName(data.firstName, 'First name');
        validateName(data.lastName, 'Last name');
      },
      async beforeUpdate(event) {
        const { data } = event.params;
        validateName(data.firstName, 'First name');
        validateName(data.lastName, 'Last name');
      },
      async afterCreate(event) {
        const { result } = event;
        try {
          await strapi.plugin('email').service('email').send({
            to: result.email,
            subject: 'User Registration Successful',
            text: `Welcome to JJ Elevate Tax Portal. This email confirms that you have successfully completed the registration. your user name is ${result.username}.`,
            html: `<p>Welcome to JJ Elevate Tax Portal.</p><p>This email confirms that you have successfully completed the registration.</p><p>your user name is <strong>${result.username}</strong>.</p>`,
          });
        } catch (err) {
          strapi.log.error('Failed to send welcome email:', err);
        }
      },
    });

    // 2. DISABLE EMAIL CONFIRMATION
    const pluginStore = strapi.store({
      type: 'plugin',
      name: 'users-permissions',
    });

    const settings = await pluginStore.get({ key: 'advanced' });

    if (settings.email_confirmation) {
      await pluginStore.set({
        key: 'advanced',
        value: {
          ...settings,
          email_confirmation: false,
        },
      });
      strapi.log.info('Email confirmation disabled via bootstrap (using Welcome Email instead).');
    }

    // 3. GRANT PERMISSIONS
    const authenticatedRole = await strapi
      .query('plugin::users-permissions.role')
      .findOne({ where: { type: 'authenticated' } });

    if (authenticatedRole) {
      const permissionAction = 'plugin::users-permissions.user.updateMe';
      const existingPermission = await strapi.query('plugin::users-permissions.permission').findOne({
        where: {
          action: permissionAction,
          role: authenticatedRole.id,
        },
      });

      if (!existingPermission) {
        await strapi.query('plugin::users-permissions.permission').create({
          data: {
            action: permissionAction,
            role: authenticatedRole.id,
          },
        });
        strapi.log.info('Granted updateMe permission to Authenticated role.');
      }
    }

    // Helper to grant permissions
    const grantPermission = async (roleName, action) => {
      const role = await strapi
        .query('plugin::users-permissions.role')
        .findOne({ where: { type: roleName } });

      if (role) {
        const existing = await strapi.query('plugin::users-permissions.permission').findOne({
          where: { action, role: role.id },
        });
        if (!existing) {
          await strapi.query('plugin::users-permissions.permission').create({
            data: { action, role: role.id },
          });
          strapi.log.info(`Granted ${action} permission to ${roleName} role.`);
        }
      }
    };

    // Grant Permissions
    await grantPermission('authenticated', 'plugin::users-permissions.user.updateMe');
    await grantPermission('authenticated', 'api::token.logout.logout');
    await grantPermission('authenticated', 'api::tax-year.tax-year.find');
    await grantPermission('authenticated', 'api::tax-year.tax-year.findOne');
    await grantPermission('authenticated', 'api::filing.filing.create');
    await grantPermission('authenticated', 'api::filing.filing.find');
    await grantPermission('authenticated', 'api::filing.filing.findOne');
    await grantPermission('authenticated', 'api::filing.filing.update');
    await grantPermission('authenticated', 'plugin::upload.content-api.upload'); // Fix 403 on Upload
    await grantPermission('public', 'api::token.token.refresh');


    // 4. SEED FILING QUESTIONS (2024) - Refactored for UX
    const filingQuestions2024 = {
      "title": "{year} Income Tax Return Personal Information Sheet",
      "pages": [
        {
          "title": "Contact & Identity",
          "id": "contact_identity",
          "fields": [
            { "name": "personalInfo.firstName", "label": "Given Name (First Name)", "type": "text", "required": true },
            { "name": "personalInfo.middleName", "label": "Middle Name", "type": "text", "required": false },
            { "name": "personalInfo.lastName", "label": "Surname (Last Name)", "type": "text", "required": true },
            { "name": "personalInfo.dateOfBirth", "label": "Date of birth", "type": "date", "required": false },
            { "name": "personalInfo.sin", "label": "SIN Number", "type": "text", "required": false },
            { "name": "personalInfo.email", "label": "Email", "type": "email", "required": true },
            { "name": "personalInfo.emailConfirmation", "label": "Email (Confirmation)", "type": "email", "required": false },
            { "name": "personalInfo.phoneNumber", "label": "Phone number", "type": "tel", "required": false },
            { "name": "personalInfo.isFirstTimeFiler", "label": "Are you filing an Income Tax Return with the CRA for the first time?", "type": "radio", "options": ["Yes", "No"], "required": false }
          ]
        },
        {
          "title": "Address & Residency",
          "id": "address_residency",
          "fields": [
            { "name": "personalInfo.currentAddress", "label": "Current Address", "type": "text", "required": true },
            { "name": "personalInfo.city", "label": "City", "type": "text", "required": true },
            { "name": "personalInfo.province", "label": "Select a Province or Territory", "type": "select", "options": ["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"], "required": true },
            { "name": "personalInfo.postalCode", "label": "Postal Code", "type": "text", "required": false },
            { "name": "personalInfo.previousAddress", "label": "Previous Address (If moved in {year})", "type": "text", "required": false },
            { "name": "personalInfo.maritalStatus", "label": "Marital Status", "type": "select", "options": ["Single", "Married", "Common-law", "Separated", "Divorced", "Widowed"], "required": false },
            { "name": "personalInfo.maritalStatusChanged", "label": "Did your Marital Status change in {year}?", "type": "radio", "options": ["Yes", "No"], "required": false },
            { "name": "personalInfo.maritalStatusChangeDate", "label": "Date of Marital status change", "type": "date", "required": false },
            { "name": "personalInfo.arrivalDateCanada", "label": "If you came to Canada in {year}, please specify the date of your arrival", "type": "date", "required": false }
          ]
        },
        {
          "title": "Employment & Income",
          "id": "employment_income",
          "fields": [
            { "name": "personalInfo.employmentStatus", "label": "Employment Status", "type": "radio", "options": ["Employed", "Self-Employed", "Student", "Retired", "Unemployed"], "required": false },
            { "name": "personalInfo.employmentDetails", "label": "Specify the details", "type": "text", "required": false },
            { "name": "personalInfo.currentStatus", "label": "Current status", "type": "text", "required": false },
            { "name": "personalInfo.movedForWork", "label": "Did you move for Work/Studies more than 40kms?", "type": "radio", "options": ["Yes", "No"], "required": false },
            { "name": "personalInfo.workFromHome", "label": "Did you work from home?", "type": "radio", "options": ["Yes", "No"], "required": false },
            { "name": "personalInfo.workedOutsideCanada", "label": "If you arrived in Canada in {year}, did you work (in person or remotely) in any country besides Canada?", "type": "radio", "options": ["Yes", "No"], "required": false },
            { "name": "personalInfo.amountOutsideCanada", "label": "Enter Amount (in CAD)", "type": "number", "required": false }
          ]
        },
        {
          "title": "Deductions",
          "id": "deductions",
          "fields": [
            { "name": "personalInfo.medicalExpenses", "label": "Did you have Medical Expenses?", "type": "radio", "options": ["Yes", "No"], "required": false },
            { "name": "personalInfo.donations", "label": "Did you make Donations?", "type": "radio", "options": ["Yes", "No"], "required": false },
            { "name": "personalInfo.rrsp", "label": "Did you contribute to RRSP?", "type": "radio", "options": ["Yes", "No"], "required": false },
            { "name": "personalInfo.directDepositInfo", "label": "Direct Deposit Information (Void Cheque details)", "type": "text", "required": false }
          ]
        },
        {
          "title": "Spouse Details",
          "id": "spouse",
          "fields": [
            { "name": "spouse.residencyStatus", "label": "Canadian Residency Status Of Spouse", "type": "radio", "options": ["Resident", "Non-Resident"], "required": true },
            { "name": "spouse.firstName", "label": "Given Name (first name)", "type": "text", "required": true },
            { "name": "spouse.middleName", "label": "Middle Name", "type": "text", "required": false },
            { "name": "spouse.lastName", "label": "Surname (last name)", "type": "text", "required": true },
            { "name": "spouse.sin", "label": "SIN Number", "type": "text", "required": false },
            { "name": "spouse.dateOfBirth", "label": "Date of Birth", "type": "date", "required": true },
            { "name": "spouse.phoneNumber", "label": "Phone number", "type": "tel", "required": false },
            { "name": "spouse.incomeOutsideCanada", "label": "Did your spouse earn any income from outside of Canada?", "type": "radio", "options": ["Yes", "No"], "required": false },
            { "name": "spouse.netIncome", "label": "Net Income", "type": "number", "required": true }
          ]
        },
        {
          "title": "Dependents Details",
          "id": "dependents",
          "fields": [
            { "name": "dependents.0.firstName", "label": "Given Name (first name)", "type": "text", "required": true },
            { "name": "dependents.0.middleName", "label": "Middle Name", "type": "text", "required": false },
            { "name": "dependents.0.lastName", "label": "Surname (last name)", "type": "text", "required": true },
            { "name": "dependents.0.dateOfBirth", "label": "Date of Birth", "type": "date", "required": true },
            { "name": "dependents.0.sin", "label": "SIN", "type": "text", "required": false },
            { "name": "dependents.0.relationship", "label": "Relationship", "type": "text", "required": true }
          ]
        },
        {
          "title": "Tax Slips & Documents",
          "id": "tax_slips",
          "fields": [
            { "name": "personalInfo.documentAvailability", "label": "Do you have any of the following documents?", "type": "checkbox", "options": ["T4 - Employment Income", "T5 - Investment Income", "T3 - Trust Income", "T2202 - Tuition", "Rent/Property Tax Receipts", "Medical Receipts", "Donation Receipts"], "required": true },
            { "name": "personalInfo.taxSlips", "label": "Select The Tax Slips That Are Available To You in {year}", "type": "checkbox", "options": ["T4", "T5", "T3", "T2202", "T4A", "T4E", "T5007", "T4RSP/RIF", "T4A-OAS/CPP"], "required": false },
            { "name": "personalInfo.uploadedFiles", "label": "Upload Your Tax Slips (Images/PDF)", "type": "file", "required": false }
          ]
        }
      ]
    };

    const taxYear2024 = await strapi.db.query('api::tax-year.tax-year').findOne({
      where: { year: '2024' },
    });

    if (taxYear2024) {
      await strapi.db.query('api::tax-year.tax-year').update({
        where: { id: taxYear2024.id },
        data: { filingQuestions: filingQuestions2024 },
      });
      strapi.log.info('Seeded Filing Questions for Tax Year 2024.');
    }

    // Seed 2025 as well for development defaults
    const taxYear2025 = await strapi.db.query('api::tax-year.tax-year').findOne({
      where: { year: '2025' },
    });

    if (taxYear2025) {
      await strapi.db.query('api::tax-year.tax-year').update({
        where: { id: taxYear2025.id },
        data: { filingQuestions: filingQuestions2024 }, // Using same questions for POC
      });
      strapi.log.info('Seeded Filing Questions for Tax Year 2025.');
    }

  },
};
