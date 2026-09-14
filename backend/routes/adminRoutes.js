// backend/routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const auth = require('../middleware/auth');
const { rbac } = require('../middleware/rbac');

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

module.exports = router;
