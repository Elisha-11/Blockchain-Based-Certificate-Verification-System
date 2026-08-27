// backend/repositories/certificateRepository.js
const pool = require('../config/db');

/**
 * Normalizes any DB date representation into a clean "YYYY-MM-DD" string.
 *
 * IMPORTANT: mysql2 returns DATE columns as native JS Date objects, NOT strings.
 * Calling String(dateObject) invokes Date.prototype.toString(), which produces
 * a format like "Sat Aug 15 2026 00:00:00 GMT+0200 (...)" — NOT an ISO string.
 * Slicing the first 10 characters of that gives "Sat Aug 15", which silently
 * drops the year and corrupts any downstream hash/verification logic.
 *
 * This function checks for a Date instance FIRST and extracts
 * year/month/day directly via the Date API, avoiding toString() entirely.
 */
const normalizeDbDate = (val) => {
  if (!val) return null;

  if (val instanceof Date) {
    const yyyy = val.getFullYear();
    const mm = String(val.getMonth() + 1).padStart(2, '0');
    const dd = String(val.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  // Already a string (e.g. "2026-08-15" or an ISO timestamp) — just trim it.
  return String(val).substring(0, 10);
};

/**
 * Maps raw database rows to clean domain objects.
 * Separates data transformation from data access (SRP).
 */
const mapCertificateRow = (row) => {
  if (!row) return null;

  const cert = { ...row };

  // Normalize date format safely (Date object or string -> "YYYY-MM-DD")
  if (cert.issue_date) {
    cert.issue_date = normalizeDbDate(cert.issue_date);
  }

  // Safely parse metadata JSON
  if (cert.metadata && typeof cert.metadata === 'string') {
    try {
      cert.metadata = JSON.parse(cert.metadata);
    } catch (e) {
      console.warn(`[CertificateRepository] Failed to parse metadata for ${cert.cert_id}:`, e.message);
      cert.metadata = {};
    }
  }

  return cert;
};

/**
 * CertificateRepository - Information Expert for certificate persistence.
 * Knows how to store, retrieve, and filter certificates based on DB schema.
 */
exports.create = async (certData) => {
  console.log('[CertificateRepository] Creating certificate:', certData.cert_id);

  const {
    cert_id,
    certificate_type,
    student_id,
    student_name,
    program,
    institution_id,
    issue_date,
    candidate_number,
    cert_hash,
    metadata
  } = certData;

  try {
    await pool.query(
      `INSERT INTO certificates 
       (cert_id, certificate_type, student_id, student_name, program, 
        institution_id, issue_date, candidate_number, cert_hash, metadata, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_blockchain')`,
      [
        cert_id,
        certificate_type || 'university',
        student_id || null,
        student_name,
        program || null,
        institution_id,
        issue_date,
        candidate_number || null,
        cert_hash,
        metadata ? JSON.stringify(metadata) : null
      ]
    );
    console.log('[CertificateRepository] Insert successful');
  } catch (err) {
    console.error('[CertificateRepository] Insert failed:', err.message);
    throw err;
  }
};

/**
 * Finds a single certificate by ID with institution details.
 * Returns null if not found (no exception thrown for missing records).
 */
exports.findById = async (certId) => {
  const [rows] = await pool.query(
    `SELECT c.*, i.name as institution_name, i.code as institution_code
     FROM certificates c
     LEFT JOIN institutions i ON c.institution_id = i.institution_id
     WHERE c.cert_id = ?`,
    [certId]
  );

  return mapCertificateRow(rows[0]);
};

/**
 * GRASP Information Expert: Filters certificates by institution with search/status support.
 * Uses parameterized queries ONLY - never concatenates user input.
 * INCLUDES LEFT JOIN FOR INSTITUTION NAME DISPLAY IN FRONTEND
 */
exports.findByInstitutionId = async (institutionId, page = 1, limit = 20, filters = {}) => {
  const offset = (page - 1) * limit;

  let query = `SELECT c.*, i.name as institution_name, i.code as institution_code
               FROM certificates c
               LEFT JOIN institutions i ON c.institution_id = i.institution_id
               WHERE c.institution_id = ?`;
  const params = [institutionId];

  // Safe filter application using parameterized queries
  if (filters.search) {
    query += ` AND (c.student_name LIKE ? OR c.cert_id LIKE ? OR c.program LIKE ?)`;
    const searchParam = `%${filters.search}%`;
    params.push(searchParam, searchParam, searchParam);
  }

  if (filters.status) {
    query += ` AND c.status = ?`;
    params.push(filters.status);
  }

  query += ` ORDER BY c.created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const [rows] = await pool.query(query, params);
  return rows.map(mapCertificateRow);
};

/**
 * Counts total certificates matching institution and optional filters.
 */
exports.countByInstitutionId = async (institutionId, filters = {}) => {
  let query = `SELECT COUNT(*) as total FROM certificates WHERE institution_id = ?`;
  const params = [institutionId];

  if (filters.search) {
    query += ` AND (student_name LIKE ? OR cert_id LIKE ? OR program LIKE ?)`;
    const searchParam = `%${filters.search}%`;
    params.push(searchParam, searchParam, searchParam);
  }

  if (filters.status) {
    query += ` AND status = ?`;
    params.push(filters.status);
  }

  const [rows] = await pool.query(query, params);
  return rows[0]?.total || 0;
};

/**
 * Atomically updates certificate status ONLY if currently in expected state.
 * Prevents race conditions during retry/revocation operations.
 */
exports.updateStatusIf = async (certId, currentStatus, newStatus, txHash = null) => {
  let query, params;

  if (txHash) {
    query = `UPDATE certificates 
             SET status = ?, blockchain_tx_hash = ? 
             WHERE cert_id = ? AND status = ?`;
    params = [newStatus, txHash, certId, currentStatus];
  } else {
    query = `UPDATE certificates 
             SET status = ? 
             WHERE cert_id = ? AND status = ?`;
    params = [newStatus, certId, currentStatus];
  }

  const [result] = await pool.query(query, params);
  return result.affectedRows > 0;
};

/**
 * Legacy updateStatus for simple transitions (no concurrency check).
 * Used only in issuance flow where race conditions are impossible.
 */
exports.updateStatus = async (certId, newStatus, txHash = null) => {
  const query = txHash
    ? `UPDATE certificates SET status = ?, blockchain_tx_hash = ? WHERE cert_id = ?`
    : `UPDATE certificates SET status = ? WHERE cert_id = ?`;

  const params = txHash ? [newStatus, txHash, certId] : [newStatus, certId];
  await pool.query(query, params);
  console.log(`[CertificateRepository] Status updated: ${certId} -> ${newStatus}`);
};

/**
 * Fetches raw certificate WITHOUT institution join or metadata parsing.
 * Used for retry/revocation where speed matters and full object mapping is unnecessary.
 *
 * NOTE: This bypasses mapCertificateRow, so issue_date here may still be a raw
 * Date object or DB-native value. Any caller using findByIdRaw that needs a
 * clean "YYYY-MM-DD" string should normalize it explicitly, e.g.:
 *   const { } = require('./certificateRepository'); // n/a — normalizeDbDate is internal
 * If you need normalization outside this module, prefer findById /
 * findByIdWithInstitution, which run rows through mapCertificateRow.
 */
exports.findByIdRaw = async (certId) => {
  const [rows] = await pool.query(
    `SELECT cert_id, certificate_type, student_name, program, 
            institution_id, issue_date, candidate_number, metadata, 
            cert_hash, status, blockchain_tx_hash
     FROM certificates WHERE cert_id = ?`,
    [certId]
  );
  return rows[0] || null;
};

/**
 * Fetches certificate WITH institution details via JOIN.
 * Required by VerificationService for complete verification context.
 */
exports.findByIdWithInstitution = async (certId) => {
  const [rows] = await pool.query(
    `SELECT c.*, i.name as institution_name, i.code as institution_code 
     FROM certificates c 
     LEFT JOIN institutions i ON c.institution_id = i.institution_id 
     WHERE c.cert_id = ?`,
    [certId]
  );

  return mapCertificateRow(rows[0]);
};

/**
 * Logs certificate revocation for compliance audit trail.
 * Creates immutable record in revocation_logs table.
 */
exports.logRevocation = async (certId, userId, reason) => {
  await pool.query(
    `INSERT INTO revocation_logs (cert_id, revoked_by_user_id, reason) 
     VALUES (?, ?, ?)`,
    [certId, userId, reason]
  );
  console.log(`[CertificateRepository] Revocation logged for ${certId} by ${userId}`);
};