const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying ForensicEvidence contract...");
  console.log("Deployer address:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "C2FLR");

  if (balance === 0n) {
    console.error("\nERROR: Deployer has 0 balance.");
    console.error("Get testnet tokens at: https://faucet.flare.network (select Coston2)");
    process.exit(1);
  }

  const ForensicEvidence = await ethers.getContractFactory("ForensicEvidence");
  const contract = await ForensicEvidence.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("\nForensicEvidence deployed to:", address);

  // Deployer is already INVESTIGATOR_ROLE via constructor — log confirmation
  const INVESTIGATOR_ROLE = await contract.INVESTIGATOR_ROLE();
  const isAuth = await contract.hasRole(INVESTIGATOR_ROLE, deployer.address);
  console.log("Deployer has INVESTIGATOR_ROLE:", isAuth);

  console.log("\n─────────────────────────────────────────────────────");
  console.log("Add to your .env:");
  console.log(`FLARE_CONTRACT_ADDRESS=${address}`);
  console.log("─────────────────────────────────────────────────────");
  console.log("\nView on Coston2 Explorer:");
  console.log(`https://coston2-explorer.flare.network/address/${address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
