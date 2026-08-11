const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middleware/auth');
// FIX: Destructure rbac from the object export
const { rbac } = require('../middleware/rbac');

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);

// Protected route example (for testing RBAC)
router.get('/me', auth, (req, res) => {
  res.json({ user: req.user });
});

// FIX: Use the destructured rbac function
router.get('/admin-dashboard', 
  auth, 
  rbac('super_admin', 'institution_admin'),
  (req, res) => {
    res.json({ message: 'Admin dashboard access granted', role: req.user.role });
  }
);

module.exports = router;
