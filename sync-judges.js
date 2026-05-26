// ── FCI Judge Sync (diff/upsert) ──────────────────────────────────────────────
// Reads fci-full-raw.json, compares with Firestore, adds/updates changed judges.
// Does NOT delete existing judges (they may have reviews/claims attached).
// Run: node sync-judges.js

import { readFileSync, existsSync, writeFileSync } from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const admin = require("firebase-admin");
const serviceAccount = JSON.parse(readFileSync("./serviceAccount.json", "utf8"));

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const PROTECTED_IDS = ["bogdan-karpovic", "j1","j2","j3","j4","j5","j6","j7","j8"];

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

// Fields to compare for change detection (skip user-editable fields like bio/social/verified)
const TRACKED_FIELDS = [
  "name","country","flag","fciLicenceCountry","fciLicenceId","fciLicenceDate",
  "breeds","allBreedJudge","groupNames","authorizedBreeds","disciplines",
  "disciplineGroups","suspensions","birthYear","licensedYear","kennelClub","status",
];

function hasChanged(existing, incoming) {
  return TRACKED_FIELDS.some(f => JSON.stringify(existing[f]) !== JSON.stringify(incoming[f]));
}

async function syncJudges() {
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

  // Fetch all existing Firestore judges
  console.log("📥 Fetching existing Firestore judges...");
  const existing = await db.collection("judges").get();
  const existingMap = {};
  existing.docs.forEach(d => { existingMap[d.id] = d.data(); });
  console.log(`   ${existing.size} judges currently in Firestore`);

  const toAdd = [];
  const toUpdate = [];

  for (const judge of incoming) {
    if (PROTECTED_IDS.includes(judge.id)) continue;
    if (!existingMap[judge.id]) {
      toAdd.push(judge);
    } else if (hasChanged(existingMap[judge.id], judge)) {
      // Merge: keep user-editable fields (bio, social, verified, claimedBy, etc.)
      toUpdate.push({ ...existingMap[judge.id], ...judge,
        bio: existingMap[judge.id].bio || judge.bio || "",
        social: existingMap[judge.id].social || {},
        verified: existingMap[judge.id].verified || false,
        claimedBy: existingMap[judge.id].claimedBy || null,
        profilePhoto: existingMap[judge.id].profilePhoto || null,
        highlights: existingMap[judge.id].highlights || [],
        headline: existingMap[judge.id].headline || "",
        lastUpdated: new Date().toISOString(),
      });
    }
  }

  console.log(`\n📋 Summary:`);
  console.log(`   New judges:     ${toAdd.length}`);
  console.log(`   Updated judges: ${toUpdate.length}`);
  console.log(`   Unchanged:      ${incoming.length - toAdd.length - toUpdate.length}`);

  const allChanges = [...toAdd, ...toUpdate];
  if (allChanges.length === 0) {
    console.log("\n✅ Nothing to sync — Firestore is up to date.");
    process.exit(0);
  }

  // Write in batches of 400
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

  // Regenerate sitemap
  const BASE = "https://judge.dog";
  const TODAY = new Date().toISOString().slice(0, 10);
  const staticPages = [
    { url:"/",        priority:"1.0", changefreq:"daily" },
    { url:"/privacy", priority:"0.3", changefreq:"monthly" },
    { url:"/terms",   priority:"0.3", changefreq:"monthly" },
    { url:"/cookies", priority:"0.3", changefreq:"monthly" },
  ];
  const judgeUrls = incoming.map(j => ({ url:`/judge/${j.slug}`, priority:"0.8", changefreq:"weekly" }));
  const allUrls = [...staticPages, ...judgeUrls];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.map(({url,priority,changefreq})=>`  <url>
    <loc>${BASE}${url}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`).join("\n")}
</urlset>`;
  writeFileSync("public/sitemap.xml", xml);
  console.log(`\n🗺️  Sitemap updated: ${allUrls.length} URLs`);

  console.log(`\n🎉 Sync complete! ${toAdd.length} added, ${toUpdate.length} updated.`);
  process.exit(0);
}

syncJudges().catch(e => {
  console.error("❌ Error:", e.message);
  process.exit(1);
});
