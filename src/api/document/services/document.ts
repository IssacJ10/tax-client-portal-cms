/**
 * Document Service
 *
 * Core Strapi service for document management.
 * Uses the factories pattern for standard CRUD operations.
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::document.document');
