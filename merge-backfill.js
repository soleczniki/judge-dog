// Merges fci-backfill-raw.json into fci-full-raw.json
// De-duplicates by fciUrlId, backfill wins on conflict (fresher scrape)
import fs from "fs";

const mainFile     = "fci-full-raw.json";
const backfillFile = "fci-backfill-raw.json";

if (!fs.existsSync(backfillFile)) {
  console.error("❌ fci-backfill-raw.json not found — nothing to merge");
  process.exit(1);
}

const main     = JSON.parse(fs.readFileSync(mainFile,     "utf8"));
const backfill = JSON.parse(fs.readFileSync(backfillFile, "utf8"));

const mainJudges     = main.judges     || [];
const backfillJudges = backfill.judges || [];

console.log(`📂 Main:     ${mainJudges.length} judges`);
console.log(`📂 Backfill: ${backfillJudges.length} judges`);

// Index main by fciUrlId
const byId = new Map(mainJudges.map(j => [j.fciUrlId, j]));

let added = 0, updated = 0;
for (const j of backfillJudges) {
  if (!byId.has(j.fciUrlId)) {
    byId.set(j.fciUrlId, j);
    added++;
  } else {
    byId.set(j.fciUrlId, j); // backfill overwrites (fresher)
    updated++;
  }
}

// Sort by fciUrlId ascending
const merged = [...byId.values()].sort((a,b) => a.fciUrlId - b.fciUrlId);

fs.writeFileSync(mainFile, JSON.stringify({ count: merged.length, judges: merged }, null, 2));
console.log(`✅ Merged → ${merged.length} total judges (+${added} new, ${updated} updated)`);
console.log(`💾 Saved to ${mainFile}`);
