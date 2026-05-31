// Fix judge names in akc-full-raw.json.
// The scraper captured only the <b> prefix ("Mr.", "Mrs.") instead of the full name
// for some judges. This script re-runs Phase 1 (ID collection only, no detail pages)
// to get the full name text from the complete list and state searches, then patches
// any judge whose name is a bare prefix.

import puppeteer from "puppeteer";
import fs from "fs";

const OUTPUT = "akc-full-raw.json";
const BASE   = "https://www.apps.akc.org/apps/judges_directory";
const COMPLETE_LIST = "https://www.apps.akc.org/a/judges_directory/judge_search/";
const PREFIXES = new Set(["mr","mrs","ms","dr","prof","rev","mr.","mrs.","ms.","dr."]);

const STATES = [
  "CA","TX","FL","NY","PA","OH","IL","MI","GA","NC",
  "NJ","VA","WA","AZ","MA","TN","IN","MO","MD","WI",
  "CO","MN","SC","AL","LA","KY","OR","OK","CT","UT",
  "IA","NV","AR","MS","KS","NE","NM","WV","ID","HI",
  "NH","ME","MT","RI","DE","SD","ND","AK","VT","WY",
  "DC","PR","GU","VI","AS","MP",
];

const DISCIPLINE_ACTIONS = ["oat","performance","jshw"];

function sleep(ms) { return new Promise(r=>setTimeout(r,ms)); }

function cfClean(v) {
  if (!v) return "";
  if (/^\[empty string\]$/i.test(v.trim())) return "";
  return v.trim();
}

function isBarePrefix(name) {
  if (!name) return true;
  const words = name.trim().toLowerCase().split(/\s+/);
  return words.length <= 1 || (words.length === 2 && PREFIXES.has(words[0]) && words[1].length <= 2);
}

function toTitleCase(str) {
  if (!str) return "";
  const LOWER = new Set(["de","van","von","del","la","le","di","da","of","the","jr","sr"]);
  return str.trim().toLowerCase().split(/\s+/).map((w,i) => {
    if (i>0 && LOWER.has(w)) return w;
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(" ");
}

function toSlug(name) {
  return name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"")
    .replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
}

// Load current data
const data = JSON.parse(fs.readFileSync(OUTPUT,"utf8"));
const judges = data.judges || [];

// Find judges with broken names
const broken = judges.filter(j => isBarePrefix(j.name));
console.log(`Total judges: ${judges.length}`);
console.log(`Judges with bare prefix names: ${broken.length}`);

if (broken.length === 0) {
  console.log("✅ All names look good — nothing to fix.");
  process.exit(0);
}

const brokenIds = new Set(broken.map(j => j.akcJudgeNumber?.toString()));
const nameMap = new Map(); // judgeNumber → full name

// ── Collect names from all sources ────────────────────────────────────────────
const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage"],
  defaultViewport: { width: 1280, height: 900 },
});
const page = await browser.newPage();
await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

// 1. Complete conformation list
console.log("\n📋 Loading complete conformation list...");
await page.goto(COMPLETE_LIST, { waitUntil:"networkidle2", timeout:30000 });
await sleep(2000);
const confJudges = await page.evaluate(() =>
  Array.from(document.querySelectorAll("a"))
    .map(a => {
      const m = a.href.match(/judge_id=([^&]+)/);
      if (!m) return null;
      const text = a.textContent.trim();
      const dashIdx = text.lastIndexOf(" - ");
      const namePart = dashIdx > -1 ? text.slice(0, dashIdx).trim() : text;
      const words = namePart.split(" ");
      const nameRaw = words.slice(0, words.length-2).join(" "); // remove state + country
      return { id: m[1], name: nameRaw };
    }).filter(Boolean)
);
confJudges.forEach(j => { if (brokenIds.has(j.id)) nameMap.set(j.id, j.name); });
console.log(`   Found names for ${nameMap.size}/${broken.length} broken judges`);

