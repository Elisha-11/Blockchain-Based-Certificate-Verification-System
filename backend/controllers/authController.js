const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

exports.login = async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    // Find user by email
    const [rows] = await pool.query(
      'SELECT user_id, email, password_hash, full_name, role, institution_id, is_active FROM users WHERE email = ?',
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

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.user_id, 
        email: user.email, 
        role: user.role, 
        institutionId: user.institution_id 
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Update last login
    await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = ?', [user.user_id]);

    // Send success response
    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.user_id,
        email: user.email,
        full_name: user.full_name,
        role: user.role
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    
    res.status(500).json({ error: 'Login failed', details: err.message });
  }
};

// Optional: Register endpoint (for testing)
exports.register = async (req, res) => {
  try {
    const { email, password, full_name, role = 'verifier', institution_id = null } = req.body;
    
    // Hash password
    const password_hash = await bcrypt.hash(password, 10);
    
    // Insert user
    const [result] = await pool.query(
      'INSERT INTO users (email, password_hash, full_name, role, institution_id) VALUES (?, ?, ?, ?, ?)',
      [email, password_hash, full_name, role, institution_id]
    );
    
    res.status(201).json({ 
      success: true, 
      message: 'User registered', 
      userId: result.insertId 
    });
  } catch (err) {
    console.error('Register error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    res.status(500).json({ error: 'Registration failed', details: err.message });
  }
};