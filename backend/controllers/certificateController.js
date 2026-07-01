const certService = require('../services/certificateService');
const { z } = require('zod');

// Updated schema to support both University and Grade 12 credentials
const issueSchema = z.object({
  certificate_type: z.enum(['university', 'grade12', 'technical']).default('university'),
  student_name: z.string().min(2, 'Student name required').trim(),
  institution_id: z.string().uuid('Valid institution_id (UUID) required'),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date format: YYYY-MM-DD'),
  
  // University specific fields (optional for Grade 12)
  student_id: z.string().uuid().optional().nullable(),
  program: z.string().optional().nullable(),
  class_of_degree: z.string().optional().nullable(),
  
  // Grade 12 specific fields (optional for University)
  candidate_number: z.string().optional().nullable(),
  subjects: z.array(z.object({
    code: z.string().min(1, 'Subject code required'),
    grade: z.string().min(1, 'Subject grade required')
  })).optional().nullable(),
  
  cert_id: z.string().min(1).optional()
});

exports.issue = async (req, res) => {
  try {
    console.log('[CertificateController] Issuance request body:', req.body);
    
    // 1. Parse and validate the base schema
    const data = issueSchema.parse(req.body);
    console.log('[CertificateController] Schema validated:', data);
    
    // 2. Apply conditional validation based on certificate type
    if (data.certificate_type === 'university' && !data.program) {
      return res.status(400).json({ error: 'Program is required for university certificates' });
    }
    
    if (data.certificate_type === 'grade12') {
      if (!data.candidate_number) {
        return res.status(400).json({ error: 'Candidate number is required for Grade 12 certificates' });
      }
      if (!data.subjects || data.subjects.length === 0) {
        return res.status(400).json({ error: 'At least one subject is required for Grade 12 certificates' });
      }
    }
    
    // 3. Pass validated data to the service layer
    const result = await certService.issueCertificate(data);
    console.log('[CertificateController] Certificate issued:', result?.cert_id);
    
    // Safety check: ensure result exists
    if (!result || !result.cert_id) {
      throw new Error('Certificate issuance returned undefined result');
    }
    
    res.status(201).json(result);
  } catch (err) {
    console.error('[CertificateController] Issuance error:', err);
    
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