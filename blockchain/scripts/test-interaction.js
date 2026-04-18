const { ethers } = require("hardhat");

async function main() {
  const contractAddress = process.env.FLARE_CONTRACT_ADDRESS;
  if (!contractAddress) {
    console.error("FLARE_CONTRACT_ADDRESS not set in .env");
    process.exit(1);
  }

  const ForensicEvidence = await ethers.getContractFactory("ForensicEvidence");
  const contract = ForensicEvidence.attach(contractAddress);

  const [signer] = await ethers.getSigners();
  console.log("Testing contract at:", contractAddress);
  console.log("Signer:", signer.address);

  let passed = 0;
  const total = 7;

  // ── Test 1: Create case ──────────────────────────────────────────────────
  const caseId = `DK-20260418-TEST01`;
  const metadataHash = ethers.keccak256(
    ethers.toUtf8Bytes(JSON.stringify({ sensors: ["rgb", "thermal", "depth"], location: "Test Crime Scene" }))
  );

  process.stdout.write("\n1. Creating test case... ");
  const tx1 = await contract.createCase(caseId, metadataHash);
  const r1 = await tx1.wait();
  console.log("OK  tx:", r1.hash);
  passed++;

  // ── Test 2: Record scene capture ─────────────────────────────────────────
  const eventsHash = ethers.keccak256(ethers.toUtf8Bytes("test events data"));

  process.stdout.write("2. Recording scene capture... ");
  const tx2 = await contract.recordSceneCapture(caseId, eventsHash, 5, ["rgb", "thermal", "depth"]);
  const r2 = await tx2.wait();
  console.log("OK  tx:", r2.hash);
  passed++;

  // ── Test 3: Record report ────────────────────────────────────────────────
  const reportHash = ethers.keccak256(ethers.toUtf8Bytes("test report"));

  process.stdout.write("3. Recording report generation... ");
  const tx3 = await contract.recordReportGeneration(caseId, reportHash, "high", 3);
  const r3 = await tx3.wait();
  console.log("OK  tx:", r3.hash);
  passed++;

  // ── Test 4: Verify known hash ────────────────────────────────────────────
  process.stdout.write("4. Verifying known hash... ");
  const isValid = await contract.verifyHash(caseId, reportHash);
  if (!isValid) throw new Error("verifyHash returned false for a recorded hash");
  console.log("OK  (valid)");
  passed++;

  // ── Test 4b: Verify unknown hash returns false ───────────────────────────
  const fakeHash = ethers.keccak256(ethers.toUtf8Bytes("not recorded"));
  const isFakeValid = await contract.verifyHash(caseId, fakeHash);
  if (isFakeValid) throw new Error("verifyHash returned true for an unknown hash");

  // ── Test 5: Chain of custody ─────────────────────────────────────────────
  process.stdout.write("5. Getting chain of custody... ");
  const custody = await contract.getChainOfCustody(caseId);
  if (custody.length < 3) throw new Error(`Expected >=3 entries, got ${custody.length}`);
  console.log(`OK  (${custody.length} entries)`);
  custody.forEach((e, i) => {
    const ts = new Date(Number(e.timestamp) * 1000).toISOString();
    console.log(`   [${i}] ${e.eventType}  hash=${e.dataHash.slice(0, 10)}...  ${ts}`);
  });
  passed++;

  // ── Test 6: Finalize case ────────────────────────────────────────────────
  process.stdout.write("6. Finalizing case... ");
  const tx4 = await contract.finalizeCase(caseId);
  const r4 = await tx4.wait();
  console.log("OK  tx:", r4.hash);
  passed++;

  // ── Test 7: Verify case is sealed & modifications blocked ────────────────
  process.stdout.write("7. Verifying sealed state... ");
  const caseData = await contract.cases(caseId);
  if (!caseData.isSealed) throw new Error("Case should be sealed");

  let sealBlocked = false;
  try {
    await contract.recordSceneCapture(caseId, eventsHash, 1, ["rgb"]);
  } catch {
    sealBlocked = true;
  }
  if (!sealBlocked) throw new Error("Sealed case should reject writes");
  console.log("OK  (sealed, writes blocked)");
  console.log(`   isSealed:  ${caseData.isSealed}`);
  console.log(`   Created:   ${new Date(Number(caseData.createdAt) * 1000).toISOString()}`);
  console.log(`   Finalized: ${new Date(Number(caseData.finalizedAt) * 1000).toISOString()}`);
  passed++;

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log(`\n${"─".repeat(55)}`);
  console.log(`All ${passed}/${total} tests passed!`);
  console.log(`\nView contract on Coston2 Explorer:`);
  console.log(`https://coston2-explorer.flare.network/address/${contractAddress}`);
}

main().catch((err) => {
  console.error("\nTEST FAILED:", err.message);
  process.exit(1);
});
