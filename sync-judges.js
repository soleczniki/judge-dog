// ── FCI Judge Sync (diff/upsert) ───────────────────────────────────────────────
// Reads fci-full-raw.json, compares with Firestore, adds/updates only what changed.
// Does NOT delete judges that have disappeared (they may have reviews).
// Run: node sync-judges.js
// CI:  set FIREBASE_SERVICE_ACCOUNT env var with service account JSON contents

import { readFileSync, existsSync, writeFileSync } from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const admin = require("firebase-admin");

// Auth: prefer env var (CI), fall back to local file
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : JSON.parse(readFileSync("./serviceAccount.json", "utf8"));

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const PROTECTED_IDS = ["bogdan-karpovic","j1","j2","j3","j4","j5","j6","j7","j8"];

function toSlug(name) {
  return name.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function assignSlugs(judges) {
  const counts = {};
  judges.forEach(j => { const b = toSlug(j.name); counts[b] = (counts[b]||0)+1; });
  const used = {};
  return judges.map(j => {
    const base = toSlug(j.name);
    if (counts[base] === 1) return { ...j, slug: base };
    used[base] = (used[base]||0)+1;
    return { ...j, slug: `${base}-${used[base]}` };
  });
}

function fieldsChanged(existing, incoming) {
  const watched = ["name","country","flag","breeds","groupNames","allBreedJudge","orgs",
    "fciLicenceId","fciLicenceCountry","birthYear","licensedYear","suspensions","disciplines"];
  return watched.some(k => JSON.stringify(existing[k]) !== JSON.stringify(incoming[k]));
}

async function sync() {
  console.log("🔄 FCI Judge Sync starting...");

  if (!existsSync("fci-full-raw.json")) {
    console.error("❌ fci-full-raw.json not found."); process.exit(1);
  }

  const raw = JSON.parse(readFileSync("fci-full-raw.json", "utf8"));
  const incoming = assignSlugs(
    raw.judges.filter(j => j && j.id && j.name).map(j => ({
      ...j,
      suspensions: (j.suspensions||[]).map(cells =>
        Array.isArray(cells) ? cells.filter(Boolean).join(" | ") : cells
      ),
    }))
  );
  console.log(`📊 ${incoming.length} judges in fci-full-raw.json`);

  // Fetch all current Firestore judge IDs + data
  console.log("📥 Fetching current Firestore judges...");
  const snap = await db.collection("judges").get();
  const existing = {};
  snap.docs.forEach(d => { existing[d.id] = d.data(); });
  console.log(`📊 ${Object.keys(existing).length} judges currently in Firestore`);

  const toAdd = [];
  const toUpdate = [];

  for (const judge of incoming) {
    if (PROTECTED_IDS.includes(judge.id)) continue;
    if (!existing[judge.id]) {
      toAdd.push(judge);
    } else if (fieldsChanged(existing[judge.id], judge)) {
      // Preserve user-added fields (bio, profilePhoto, social, etc.)
      toUpdate.push({ ...existing[judge.id], ...judge });
    }
  }

  console.log(`\n📋 Changes: ${toAdd.length} new, ${toUpdate.length} updated, ${Object.keys(existing).length - toUpdate.length - toAdd.length} unchanged`);

  const BATCH_SIZE = 400;
  const allChanges = [...toAdd, ...toUpdate];

  if (allChanges.length === 0) {
    console.log("✅ Nothing to sync — Firestore is up to date.");
    process.exit(0);
  }

  for (let i = 0; i < allChanges.length; i += BATCH_SIZE) {
    const batch = db.batch();
    allChanges.slice(i, i + BATCH_SIZE).forEach(j => {
      batch.set(db.collection("judges").doc(j.id), j, { merge: true });
    });
    await batch.commit();
    console.log(`  ✅ ${Math.min(i + BATCH_SIZE, allChanges.length)}/${allChanges.length} written`);
  }

  console.log(`\n🎉 Sync complete: ${toAdd.length} added, ${toUpdate.length} updated.`);

  // Write summary for GitHub Actions step output
  if (process.env.GITHUB_OUTPUT) {
    writeFileSync(process.env.GITHUB_OUTPUT,
      `added=${toAdd.length}\nupdated=${toUpdate.length}\n`,
      { flag: "a" }
    );
  }

  process.exit(0);
}

sync().catch(e => { console.error("❌", e.message); process.exit(1); });
