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


  },
};
