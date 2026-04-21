const verifyService = require('../services/verifyService');
const { z } = require('zod');

const verifySchema = z.object({
  cert_id: z.string().min(1, 'Certificate ID is required')
});

exports.verify = async (req, res) => {
  try {
    const { cert_id } = verifySchema.parse(req.body);
    const result = await verifyService.verifyCertificate(cert_id, {
      verifier_ip: req.ip,
      user_agent: req.headers['user-agent']
    });
    res.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    console.error('❌ Verification error:', err);
    res.status(500).json({ error: 'Verification failed', details: err.message });
  }
};