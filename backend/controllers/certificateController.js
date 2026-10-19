// backend/controllers/certificateController.js
const certService = require('../services/certificateService');
const institutionRepo = require('../repositories/institutionRepository');
const auditRepo = require('../repositories/auditRepository');
const { CLASSIFICATIONS } = require('../utils/classification');

/**
 * Who performed the action, for the regulator audit trail. Captured here
 * rather than in the service so the service stays free of Express types.
 */
const actorFrom = (req) => ({
  user_id: req.user?.user_id || null,
  email: req.user?.email || null,
  ip: req.ip,
  user_agent: req.headers['user-agent']
});

/**
 * Which certificate_type values each kind of institution is authorized to
 * issue. UNZA/CBU (type 'university') and any 'college' issue degrees and
 * diplomas; ECZ (type 'examination_council') issues examination results;
 * ZAQA (type 'regulatory_body') issues nothing — it only qualifies other
 * institutions via PATCH /api/institutions/:id/status.
 */
const ALLOWED_CERT_TYPES_BY_INSTITUTION_TYPE = {
  university: ['university', 'technical'],
  college: ['university', 'technical'],
  examination_council: ['examination'],
  regulatory_body: []
};

// ✅ ZOD V4/V3 COMPATIBLE IMPORT FOR COMMONJS
let z, ZodError;
try {
  const zod = require('zod');
  // Zod v4 exports z inside namespace; v3 exports directly
  z = zod.z || zod.default?.z || zod;
  ZodError = zod.ZodError || zod.ZodParseError || (zod.default && zod.default.ZodError);
} catch (e) {
  console.error('[CertificateController] Failed to load Zod:', e.message);
  throw new Error('Zod library is required but failed to initialize');
}

// Base fields common to ALL certificate types
const baseCertSchema = z.object({
  student_name: z.string().min(2, 'Student name required').trim(),
  institution_id: z.string().uuid('Valid institution_id (UUID) required'),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date format: YYYY-MM-DD'),
  cert_id: z.string().min(1).optional()
});

// Student ID is the institution's own 10-digit student number, not a UUID.
const studentIdSchema = z.string().regex(/^\d{10}$/, 'Student ID must be a 10-digit number').nullable().optional();

// The one classification vocabulary shared by every credential type. Legacy
// degree classes ('First Class', 'Second Class Upper', ...) are rejected
// rather than silently accepted, so the stored vocabulary stays consistent —
// certificates issued under the old values keep their original metadata and
// are unaffected.
const classificationSchema = z
  .enum(CLASSIFICATIONS, {
    message: `classification must be one of: ${CLASSIFICATIONS.join(', ')}`
  })
  .nullable()
  .optional();

// University-specific schema (strictly typed)
const universitySchema = baseCertSchema.extend({
  certificate_type: z.literal('university'),
  student_id: studentIdSchema,
  program: z.string().min(2, 'Program name required for university certificates'),
  classification: classificationSchema,
  // Legacy alias for 'classification', kept so an older client still works.
  // The service reads classification first and falls back to this.
  class_of_degree: classificationSchema
});

// Examination schema covers every ECZ result type (Grade 7, Grade 9, Grade 12,
// GCE) — they share the same shape (candidate number + subjects/grades) and
// differ only by the 'level' field.
const examinationSchema = baseCertSchema.extend({
  certificate_type: z.literal('examination'),
  level: z.enum(['grade7', 'grade9', 'grade12', 'gce'], {
    message: 'level must be one of: grade7, grade9, grade12, gce'
  }),
  candidate_number: z.string().min(1, 'Candidate number required for examination certificates'),
  subjects: z.array(z.object({
    code: z.string().min(1, 'Subject code required'),
    // Constrained to the ECZ 1-9 scale because the certificate's
    // classification is derived by summing these as aggregate points — a
    // free-text grade would silently drop out of that calculation.
    grade: z.string().regex(/^[1-9]$/, 'Subject grade must be a single digit 1-9')
  })).min(1, 'At least one subject required for examination certificates')
  // No classification field: it is derived from the grades above, never
  // submitted by the issuer. See utils/classification.js.
});

// Technical diploma-specific schema (strictly typed)
const technicalSchema = baseCertSchema.extend({
  certificate_type: z.literal('technical'),
  student_id: studentIdSchema,
  program: z.string().min(2, 'Program name required for technical certificates'),
  diploma_type: z.string().min(1, 'Diploma type required for technical certificates'),
  classification: classificationSchema
});

// Discriminated union automatically validates based on certificate_type value
const issueSchema = z.discriminatedUnion('certificate_type', [
  universitySchema,
  examinationSchema,
  technicalSchema
]);

/**
 * Records an issuance the system refused outright — a de-qualified institution
 * or one reaching for a credential type outside its mandate. These never reach
 * the service layer, so without this they would leave no trace at all, which
 * is the opposite of what a regulator needs from an audit trail.
 */
const refuseIssuance = (req, data, reason) =>
  auditRepo.record({
    event_type: 'issuance_failed',
    cert_id: null,
    institution_id: data.institution_id,
    actor_user_id: req.user?.user_id || null,
    actor_email: req.user?.email || null,
    actor_ip: req.ip,
    user_agent: req.headers['user-agent'],
    student_name: data.student_name,
    certificate_type: data.certificate_type,
    classification: null,
    detail: `Refused: ${reason}`
  });

/**
 * POST /api/certificates
 * Issues a new certificate with type-specific validation.
 */
