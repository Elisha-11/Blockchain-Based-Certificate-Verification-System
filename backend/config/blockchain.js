const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Read from environment so the same code works against local Ganache (dev) or a
// public testnet like Sepolia (deployment) just by changing .env — a hardcoded
// 127.0.0.1 RPC URL / private key can never be reached once this backend is
// hosted somewhere other than the developer's own machine.
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const RPC_URL = process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545';

if (!CONTRACT_ADDRESS) {
  console.error('FATAL: CONTRACT_ADDRESS is not set in the environment');
  process.exit(1);
}

const RAW_KEY_INPUT = process.env.BLOCKCHAIN_PRIVATE_KEY;

if (!RAW_KEY_INPUT) {
  console.error('FATAL: BLOCKCHAIN_PRIVATE_KEY is not set in the environment');
  process.exit(1);
}

// SANITIZE: Multi-step approach to handle invisible chars, padding, etc.
// 1. Trim all whitespace (spaces, tabs, newlines, zero-width chars)
// 2. Remove 0x prefix if present
// 3. Keep only hex characters
// 4. Pad to 64 chars if needed (handles leading zero loss)
// 5. Reconstruct with 0x prefix

let cleaned = RAW_KEY_INPUT
  .trim()                              // Remove leading/trailing whitespace
  .replace(/\0/g, '')                  // Remove null bytes
  .replace(/^0x/i, '')                 // Remove 0x prefix (case-insensitive)
  .replace(/[^0-9a-fA-F]/g, '')        // Remove all non-hex characters
  .toLowerCase();                      // Normalize to lowercase

// Pad with leading zero if somehow we lost it or it's 63 chars
if (cleaned.length === 63) {
  cleaned = '0' + cleaned;
}

const PRIVATE_KEY = '0x' + cleaned;

// VALIDATE: Ensure final key is exactly 66 chars (0x + 64 hex digits)
if (PRIVATE_KEY.length !== 66) {
  console.error(`FATAL: Private key is ${PRIVATE_KEY.length} chars. Expected 66.`);
  console.error('Raw input:', RAW_KEY_INPUT);
  console.error('Cleaned:', PRIVATE_KEY);
  process.exit(1);
}

if (!/^0x[0-9a-f]{64}$/.test(PRIVATE_KEY)) {
  console.error('FATAL: Private key does not match hex pattern');
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

// Initialize Ethers provider and signer
const provider = new ethers.JsonRpcProvider(RPC_URL);
const signer = new ethers.Wallet(PRIVATE_KEY, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

console.log(`Blockchain connected: ${CONTRACT_ADDRESS}`);

module.exports = { 
  contract, 
  provider, 
  signer, 
  CONTRACT_ADDRESS 
};
