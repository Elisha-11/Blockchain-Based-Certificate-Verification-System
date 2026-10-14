-- certificateRepository/certificateService write 'pending_blockchain' and
-- 'blockchain_failed' statuses (to keep a cert's DB row and its on-chain
-- registration atomic) and a blockchain_tx_hash column, but the live schema
-- only had enum('active','revoked','suspended') and no such column.

ALTER TABLE certificates
  MODIFY COLUMN status enum('pending_blockchain','active','revoked','suspended','blockchain_failed')
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  ADD COLUMN blockchain_tx_hash char(66) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER status;
