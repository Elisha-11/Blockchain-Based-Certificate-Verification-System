// backend/routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const auditController = require('../controllers/auditController');
const auth = require('../middleware/auth');
const { rbac, requireRegulator } = require('../middleware/rbac');

/**
 * POST /api/admin/users
 * Create a privileged/scoped user account (institution_admin or super_admin).
 * Only reachable by an already-authenticated admin — see adminController.createUser
 * for the containment rules (an institution_admin cannot escalate to super_admin
 * or assign a different institution than their own).
 */
router.post('/users',
  auth,
  rbac('super_admin', 'institution_admin'),
  adminController.createUser
);

/**
 * GET /api/admin/audit-logs
 * Cross-institution trail of every issuance, failed issuance and revocation.
 * Restricted to ZAQA (institution_type 'regulatory_body') and super_admin —
 * an ordinary institution_admin must not see other institutions' activity.
 */
router.get('/audit-logs',
  auth,
  rbac('super_admin', 'institution_admin'),
  requireRegulator,
  auditController.list
);

/**
 * GET /api/admin/audit-logs/summary
 * Per-institution counts and classification distribution for the regulator.
 */
router.get('/audit-logs/summary',
  auth,
  rbac('super_admin', 'institution_admin'),
  requireRegulator,
  auditController.summary
);

module.exports = router;
