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
  bootstrap({ strapi }) {
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
    });
  },
};
