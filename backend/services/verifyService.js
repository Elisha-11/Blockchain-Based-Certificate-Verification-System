// backend/services/verifyService.js
const certRepo = require('../repositories/certificateRepository');
const logRepo = require('../repositories/logRepository');
const { generateDeterministicHash } = require('../utils/crypto');
const { ethers } = require('ethers');
const { contract, provider, CONTRACT_ADDRESS } = require('../config/blockchain');

/**
 * STRATEGY PATTERN: Type-specific detail formatting.
 * OCP: Add new certificate types by adding entries to this map.
 */
const DETAIL_STRATEGIES = {
  examination: (cert, metadata) => ({
    student_name: cert.student_name,
    issue_date: cert.issue_date,
    level: metadata.level || null,
    candidate_number: cert.candidate_number,
    exam_year: metadata.exam_year || null,
    subjects: metadata.subjects || [],
    classification: metadata.classification || null,
    // Surfaced so a verifier can confirm the classification follows from the
    // grades printed on the certificate rather than taking it on trust.
    aggregate: metadata.aggregate ?? null,
    counted_subjects: metadata.counted_subjects ?? null,
    institution_name: cert.institution_name,
    institution_code: cert.institution_code
  }),
  university: (cert, metadata) => ({
    student_name: cert.student_name,
    issue_date: cert.issue_date,
    program: cert.program,
    // Certificates issued before the shared vocabulary stored their degree
    // class under class_of_degree; fall back to it so they still display.
    classification: metadata.classification || metadata.class_of_degree || null,
    class_of_degree: metadata.class_of_degree || metadata.classification || 'Not Specified',
    student_id: cert.student_id,
    institution_name: cert.institution_name,
    institution_code: cert.institution_code
  }),
  technical: (cert, metadata) => ({
    student_name: cert.student_name,
    issue_date: cert.issue_date,
    program: cert.program,
    diploma_type: metadata.diploma_type || 'Not Specified',
    classification: metadata.classification || null,
    student_id: cert.student_id,
    institution_name: cert.institution_name,
    institution_code: cert.institution_code
  })
};

// Legacy alias: certificates issued before the grade12 -> examination rename
// still have certificate_type='grade12' stored (renaming it would change the
// hashed certificate_type and break their verification), so keep serving them
// through the same formatter.
DETAIL_STRATEGIES.grade12 = DETAIL_STRATEGIES.examination;

/**
 * PURE FUNCTION: Constructs hash input deterministically.
 * ✅ FIXED: Extracts class_of_degree to top-level to match issuance hash structure exactly.
 */
const buildVerificationHashInput = (cert, metadata) => {
  let normalizedDate = '';
  
  if (cert.issue_date) {
    // TIER 1: Handle native Date objects directly (MySQL default)
    if (cert.issue_date instanceof Date) {
      const yyyy = cert.issue_date.getFullYear();
      const mm = String(cert.issue_date.getMonth() + 1).padStart(2, '0');
      const dd = String(cert.issue_date.getDate()).padStart(2, '0');
      normalizedDate = `${yyyy}-${mm}-${dd}`;
    } 
    // TIER 2: Handle ISO format strings ("2026-08-26T00:00:00.000Z")
    else if (typeof cert.issue_date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(cert.issue_date)) {
      normalizedDate = cert.issue_date.substring(0, 10);
    } 
    // TIER 3: Parse any other string format via Date constructor fallback
    else {
      try {
        const d = new Date(cert.issue_date);
        if (!isNaN(d.getTime())) {
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          normalizedDate = `${yyyy}-${mm}-${dd}`;
        } else {
          normalizedDate = String(cert.issue_date).substring(0, 10);
        }
      } catch (e) {
        normalizedDate = String(cert.issue_date).substring(0, 10);
      }
    }
  }

  // ✅ CRITICAL FIX: Mirror exact structure used during issuance
  return {
    cert_id: String(cert.cert_id || '').trim(),
    certificate_type: String(cert.certificate_type || 'university').trim().toLowerCase(),
    student_name: String(cert.student_name || '').trim().toLowerCase(),
    institution_id: String(cert.institution_id || '').trim(),
    issue_date: normalizedDate,
    candidate_number: cert.candidate_number 
      ? String(cert.candidate_number).trim() 
      : null,
    program: cert.program 
      ? String(cert.program).trim() 
      : null,
    class_of_degree: metadata?.class_of_degree || null, // ✅ MOVED TO TOP LEVEL
    // Mirrors buildCertificateHashInput: classification is read out of
    // metadata and hashed at the top level. Absent on certificates issued
    // before classification existed, which is what keeps their hash stable.
    classification: metadata?.classification || null,
    metadata: {} // ✅ ALWAYS EMPTY FOR UNIVERSITY CERTS TO MATCH ISSUANCE
  };
};

