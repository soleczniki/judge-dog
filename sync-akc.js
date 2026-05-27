// ── AKC Judge Sync (diff/upsert) ─────────────────────────────────────────────
// Reads akc-full-raw.json, compares with Firestore, adds/updates changed judges.
// Does NOT delete existing judges.
// Run: node sync-akc.js

import { readFileSync, existsSync } from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const admin = require("firebase-admin");
const serviceAccount = JSON.parse(readFileSync("./serviceAccount.json", "utf8"));

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const TRACKED_FIELDS = [
  "name","country","orgs","akcJudgeNumber","akcFeeInfo","akcJudgeUrl",
  "akcVisitingJudge","akcProvisionalBreeds","disciplines","breeds",
  "authorizedBreeds","allBreedJudge","groupNames","suspensions","status",
];

function hasChanged(existing, incoming) {
  return TRACKED_FIELDS.some(f => JSON.stringify(existing[f]) !== JSON.stringify(incoming[f]));
}

async function syncAkc() {
  console.log("🔄 AKC Judge Sync starting...");

  if (!existsSync("akc-full-raw.json")) {
    console.error("❌ akc-full-raw.json not found."); process.exit(1);
  }

  const raw = JSON.parse(readFileSync("akc-full-raw.json", "utf8"));
  const incoming = raw.judges.filter(j => j && j.id && j.name);
  console.log(`📊 ${incoming.length} judges in akc-full-raw.json`);

  console.log("📥 Fetching existing Firestore judges...");
  const existing = await db.collection("judges").get();
  const existingMap = {};
  existing.docs.forEach(d => { existingMap[d.id] = d.data(); });
  console.log(`   ${existing.size} judges currently in Firestore`);

  const toAdd    = [];
  const toUpdate = [];

  for (const judge of incoming) {
    const ex = existingMap[judge.id];
    if (!ex) {
      toAdd.push({ ...judge, slugAliases: [] });
    } else {
      const oldSlug = ex.slug;
      const newSlug = judge.slug;
      const existingAliases = ex.slugAliases || [];
      const slugAliases = oldSlug && oldSlug !== newSlug && !existingAliases.includes(oldSlug)
        ? [...existingAliases, oldSlug] : existingAliases;

      if (hasChanged(ex, judge)) {
        toUpdate.push({
          ...ex, ...judge,
          slugAliases,
          bio:          ex.bio          || "",
          social:       ex.social       || {},
          verified:     ex.verified     || false,
          claimedBy:    ex.claimedBy    || null,
          profilePhoto: ex.profilePhoto || null,
          highlights:   ex.highlights   || [],
          headline:     ex.headline     || "",
          lastUpdated:  new Date().toISOString(),
        });
      } else if (slugAliases.length !== existingAliases.length) {
        toUpdate.push({ ...ex, slugAliases, lastUpdated: new Date().toISOString() });
      }
    }
  }

  console.log(`\n📋 Summary:`);
  console.log(`   New:       ${toAdd.length}`);
  console.log(`   Updated:   ${toUpdate.length}`);
  console.log(`   Unchanged: ${incoming.length - toAdd.length - toUpdate.length}`);

  const allChanges = [...toAdd, ...toUpdate];
  if (allChanges.length === 0) {
    console.log("\n✅ Nothing to sync — Firestore is up to date.");
    process.exit(0);
  }

  const BATCH_SIZE = 400;
  let written = 0;
  for (let i = 0; i < allChanges.length; i += BATCH_SIZE) {
    const batch = db.batch();
    allChanges.slice(i, i + BATCH_SIZE).forEach(j => {
      batch.set(db.collection("judges").doc(j.id), j, { merge: true });
    });
    await batch.commit();
    written += Math.min(BATCH_SIZE, allChanges.length - i);
    console.log(`   📤 ${written}/${allChanges.length} written...`);
  }

  console.log(`\n🎉 Sync complete! ${toAdd.length} added, ${toUpdate.length} updated.`);
  process.exit(0);
}

syncAkc().catch(e => {
  console.error("❌ Error:", e.message);
  process.exit(1);
});
