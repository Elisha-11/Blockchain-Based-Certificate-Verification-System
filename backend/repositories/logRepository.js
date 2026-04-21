const pool = require('../config/db');

exports.create = async (logData) => {
  const { cert_id, verifier_ip, result, user_agent } = logData;
  await pool.query(
    `INSERT INTO verification_logs (cert_id, verifier_ip, result, user_agent) VALUES (?, ?, ?, ?)`,
    [cert_id, verifier_ip, result, user_agent]
  );
};