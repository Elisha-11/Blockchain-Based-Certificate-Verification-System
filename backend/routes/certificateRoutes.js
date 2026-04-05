const express = require('express');
const router = express.Router();
const certController = require('../controllers/certificateController');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');

// Only admins/institution admins can issue
router.post('/', auth, rbac('super_admin', 'institution_admin'), certController.issue);

module.exports = router;