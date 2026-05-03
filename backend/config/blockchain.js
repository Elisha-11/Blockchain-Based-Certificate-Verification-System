const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// --- CONFIGURATION ---
const RPC_URL = 'http://127.0.0.1:8545'; // Local Hardhat Node
const CONTRACT_ADDRESS = '0x5fbdb2315678afecb367f032d93f642f64180aa3'; // <-- PASTE YOUR ADDRESS HERE

// --- PRIVATE KEY ---
// This is the default Private Key for Account #0 in Hardhat Node
// If your terminal showed a different key for Account #0, replace it here.
const PRIVATE_KEY = '0xac0974bec39a87054948a86a58deea4c5c02433658d9402f75d4d0a0a0a0a0a0'; 

// --- LOAD ABI ---
// We load the ABI from the compiled artifacts in the blockchain folder
const artifactPath = path.join(__dirname, '../../blockchain/artifacts/contracts/CertificateRegistry.sol/CertificateRegistry.json');
const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
const ABI = artifact.abi;

// --- SETUP ETHERS ---
const provider = new ethers.JsonRpcProvider(RPC_URL);
const signer = new ethers.Wallet(PRIVATE_KEY, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

module.exports = {
  contract,
  provider,
  signer,
  CONTRACT_ADDRESS
};