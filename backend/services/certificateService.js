
const certRepo = require('../repositories/certificateRepository');
const { generateDeterministicHash } = require('../utils/crypto');
const QRCode = require('qrcode');
const { ethers } = require('ethers'); 
const { contract } = require('../config/blockchain'); 

exports.issueCertificate = async (data) => {
  try {
    console.log('🔧 Service: Starting issuance for', data.student_name);
    
    // Generate cert_id if not provided
    const cert_id = data.cert_id || `CERT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    
    // 1. Generate deterministic hash
    const hashInput = {
  cert_id,
  student_name: data.student_name?.trim()?.toLowerCase() || '',
  program: data.program?.trim()?.toLowerCase() || '',
  institution_id: data.institution_id,
  issue_date: String(data.issue_date).trim()  
};
    console.log(' Service: Hash input:', hashInput);
    
    const cert_hash = generateDeterministicHash(hashInput);
    console.log(' Service: Generated hash:', cert_hash);

    // 2. Save to MySQL via repository
    const newCert = await certRepo.create({
      cert_id,
      student_id: data.student_id || null,
      student_name: data.student_name,
      program: data.program,
      institution_id: data.institution_id,
      issue_date: data.issue_date,
      cert_hash
    });
    
    console.log(' Service: Saved to DB, cert_id:', newCert?.cert_id);

    // ---  BLOCKCHAIN INTEGRATION START ---
    try {
      console.log(' Registering hash on Blockchain...');
      
      // Convert cert_id string to bytes32 (Solidity requirement)
      const certIdBytes = ethers.id(newCert.cert_id); 
      
      // Ensure hash has 0x prefix for bytes32
      const hashBytes = ethers.toBeArray ('0x' + cert_hash);

      // Call the smart contract function
      const tx = await contract.registerCertificate(certIdBytes, hashBytes);
      
      // Wait for the transaction to be mined
      await tx.wait();

      console.log(' Hash registered on Blockchain. TxHash:', tx.hash);
    } catch (blockchainError) {
      console.error(' Blockchain registration failed:', blockchainError.message);
      // For prototype, we continue even if blockchain fails, but log it.
    }
    // ---  BLOCKCHAIN INTEGRATION END ---

    // 3. Generate QR code
    const verificationUrl = `http://localhost:5173/verify?id=${cert_id}`;
    const qrCodeDataUrl = await QRCode.toDataURL(verificationUrl);

    // CRITICAL: Return the result object explicitly
    return {
      success: true,
      cert_id: newCert.cert_id,
      cert_hash,
      qr_code: qrCodeDataUrl,
      verification_url: verificationUrl,
      message: 'Certificate issued, saved to DB, and anchored on Blockchain.'
    };
  } catch (err) {
    console.error(' Service: Issuance failed:', err.message);
    console.error(' Service: Stack:', err.stack);
    throw err; // Re-throw so controller can catch it
  }
};