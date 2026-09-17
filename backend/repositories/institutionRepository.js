// backend/repositories/institutionRepository.js
const pool = require('../config/db');

/**
 * Fetches the on-chain wallet identity for an institution.
 * Used to resolve which signer should sign a certificate's blockchain
 * transactions (issuance, revocation) on that institution's behalf.
 */
exports.findWalletInfo = async (institutionId) => {
  const [rows] = await pool.query(
    'SELECT wallet_index, wallet_address FROM institutions WHERE institution_id = ?',
    [institutionId]
  );

  return rows[0] || null;
};
