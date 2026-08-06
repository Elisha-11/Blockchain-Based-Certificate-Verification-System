require("@nomicfoundation/hardhat-ethers");

module.exports = {
  solidity: "0.8.18",
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org",
      accounts: [process.env.DEPLOYER_PRIVATE_KEY] // Use a DIFFERENT key than Ganache
    }
  }
};