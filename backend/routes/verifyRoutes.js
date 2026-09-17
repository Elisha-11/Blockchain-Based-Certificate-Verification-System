const express = require('express');
const router = express.Router();
const verifyController = require('../controllers/verifyController');
const { verifyLimiter } = require('../middleware/rateLimiter');

// Public endpoint - no auth required for verification
router.post('/', verifyLimiter, verifyController.verify);

module.exports = router;