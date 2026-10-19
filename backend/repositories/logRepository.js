const pool = require('../config/db');

/**
 * How the verifier arrived at the certificate they checked. 'id' is a typed
 * certificate number, 'qr' a scanned code, 'upload' a document file whose
 * identifier was read out of the file itself.
 */
const VERIFICATION_METHODS = ['id', 'qr', 'upload'];

exports.create = async (logData) => {
  const {
    cert_id,
    verifier_ip,
    result,
    user_agent,
    verification_method,
    document_sha256
  } = logData;

  // Falls back to 'id' rather than trusting the caller, so an unrecognised
  // value cannot abort the insert and lose the audit entry entirely.
  const method = VERIFICATION_METHODS.includes(verification_method)
    ? verification_method
    : 'id';

  // A SHA-256 hex digest is exactly 64 characters; anything else is not one,
  // and storing it would make the column useless for matching repeat
  // submissions of the same document.
  const documentHash = /^[0-9a-f]{64}$/i.test(String(document_sha256 || ''))
    ? String(document_sha256).toLowerCase()
    : null;

  await pool.query(
    `INSERT INTO verification_logs
       (cert_id, verifier_ip, result, user_agent, verification_method, document_sha256)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      cert_id,
      verifier_ip,
      result,
      user_agent ? String(user_agent).substring(0, 255) : null,
      method,
      documentHash
    ]
  );
};

exports.VERIFICATION_METHODS = VERIFICATION_METHODS;
