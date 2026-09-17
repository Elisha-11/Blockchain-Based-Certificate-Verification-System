const hre = require("hardhat");
const { ethers } = hre;
require("dotenv").config();

// Derives the same per-institution addresses the backend will derive from
// BLOCKCHAIN_MNEMONIC (see backend/config/blockchain.js) and authorises each
// of them, so a freshly deployed contract is immediately usable end to end
// instead of requiring a separate manual authorisation pass.
function deriveInstitutionAddresses(mnemonic, count) {
  const addresses = [];
  for (let i = 0; i < count; i++) {
    const wallet = ethers.HDNodeWallet.fromPhrase(mnemonic, undefined, `m/44'/60'/0'/0/${i}`);
    addresses.push({ index: i, address: wallet.address });
  }
  return addresses;
}

async function main() {
  const CertificateRegistry = await hre.ethers.getContractFactory("CertificateRegistry");

  console.log("Deploying CertificateRegistry...");
  const registry = await CertificateRegistry.deploy();
  await registry.waitForDeployment();

  const address = await registry.getAddress();
  console.log(`CertificateRegistry deployed to: ${address}`);

  const mnemonic = process.env.BLOCKCHAIN_MNEMONIC;
  const count = parseInt(process.env.INSTITUTION_WALLET_COUNT || "0", 10);

  if (!mnemonic || !count) {
    console.log("BLOCKCHAIN_MNEMONIC / INSTITUTION_WALLET_COUNT not set — skipping institution authorisation.");
    console.log("Set both in blockchain/.env and re-run to authorise institution wallets automatically.");
    return;
  }

  const institutionWallets = deriveInstitutionAddresses(mnemonic, count);

  console.log(`Authorising ${institutionWallets.length} institution wallet(s)...`);
  for (const { index, address: walletAddress } of institutionWallets) {
    const tx = await registry.authoriseInstitution(walletAddress);
    await tx.wait();
    console.log(`  [${index}] ${walletAddress} authorised`);
  }

  console.log("\nPaste these into the institutions table (wallet_index, wallet_address):");
  console.table(institutionWallets);
}

// Execute the script
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
