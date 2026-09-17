// backend/services/certificateService.js
const certRepo = require('../repositories/certificateRepository');
const institutionRepo = require('../repositories/institutionRepository');
const { generateDeterministicHash } = require('../utils/crypto');
const { buildCertificateHashInput } = require('../utils/hashBuilder');
const { provider, getSignerForInstitution } = require('../config/blockchain');
const { ethers } = require('ethers');

/**
 * Resolves the institution's on-chain signer, so the msg.sender that
 * registers/revokes a certificate always matches the institution that
 * actually issued it, regardless of which account made the API call.
 */
async function resolveInstitutionContract(institutionId) {
  const wallet = await institutionRepo.findWalletInfo(institutionId);
  if (!wallet || wallet.wallet_index === null || wallet.wallet_index === undefined) {
    throw new Error(`Institution ${institutionId} has no wallet_index configured for blockchain transactions`);
  }
  return getSignerForInstitution(wallet.wallet_index);
}

/**
 * STRATEGY PATTERN: Type-specific field extraction.
 * OCP: Add new certificate types by adding entries to this map ONLY.
 */
const TYPE_STRATEGIES = {
  grade12: (data) => ({
    candidate_number: data.candidate_number,
    program: null,
    student_id: null,
    metadata: {
      exam_year: new Date(data.issue_date).getFullYear(),
      subjects: data.subjects || []
    }
  }),
  university: (data) => ({
    candidate_number: null,
    program: data.program,
    student_id: data.student_id,
    metadata: {
      class_of_degree: data.class_of_degree || null
    }
  }),
  technical: (data) => ({
    candidate_number: null,
    program: data.program,
    student_id: data.student_id,
    metadata: {
      diploma_type: data.diploma_type || null
    }
  })
};

class CertificateService {
  constructor(repository = certRepo) {
    this.repository = repository;
  }

