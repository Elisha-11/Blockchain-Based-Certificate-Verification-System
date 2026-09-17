-- Adds on-chain access-control support: a per-institution HD wallet index
-- (institutions.wallet_address already existed but was never populated), and
-- a dedicated revocation transaction hash + lifecycle states on certificates
-- so revocation can go through the same pending/failed/retry flow as issuance.

ALTER TABLE institutions
  ADD COLUMN wallet_index INT UNIQUE NULL COMMENT 'HD derivation index (m/44''/60''/0''/0/N) for this institution''s signing wallet';

ALTER TABLE certificates
  ADD COLUMN revocation_tx_hash VARCHAR(66) NULL,
  MODIFY COLUMN status ENUM('active','revoked','suspended','pending_blockchain','blockchain_failed','pending_revocation','revocation_failed')
    NOT NULL DEFAULT 'pending_blockchain';
