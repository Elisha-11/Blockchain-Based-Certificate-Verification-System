// backend/controllers/auditController.js
const auditRepo = require('../repositories/auditRepository');

/**
 * Regulator oversight endpoints. Access is gated by middleware/rbac
 * requireRegulator — these controllers assume the caller is already
 * established as ZAQA (or a super_admin) and so apply no institution scoping
 * of their own: seeing every institution at once is the point.
 */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/admin/audit-logs
 *
 * Query: event_type, institution_id, from, to, search, page, limit
 */
exports.list = async (req, res) => {
  try {
    const { event_type, institution_id, from, to, search, page, limit } = req.query;

    // Rejected rather than ignored: silently dropping a malformed date filter
    // would show the regulator a wider result set than they asked for and let
    // them believe they had reviewed a specific window.
    for (const [name, value] of Object.entries({ from, to })) {
      if (value && !DATE_PATTERN.test(value)) {
        return res.status(400).json({ error: `${name} must be a date in YYYY-MM-DD format` });
      }
    }

    if (event_type && !auditRepo.EVENT_TYPES.includes(event_type)) {
      return res.status(400).json({
        error: `event_type must be one of: ${auditRepo.EVENT_TYPES.join(', ')}`
      });
    }

    const result = await auditRepo.findAll(
      { event_type, institution_id, from, to, search },
      page,
      limit
    );

    res.json(result);
  } catch (err) {
    console.error('[AuditController] Failed to list audit logs:', err.message);
    res.status(500).json({ error: 'Failed to load audit log', details: err.message });
  }
};

/**
 * GET /api/admin/audit-logs/summary
 *
 * Per-institution issuance/failure/revocation counts plus the classification
 * distribution, for the regulator's overview cards.
 */
exports.summary = async (req, res) => {
  try {
    const [institutions, classifications] = await Promise.all([
      auditRepo.summaryByInstitution(),
      auditRepo.classificationBreakdown()
    ]);

    const totals = institutions.reduce(
      (acc, row) => ({
        issued: acc.issued + Number(row.issued),
        failed: acc.failed + Number(row.failed),
        revoked: acc.revoked + Number(row.revoked)
      }),
      { issued: 0, failed: 0, revoked: 0 }
    );

    res.json({ totals, institutions, classifications });
  } catch (err) {
    console.error('[AuditController] Failed to build summary:', err.message);
    res.status(500).json({ error: 'Failed to load audit summary', details: err.message });
  }
};
