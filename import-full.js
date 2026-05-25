// ── FCI Full Importer ─────────────────────────────────────────────────────────
// Imports judges from scrape-fci-full.js or scrape-test-50.js output.
// Usage:
//   node import-full.js fci-test-50.json        ← test run (merges/replaces)
//   node import-full.js fci-full-raw.json        ← full production run
//   node import-full.js fci-full-raw.json --dry  ← dry run (no writes)
//
// Requires serviceAccount.json in same folder.

import { readFileSync } from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const admin = require("firebase-admin");
const serviceAccount = JSON.parse(readFileSync("./serviceAccount.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const [,, inputFile = "fci-test-50.json", ...flags] = process.argv;
const DRY = flags.includes("--dry");
const MERGE = flags.includes("--merge"); // keep existing judges not in this file

const BATCH_SIZE = 400;

async function run() {
  console.log(`🐕 FCI Full Importer`);
  console.log(`   Input:  ${inputFile}`);
  console.log(`   Mode:   ${DRY ? "DRY RUN" : MERGE ? "merge" : "replace all"}`);

  const raw = JSON.parse(readFileSync(inputFile, "utf8"));
  const judges = raw.judges || [];
  console.log(`\n📊 ${judges.length} judges in file`);

  // Validation check
  const sample = judges.slice(0, 5);
  console.log("\n📋 Sample:");
  sample.forEach(j => console.log(`  ${j.flag||"🌍"} ${j.name} (${j.country}) — breeds: ${j.breeds?.length||0}${j.allBreedJudge?" [all-breed]":""}`));

  const allBreedCount = judges.filter(j => j.allBreedJudge).length;
  const withBreeds    = judges.filter(j => j.breeds?.length > 0).length;
  const noBreeds      = judges.filter(j => !j.breeds?.length).length;
  console.log(`\n📊 All-breed: ${allBreedCount} | With breeds: ${withBreeds} | No breeds: ${noBreeds}`);

  if (DRY) {
    console.log("\n✅ Dry run complete — no writes.");
    process.exit(0);
  }

  console.log(`\n⚠️  Will ${MERGE ? "merge" : "replace ALL existing judges"} with ${judges.length} entries.`);
  console.log("Waiting 5 seconds — Ctrl+C to cancel...");
  await new Promise(r => setTimeout(r, 5000));

  if (!MERGE) {
    console.log("\n🗑️  Clearing existing judges...");
    const existing = await db.collection("judges").get();
    let deleted = 0;
    for (let i = 0; i < existing.docs.length; i += BATCH_SIZE) {
      const batch = db.batch();
      existing.docs.slice(i, i + BATCH_SIZE).forEach(d => batch.delete(d.ref));
      await batch.commit();
      deleted += Math.min(BATCH_SIZE, existing.docs.length - i);
    }
    console.log(`  ✅ Deleted ${deleted} existing judges`);
  }

  console.log(`\n📤 Pushing ${judges.length} judges...`);
  let pushed = 0;
  for (let i = 0; i < judges.length; i += BATCH_SIZE) {
    const batch = db.batch();
    judges.slice(i, i + BATCH_SIZE).forEach(j => {
      const ref = db.collection("judges").doc(j.id);
      batch.set(ref, j, MERGE ? { merge: true } : undefined);
    });
    await batch.commit();
    pushed += Math.min(BATCH_SIZE, judges.length - i);
    console.log(`  📤 ${pushed}/${judges.length}`);
  }

  console.log(`\n🎉 Done! ${judges.length} judges imported.`);
  process.exit(0);
}

run().catch(e => { console.error("❌", e.message); process.exit(1); });
