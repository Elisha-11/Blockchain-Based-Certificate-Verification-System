// backend/repositories/institutionRepository.js
const pool = require('../config/db');

exports.findById = async (institutionId) => {
  const [rows] = await pool.query(
    `SELECT institution_id, name, code, type, wallet_address, logo_url, contact_email, is_active
     FROM institutions WHERE institution_id = ?`,
    [institutionId]
  );
  return rows[0] || null;
};

exports.findAll = async () => {
  const [rows] = await pool.query(
    `SELECT institution_id, name, code, type, logo_url, contact_email, is_active, created_at
     FROM institutions ORDER BY type, name`
  );
  return rows;
};

exports.setActiveStatus = async (institutionId, isActive) => {
  const [result] = await pool.query(
    'UPDATE institutions SET is_active = ? WHERE institution_id = ?',
    [isActive, institutionId]
  );
  return result.affectedRows > 0;
};
