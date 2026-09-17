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
  grade12: (cert, metadata) => ({
    candidate_number: cert.candidate_number,
    exam_year: metadata.exam_year || null,
    subjects: metadata.subjects || [],
    institution_name: cert.institution_name,
    institution_code: cert.institution_code
  }),
  university: (cert, metadata) => ({
    program: cert.program,
    class_of_degree: metadata.class_of_degree || 'Not Specified',
    student_id: cert.student_id,
    institution_name: cert.institution_name,
    institution_code: cert.institution_code
  }),
  technical: (cert, metadata) => ({
    program: cert.program,
    diploma_type: metadata.diploma_type || 'Not Specified',
    student_id: cert.student_id,
    institution_name: cert.institution_name,
    institution_code: cert.institution_code
  })
};

/**
 * Truncates the full cert_hash for display, so the verification page can
 * show a trust signal without dumping the entire raw hash on the page.
 */
const formatHashPreview = (hash) => {
  if (!hash) return null;
  return hash.length <= 18 ? hash : `${hash.slice(0, 10)}...${hash.slice(-8)}`;
};

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

    // Revocation disagreement between MySQL and the chain — same spirit as
    // the hash-mismatch debug block above: surfaced via server log only, no
    // new DB column/enum and no change to the response shape.
    if (!blockchainResult.error && (cert.status === 'revoked') !== blockchainResult.revoked) {
      console.warn(
        '[VerifyService] REVOCATION STATUS MISMATCH for', certId,
        '- DB status:', cert.status,
        '| on-chain revoked:', blockchainResult.revoked
      );
    }

    // 6. Determine final status (on-chain revoked flag is now the source of
    // truth; DB status is only a fallback if the chain call itself errored)
    const status = this._determineStatus(
      cert.status,
      mysqlHashMatches,
      blockchainResult
    );

    // 7. Log audit trail
    await this._logVerification(certId, context, status.result);

    // 8. Format details via strategy (OCP), plus fields common to every
    // certificate type that the verification result page always displays.
    const detailStrategy = DETAIL_STRATEGIES[cert.certificate_type] || DETAIL_STRATEGIES.university;
    const details = {
      student_name: cert.student_name,
      issue_date: cert.issue_date,
      cert_hash_preview: formatHashPreview(cert.cert_hash),
      ...detailStrategy(cert, metadata)
    };

    return {
      valid: status.result === 'valid',
      status: status.result.toUpperCase(),
      certificate_type: cert.certificate_type || 'university',
      cert_id: cert.cert_id,
      message: status.message,
      details,
      verification: {
        mysql_hash_match: mysqlHashMatches,
        blockchain_verified: blockchainResult.exists,
        blockchain_error: blockchainResult.error,
        // Cryptographic proof of which wallet actually registered this
        // certificate on-chain — only meaningful once the chain confirms a
        // matching record exists, so it's null otherwise rather than showing
        // a stale/zero address.
        blockchain_issuer: blockchainResult.exists ? blockchainResult.issuer : null
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
      return { exists: false, revoked: false, error: 'Blockchain adapter not initialized' };
    }

    try {
      const code = await provider.getCode(CONTRACT_ADDRESS);
      if (code === '0x') {
        throw new Error('Contract not deployed at specified address');
      }

      const certIdBytes = ethers.id(certId);
      const hashBytes = ethers.toBeArray('0x' + storedHash);
      const result = await contract.verifyCertificate(certIdBytes, hashBytes);

      return {
        exists: Boolean(result.exists),
        revoked: Boolean(result.revoked),
        issuer: result.issuer,
        issuedAt: result.issuedAt,
        revokedAt: result.revokedAt,
        error: null
      };
    } catch (err) {
      console.error('[VerifyService] Blockchain check failed:', err.message);
      return { exists: false, revoked: false, error: err.message };
    }
  }

  _determineStatus(dbStatus, mysqlMatch, blockchainResult) {
    if (!mysqlMatch) {
      return {
        result: 'invalid',
        message: 'Certificate integrity check failed. Database hash mismatch indicates tampering.'
      };
    }

    // The chain is authoritative for revocation status. Only fall back to
    // the DB flag when the chain itself couldn't be reached — the same
    // graceful-degradation behavior this service already applies below when
    // deciding whether a blockchain error should block verification.
    const revoked = blockchainResult.error
      ? dbStatus === 'revoked'
      : blockchainResult.revoked;

    if (revoked) {
      return {
        result: 'revoked',
        message: 'This certificate has been officially revoked by the issuing institution.'
      };
    }
    if (!blockchainResult.exists && !blockchainResult.error) {
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
        user_agent: context.user_agent
      });
    } catch (logErr) {
      console.error('[VerifyService] Audit log failed:', logErr.message);
    }
  }
}

module.exports = new VerificationService();