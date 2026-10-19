-- 007_create_issuance_audit_logs.sql
--
-- Regulator-facing audit trail. ZAQA (institutions.type = 'regulatory_body')
-- does not issue or hold certificates of its own, so it had no way to see what
-- the institutions it qualifies were actually doing. This table records every
-- issuance attempt — successful or failed — and every revocation, across all
-- institutions, as an append-only log.
--
-- Deliberately denormalized: student_name, certificate_type, classification and
-- actor_email are copied in at write time rather than joined on read. A
-- certificate row can later be revoked, corrected or (in a failed issuance)
-- never reach a usable state, and the regulator needs to see what was submitted
-- at the time, not what the record looks like now.

CREATE TABLE IF NOT EXISTS issuance_audit_logs (
  audit_id          BIGINT AUTO_INCREMENT PRIMARY KEY,

  event_type        ENUM('issuance_success', 'issuance_failed', 'revocation') NOT NULL,

  -- Nullable: a certificate that failed before its row was written has no
  -- certificate to point at, and ON DELETE SET NULL keeps the audit entry
  -- alive even if the certificate row is later removed. The log outliving
  -- the thing it describes is the point of an audit trail.
  cert_id           CHAR(36) NULL,
  institution_id    CHAR(36) NULL,

  actor_user_id     CHAR(36) NULL,
  actor_email       VARCHAR(255) NULL,
  actor_ip          VARCHAR(45) NULL,
  user_agent        VARCHAR(255) NULL,

  student_name      VARCHAR(255) NULL,
  certificate_type  VARCHAR(32) NULL,
  classification    VARCHAR(32) NULL,

  blockchain_tx_hash CHAR(66) NULL,

  -- Populated for issuance_failed (the blockchain/DB error) and for
  -- revocation (the mandatory reason the revoking officer gave).
  detail            TEXT NULL,

  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_audit_cert
    FOREIGN KEY (cert_id) REFERENCES certificates(cert_id) ON DELETE SET NULL,
  CONSTRAINT fk_audit_institution
    FOREIGN KEY (institution_id) REFERENCES institutions(institution_id) ON DELETE SET NULL,

  -- The regulator's three access patterns: the whole log newest-first,
  -- one institution's activity, and one event type across institutions.
  INDEX idx_audit_created (created_at),
  INDEX idx_audit_institution_created (institution_id, created_at),
  INDEX idx_audit_event_created (event_type, created_at),
  INDEX idx_audit_cert (cert_id)
)
-- Must match the collation of certificates/institutions (utf8mb4_unicode_ci),
-- not the server default (utf8mb4_0900_ai_ci) — MySQL rejects a foreign key
-- whose column collation differs from the column it references.
ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
