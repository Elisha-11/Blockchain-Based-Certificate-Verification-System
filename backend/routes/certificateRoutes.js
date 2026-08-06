const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const certController = require('../controllers/certificateController');
const auth = require('../middleware/auth');
const { rbac, authorizeInstitution } = require('../middleware/rbac');

// POST /api/certificates - Issue new certificate (admin only)
router.post('/', 
  auth, 
  rbac('super_admin', 'institution_admin'), 
  authorizeInstitution, 
  certController.issue
);

// GET /api/certificates - List certificates (admin only)
router.get('/', auth, rbac('super_admin', 'institution_admin'), async (req, res) => {
  try {
    const { search, status, page = 1, limit = 20 } = req.query;
    
    let query = 'SELECT cert_id, student_name, program, institution_id, issue_date, status, created_at FROM certificates WHERE 1=1';
    const params = [];
    
    // Multi-tenancy enforcement: Only super_admins see all data
    if (req.user.role !== 'super_admin') {
      query += ' AND institution_id = ?';
      params.push(req.user.institution_id);
    }
    
    if (search) {
      query += ' AND (student_name LIKE ? OR cert_id LIKE ? OR program LIKE ?)';
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam);
    }
    
    if (status && status !== 'all') {
      query += ' AND status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
    
    const [certificates] = await pool.query(query, params);
    
    // Get total count for pagination with same filters
    let countQuery = 'SELECT COUNT(*) as total FROM certificates WHERE 1=1';
    const countParams = [];
    
    if (req.user.role !== 'super_admin') {
      countQuery += ' AND institution_id = ?';
      countParams.push(req.user.institution_id);
    }
    
    if (search) {
      countQuery += ' AND (student_name LIKE ? OR cert_id LIKE ? OR program LIKE ?)';
      const searchParam = `%${search}%`;
      countParams.push(searchParam, searchParam, searchParam);
    }
    if (status && status !== 'all') {
      countQuery += ' AND status = ?';
      countParams.push(status);
    }
    
    const [countResult] = await pool.query(countQuery, countParams);
    
    res.json({
      certificates,
      pagination: {
        total: countResult[0].total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(countResult[0].total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching certificates:', error);
    res.status(500).json({ error: 'Failed to fetch certificates' });
  }
});

// GET /api/certificates/:cert_id - Get single certificate details
router.get('/:cert_id', auth, rbac('super_admin', 'institution_admin'), async (req, res) => {
  try {
    const { cert_id } = req.params;
    
    let query = `SELECT cert_id, student_id, student_name, program, institution_id, issue_date, cert_hash, status, created_at 
                 FROM certificates WHERE cert_id = ?`;
    const queryParams = [cert_id];
    
    if (req.user.role !== 'super_admin') {
      query += ' AND institution_id = ?';
      queryParams.push(req.user.institution_id);
    }
    
    const [rows] = await pool.query(query, queryParams);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Certificate not found or access denied' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching certificate:', error);
    res.status(500).json({ error: 'Failed to fetch certificate' });
  }
});

module.exports = router;