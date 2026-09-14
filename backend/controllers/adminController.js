// backend/controllers/adminController.js
const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const { z } = require('zod');

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  full_name: z.string().min(2, 'Full name is required').trim(),
  role: z.enum(['verifier', 'institution_admin', 'super_admin']),
  institution_id: z.string().uuid().optional().nullable()
});

/**
 * POST /api/admin/users
 * Creates a privileged (or scoped) user account. Requires an authenticated
 * admin — this is the ONLY place institution_admin / super_admin accounts can
 * be created; public self-registration (POST /api/auth/register) always
 * creates a plain 'verifier' account.
 *
 * Containment rules:
 * - Only an existing super_admin may create another super_admin.
 * - An institution_admin may only create verifier/institution_admin accounts,
 *   and only for their OWN institution (cannot set an arbitrary institution_id).
 */
exports.createUser = async (req, res) => {
  try {
    const data = createUserSchema.parse(req.body);

    if (data.role === 'super_admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only a super admin can create super admin accounts' });
    }

    if (req.user.role === 'institution_admin') {
      // Institution admins are confined to their own institution regardless of
      // what institution_id was submitted in the request body.
      data.institution_id = req.user.institution_id;
    }

    if (data.role === 'institution_admin' && !data.institution_id) {
      return res.status(400).json({ error: 'institution_id is required for institution_admin accounts' });
    }

    const password_hash = await bcrypt.hash(data.password, 10);

    const [result] = await pool.query(
      'INSERT INTO users (email, password_hash, full_name, role, institution_id) VALUES (?, ?, ?, ?, ?)',
      [data.email, password_hash, data.full_name, data.role, data.institution_id || null]
    );

    res.status(201).json({
      success: true,
      message: 'User created',
      userId: result.insertId
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    console.error('[AdminController] createUser failed:', err.message);
    res.status(500).json({ error: 'Failed to create user', details: err.message });
  }
};
