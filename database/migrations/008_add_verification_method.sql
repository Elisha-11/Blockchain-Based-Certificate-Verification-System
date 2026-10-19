-- 008_add_verification_method.sql
--
-- Records HOW a verification was performed, so the regulator can tell a
-- verifier who typed a certificate ID from one who uploaded the document
-- itself. document_sha256 fingerprints an uploaded file, which is what makes
-- repeated verification attempts against the same forged document visible.

ALTER TABLE verification_logs
  ADD COLUMN verification_method ENUM('id', 'qr', 'upload') NOT NULL DEFAULT 'id'
    AFTER result,
  ADD COLUMN document_sha256 CHAR(64) NULL
    AFTER verification_method;

CREATE INDEX idx_verification_document ON verification_logs (document_sha256);