exports.issue = async (req, res) => {
  try {
    console.log('[CertificateController] Issuance request:', req.body);
    
    const data = issueSchema.parse(req.body);
    console.log('[CertificateController] Validated type:', data.certificate_type);

    // Enforce ZAQA-regulated issuance rules: an institution must be qualified
    // (is_active) and may only issue the credential types its institution
    // type is authorized for. super_admin bypasses this (system-wide account,
    // not bound to a single institution's mandate).
    if (req.user.role !== 'super_admin') {
      const institution = await institutionRepo.findById(req.user.institutionId);

      if (!institution) {
        return res.status(403).json({ error: 'Institution not found for this account' });
      }
      if (!institution.is_active) {
        const error = `${institution.name} is not currently qualified by ZAQA to issue credentials`;
        await refuseIssuance(req, data, error);
        return res.status(403).json({ error });
      }

      const allowedTypes = ALLOWED_CERT_TYPES_BY_INSTITUTION_TYPE[institution.type] || [];
      if (!allowedTypes.includes(data.certificate_type)) {
        const error = `${institution.name} is not authorized to issue '${data.certificate_type}' credentials`;
        await refuseIssuance(req, data, error);
        return res.status(403).json({ error });
      }
    }

    const result = await certService.issueCertificate(data, actorFrom(req));
    
    if (!result?.cert_id) {
      throw new Error('Service returned invalid issuance result');
    }
    
    res.status(201).json(result);
    
  } catch (err) {
    console.error('[CertificateController] Issuance error:', err.message);
    
    // ✅ Universal Zod error handling (v3 + v4 compatible)
    if (err instanceof ZodError) {
      const issues = err.issues || err.errors; // v4 uses 'issues', v3 uses 'errors'
      const firstError = issues?.[0];
      return res.status(400).json({ 
        error: firstError?.message || 'Validation failed',
        field: firstError?.path?.join('.') || null
      });
    }
    
    res.status(500).json({ 
      error: 'Certificate issuance failed', 
      details: err.message 
    });
  }
};

/**
 * GET /api/certificates/my-institution?page=1&limit=20&search=&status=
 * Returns scoped certificates with search and status filtering.
 */
exports.getMyInstitutionCerts = async (req, res) => {
  try {
    const institutionId = req.user.institutionId;
    
    if (!institutionId) {
      return res.status(403).json({ error: 'No institution associated with account' });
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    
    const filters = {
      search: req.query.search?.trim() || null,
      status: (req.query.status && req.query.status !== 'all') 
        ? req.query.status 
        : null
    };

    const result = await certService.getCertificatesByInstitution(
      institutionId, 
      page, 
      limit, 
      filters
    );
    res.json(result);
  } catch (err) {
    console.error('[CertificateController] Fetch failed:', err.message);
    res.status(500).json({ error: 'Failed to fetch certificates', details: err.message });
  }
};

/**
 * ✅ NEW: GET /api/certificates/:id
 * Fetches a single certificate with institution details for detail/print view.
 * Includes security check for institutional ownership.
 */
exports.getById = async (req, res) => {
  try {
    // Use findById which includes the JOIN for institution_name and institution_code
    const cert = await certService.repository.findById(req.params.id);
    
    if (!cert) {
      return res.status(404).json({ error: 'Certificate not found' });
    }

    // Security check: Ensure user belongs to same institution or is super_admin
    if (
      cert.institution_id !== req.user.institutionId && 
      req.user.role !== 'super_admin'
    ) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(cert);
  } catch (err) {
    console.error('[CertificateController] Get by ID failed:', err.message);
    res.status(500).json({ 
      error: 'Failed to fetch certificate', 
      details: err.message 
    });
  }
};

/**
 * POST /api/certificates/:id/retry-blockchain
 * Retries blockchain registration for failed certificates.
 */
exports.retryBlockchain = async (req, res) => {
  try {
    const { id } = req.params;
    
    const cert = await certService.repository.findByIdRaw(id);
    if (!cert) {
      return res.status(404).json({ error: 'Certificate not found' });
    }

    if (cert.institution_id !== req.user.institutionId && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Access denied: Certificate belongs to different institution' });
    }

    const result = await certService.retryBlockchainRegistration(id, actorFrom(req));
    res.json(result);
  } catch (err) {
    console.error('[CertificateController] Retry failed:', err.message);
    
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    if (err.message.includes('Cannot retry')) {
      return res.status(409).json({ error: err.message });
    }
    
    res.status(500).json({ error: 'Blockchain retry failed', details: err.message });
  }
};

/**
 * GET /api/certificates/:id/presentation
 * Public endpoint - NO AUTHENTICATION REQUIRED.
 */
exports.getPresentationConfig = async (req, res) => {
  try {
    const cert = await certService.repository.findByIdRaw(req.params.id);
    
    if (!cert) {
      return res.status(404).json({ error: 'Certificate not found' });
    }

    const config = certService.getPresentationConfig(cert.certificate_type);
    
    res.json({
      certificate_type: cert.certificate_type,
      ui_config: config
    });
  } catch (err) {
    console.error('[CertificateController] Config fetch failed:', err.message);
    res.status(500).json({ error: 'Failed to get presentation config' });
  }
};

/**
 * POST /api/certificates/:id/revoke
 * Revokes a certificate with mandatory audit reason.
 */
exports.revokeCertificate = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({ error: 'Revocation reason must be at least 10 characters' });
    }

    const cert = await certService.repository.findByIdRaw(id);
    if (!cert) return res.status(404).json({ error: 'Certificate not found' });

    if (cert.institution_id !== req.user.institutionId && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Access denied: Cannot revoke certificates from other institutions' });
    }
    if (cert.status === 'revoked') {
      return res.status(409).json({ error: 'Certificate already revoked' });
    }

    const result = await certService.revokeCertificate(id, req.user.userId, reason.trim(), actorFrom(req));
    res.json(result);
  } catch (err) {
    console.error('[CertificateController] Revocation failed:', err.message);
    res.status(500).json({ error: 'Revocation failed', details: err.message });
  }
};