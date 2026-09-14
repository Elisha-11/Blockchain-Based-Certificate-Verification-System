// backend/scripts/createSuperAdmin.js
//
// Bootstraps the very first super_admin account. Run this once against a fresh
// database — after that, further admin accounts should be created via the
// authenticated POST /api/admin/users endpoint (adminController.createUser),
// not this script, since it bypasses auth entirely by design (there is no
// admin yet to authenticate as).
//
// Usage:
//   node scripts/createSuperAdmin.js <email> <password> "<full name>"
//
// Requires backend/.env to be configured (DB_HOST, DB_USER, DB_PASS, DB_NAME).

require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

async function main() {
  const [email, password, fullName] = process.argv.slice(2);

  if (!email || !password || !fullName) {
    console.error('Usage: node scripts/createSuperAdmin.js <email> <password> "<full name>"');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }

  try {
    const [existing] = await pool.query('SELECT user_id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      console.error(`A user with email ${email} already exists.`);
      process.exit(1);
    }

    const password_hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (email, password_hash, full_name, role, institution_id) VALUES (?, ?, ?, ?, ?)',
      [email, password_hash, fullName, 'super_admin', null]
    );

    console.log(`Super admin created: ${email} (user_id ${result.insertId})`);
    console.log('You can now log in and use POST /api/admin/users to create further accounts.');
  } catch (err) {
    console.error('Failed to create super admin:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
