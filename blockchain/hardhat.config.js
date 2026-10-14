import { defineConfig } from "hardhat/config";
import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import dotenv from "dotenv";

dotenv.config();

export default defineConfig({
  plugins: [hardhatToolboxMochaEthersPlugin],
  defaultNetwork: "localhost",
  solidity: {
    version: "0.8.20",
    settings: {
      // Ganache doesn't support the PUSH0 opcode solc 0.8.20 emits by
      // default (its default EVM target is Shanghai), so target Paris.
      evmVersion: "paris",
    },
  },
  networks: {
    // Points at Ganache. Start Ganache (GUI or `ganache`) before running
    // any task against this network — Hardhat does not start it for you.
    localhost: {
      type: "http",
      url: process.env.GANACHE_RPC_URL || "http://127.0.0.1:8545",
    },
    sepolia: {
      type: "http",
      url: process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org",
      accounts: process.env.DEPLOYER_PRIVATE_KEY
        ? [process.env.DEPLOYER_PRIVATE_KEY]
        : [],
    },
  },
});
