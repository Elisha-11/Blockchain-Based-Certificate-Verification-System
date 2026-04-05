const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);

// Protected route example (for testing RBAC)
router.get('/me', require('../middleware/auth'), (req, res) => {
  res.json({ user: req.user });
});

router.get('/admin-dashboard', 
  require('../middleware/auth'), 
  require('../middleware/rbac')('super_admin', 'institution_admin'),
  (req, res) => {
    res.json({ message: 'Admin dashboard access granted', role: req.user.role });
  }
);

module.exports = router;