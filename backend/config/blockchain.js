const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// CRITICAL: REPLACE THIS WITH YOUR ACTUAL DEPLOYED ADDRESS
// Find it in your Hardhat deployment output: "CertificateRegistry deployed to: 0x..."
const CONTRACT_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3'; // ← REPLACE THIS LINE

const RPC_URL = 'http://127.0.0.1:8545';
// Default Hardhat Account #0 Private Key (from `npx hardhat node` output)
const PRIVATE_KEY = '0xdf57089febbacf7ba0bc227dafbffa9fc08a93fdc68e1e42411a14efcf23656e';

// Validate address format BEFORE proceeding
if (!CONTRACT_ADDRESS || !CONTRACT_ADDRESS.startsWith('0x') || CONTRACT_ADDRESS.length !== 42) {
  console.error(' FATAL: CONTRACT_ADDRESS is invalid in blockchain.js');
  console.error(' Current value:', CONTRACT_ADDRESS);
  console.error(' Expected format: 0x + 40 hex characters (e.g., 0x5FbDB2315678afecb367f032d93F642f64180aa3)');
  console.error(' Fix: Update this file with the address from your latest deployment.');
  process.exit(1); // Stop the server so you notice the error
}

// Load ABI from compiled artifacts
const artifactPath = path.join(__dirname, '../../blockchain/artifacts/contracts/CertificateRegistry.sol/CertificateRegistry.json');
let ABI;
try {
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  ABI = artifact.abi;
} catch (err) {
  console.error(' Failed to load contract ABI:', err.message);
  process.exit(1);
}

// Initialize Ethers
const provider = new ethers.JsonRpcProvider(RPC_URL);
const signer = new ethers.Wallet(PRIVATE_KEY, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

// Log success on startup
console.log(`Blockchain connected: ${CONTRACT_ADDRESS}`);

module.exports = { contract, provider, signer, CONTRACT_ADDRESS };