  /**
   * Issues a certificate with ATOMIC blockchain registration.
   * Uses pending status to prevent orphaned records if blockchain fails.
   */
  async issueCertificate(data) {
    console.log('[CertificateService] Starting issuance for:', data.student_name);

    const cert_id = data.cert_id || `CERT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const certType = data.certificate_type || 'university';

    const strategy = TYPE_STRATEGIES[certType] || TYPE_STRATEGIES.university;
    const typeFields = strategy(data);

    const hashInput = buildCertificateHashInput(cert_id, data, typeFields);
    const cert_hash = generateDeterministicHash(hashInput);

    // 1. Save to DB with 'pending_blockchain' status
    try {
      await this.repository.create({
        cert_id,
        certificate_type: certType,
        ...typeFields,
        student_name: data.student_name,
        institution_id: data.institution_id,
        issue_date: data.issue_date,
        cert_hash,
        metadata: typeFields.metadata,
        status: 'pending_blockchain'
      });
      console.log('[CertificateService] Saved to DB (pending):', cert_id);
    } catch (dbError) {
      console.error('[CertificateService] DB Insert failed:', dbError.message);
      throw dbError;
    }

    // 2. Register on Blockchain with resilience check
    let txHash = null;
    try {
      if (!provider) {
        throw new Error('Blockchain adapter not initialized. Check Ganache/Sepolia connection.');
      }

      console.log('[CertificateService] Registering hash on Blockchain...');
      const institutionContract = await resolveInstitutionContract(data.institution_id);
      const certIdBytes = ethers.id(cert_id);
      const hashBytes = ethers.toBeArray('0x' + cert_hash);

      const tx = await institutionContract.registerCertificate(certIdBytes, hashBytes);
      const receipt = await tx.wait();
      txHash = receipt.hash;

      await this.repository.updateStatus(cert_id, 'active', txHash);
      console.log('[CertificateService] Hash registered. TxHash:', txHash);
    } catch (blockchainError) {
      console.error('[CertificateService] Blockchain registration failed:', blockchainError.message);

      try {
        await this.repository.updateStatus(cert_id, 'blockchain_failed', null);
      } catch (updateErr) {
        console.error('[CertificateService] Status update after blockchain error failed:', updateErr.message);
      }

      throw new Error(`Certificate saved to DB but blockchain registration failed: ${blockchainError.message}`);
    }

    return { cert_id, cert_hash, tx_hash: txHash };
  }

  /**
   * GRASP Information Expert: Delegates institution-scoped queries to repository.
   * 
   */
  async getCertificatesByInstitution(institutionId, page = 1, limit = 20, filters = {}) {
    if (!institutionId) {
      throw new Error('institutionId is required for scoped certificate retrieval');
    }

    const [certificates, totalCount] = await Promise.all([
      this.repository.findByInstitutionId(institutionId, page, limit, filters),
      this.repository.countByInstitutionId(institutionId, filters)
    ]);

    return {
      certificates,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    };
  }

  /**
   * Retries blockchain registration for failed certificates.
   * SRP: Only handles retry logic, not initial issuance.
   */
  async retryBlockchainRegistration(certId) {
    console.log(`[CertificateService] Retrying blockchain for: ${certId}`);

    const cert = await this.repository.findByIdRaw(certId);
    
    if (!cert) {
      throw new Error('Certificate not found');
    }

    if (cert.status !== 'blockchain_failed') {
      throw new Error(`Cannot retry: Certificate status is '${cert.status}', expected 'blockchain_failed'`);
    }

    const updated = await this.repository.updateStatusIf(
      certId, 
      'blockchain_failed', 
      'pending_blockchain'
    );

    if (!updated) {
      throw new Error('Retry failed: Certificate status changed concurrently');
    }

    console.log('[CertificateService] Status updated to pending_blockchain');

    try {
      if (!provider) {
        throw new Error('Blockchain adapter not initialized');
      }

      const institutionContract = await resolveInstitutionContract(cert.institution_id);
      const certIdBytes = ethers.id(cert.cert_id);
      const hashBytes = ethers.toBeArray('0x' + cert.cert_hash);

      const tx = await institutionContract.registerCertificate(certIdBytes, hashBytes);
      const receipt = await tx.wait();

      const finalUpdate = await this.repository.updateStatusIf(
        certId,
        'pending_blockchain',
        'active',
        receipt.hash
      );

      if (!finalUpdate) {
        console.warn('[CertificateService] Blockchain succeeded but DB update failed. Manual intervention required.');
        return { 
          success: false, 
          message: 'Blockchain registered but database update failed. Contact admin.',
          tx_hash: receipt.hash 
        };
      }

      console.log('[CertificateService] Retry successful. TxHash:', receipt.hash);
      return { 
        success: true, 
        message: 'Blockchain registration completed successfully',
        tx_hash: receipt.hash 
      };

    } catch (blockchainError) {
      console.error('[CertificateService] Retry blockchain failed:', blockchainError.message);

      await this.repository.updateStatusIf(
        certId,
        'pending_blockchain',
        'blockchain_failed'
      );

      throw new Error(`Blockchain retry failed: ${blockchainError.message}`);
    }
  }

  /**
   * Revokes a certificate with mandatory audit trail.
   * SRP: Only handles revocation logic and compliance logging.
   *
   * Revocation now sends a transaction (same lifecycle treatment as
   * issuance): 'pending_revocation' -> 'revoked' or 'revocation_failed',
   * with retryRevocation() picking up from the failed state.
   *
   * The audit log is written up front, before the blockchain call, so the
   * mandatory reason is never lost if the transaction later needs a retry —
   * mirroring how issuance's DB row is written before its blockchain call.
   */
  async revokeCertificate(certId, userId, reason) {
    const cert = await this.repository.findByIdRaw(certId);
    if (!cert) throw new Error('Certificate not found');
    if (cert.status === 'revoked') throw new Error('Already revoked');
    if (cert.status === 'pending_revocation') throw new Error('Revocation already in progress');

    const updated = await this.repository.updateStatusIf(
      certId,
      cert.status,
      'pending_revocation'
    );

    if (!updated) {
      throw new Error('Concurrent modification detected during revocation');
    }

    return this._sendRevocationTransaction(certId, cert.institution_id, userId, reason);
  }

  /**
   * Retries the blockchain revocation transaction for a certificate stuck in
   * 'revocation_failed'. Mirrors retryBlockchainRegistration exactly. The
   * audit log entry was already written by the original revokeCertificate
   * call, so it is not touched here.
   */
  async retryRevocation(certId) {
    console.log(`[CertificateService] Retrying revocation for: ${certId}`);

    const cert = await this.repository.findByIdRaw(certId);

    if (!cert) {
      throw new Error('Certificate not found');
    }

    if (cert.status !== 'revocation_failed') {
      throw new Error(`Cannot retry: Certificate status is '${cert.status}', expected 'revocation_failed'`);
    }

    const updated = await this.repository.updateRevocationStatusIf(
      certId,
      'revocation_failed',
      'pending_revocation'
    );

    if (!updated) {
      throw new Error('Retry failed: Certificate status changed concurrently');
    }

    return this._sendRevocationTransaction(certId, cert.institution_id);
  }

  /**
   * Shared blockchain step for both the initial revocation attempt and its
   * retry: cert must already be in 'pending_revocation' when this runs.
   *
   * userId/reason are only passed on the initial attempt (never on retry,
   * which must not create a second audit entry). The audit log write lives
   * INSIDE this try block, alongside the chain call: if it throws, the
   * certificate must fall through to 'revocation_failed' just like a chain
   * failure would, rather than being stranded in 'pending_revocation' with
   * no retry path (retryRevocation only accepts 'revocation_failed').
   */
  async _sendRevocationTransaction(certId, institutionId, userId = null, reason = null) {
    try {
      if (!provider) {
        throw new Error('Blockchain adapter not initialized');
      }

      if (userId && reason) {
        await this.repository.logRevocation(certId, userId, reason);
      }

      const institutionContract = await resolveInstitutionContract(institutionId);
      const certIdBytes = ethers.id(certId);

      const tx = await institutionContract.revokeCertificate(certIdBytes);
      const receipt = await tx.wait();

      const finalUpdate = await this.repository.updateRevocationStatusIf(
        certId,
        'pending_revocation',
        'revoked',
        receipt.hash
      );

      if (!finalUpdate) {
        console.warn('[CertificateService] Blockchain revocation succeeded but DB update failed. Manual intervention required.');
        return {
          success: false,
          message: 'Blockchain revocation completed but database update failed. Contact admin.',
          tx_hash: receipt.hash
        };
      }

      console.log('[CertificateService] Revocation successful. TxHash:', receipt.hash);
      return {
        success: true,
        message: 'Certificate revoked successfully',
        revoked_at: new Date().toISOString()
      };

    } catch (blockchainError) {
      console.error('[CertificateService] Revocation blockchain call failed:', blockchainError.message);

      await this.repository.updateRevocationStatusIf(
        certId,
        'pending_revocation',
        'revocation_failed'
      );

      throw new Error(`Certificate revocation failed on blockchain: ${blockchainError.message}`);
    }
  }

  /**
   * Returns UI presentation config for a certificate type.
   * Polymorphism: Different types return different rendering instructions.
   */
  getPresentationConfig(certificateType) {
    const configs = {
      grade12: {
        template: 'examination_result',
        displayFields: ['candidate_number', 'exam_year', 'subjects'],
        colorScheme: 'national_green',
        label: 'Grade 12 Certificate'
      },
      university: {
        template: 'academic_degree',
        displayFields: ['program', 'class_of_degree', 'student_id'],
        colorScheme: 'institutional_blue',
        label: 'University Degree'
      },
      technical: {
        template: 'diploma_certificate',
        displayFields: ['program', 'diploma_type', 'student_id'],
        colorScheme: 'technical_orange',
        label: 'Technical Diploma'
      }
    };

    return configs[certificateType] || configs.university;
  }
}

module.exports = new CertificateService();