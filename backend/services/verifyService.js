const certRepo = require('../repositories/certificateRepository');
const logRepo = require('../repositories/logRepository');
const pool = require('../config/db');
const { generateDeterministicHash } = require('../utils/crypto');
const { ethers } = require('ethers');

/**
 * Helper: Convert MySQL date to YYYY-MM-DD string for consistent hashing.
 * @param {Date|string} date 
 * @returns {string}
 */
const formatDate = (date) => {
  if (!date) return '';
  // Since repository now returns raw strings via CAST AS CHAR, 
  // this primarily handles edge cases or direct object usage
  if (typeof date === 'string') return date.trim();
  if (date instanceof Date) {
    return date.toISOString().split('T')[0];
  }
  return String(date).trim();
};

/**
 * Helper: Safely parse JSON metadata from the database.
 * @param {string|Object} metadata 
 * @returns {Object}
 */
const parseMetadata = (metadata) => {
  if (!metadata) return {};
  if (typeof metadata === 'string') {
    try {
      return JSON.parse(metadata);
    } catch (error) {
      console.error('[VerifyService] Failed to parse metadata JSON:', error.message);
      return {};
    }
  }
  return metadata;
};

/**
 * Verifies a certificate against the database and blockchain.
 * @param {string} cert_id 
 * @param {Object} context - Contains verifier_ip and user_agent
 * @returns {Object} Verification result
 */
exports.verifyCertificate = async (cert_id, context = {}) => {
  console.log('[VerifyService] Initiating verification for:', cert_id);
  
  // 1. Fetch certificate and institution details using a JOIN
  const [rows] = await pool.query(
    `SELECT c.*, i.name as institution_name, i.code as institution_code 
     FROM certificates c 
     LEFT JOIN institutions i ON c.institution_id = i.institution_id 
     WHERE c.cert_id = ?`,
    [cert_id]
  );

  const cert = rows[0];

  if (!cert) {
    await logRepo.create({ 
      cert_id, 
      verifier_ip: context.verifier_ip, 
      result: 'not_found', 
      user_agent: context.user_agent 
    });
    return { 
      valid: false, 
      status: 'NOT_FOUND', 
      cert_id, 
      message: 'Certificate not found in the national registry.' 
    };
  }

  // 2. Parse metadata and construct the exact hash input object
  const metadata = parseMetadata(cert.metadata);
  
  const hashInput = {
    cert_id: String(cert.cert_id || '').trim(),
    certificate_type: cert.certificate_type || 'university',
    student_name: String(cert.student_name || '').trim(),
    institution_id: String(cert.institution_id || '').trim(),
    issue_date: formatDate(cert.issue_date),
    candidate_number: cert.candidate_number ? String(cert.candidate_number).trim() : null,
    program: cert.program ? String(cert.program).trim() : null,
    metadata: metadata
  };

  console.log('[VerifyService] Hash input constructed:', hashInput);

  // 3. Recompute hash using the deterministic method
  const recomputedHash = generateDeterministicHash(hashInput);

  console.log('[VerifyService] Recomputed hash:', recomputedHash);
  console.log('[VerifyService] Stored hash:    ', cert.cert_hash);
  console.log('[VerifyService] DB Match:       ', recomputedHash === cert.cert_hash);

  // 4. Check MySQL hash match
  const mysqlHashMatches = recomputedHash === cert.cert_hash;

  // 5. Check Blockchain hash match with enhanced debugging
  let blockchainVerified = false;
  let blockchainError = null;

  try {
    console.log('[VerifyService] Checking blockchain for hash...');
    
    const { CONTRACT_ADDRESS, contract, provider } = require('../config/blockchain');
    console.log('[VerifyService] Contract address:', CONTRACT_ADDRESS);

    // DEBUGGING: Verify contract is actually deployed at this address
    try {
      const code = await provider.getCode(CONTRACT_ADDRESS);
      console.log('[VerifyService] Contract code length:', code.length);
      
      if (code === '0x') {
        console.error('[VerifyService] FATAL: Contract address is empty (not deployed)');
        throw new Error('Contract not deployed at specified address');
      }
    } catch (contractCheckErr) {
      console.error('[VerifyService] Contract deployment check failed:', contractCheckErr.message);
      throw contractCheckErr; // Re-throw to be caught by outer try-catch
    }
    
    const certIdBytes = ethers.id(cert.cert_id);
    const hashBytes = ethers.toBeArray('0x' + cert.cert_hash);
    
    const result = await contract.verifyCertificate(certIdBytes, hashBytes);
    blockchainVerified = Boolean(result);
    
    console.log('[VerifyService] Blockchain verification result:', blockchainVerified);
  } catch (err) {
    console.error('[VerifyService] Blockchain check failed:', err.message);
    console.error('[VerifyService] Error code:', err.code);
    blockchainError = err.message;
  }

  // 6. Determine final validity status
  const isRevoked = cert.status === 'revoked';
  let resultStatus, message;
  
  if (isRevoked) {
    resultStatus = 'revoked';
    message = 'This certificate has been officially revoked by the issuing institution.';
  } else if (!mysqlHashMatches) {
    resultStatus = 'invalid';
    message = 'Certificate integrity check failed. Database hash mismatch indicates tampering.';
  } else if (!blockchainVerified && !blockchainError) {
    resultStatus = 'invalid';
    message = 'Certificate hash not found on the blockchain registry.';
  } else {
    resultStatus = 'valid';
    message = 'Certificate is authentic and verified on the blockchain.';
  }

  // 7. Log the verification attempt for audit trails
  await logRepo.create({ 
    cert_id, 
    verifier_ip: context.verifier_ip, 
    result: resultStatus, 
    user_agent: context.user_agent 
  });

  // 8. Format the details payload based on certificate type
  const details = {
    student_name: cert.student_name,
    institution_name: cert.institution_name || 'Unknown Institution',
    institution_code: cert.institution_code || 'N/A',
    issue_date: formatDate(cert.issue_date),
    cert_hash_preview: cert.cert_hash.substring(0, 16) + '...'
  };

  if (cert.certificate_type === 'grade12') {
    details.candidate_number = cert.candidate_number;
    details.subjects = metadata.subjects || [];
  } else {
    // Default to university or technical certificates
    details.program = cert.program;
    details.class_of_degree = metadata.class_of_degree || 'Not Specified';
  }

  // 9. Return the final structured response
  return {
    valid: resultStatus === 'valid',
    status: resultStatus.toUpperCase(),
    certificate_type: cert.certificate_type || 'university',
    cert_id: cert.cert_id,
    message,
    details,
    verification: {
      mysql_hash_match: mysqlHashMatches,
      blockchain_verified: blockchainVerified,
      blockchain_error: blockchainError
    }
  };
};