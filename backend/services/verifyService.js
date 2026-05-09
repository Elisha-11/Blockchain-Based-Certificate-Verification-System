const certRepo = require('../repositories/certificateRepository');
const logRepo = require('../repositories/logRepository');
const { generateDeterministicHash } = require('../utils/crypto');
const { contract } = require('../config/blockchain');
const { ethers } = require('ethers');

//  HELPER: Convert MySQL date to YYYY-MM-DD string for consistent hashing
const formatDate = (date) => {
  if (!date) return '';
  if (typeof date === 'string') return date.trim(); // Already a string
  if (date instanceof Date) {
    // Convert ISO timestamp to "YYYY-MM-DD"
    return date.toISOString().split('T')[0];
  }
  return String(date).trim();
};

exports.verifyCertificate = async (cert_id, context = {}) => {
  console.log('Verifying certificate:', cert_id);
  
  // 1. Fetch certificate from MySQL
  const cert = await certRepo.findById(cert_id);
  if (!cert) {
    await logRepo.create({ cert_id, verifier_ip: context.verifier_ip, result: 'not_found', user_agent: context.user_agent });
    return { valid: false, status: 'NOT_FOUND', cert_id, message: 'Certificate not found in system' };
  }

  // 2. Recompute hash using SAME deterministic method as issuance
  console.log(' Debug - Raw DB data:', {
    student_name: cert.student_name,
    program: cert.program,
    institution_id: cert.institution_id,
    issue_date: cert.issue_date,
    issue_date_type: typeof cert.issue_date,
    issue_date_formatted: formatDate(cert.issue_date)
  });

  const recomputedHash = generateDeterministicHash({
    cert_id: String(cert.cert_id || '').trim(),
    student_name: String(cert.student_name || '').trim().toLowerCase(),
    program: String(cert.program || '').trim().toLowerCase(),
    institution_id: String(cert.institution_id || '').trim(),
    issue_date: formatDate(cert.issue_date)  //  CRITICAL: Use formatted date
  });

  console.log(' Debug - Recomputed hash:', recomputedHash);
  console.log(' Debug - Stored hash:    ', cert.cert_hash);
  console.log(' Debug - Match:          ', recomputedHash === cert.cert_hash);

  // 3. Check MySQL hash match
  const mysqlHashMatches = recomputedHash === cert.cert_hash;
  // 4. Check Blockchain hash match
let blockchainVerified = false;
let blockchainError = null;

try {
  console.log(' Checking blockchain for hash...');
  console.log(' Debug - Contract address:', contract.address);
  console.log(' Debug - Cert ID:', cert.cert_id);
  console.log(' Debug - Cert hash:', cert.cert_hash);
  
  // Convert to bytes32 format (MUST match issuance exactly)
  const certIdBytes = ethers.id(cert.cert_id);  // keccak256 hash of string → bytes32
  const hashBytes = ethers.toBeArray('0x' + cert.cert_hash); // Ensure proper bytes32 format
  
  console.log(' Debug - certIdBytes:', certIdBytes);
  console.log(' Debug - hashBytes:', ethers.hexlify(hashBytes));
  
  // Call the smart contract's view function
  const result = await contract.verifyCertificate(certIdBytes, hashBytes);
  blockchainVerified = Boolean(result);
  
  console.log('Blockchain verification result:', blockchainVerified);
} catch (err) {
  console.error(' Blockchain check failed:', err.message);
  console.error(' Error code:', err.code);
  console.error(' Error reason:', err.reason);
  blockchainError = err.message;
}

  // 5. Determine final result
  const isRevoked = cert.status === 'revoked';
  let result, message;
  
  if (isRevoked) {
    result = 'revoked';
    message = 'Certificate has been revoked by issuing institution';
  } else if (!mysqlHashMatches) {
    result = 'invalid';
    message = 'Certificate data has been tampered with (MySQL hash mismatch)';
  } else if (!blockchainVerified && !blockchainError) {
    result = 'invalid';
    message = 'Certificate hash not found on blockchain';
  } else {
    result = 'valid';
    message = 'Certificate is authentic and verified on blockchain';
  }

  // 6. Log verification attempt
  await logRepo.create({ 
    cert_id, 
    verifier_ip: context.verifier_ip, 
    result, 
    user_agent: context.user_agent 
  });

  // 7. Return result with blockchain status
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
    },
    verification: {
      mysql_hash_match: mysqlHashMatches,
      blockchain_verified: blockchainVerified,
      blockchain_error: blockchainError
    }
  };
};