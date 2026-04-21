const express = require('express');
const router = express.Router();
const verifyController = require('../controllers/verifyController');

// Public endpoint - no auth required for verification
router.post('/', verifyController.verify);

module.exports = router;