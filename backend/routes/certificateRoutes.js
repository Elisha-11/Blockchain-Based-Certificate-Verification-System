// backend/routes/certificateRoutes.js
const express = require('express');
const router = express.Router();
const certController = require('../controllers/certificateController');
const auth = require('../middleware/auth');
const { rbac } = require('../middleware/rbac');

/**
 * POST /api/certificates
 * Issue new certificate with type-specific validation.
 */
router.post('/', 
  auth, 
  rbac('super_admin', 'institution_admin'), 
  certController.issue
);

/**
 * GET /api/certificates/my-institution
 * List certificates scoped to authenticated user's institution.
 *  MUST be defined BEFORE /:id routes to prevent path collision.
 */
router.get('/my-institution', 
  auth, 
  certController.getMyInstitutionCerts
);

/**
 *  GET /api/certificates/:id
 * Fetch single certificate with institution details for detail/print view.
 * Must come AFTER /my-institution but BEFORE other /:id sub-routes.
 */
router.get('/:id', 
  auth, 
  certController.getById
);

/**
 * POST /api/certificates/:id/retry-blockchain
 * Retry blockchain registration for failed certificates.
 */
router.post('/:id/retry-blockchain', 
  auth, 
  rbac('super_admin', 'institution_admin'), 
  certController.retryBlockchain
);

/**
 * POST /api/certificates/:id/revoke
 * Revoke certificate with mandatory audit reason.
 */
router.post('/:id/revoke', 
  auth, 
  rbac('super_admin', 'institution_admin'), 
  certController.revokeCertificate
);

/**
 * GET /api/certificates/:id/presentation
 * Public endpoint returning UI configuration for certificate type.
 * NO AUTHENTICATION REQUIRED.
 */
router.get('/:id/presentation', 
  certController.getPresentationConfig
);

module.exports = router;