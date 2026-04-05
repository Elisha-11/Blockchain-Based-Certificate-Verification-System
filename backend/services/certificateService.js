const certRepo = require('../repositories/certificateRepository');
const { generateDeterministicHash } = require('../utils/crypto');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');

exports.issueCertificate = async (data) => {
  const cert_id = data.cert_id || `CERT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  
  // 1. Generate deterministic hash
  const cert_hash = generateDeterministicHash({ ...data, cert_id });

  // 2. Save to MySQL
  const newCert = await certRepo.create({
    cert_id,
    student_id: data.student_id || null,
    student_name: data.student_name,
    program: data.program,
    institution_id: data.institution_id,
    issue_date: data.issue_date,
    cert_hash
  });

  // 3. Generate QR code pointing to verification portal
  const verificationUrl = `http://localhost:5173/verify?id=${cert_id}`;
  const qrCodeDataUrl = await QRCode.toDataURL(verificationUrl);

  return {
    success: true,
    cert_id: newCert.cert_id,
    cert_hash,
    qr_code: qrCodeDataUrl,
    verification_url: verificationUrl,
    message: 'Certificate issued & anchored in database. Hash ready for blockchain.'
  };
};