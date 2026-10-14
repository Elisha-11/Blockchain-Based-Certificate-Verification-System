// backend/controllers/institutionController.js
const institutionRepo = require('../repositories/institutionRepository');

/**
 * Only ZAQA (the regulatory_body institution) or a super_admin may qualify
 * institutions. Checked against a fresh DB read, not the JWT, so a change in
 * institution type/role takes effect immediately rather than waiting for the
 * admin's token to expire.
 */
async function assertIsRegulator(req, res) {
  if (req.user.role === 'super_admin') return true;

  const institution = await institutionRepo.findById(req.user.institutionId);
  if (!institution || institution.type !== 'regulatory_body') {
    res.status(403).json({ error: 'Only the qualifications regulator (ZAQA) can manage institutions' });
    return false;
  }
  return true;
}

/**
 * GET /api/institutions
 * Lists every institution with its qualification (is_active) status.
 * Restricted to the regulator so other institutions can't see each other's
 * standing — the public, single-institution lookup stays on GET /:id.
 */
exports.list = async (req, res) => {
  try {
    if (!(await assertIsRegulator(req, res))) return;

    const institutions = await institutionRepo.findAll();
    res.json({ institutions });
  } catch (err) {
    console.error('[InstitutionController] List failed:', err.message);
    res.status(500).json({ error: 'Failed to fetch institutions' });
  }
};

/**
 * PATCH /api/institutions/:id/status
 * Qualifies (activates) or suspends an institution's authority to issue and
 * verify credentials. ZAQA cannot suspend itself out of the regulator seat.
 */
exports.setStatus = async (req, res) => {
  try {
    if (!(await assertIsRegulator(req, res))) return;

    const { id } = req.params;
    const { is_active } = req.body;

    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ error: 'is_active (boolean) is required' });
    }

    const target = await institutionRepo.findById(id);
    if (!target) return res.status(404).json({ error: 'Institution not found' });

    if (target.type === 'regulatory_body' && !is_active) {
      return res.status(400).json({ error: 'The regulator institution cannot be deactivated' });
    }

    await institutionRepo.setActiveStatus(id, is_active);
    res.json({ success: true, institution_id: id, is_active });
  } catch (err) {
    console.error('[InstitutionController] setStatus failed:', err.message);
    res.status(500).json({ error: 'Failed to update institution status' });
  }
};
