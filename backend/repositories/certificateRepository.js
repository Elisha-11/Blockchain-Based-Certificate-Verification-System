const pool = require('../config/db');

exports.create = async (certData) => {
  console.log('Repo: Creating certificate', certData.cert_id);
  
  const { cert_id, student_id, student_name, program, institution_id, issue_date, cert_hash } = certData;
  
  try {
    const [result] = await pool.query(
      `INSERT INTO certificates 
       (cert_id, student_id, student_name, program, institution_id, issue_date, cert_hash, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
      [cert_id, student_id || null, student_name, program, institution_id, issue_date, cert_hash]
    );
    
    console.log('Repo: Insert successful');
    
    // CRITICAL: Return the certificate data explicitly
    return { 
      cert_id, 
      student_id: student_id || null,
      student_name, 
      program, 
      institution_id, 
      issue_date, 
      cert_hash,
      status: 'active'
    };
  } catch (err) {
    console.error(' Repo: Insert failed:', err.message);
    console.error(' Repo: Error code:', err.code);
    throw err; // Re-throw so service can catch it
  }
};
exports.findById = async (certId) => {
  // Use DATE_FORMAT to return issue_date as 'YYYY-MM-DD' string
  const [rows] = await pool.query(
    `SELECT 
       cert_id, 
       student_id, 
       student_name, 
       program, 
       institution_id, 
       DATE_FORMAT(issue_date, '%Y-%m-%d') AS issue_date,  
       cert_hash, 
       status,
       created_at,
       updated_at
     FROM certificates 
     WHERE cert_id = ?`,
    [certId]
  );
  return rows[0] || null;
};


