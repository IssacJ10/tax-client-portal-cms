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


    // 4. SEED FILING QUESTIONS (2024/2025)
    // Now loading from the V2 format in src/config/questions_v2.json
    // This is the new question-based format with proper conditional logic support
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const filingQuestions = require('./config/questions_v2.json');


    const taxYear2024 = await strapi.db.query('api::tax-year.tax-year').findOne({
      where: { year: '2024' },
    });

    if (taxYear2024) {
      await strapi.db.query('api::tax-year.tax-year').update({
        where: { id: taxYear2024.id },
        data: { filingQuestions },
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
        data: { filingQuestions },
      });
      strapi.log.info('Seeded Filing Questions for Tax Year 2025.');
    }

  },
};
