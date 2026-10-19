const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  full_name: z.string().min(2, 'Full name is required').trim()
});

exports.login = async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    // Find user by email, joining institution so role-gated UI (e.g. ZAQA's
    // regulator dashboard vs. an issuing institution's forms) doesn't need a
    // second round-trip after login.
    const [rows] = await pool.query(
      `SELECT u.user_id, u.email, u.password_hash, u.full_name, u.role, u.institution_id, u.is_active,
              i.code AS institution_code, i.type AS institution_type, i.is_active AS institution_is_active
       FROM users u
       LEFT JOIN institutions i ON u.institution_id = i.institution_id
       WHERE u.email = ?`,
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = rows[0];

    // Check if account is active
    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token - USE SNAKE_CASE TO MATCH DATABASE
    const token = jwt.sign(
      { 
        user_id: user.user_id,          // FIXED: was userId
        email: user.email, 
        role: user.role,
        institution_id: user.institution_id, // FIXED: was institutionId
        institution_code: user.institution_code,
        institution_type: user.institution_type,
        full_name: user.full_name
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Update last login
    await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = ?', [user.user_id]);

    // Send success response - INCLUDE institution_id IN USER OBJECT
    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        user_id: user.user_id,          // FIXED: was id
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        institution_id: user.institution_id, // ADDED: was missing
        institution_code: user.institution_code,
        institution_type: user.institution_type
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    
    if (err instanceof z.ZodError) {
      // Zod v4 exposes '.issues'; '.errors' only exists in v3. Reading
      // '.errors[0]' on v4 threw a TypeError, which Express turned into a
      // 500 with a stack trace instead of this 400.
      const issues = err.issues || err.errors || [];
      return res.status(400).json({
        error: issues[0]?.message || 'Invalid request body'
      });
    }
    
    res.status(500).json({ error: 'Login failed', details: err.message });
  }
};

/**
 * Public self-registration.
 *
 * SECURITY: This endpoint is unauthenticated by design (anyone can create an
 * account to use the public verification portal), so it must NEVER trust a
 * caller-supplied role or institution_id — doing so previously let any caller
 * register as 'super_admin' and gain full administrative access. Every account
 * created here is hardcoded to the lowest-privilege role with no institution
 * affiliation. Institution admin / super admin accounts can only be created by
 * an already-authenticated admin via POST /api/admin/users (adminController.createUser).
 */
exports.register = async (req, res) => {
  try {
    const { email, password, full_name } = registerSchema.parse(req.body);

    const password_hash = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      'INSERT INTO users (email, password_hash, full_name, role, institution_id) VALUES (?, ?, ?, ?, ?)',
      [email, password_hash, full_name, 'verifier', null]
    );

    res.status(201).json({
      success: true,
      message: 'User registered',
      userId: result.insertId
    });
  } catch (err) {
    console.error('Register error:', err);

    if (err instanceof z.ZodError) {
      // Zod v4 exposes '.issues'; '.errors' only exists in v3. Reading
      // '.errors[0]' on v4 threw a TypeError, which Express turned into a
      // 500 with a stack trace instead of this 400.
      const issues = err.issues || err.errors || [];
      return res.status(400).json({
        error: issues[0]?.message || 'Invalid request body'
      });
    }
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    res.status(500).json({ error: 'Registration failed', details: err.message });
  }
};
