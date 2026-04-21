const certRepo = require('../repositories/certificateRepository');
const logRepo = require('../repositories/logRepository');
const { generateDeterministicHash } = require('../utils/crypto');

exports.verifyCertificate = async (cert_id, context = {}) => {
  console.log('🔍 Verifying certificate:', cert_id);
  
  // 1. Fetch certificate from MySQL
  const cert = await certRepo.findById(cert_id);
  if (!cert) {
    await logRepo.create({ cert_id, verifier_ip: context.verifier_ip, result: 'not_found', user_agent: context.user_agent });
    return { valid: false, status: 'NOT_FOUND', cert_id, message: 'Certificate not found in system' };
  }

  // 2. Recompute hash using SAME deterministic method as issuance
  const recomputedHash = generateDeterministicHash({
    cert_id: cert.cert_id,
    student_name: cert.student_name,
    program: cert.program,
    institution_id: cert.institution_id,
    issue_date: cert.issue_date
  });

  // 3. Compare hashes and determine result
  const hashMatches = recomputedHash === cert.cert_hash;
  const isRevoked = cert.status === 'revoked';
  
  let result, message;
  if (isRevoked) {
    result = 'revoked';
    message = 'Certificate has been revoked by issuing institution';
  } else if (!hashMatches) {
    result = 'invalid';
    message = 'Certificate data has been tampered with';
  } else {
    result = 'valid';
    message = 'Certificate is authentic and valid';
  }

  // 4. Log verification attempt
  await logRepo.create({ 
    cert_id, 
    verifier_ip: context.verifier_ip, 
    result, 
    user_agent: context.user_agent 
  });

  // 5. Return result
  return {
    valid: result === 'valid',
    status: result.toUpperCase(),
    cert_id: cert.cert_id,
    message,
    details: {
      student_name: cert.student_name,
      program: cert.program,
      institution_id: cert.institution_id,
      issue_date: cert.issue_date,
      cert_hash_preview: cert.cert_hash.substring(0, 16) + '...'
    }
  };
};