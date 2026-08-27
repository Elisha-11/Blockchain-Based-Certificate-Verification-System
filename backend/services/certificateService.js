// backend/services/certificateService.js
const certRepo = require('../repositories/certificateRepository');
const { generateDeterministicHash } = require('../utils/crypto');
const { buildCertificateHashInput } = require('../utils/hashBuilder');
const { contract, provider } = require('../config/blockchain');
const { ethers } = require('ethers');

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
      if (!contract || !provider) {
        throw new Error('Blockchain adapter not initialized. Check Ganache/Sepolia connection.');
      }

      console.log('[CertificateService] Registering hash on Blockchain...');
      const certIdBytes = ethers.id(cert_id);
      const hashBytes = ethers.toBeArray('0x' + cert_hash);

      const tx = await contract.registerCertificate(certIdBytes, hashBytes);
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
      if (!contract || !provider) {
        throw new Error('Blockchain adapter not initialized');
      }

      const certIdBytes = ethers.id(cert.cert_id);
      const hashBytes = ethers.toBeArray('0x' + cert.cert_hash);

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
   *  NEW: Revokes a certificate with mandatory audit trail.
   * SRP: Only handles revocation logic and compliance logging.
   */
  async revokeCertificate(certId, userId, reason) {
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

    return { 
      success: true, 
      message: 'Certificate revoked successfully',
      revoked_at: new Date().toISOString()
    };
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