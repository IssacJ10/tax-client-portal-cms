/**
 * Personal Filing Controller
 * Handles CRUD operations for personal tax filings with comprehensive validation
 */

import { factories } from '@strapi/strapi';
import { errors } from '@strapi/utils';
import { validatePersonalFilingData } from '../../../utils/validators';

const { ValidationError, ForbiddenError } = errors;

export default factories.createCoreController('api::personal-filing.personal-filing', ({ strapi }) => ({
  /**
   * Create a new personal filing with validation
   */
  async create(ctx) {
    // Validate input data
    const data = ctx.request.body?.data;

    if (data) {
      const validationErrors = validatePersonalFilingData(data);
      if (validationErrors.length > 0) {
        strapi.log.warn('[PersonalFiling] Validation failed on create:', {
          errors: validationErrors,
          userId: ctx.state?.user?.id,
        });
        throw new ValidationError(`Validation failed: ${validationErrors.join('; ')}`);
      }
    }

    // Ensure the filing belongs to the authenticated user
    const user = ctx.state?.user;
    if (!user) {
      throw new ForbiddenError('Authentication required');
    }

    // Call the default create
    const response = await super.create(ctx);

    strapi.log.info('[PersonalFiling] Created', {
      filingId: response.data?.id,
      userId: user.id,
    });

    return response;
  },

  /**
   * Update a personal filing with validation
   */
  async update(ctx) {
    const { id } = ctx.params; // This is the documentId in Strapi v5
    const data = ctx.request.body?.data;

    // Verify ownership before update
    const user = ctx.state?.user;
    if (!user) {
      throw new ForbiddenError('Authentication required');
    }

    // Check if user owns this filing using documents API (for documentId)
    const filing: any = await strapi.documents('api::personal-filing.personal-filing').findOne({
      documentId: id,
      populate: {
        filing: {
          populate: ['user'],
        },
      },
    });

    if (!filing) {
      throw new ValidationError('Filing not found');
    }

    // Check ownership through the parent filing
    const parentFiling = filing.filing as any;
    if (parentFiling?.user?.id !== user.id) {
      strapi.log.warn('[PersonalFiling] Unauthorized update attempt', {
        filingId: id,
        attemptedBy: user.id,
        owner: parentFiling?.user?.id,
      });
      throw new ForbiddenError('You do not have permission to update this filing');
    }

    // Validate input data (skip validation for simple status updates)
    const isStatusOnlyUpdate = data && Object.keys(data).length === 1 && data.individualStatus;
    if (data && !isStatusOnlyUpdate) {
      const validationErrors = validatePersonalFilingData(data);
      if (validationErrors.length > 0) {
        strapi.log.warn('[PersonalFiling] Validation failed on update:', {
          filingId: id,
          errors: validationErrors,
          userId: user.id,
        });
        throw new ValidationError(`Validation failed: ${validationErrors.join('; ')}`);
      }
    }

    // Use Document Service directly to avoid issues with super.update() in Strapi v5
    const updatedFiling = await strapi.documents('api::personal-filing.personal-filing').update({
      documentId: id,
      data: data,
    });

    strapi.log.info('[PersonalFiling] Updated', {
      filingId: id,
      userId: user.id,
      changes: Object.keys(data || {}),
    });

    // Return in Strapi API format
    return {
      data: updatedFiling,
    };
  },

  /**
   * Find personal filings - restrict to user's own filings
   */
  async find(ctx) {
    const user = ctx.state?.user;
    if (!user) {
      throw new ForbiddenError('Authentication required');
    }

    // Modify the query to only return user's filings
    // This is enforced at the query level for security
    const existingQuery = ctx.query || {};
    const existingFilters = (existingQuery as any).filters || {};

    ctx.query = {
      ...(existingQuery as object),
      filters: {
        ...existingFilters,
        filing: {
          user: {
            id: user.id,
          },
        },
      },
    };

    return super.find(ctx);
  },

  /**
   * Find one personal filing - verify ownership
   */
  async findOne(ctx) {
    const { id } = ctx.params; // This is the documentId in Strapi v5
    const user = ctx.state?.user;

    if (!user) {
      throw new ForbiddenError('Authentication required');
    }

    // Fetch the filing with ownership info using documents API (for documentId)
    const filing: any = await strapi.documents('api::personal-filing.personal-filing').findOne({
      documentId: id,
      populate: {
        filing: {
          populate: ['user'],
        },
      },
    });

    if (!filing) {
      throw new ValidationError('Filing not found');
    }

    // Check ownership
    const parentFiling = filing.filing as any;
    if (parentFiling?.user?.id !== user.id) {
      strapi.log.warn('[PersonalFiling] Unauthorized access attempt', {
        filingId: id,
        attemptedBy: user.id,
        owner: parentFiling?.user?.id,
      });
      throw new ForbiddenError('You do not have permission to access this filing');
    }

    // Return the already-fetched filing data (with full populate)
    // This avoids issues with super.findOne() in Strapi v5
    return {
      data: filing,
    };
  },

  /**
   * Delete is disabled for personal filings
   * Filings should be archived, not deleted
   */
  async delete(ctx) {
    const user = ctx.state?.user;
    strapi.log.warn('[PersonalFiling] Delete attempt blocked', {
      filingId: ctx.params.id,
      userId: user?.id,
    });

    throw new ForbiddenError('Personal filings cannot be deleted. Please contact support if you need to archive a filing.');
  },
}));
