const pool = require('../config/db');

exports.create = async (certData) => {
  const { cert_id, student_id, student_name, program, institution_id, issue_date, cert_hash } = certData;
  const [result] = await pool.query(
    `INSERT INTO certificates (cert_id, student_id, student_name, program, institution_id, issue_date, cert_hash, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
    [cert_id, student_id || null, student_name, program, institution_id, issue_date, cert_hash]
  );
  return { ...certData, db_insert_id: result.insertId };
};

exports.findById = async (certId) => {
  const [rows] = await pool.query('SELECT * FROM certificates WHERE cert_id = ?', [certId]);
  return rows[0] || null;
};