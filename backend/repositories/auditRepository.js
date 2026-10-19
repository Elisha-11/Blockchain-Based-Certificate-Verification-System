// backend/repositories/auditRepository.js
const pool = require('../config/db');

/**
 * Append-only access to issuance_audit_logs — the regulator's view of what
 * every institution has been issuing, failing to issue, and revoking.
 *
 * There is deliberately no update or delete method: an audit trail the issuing
 * side can edit is not evidence of anything.
 */

const EVENT_TYPES = ['issuance_success', 'issuance_failed', 'revocation'];

/**
 * Records one audit event.
 *
 * Never throws. An audit write failing must not roll back or mask the
 * issuance/revocation the caller just performed — the caller reports the
 * failure instead, so a broken log is visible without destroying the
 * operation it was meant to describe.
 *
 * @returns {Promise<boolean>} Whether the row was written
 */
exports.record = async (event) => {
  try {
    await pool.query(
      `INSERT INTO issuance_audit_logs
         (event_type, cert_id, institution_id, actor_user_id, actor_email,
          actor_ip, user_agent, student_name, certificate_type, classification,
          blockchain_tx_hash, detail)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        event.event_type,
        event.cert_id || null,
        event.institution_id || null,
        event.actor_user_id || null,
        event.actor_email || null,
        event.actor_ip || null,
        // The column is VARCHAR(255); a long UA string would otherwise abort
        // the insert in strict mode and lose the whole audit entry.
        event.user_agent ? String(event.user_agent).substring(0, 255) : null,
        event.student_name || null,
        event.certificate_type || null,
        event.classification || null,
        event.blockchain_tx_hash || null,
        event.detail || null
      ]
    );
    return true;
  } catch (err) {
    console.error('[AuditRepository] Failed to record audit event:', err.message);
    return false;
  }
};

/**
 * Returns a page of audit events, newest first, with the institution name
 * joined in for display.
 *
 * Every filter is applied as a bound parameter, and `event_type` is checked
 * against EVENT_TYPES rather than interpolated, so a caller cannot smuggle SQL
 * through the query string.
 *
 * @param {Object} filters
 * @param {string} [filters.event_type]
 * @param {string} [filters.institution_id]
 * @param {string} [filters.from] - ISO date, inclusive
 * @param {string} [filters.to] - ISO date, inclusive
 * @param {string} [filters.search] - Matches student name or certificate ID
 * @param {number} [page=1]
 * @param {number} [limit=50]
 */
exports.findAll = async (filters = {}, page = 1, limit = 50) => {
  const conditions = [];
  const params = [];

  if (filters.event_type && EVENT_TYPES.includes(filters.event_type)) {
    conditions.push('a.event_type = ?');
    params.push(filters.event_type);
  }
  if (filters.institution_id) {
    conditions.push('a.institution_id = ?');
    params.push(filters.institution_id);
  }
  if (filters.from) {
    conditions.push('a.created_at >= ?');
    params.push(filters.from);
  }
  if (filters.to) {
    // Callers pass a plain date (YYYY-MM-DD), which would otherwise compare
    // against midnight and exclude everything logged during that day.
    conditions.push('a.created_at < DATE_ADD(?, INTERVAL 1 DAY)');
    params.push(filters.to);
  }
  if (filters.search) {
    conditions.push('(a.student_name LIKE ? OR a.cert_id LIKE ?)');
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  // LIMIT/OFFSET are coerced to integers rather than bound, because MySQL
  // rejects placeholders there in prepared statements.
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  const safePage = Math.max(parseInt(page, 10) || 1, 1);
  const offset = (safePage - 1) * safeLimit;

  const [rows] = await pool.query(
    `SELECT a.audit_id, a.event_type, a.cert_id, a.institution_id,
            a.actor_user_id, a.actor_email, a.actor_ip,
            a.student_name, a.certificate_type, a.classification,
            a.blockchain_tx_hash, a.detail, a.created_at,
            i.name AS institution_name, i.code AS institution_code
       FROM issuance_audit_logs a
       LEFT JOIN institutions i ON a.institution_id = i.institution_id
       ${where}
       ORDER BY a.created_at DESC, a.audit_id DESC
       LIMIT ${safeLimit} OFFSET ${offset}`,
    params
  );

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM issuance_audit_logs a ${where}`,
    params
  );

  return {
    events: rows,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit) || 1
    }
  };
};

/**
 * Per-institution event counts for the regulator's overview — one row per
 * institution with its successes, failures and revocations side by side.
 *
 * Driven from `institutions` so an institution that has issued nothing still
 * appears with zeroes, which is itself something a regulator wants to see.
 */
exports.summaryByInstitution = async () => {
  const [rows] = await pool.query(
    `SELECT i.institution_id, i.name AS institution_name, i.code AS institution_code,
            i.type AS institution_type, i.is_active,
            COALESCE(SUM(a.event_type = 'issuance_success'), 0) AS issued,
            COALESCE(SUM(a.event_type = 'issuance_failed'), 0)  AS failed,
            COALESCE(SUM(a.event_type = 'revocation'), 0)       AS revoked,
            MAX(a.created_at) AS last_activity
       FROM institutions i
       LEFT JOIN issuance_audit_logs a ON a.institution_id = i.institution_id
       GROUP BY i.institution_id, i.name, i.code, i.type, i.is_active
       ORDER BY i.name`
  );
  return rows;
};

/**
 * Classification distribution across all institutions, so the regulator can
 * spot an institution awarding implausibly many Distinctions.
 */
exports.classificationBreakdown = async () => {
  const [rows] = await pool.query(
    `SELECT i.code AS institution_code, i.name AS institution_name,
            a.certificate_type, a.classification, COUNT(*) AS count
       FROM issuance_audit_logs a
       LEFT JOIN institutions i ON a.institution_id = i.institution_id
      WHERE a.event_type = 'issuance_success'
        AND a.classification IS NOT NULL
      GROUP BY i.code, i.name, a.certificate_type, a.classification
      ORDER BY i.name, a.certificate_type, a.classification`
  );
  return rows;
};

exports.EVENT_TYPES = EVENT_TYPES;