class VerificationService {
  constructor(certificateRepository = certRepo, loggingRepository = logRepo) {
    this.certRepo = certificateRepository;
    this.logRepo = loggingRepository;
  }

  async verifyCertificate(certId, context = {}) {
    console.log('[VerifyService] Initiating verification for:', certId);

    // 1. Fetch via Repository (GRASP Information Expert)
    const cert = await this.certRepo.findByIdWithInstitution(certId);

    if (!cert) {
      await this._logVerification(certId, context, 'not_found');
      return {
        valid: false,
        status: 'NOT_FOUND',
        cert_id: certId,
        message: 'Certificate not found in the national registry.'
      };
    }

    // 2. Parse metadata safely
    const metadata = this._safeParseMetadata(cert.metadata);

    // 3. Recompute hash using strict normalization
    const hashInput = buildVerificationHashInput(cert, metadata);
    const recomputedHash = generateDeterministicHash(hashInput);

    // Debug logging to identify mismatch source
    console.log('[VerifyService] Hash Input:', JSON.stringify(hashInput));
    console.log('[VerifyService] Stored Hash:   ', cert.cert_hash);
    console.log('[VerifyService] Recomputed:    ', recomputedHash);
    console.log('[VerifyService] DB Match:      ', recomputedHash === cert.cert_hash);

    // 4. Check MySQL integrity
    const mysqlHashMatches = recomputedHash === cert.cert_hash;

    // 5. Check Blockchain with defensive adapter check
    const blockchainResult = await this._verifyOnBlockchain(cert.cert_id, cert.cert_hash);

    // 6. Determine final status
    const status = this._determineStatus(
      cert.status,
      mysqlHashMatches,
      blockchainResult.verified,
      blockchainResult.error
    );

    // 7. Log audit trail
    await this._logVerification(certId, context, status.result);

    // 8. Format details via strategy (OCP)
    const detailStrategy = DETAIL_STRATEGIES[cert.certificate_type] || DETAIL_STRATEGIES.university;
    const details = detailStrategy(cert, metadata);

    return {
      valid: status.result === 'valid',
      status: status.result.toUpperCase(),
      certificate_type: cert.certificate_type || 'university',
      cert_id: cert.cert_id,
      message: status.message,
      details,
      verification: {
        mysql_hash_match: mysqlHashMatches,
        blockchain_verified: blockchainResult.verified,
        blockchain_error: blockchainResult.error
      }
    };
  }

  // --- PRIVATE HELPER METHODS (SRP Separation) ---

  _safeParseMetadata(metadata) {
    if (!metadata) return {};
    if (typeof metadata === 'string') {
      try { return JSON.parse(metadata); }
      catch (e) {
        console.error('[VerifyService] Metadata parse failed:', e.message);
        return {};
      }
    }
    return metadata;
  }

  async _verifyOnBlockchain(certId, storedHash) {
    if (!contract || !provider || !CONTRACT_ADDRESS) {
      return { verified: false, error: 'Blockchain adapter not initialized' };
    }

    try {
      const code = await provider.getCode(CONTRACT_ADDRESS);
      if (code === '0x') {
        throw new Error('Contract not deployed at specified address');
      }

      const certIdBytes = ethers.id(certId);
      // storedHash is a 64-char SHA-256 hex digest, already exactly 32 bytes
      // — pass it directly rather than through ethers.toBeArray(), which
      // treats hex as a number and strips leading zero BYTES.
      const hashBytes = '0x' + storedHash;
      const result = await contract.verifyCertificate(certIdBytes, hashBytes);

      return { verified: Boolean(result), error: null };
    } catch (err) {
      console.error('[VerifyService] Blockchain check failed:', err.message);
      return { verified: false, error: err.message };
    }
  }

  _determineStatus(dbStatus, mysqlMatch, blockchainVerified, blockchainError) {
    if (dbStatus === 'revoked') {
      return {
        result: 'revoked',
        message: 'This certificate has been officially revoked by the issuing institution.'
      };
    }
    if (!mysqlMatch) {
      return {
        result: 'invalid',
        message: 'Certificate integrity check failed. Database hash mismatch indicates tampering.'
      };
    }
    if (!blockchainVerified && !blockchainError) {
      return {
        result: 'invalid',
        message: 'Certificate hash not found on the blockchain registry.'
      };
    }
    return {
      result: 'valid',
      message: 'Certificate is authentic and verified on the blockchain.'
    };
  }

  async _logVerification(certId, context, result) {
    try {
      await this.logRepo.create({
        cert_id: certId,
        verifier_ip: context.verifier_ip,
        result,
        user_agent: context.user_agent,
        verification_method: context.verification_method,
        document_sha256: context.document_sha256
      });
    } catch (logErr) {
      console.error('[VerifyService] Audit log failed:', logErr.message);
    }
  }
}

module.exports = new VerificationService();