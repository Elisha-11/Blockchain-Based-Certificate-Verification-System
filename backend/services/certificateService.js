// backend/services/certificateService.js
const certRepo = require('../repositories/certificateRepository');
const auditRepo = require('../repositories/auditRepository');
const { generateDeterministicHash } = require('../utils/crypto');
const { buildCertificateHashInput } = require('../utils/hashBuilder');
const {
  normalizeClassification,
  deriveExaminationClassification
} = require('../utils/classification');
const { contract, provider } = require('../config/blockchain');
const { ethers } = require('ethers');

/**
 * STRATEGY PATTERN: Type-specific field extraction.
 * OCP: Add new certificate types by adding entries to this map ONLY.
 */
const TYPE_STRATEGIES = {
  // Examination classification is never taken from the request: it is derived
  // from the subject grades, so an issuing officer cannot award a candidate a
  // Distinction that their own grades do not support. The aggregate is stored
  // alongside it so a verifier can check the arithmetic.
  examination: (data) => {
    const { classification, aggregate, counted_subjects } =
      deriveExaminationClassification(data.subjects);

    return {
      candidate_number: data.candidate_number,
      program: null,
      student_id: null,
      metadata: {
        level: data.level,
        exam_year: new Date(data.issue_date).getFullYear(),
        subjects: data.subjects || [],
        classification,
        aggregate,
        counted_subjects
      }
    };
  },
  university: (data) => ({
    candidate_number: null,
    program: data.program,
    student_id: data.student_id,
    metadata: {
      // 'class_of_degree' is the legacy field name kept for API compatibility;
      // 'classification' is the canonical one and the one that is hashed.
      classification: normalizeClassification(
        data.classification ?? data.class_of_degree
      )
    }
  }),
  technical: (data) => ({
    candidate_number: null,
    program: data.program,
    student_id: data.student_id,
    metadata: {
      diploma_type: data.diploma_type || null,
      classification: normalizeClassification(data.classification)
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
  async issueCertificate(data, actor = {}) {
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
      if (!contract || !provider) {
        throw new Error('Blockchain adapter not initialized. Check Ganache/Sepolia connection.');
      }

      console.log('[CertificateService] Registering hash on Blockchain...');
      const certIdBytes = ethers.id(cert_id);
      // cert_hash is a 64-char SHA-256 hex digest, already exactly 32 bytes —
      // pass it directly. ethers.toBeArray() treats hex as a number and
      // strips leading zero BYTES, so any hash starting with 0x00 would
      // produce fewer than 32 bytes and fail bytes32 encoding.
      const hashBytes = '0x' + cert_hash;

      const tx = await contract.registerCertificate(certIdBytes, hashBytes);
      const receipt = await tx.wait();
      txHash = receipt.hash;

      await this.repository.updateStatus(cert_id, 'active', txHash);
      console.log('[CertificateService] Hash registered. TxHash:', txHash);

      await this._audit('issuance_success', cert_id, data, typeFields, actor, {
        blockchain_tx_hash: txHash
      });
    } catch (blockchainError) {
      console.error('[CertificateService] Blockchain registration failed:', blockchainError.message);

      try {
        await this.repository.updateStatus(cert_id, 'blockchain_failed', null);
      } catch (updateErr) {
        console.error('[CertificateService] Status update after blockchain error failed:', updateErr.message);
      }

      // Logged before rethrowing: a failed issuance is exactly the event the
      // regulator cannot otherwise see, since no usable certificate results
      // from it and the caller only gets an error back.
      await this._audit('issuance_failed', cert_id, data, typeFields, actor, {
        detail: blockchainError.message
      });

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
  async retryBlockchainRegistration(certId, actor = {}) {
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
      if (!contract || !provider) {
        throw new Error('Blockchain adapter not initialized');
      }

      const certIdBytes = ethers.id(cert.cert_id);
      const hashBytes = '0x' + cert.cert_hash;

      const tx = await contract.registerCertificate(certIdBytes, hashBytes);
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

      // A successful retry is the moment the credential actually becomes
      // valid, so it is logged as an issuance success in its own right.
      await this._auditCert('issuance_success', cert, actor, {
        blockchain_tx_hash: receipt.hash,
        detail: 'Blockchain registration completed on retry'
      });

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

      await this._auditCert('issuance_failed', cert, actor, {
        detail: `Retry failed: ${blockchainError.message}`
      });

      throw new Error(`Blockchain retry failed: ${blockchainError.message}`);
    }
  }

  /**
   *  NEW: Revokes a certificate with mandatory audit trail.
   * SRP: Only handles revocation logic and compliance logging.
   */
  async revokeCertificate(certId, userId, reason, actor = {}) {
    const cert = await this.repository.findByIdRaw(certId);
    if (!cert) throw new Error('Certificate not found');
    if (cert.status === 'revoked') throw new Error('Already revoked');

    // Atomic status update with concurrency protection
    const updated = await this.repository.updateStatusIf(
      certId, 
      cert.status, 
      'revoked'
    );
    
    if (!updated) {
      throw new Error('Concurrent modification detected during revocation');
    }

    // Create immutable audit trail entry
    await this.repository.logRevocation(certId, userId, reason);

    // Mirrored into the regulator-facing log. revocation_logs is scoped to the
    // issuing institution's own records; ZAQA needs revocations from every
    // institution in one place, with the reason attached.
    await this._auditCert('revocation', cert, { ...actor, user_id: userId }, {
      detail: reason
    });

    return { 
      success: true, 
      message: 'Certificate revoked successfully',
      revoked_at: new Date().toISOString()
    };
  }

  /**
   * Writes a regulator audit entry for an issuance attempt, using the request
   * payload (the certificate row may not exist or may be incomplete).
   *
   * @param {string} eventType
   * @param {string} certId
   * @param {Object} data - Validated issuance request
   * @param {Object} typeFields - Output of the type strategy
   * @param {Object} actor - { user_id, email, ip, user_agent }
   * @param {Object} extra - { blockchain_tx_hash, detail }
   * @private
   */
  async _audit(eventType, certId, data, typeFields, actor = {}, extra = {}) {
    return auditRepo.record({
      event_type: eventType,
      cert_id: certId,
      institution_id: data.institution_id,
      actor_user_id: actor.user_id || null,
      actor_email: actor.email || null,
      actor_ip: actor.ip || null,
      user_agent: actor.user_agent || null,
      student_name: data.student_name,
      certificate_type: data.certificate_type,
      classification: typeFields?.metadata?.classification || null,
      blockchain_tx_hash: extra.blockchain_tx_hash || null,
      detail: extra.detail || null
    });
  }

  /**
   * Writes a regulator audit entry from an existing certificate row, for
   * events after issuance (retry, revocation) where the stored record — not a
   * request body — is the source of truth.
   *
   * @private
   */
  async _auditCert(eventType, cert, actor = {}, extra = {}) {
    let metadata = {};
    try {
      metadata = typeof cert.metadata === 'string'
        ? JSON.parse(cert.metadata)
        : (cert.metadata || {});
    } catch (err) {
      // A certificate with unparseable metadata must still be auditable.
      console.error('[CertificateService] Audit metadata parse failed:', err.message);
    }

    return auditRepo.record({
      event_type: eventType,
      cert_id: cert.cert_id,
      institution_id: cert.institution_id,
      actor_user_id: actor.user_id || null,
      actor_email: actor.email || null,
      actor_ip: actor.ip || null,
      user_agent: actor.user_agent || null,
      student_name: cert.student_name,
      certificate_type: cert.certificate_type,
      // Legacy certificates stored the degree class under class_of_degree.
      classification: metadata.classification || metadata.class_of_degree || null,
      blockchain_tx_hash: extra.blockchain_tx_hash || null,
      detail: extra.detail || null
    });
  }

  /**
   * Returns UI presentation config for a certificate type.
   * Polymorphism: Different types return different rendering instructions.
   */
  getPresentationConfig(certificateType) {
    const configs = {
      examination: {
        template: 'examination_result',
        displayFields: ['level', 'candidate_number', 'exam_year', 'subjects'],
        colorScheme: 'national_green',
        label: 'Examination Result'
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

    // Legacy alias: certificates issued before the grade12 -> examination
    // rename still have certificate_type='grade12' stored in the DB.
    configs.grade12 = configs.examination;

    return configs[certificateType] || configs.university;
  }
}

module.exports = new CertificateService();