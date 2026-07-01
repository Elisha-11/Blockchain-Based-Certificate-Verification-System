const certRepo = require('../repositories/certificateRepository');
const { generateDeterministicHash } = require('../utils/crypto');
const { contract } = require('../config/blockchain');
const { ethers } = require('ethers');

exports.issueCertificate = async (data) => {
  console.log('[CertificateService] Starting issuance for:', data.student_name);
  
  const cert_id = data.cert_id || `CERT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  
  // 1. Construct metadata and type-specific fields based on certificate type
  let metadata = {};
  let program = null;
  let student_id = null;
  let candidate_number = null;

  if (data.certificate_type === 'grade12') {
    candidate_number = data.candidate_number;
    metadata = {
      exam_year: new Date(data.issue_date).getFullYear(),
      subjects: data.subjects
    };
  } else {
    // Default to university or technical
    program = data.program;
    student_id = data.student_id;
    metadata = {
      class_of_degree: data.class_of_degree
    };
  }

  // 2. Construct V2 Hash Input (Must match verifyService.js exactly)
  const hashInput = {
    cert_id,
    certificate_type: data.certificate_type,
    student_name: data.student_name,
    institution_id: data.institution_id,
    issue_date: data.issue_date,
    candidate_number,
    program,
    metadata
  };

  console.log('[CertificateService] V2 Hash input:', hashInput);
  const cert_hash = generateDeterministicHash(hashInput);
  console.log('[CertificateService] Generated V2 hash:', cert_hash);

  // 3. Save to Database
  try {
    await certRepo.create({
      cert_id,
      certificate_type: data.certificate_type,
      student_id,
      student_name: data.student_name,
      program,
      institution_id: data.institution_id,
      issue_date: data.issue_date,
      candidate_number,
      cert_hash,
      metadata
    });
    console.log('[CertificateService] Saved to DB:', cert_id);
  } catch (dbError) {
    console.error('[CertificateService] DB Insert failed:', dbError.message);
    throw dbError;
  }

  // 4. Register on Blockchain
  try {
    console.log('[CertificateService] Registering hash on Blockchain...');
    const certIdBytes = ethers.id(cert_id);
    const hashBytes = ethers.toBeArray('0x' + cert_hash);
    
    const tx = await contract.registerCertificate(certIdBytes, hashBytes);
    await tx.wait();
    console.log('[CertificateService] Hash registered on Blockchain. TxHash:', tx.hash);
  } catch (blockchainError) {
    console.error('[CertificateService] Blockchain registration failed:', blockchainError.message);
    throw blockchainError; 
  }

  return { cert_id, cert_hash };
};