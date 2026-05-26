// ── FCI Judge Importer v3 (Admin SDK) ─────────────────────────────────────────
// Run with: node import-judges.js
// Requires: fci-full-raw.json and serviceAccount.json in same folder

import { readFileSync, existsSync } from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const admin = require("firebase-admin");
const serviceAccount = JSON.parse(readFileSync("./serviceAccount.json", "utf8"));

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// These IDs are never deleted (hidden test/admin profiles)
const PROTECTED_IDS = ["bogdan-karpovic", "j1","j2","j3","j4","j5","j6","j7","j8"];

async function importJudges() {
  console.log("🐕 FCI Judge Importer v3 starting...");

  if (!existsSync("fci-full-raw.json")) {
    console.error("❌ fci-full-raw.json not found! Run the scraper first."); process.exit(1);
  }

  const raw = JSON.parse(readFileSync("fci-full-raw.json", "utf8"));
  const judges = raw.judges.filter(j => j && j.id && j.name);
  console.log(`📊 Loaded ${judges.length} judges from fci-full-raw.json`);

  // Show sample names for verification
  console.log("\n📋 Sample names:");
  judges.slice(0, 10).forEach(j => console.log(`  ${j.flag} ${j.name} (${j.country}) [${j.fciLicenceId || j.id}]`));

  console.log(`\n⚠️  Will replace all non-protected judges with ${judges.length} scraped entries.`);
  console.log(`   Protected (never deleted): ${PROTECTED_IDS.join(", ")}`);
  console.log("Waiting 5 seconds... Press Ctrl+C to cancel.");
  await new Promise(r=>setTimeout(r,5000));

  // Delete all existing non-protected judges
  console.log("\n🗑️  Clearing existing judges...");
  const existing = await db.collection("judges").get();
  const toDelete = existing.docs.filter(d => !PROTECTED_IDS.includes(d.id));
  if (toDelete.length > 0) {
    const deleteBatch = db.batch();
    toDelete.forEach(d => deleteBatch.delete(d.ref));
    await deleteBatch.commit();
  }
  console.log(`  ✅ Deleted ${toDelete.length} existing judges (kept ${existing.docs.length - toDelete.length} protected)`);

  // Push in batches of 400
  console.log(`\n📤 Pushing ${judges.length} judges...`);
  const BATCH_SIZE = 400;
  let pushed = 0;

  for (let i = 0; i < judges.length; i += BATCH_SIZE) {
    const batch = db.batch();
    judges.slice(i, i + BATCH_SIZE).forEach(j => {
      batch.set(db.collection("judges").doc(j.id), j);
    });
    await batch.commit();
    pushed += Math.min(BATCH_SIZE, judges.length - i);
    console.log(`  📤 ${pushed}/${judges.length} pushed...`);
  }

  console.log(`\n🎉 Done! ${judges.length} FCI judges imported.`);
  process.exit(0);
}

importJudges().catch(e => {
  console.error("❌ Error:", e.message);
  process.exit(1);
});
