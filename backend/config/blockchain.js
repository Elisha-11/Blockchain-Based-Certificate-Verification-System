const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// ⚠️ CRITICAL: REPLACE WITH YOUR ACTUAL DEPLOYED ADDRESS
const CONTRACT_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3'; // ← PASTE YOUR ADDRESS HERE

const RPC_URL = 'http://127.0.0.1:8545';
const PRIVATE_KEY = '0xea6c44ac03bff858b476bba40716402b03e41b8e97e276d1baec7c37d42484a0';

// Validate address BEFORE proceeding
if (!CONTRACT_ADDRESS || !CONTRACT_ADDRESS.startsWith('0x') || CONTRACT_ADDRESS.length !== 42) {
  console.error(' FATAL: CONTRACT_ADDRESS is invalid');
  console.error(' Expected: 0x + 40 hex chars (e.g., 0x5FbDB2315678afecb367f032d93F642f64180aa3)');
  process.exit(1);
}

// Load ABI
const artifactPath = path.join(__dirname, '../../blockchain/artifacts/contracts/CertificateRegistry.sol/CertificateRegistry.json');
let ABI;
try {
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  ABI = artifact.abi;
} catch (err) {
  console.error(' Failed to load ABI:', err.message);
  process.exit(1);
}

// Initialize Ethers
const provider = new ethers.JsonRpcProvider(RPC_URL);
const signer = new ethers.Wallet(PRIVATE_KEY, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

//  Log on startup
console.log(` Blockchain connected: ${CONTRACT_ADDRESS}`);

//  Export BOTH the contract AND the address string separately
module.exports = { 
  contract, 
  provider, 
  signer, 
  CONTRACT_ADDRESS  // ← This is the key fix: export the raw address string
};