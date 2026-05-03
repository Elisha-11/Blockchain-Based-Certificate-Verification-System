const hre = require("hardhat");

async function main() {
  // Get the contract factory for CertificateRegistry
  const CertificateRegistry = await hre.ethers.getContractFactory("CertificateRegistry");

  // Deploy the contract
  console.log("Deploying CertificateRegistry...");
  const registry = await CertificateRegistry.deploy();

  // Wait for deployment to finish
  await registry.waitForDeployment();

  // Get the deployed address
  const address = await registry.getAddress();
  console.log(`CertificateRegistry deployed to: ${address}`);
}

// Execute the script
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});