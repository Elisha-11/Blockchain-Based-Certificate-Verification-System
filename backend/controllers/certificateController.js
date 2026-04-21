const certService = require('../services/certificateService');
const { z } = require('zod');

const issueSchema = z.object({
  student_name: z.string().min(2, 'Student name required'),
  program: z.string().min(2, 'Program required'),
  institution_id: z.string().uuid('Valid institution_id (UUID) required'),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date format: YYYY-MM-DD'),
  student_id: z.string().uuid().optional(),
  cert_id: z.string().min(1).optional()
});

exports.issue = async (req, res) => {
  try {
    console.log('Issuance request body:', req.body);
    
    const data = issueSchema.parse(req.body);
    console.log('Schema validated:', data);
    
    const result = await certService.issueCertificate(data);
    console.log('Certificate issued:', result?.cert_id);
    
    // Safety check: ensure result exists
    if (!result || !result.cert_id) {
      throw new Error('Certificate issuance returned undefined result');
    }
    
    res.status(201).json(result);
  } catch (err) {
    console.error(' Issuance error:', err);
    
    // Safe Zod error handling
    if (err instanceof z.ZodError) {
      const firstError = err.errors?.[0]?.message || 'Validation failed';
      return res.status(400).json({ error: firstError });
    }
    
    // Safe generic error handling
    const errorMsg = err.message || 'Unknown error';
    res.status(500).json({ error: 'Certificate issuance failed', details: errorMsg });
  }
};