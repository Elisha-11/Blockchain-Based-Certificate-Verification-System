const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Read from environment so the same code works against local Ganache (dev) or a
// public testnet like Sepolia (deployment) just by changing .env — a hardcoded
// 127.0.0.1 RPC URL / mnemonic can never be reached once this backend is
// hosted somewhere other than the developer's own machine.
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const RPC_URL = process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545';

if (!CONTRACT_ADDRESS) {
  console.error('FATAL: CONTRACT_ADDRESS is not set in the environment');
  process.exit(1);
}

const MNEMONIC = process.env.BLOCKCHAIN_MNEMONIC;

if (!MNEMONIC) {
  console.error('FATAL: BLOCKCHAIN_MNEMONIC is not set in the environment');
  process.exit(1);
}

if (!ethers.Mnemonic.isValidMnemonic(MNEMONIC.trim())) {
  console.error('FATAL: BLOCKCHAIN_MNEMONIC is not a valid BIP-39 mnemonic phrase');
  process.exit(1);
}

// Validate contract address format
if (!CONTRACT_ADDRESS || !CONTRACT_ADDRESS.startsWith('0x') || CONTRACT_ADDRESS.length !== 42) {
  console.error('FATAL: CONTRACT_ADDRESS is invalid');
  process.exit(1);
}

// Load ABI from artifact file
const artifactPath = path.join(__dirname, '../../blockchain/artifacts/contracts/CertificateRegistry.sol/CertificateRegistry.json');
let ABI;
try {
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  ABI = artifact.abi;
} catch (err) {
  console.error('Failed to load ABI:', err.message);
  process.exit(1);
}

// Initialize Ethers provider and a read-only contract instance (no signer) for
// view calls like verifyCertificate, which don't need to send transactions.
const provider = new ethers.JsonRpcProvider(RPC_URL);
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

/**
 * Derives the signer for a given institution's HD wallet index — the same
 * derivation path deploy.js used to authorise institutions on-chain — and
 * returns a Contract instance connected to it, so on-chain issuer/revoker
 * identity always matches the institution actually performing the action.
 */
function getSignerForInstitution(walletIndex) {
  if (walletIndex === null || walletIndex === undefined) {
    throw new Error('Institution has no wallet_index configured for blockchain transactions');
  }

  const wallet = ethers.HDNodeWallet.fromPhrase(
    MNEMONIC.trim(),
    undefined,
    `m/44'/60'/0'/0/${walletIndex}`
  ).connect(provider);

  return contract.connect(wallet);
}

console.log(`Blockchain connected: ${CONTRACT_ADDRESS}`);

module.exports = {
  contract,
  provider,
  getSignerForInstitution,
  CONTRACT_ADDRESS
};
