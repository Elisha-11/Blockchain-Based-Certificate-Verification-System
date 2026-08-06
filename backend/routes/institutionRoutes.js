const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');

// GET /api/institutions/:id - Get institution details (public, no auth required)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      'SELECT institution_id, name, code, logo_url, contact_email FROM institutions WHERE institution_id = ? AND is_active = TRUE',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Institution not found' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching institution:', error);
    res.status(500).json({ error: 'Failed to fetch institution details' });
  }
});

module.exports = router;