// 2. State searches for remaining
const stillMissing = broken.filter(j => !nameMap.has(j.akcJudgeNumber?.toString()));
if (stillMissing.length > 0) {
  console.log(`\n🔍 State searches for remaining ${stillMissing.length} judges...`);
  const missingIds = new Set(stillMissing.map(j => j.akcJudgeNumber?.toString()));

  async function parseCfDump() {
    return page.evaluate(() => {
      for (const t of document.querySelectorAll("table")) {
        const rows = Array.from(t.querySelectorAll("tr"));
        for (let i=0; i<rows.length; i++) {
          const cells = Array.from(rows[i].querySelectorAll(":scope > th, :scope > td")).map(c=>c.textContent.trim());
          if (cells.filter(x=>/^[A-Z]{2,}(_[A-Z]+)*$/.test(x)).length>=5 && cells.includes("NUM_JUDGE")) {
            const headers = cells;
            return rows.slice(i+1).map(row=>{
              const c = Array.from(row.querySelectorAll(":scope > td, :scope > th")).map(c=>c.textContent.trim());
              const obj = {};
              headers.forEach((h,idx)=>{ if(h) obj[h]=c[idx]||""; });
              return obj;
            }).filter(r=>r.NUM_JUDGE);
          }
        }
      }
      return [];
    });
  }

  for (const action of ["conf", ...DISCIPLINE_ACTIONS]) {
    if (nameMap.size >= broken.length) break;
    for (const state of STATES) {
      if (nameMap.size >= broken.length) break;
      try {
        const url = action === "conf"
          ? `${BASE}/index.cfm?action=conf`
          : `${BASE}/index.cfm?action=${action}`;
        await page.goto(url, { waitUntil:"domcontentloaded", timeout:30000 });
        await sleep(400);
        await page.select('select[name="states"]', state).catch(()=>{});
        await sleep(200);
        const nav = page.waitForNavigation({ waitUntil:"domcontentloaded", timeout:30000 });
        page.evaluate(() => {
          const f = document.querySelector("form");
          if (f) { f.action = f.action.replace(/index\.cfm.*/, "index.cfm?action=results"); f.submit(); }
        }).catch(()=>{});
        await nav;
        await sleep(800);
        const rows = await parseCfDump();
        rows.forEach(r => {
          const id = cfClean(r.NUM_JUDGE);
          if (!missingIds.has(id) || nameMap.has(id)) return;
          const name = [cfClean(r.TEXT_PREFIX),cfClean(r.TEXT_NAME_FIRST),cfClean(r.TEXT_NAME_MIDDLE),cfClean(r.TEXT_NAME_LAST_OR_OTHER),cfClean(r.TEXT_SUFFIX)].filter(Boolean).join(" ");
          if (name && !isBarePrefix(name)) nameMap.set(id, name);
        });
      } catch(e) { /* continue */ }
      await sleep(400);
    }
    console.log(`   After ${action}: ${nameMap.size}/${broken.length} found`);
  }
}

await browser.close();

// ── Patch names ───────────────────────────────────────────────────────────────
let patched = 0;
const updatedJudges = judges.map(j => {
  const id = j.akcJudgeNumber?.toString();
  if (!isBarePrefix(j.name) || !nameMap.has(id)) return j;
  const rawName = nameMap.get(id);
  const fullName = toTitleCase(rawName);
  const words = rawName.split(/\s+/);
  patched++;
  return {
    ...j,
    name: fullName,
    lastName:  toTitleCase(words[words.length-1]||""),
    firstName: toTitleCase(words[words.length>=2?words.length-2:0]||""),
    slug: toSlug(fullName),
  };
});

// Re-assign slugs to avoid duplicates
const counts = {};
updatedJudges.forEach(j => { const b = toSlug(j.name); counts[b]=(counts[b]||0)+1; });
const used = {};
const final = updatedJudges.map(j => {
  const base = toSlug(j.name);
  if (counts[base]===1) return {...j,slug:base};
  used[base]=(used[base]||0)+1;
  return {...j,slug:`${base}-${used[base]}`};
});

fs.writeFileSync(OUTPUT, JSON.stringify({count:final.length,judges:final},null,2));
console.log(`\n✅ Patched ${patched} names. Saved to ${OUTPUT}.`);
console.log(`   Still unfixed: ${broken.length - patched} (no name found in any source)`);
