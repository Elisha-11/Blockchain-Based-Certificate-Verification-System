const verifyService = require('../services/verifyService');
const { z } = require('zod');

const verifySchema = z.object({
  cert_id: z.string().min(1, 'Certificate ID is required'),
  // How the verifier found this certificate. Recorded for the regulator's
  // verification log; it never affects the verification result itself.
  verification_method: z.enum(['id', 'qr', 'upload']).optional(),
  // SHA-256 of an uploaded document, when the certificate ID was read out of
  // a file. Fingerprinting the file is what makes repeat submissions of the
  // same forged document visible in the log.
  document_sha256: z.string().regex(/^[0-9a-f]{64}$/i, 'document_sha256 must be a SHA-256 hex digest').optional()
});

exports.verify = async (req, res) => {
  try {
    const { cert_id, verification_method, document_sha256 } = verifySchema.parse(req.body);
    const result = await verifyService.verifyCertificate(cert_id, {
      verifier_ip: req.ip,
      user_agent: req.headers['user-agent'],
      verification_method,
      document_sha256
    });
    res.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      // Zod v4 exposes '.issues'; '.errors' only exists in v3. Reading
      // '.errors[0]' on v4 threw a TypeError, which Express turned into a
      // 500 with a stack trace instead of this 400.
      const issues = err.issues || err.errors || [];
      return res.status(400).json({
        error: issues[0]?.message || 'Invalid request body'
      });
    }
    console.error(' Verification error:', err);
    res.status(500).json({ error: 'Verification failed', details: err.message });
  }
};
