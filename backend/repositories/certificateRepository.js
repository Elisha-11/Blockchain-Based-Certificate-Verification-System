const pool = require('../config/db');

exports.create = async (certData) => {
  console.log('[CertificateRepository] Creating certificate:', certData.cert_id);

  const {
    cert_id, certificate_type, student_id, student_name, program,
    institution_id, issue_date, candidate_number, cert_hash, metadata
  } = certData;

  try {
    await pool.query(
      `INSERT INTO certificates 
       (cert_id, certificate_type, student_id, student_name, program, 
        institution_id, issue_date, candidate_number, cert_hash, metadata, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [
        cert_id, certificate_type || 'university', student_id || null,
        student_name, program || null, institution_id, issue_date,
        candidate_number || null, cert_hash, metadata ? JSON.stringify(metadata) : null
      ]
    );
    console.log('[CertificateRepository] Insert successful');
  } catch (err) {
    console.error('[CertificateRepository] Insert failed:', err.message);
    throw err;
  }
};

exports.findById = async (certId) => {
  const [rows] = await pool.query(
    `SELECT cert_id, certificate_type, student_id, student_name, program,
            institution_id, CAST(issue_date AS CHAR) AS issue_date,
            candidate_number, metadata, cert_hash, status
     FROM certificates WHERE cert_id = ?`,
    [certId]
  );

  if (rows.length === 0) return null;
  const cert = rows[0];

  // Force to plain YYYY-MM-DD regardless of what driver returns
  if (cert.issue_date) {
    cert.issue_date = String(cert.issue_date).substring(0, 10);
  }

  if (cert.metadata && typeof cert.metadata === 'string') {
    try { cert.metadata = JSON.parse(cert.metadata); }
    catch (e) { cert.metadata = {}; }
  }

  return cert;
};
















