'use strict';

/**
 * tax-tip service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::tax-tip.tax-tip');
