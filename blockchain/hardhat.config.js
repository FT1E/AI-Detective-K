require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: "../.env" });

const privateKey = process.env.FLARE_PRIVATE_KEY;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    coston2: {
      url: process.env.FLARE_RPC_URL || "https://coston2-api.flare.network/ext/C/rpc",
      accounts: privateKey ? [privateKey] : [],
      chainId: 114,
    },
    flare: {
      url: "https://flare-api.flare.network/ext/C/rpc",
      accounts: privateKey ? [privateKey] : [],
      chainId: 14,
    },
  },
  // Silence the "no test files" warning when running deploy/test scripts
  mocha: {
    timeout: 120000,
  },
};
