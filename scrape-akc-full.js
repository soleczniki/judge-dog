// ── AKC Full Judge Scraper ─────────────────────────────────────────────────────
// Scrapes ALL AKC judges across all disciplines.
//
// Phase 1 — Collect all unique judge IDs:
//   a) Complete conformation list (one page, ~3,100+ judges)
//   b) State-by-state search for OAT / Performance / Junior Showmanship
//   Merges and deduplicates by judge ID.
//
// Phase 2 — Detail per unique judge:
//   - Breed & Group Judging Status (Approved/Provisional with dates)
//   - Future Assignments (stored, not shown publicly yet)
//   - Past Assignments (stored, not shown publicly yet)
//
// Run:    node scrape-akc-full.js
// Resume: node scrape-akc-full.js   (auto-resumes from checkpoint)
// Output: akc-full-raw.json

import puppeteer from "puppeteer";
import fs from "fs";
import { akcTypesToGroups } from "./akc-disciplines.js";

const args = process.argv.slice(2);
const DELAY_MS      = parseInt(args.find(a=>a.startsWith("--delay="))?.split("=")[1] || "700");
const RESTART_EVERY = 250;
const SAVE_EVERY    = 25;
const OUTPUT        = "akc-full-raw.json";
const PROGRESS      = "akc-full-progress.json";
const BASE          = "https://www.apps.akc.org/apps/judges_directory";
const COMPLETE_LIST = "https://www.apps.akc.org/a/judges_directory/judge_search/";

const STATES = [
  "CA","TX","FL","NY","PA","OH","IL","MI","GA","NC",
  "NJ","VA","WA","AZ","MA","TN","IN","MO","MD","WI",
  "CO","MN","SC","AL","LA","KY","OR","OK","CT","UT",
  "IA","NV","AR","MS","KS","NE","NM","WV","ID","HI",
  "NH","ME","MT","RI","DE","SD","ND","AK","VT","WY",
  "DC","PR","GU","VI","AS","MP",
];

// Discipline search actions for state-by-state scraping
const DISCIPLINE_ACTIONS = ["oat", "performance", "jshw"];

function sleep(ms) { return new Promise(r=>setTimeout(r,ms)); }

function toTitleCase(str) {
  if (!str) return "";
  const LOWER = new Set(["de","van","von","del","la","le","di","da","of","the","jr","sr"]);
  return str.trim().toLowerCase().split(/\s+/).map((w,i) => {
    if (i>0 && LOWER.has(w)) return w;
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(" ");
}

function toSlug(name) {
  return name.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g,"")
    .replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
}

function cfClean(v) {
  if (!v) return "";
  if (/^\[empty string\]$/i.test(v.trim())) return "";
  return v.trim();
}

let browser, page;

async function initBrowser(label="") {
  if (browser) { try { await browser.close(); } catch(e) {} browser=null; page=null; }
  browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage"],
    defaultViewport: { width: 1280, height: 900 },
  });
  page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
  // Prime CF session via complete list page
  try {
    await page.goto(COMPLETE_LIST, { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(1500);
    console.log(`✅ Browser ready${label?" ("+label+")":""}`);
  } catch(e) { console.log(`⚠️  Prime failed: ${e.message}`); }
}

// ── Phase 1a: Get all conformation judges from complete list ─────────────────
async function getConformationIds() {
  console.log("📋 Loading complete conformation judge list...");
  await page.goto(COMPLETE_LIST, { waitUntil: "networkidle2", timeout: 30000 });
  await sleep(2000);
  const judges = await page.evaluate(() =>
    Array.from(document.querySelectorAll("a"))
      .map(a => {
        const m = a.href.match(/judge_id=([^&]+)/);
        if (!m) return null;
        const text = a.textContent.trim();
        const dashIdx = text.lastIndexOf(" - ");
        const namePart = dashIdx > -1 ? text.slice(0, dashIdx).trim() : text;
        const words = namePart.split(" ");
        const country = words[words.length-1] || "USA";
        const state = words[words.length-2] || "";
        const nameRaw = words.slice(0, words.length-2).join(" ");
        return { judgeNumber: m[1], nameRaw, state, country };
      })
      .filter(Boolean)
  );
  console.log(`   Found ${judges.length} conformation judges`);
  return judges;
}

// ── Phase 1b: State-by-state search for a specific discipline ────────────────
async function parseCfDump(page) {
  return page.evaluate(() => {
    for (const t of document.querySelectorAll("table")) {
      const rows = Array.from(t.querySelectorAll("tr"));
      for (let i=0; i<rows.length; i++) {
        const cells = Array.from(rows[i].querySelectorAll(":scope > th, :scope > td")).map(c=>c.textContent.trim());
        const caps = cells.filter(x=>/^[A-Z]{2,}(_[A-Z0-9]+)*$/.test(x)).length;
        if (caps>=5 && cells.includes("NUM_JUDGE")) {
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

async function getDisciplineStateIds(action, state) {
  try {
    // Navigate to the discipline search page
    await page.goto(`${BASE}/index.cfm?action=${action}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await sleep(600);
    await page.select('select[name="states"]', state).catch(()=>{});
    await sleep(200);
    const nav = page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 });
    page.evaluate(() => {
      const f = document.querySelector("form");
      if (f) { f.action = f.action.replace(/index\.cfm.*/, "index.cfm?action=results"); f.submit(); }
    }).catch(()=>{});
    await nav;
    await sleep(1200);
    const rows = await parseCfDump(page);
    return rows.map(r => ({
      judgeNumber:  cfClean(r.NUM_JUDGE),
      nameRaw:      [cfClean(r.TEXT_PREFIX), cfClean(r.TEXT_NAME_FIRST), cfClean(r.TEXT_NAME_MIDDLE), cfClean(r.TEXT_NAME_LAST_OR_OTHER), cfClean(r.TEXT_SUFFIX)].filter(Boolean).join(" "),
      state:        cfClean(r.CDE_STATE_PROVINCE)||state,
      country:      cfClean(r.CDE_COUNTRY)||"USA",
      email:        cfClean(r.TEXT_E_MAIL1)||"",
    })).filter(j=>j.judgeNumber);
  } catch(e) {
    console.warn(`  ⚠️  ${action}/${state}: ${e.message.slice(0,60)}`);
    return [];
  }
}

// ── Phase 2: Scrape detail for one judge ─────────────────────────────────────
async function fetchJudgeDetail(judgeNumber) {
  const detailUrl = `${BASE}/index.cfm?action=refresh_index&active_tab_row=1&active_tab_col=1&fixed_tab=1&judge_id=${judgeNumber}`;
  try {
    await page.goto(detailUrl, { waitUntil: "load", timeout: 25000 });
    await sleep(600);

    // Parse breed page + extract tab hrefs for assignments
    const breedData = await page.evaluate(() => {
      // ── Judge types ──────────────────────────────────────────────────────
      const allCells = Array.from(document.querySelectorAll("td,th")).map(el=>el.textContent);
      const judgeTypes = [];
      for (const cell of allCells) {
        const m = cell.match(/judge type:\s*([^\n\r]+)/i);
        if (m) {
          m[1].trim().split(/[,;]/).map(s=>s.trim()).filter(Boolean).forEach(t=>{
            if (!judgeTypes.includes(t)) judgeTypes.push(t);
          });
          break;
        }
      }

      // ── Judge name from page ─────────────────────────────────────────────
      const nameEl = document.querySelector("table td b, table td strong");
      const pageNameRaw = nameEl?.textContent?.trim()||"";

      // ── Initial breed ────────────────────────────────────────────────────
      let initialBreed = null;
      for (const cell of document.querySelectorAll("td")) {
        if (/^initial breed:/i.test(cell.textContent.trim())) {
          initialBreed = cell.textContent.trim().replace(/^initial breed:\s*/i,"").trim();
          break;
        }
      }

      // ── Breed approvals ──────────────────────────────────────────────────
      const breedApprovals = [];
      const seenBreeds = new Set();
      const CF_JUNK = new Set(["RESULTSET","SQL","CACHENAME","DATASOURCE","DBTYPE","EXECUTIONTIME","CACHED","RECORDCOUNT","COLUMNLIST"]);

      document.querySelectorAll("table").forEach(table => {
        if (!/breed|group|class/i.test(table.textContent)) return;
        const rows = Array.from(table.querySelectorAll("tr"));
        if (rows.length < 2) return;
        let breedIdx=0, statusIdx=1;
        for (const row of rows) {
          const cells = Array.from(row.querySelectorAll(":scope > td, :scope > th")).map(c=>c.textContent.trim());
          if (cells.some(c=>/breed|group|class/i.test(c))) {
            breedIdx  = cells.findIndex(c=>/breed|group|class/i.test(c));
            statusIdx = cells.findIndex(c=>/status/i.test(c));
            if (statusIdx===-1) statusIdx=breedIdx+1;
            break;
          }
        }
        rows.forEach(tr => {
          if (tr.querySelectorAll(":scope > th").length > 0) return;
          const cells = Array.from(tr.querySelectorAll(":scope > td")).map(td=>td.textContent.trim());
          if (cells.length <= breedIdx) return;
          const breed = cells[breedIdx];
          if (!breed || breed.length < 2 || breed.length > 80 || seenBreeds.has(breed)) return;
          if (/^[A-Z_\s]+$/.test(breed) || CF_JUNK.has(breed)) return;
          if (/^\[empty string\]$/i.test(breed)) return;
          if (/^breed\/group\/class$/i.test(breed.trim())) return;
          if (/SELECT\s|FROM\s|WHERE\s|pr_judge_search/i.test(breed)) return;
          if (breed.includes('\n')) return;
          const statusRaw = cells[statusIdx]||"";
          const isApproved = /\bappr\b/i.test(statusRaw) || /^approved/i.test(statusRaw.trim());
          const isProv = !isApproved && /prov|permit/i.test(statusRaw);
          if (!isApproved && !isProv) return;
          seenBreeds.add(breed);
          const approvedMatch = statusRaw.match(/appr\.?\s+([A-Z][a-z]+,?\s+\d+,?\s+\d{4})/i);
          const provMatch = statusRaw.match(/prov[^,]*\s+([A-Z][a-z]+,?\s+\d+,?\s+\d{4})/i);
          breedApprovals.push({
            breed,
            status: isApproved ? "Approved" : "Provisional",
            approvedDate: approvedMatch?.[1]||null,
            provDate: provMatch?.[1]||null,
          });
        });
      });

      // ── Tab hrefs for Future/Past Assignments ────────────────────────────
      const tabHrefs = {};
      Array.from(document.querySelectorAll("a.tabs__anchor")).forEach(a => {
        const text = a.textContent.trim().toLowerCase();
        if (text.includes("future")) tabHrefs.future = a.href;
        if (text.includes("past"))   tabHrefs.past   = a.href;
      });

      return { judgeTypes, pageNameRaw, initialBreed, breedApprovals, tabHrefs };
    });

    // ── Fetch Future Assignments ─────────────────────────────────────────────
    let futureAssignments = [];
    if (breedData.tabHrefs.future) {
      futureAssignments = await fetchAssignments(breedData.tabHrefs.future);
    }

    // ── Fetch Past Assignments ───────────────────────────────────────────────
    let pastAssignments = [];
    if (breedData.tabHrefs.past) {
      pastAssignments = await fetchAssignments(breedData.tabHrefs.past);
    }

    return { ...breedData, futureAssignments, pastAssignments };
  } catch(e) {
    return { judgeTypes:[], pageNameRaw:"", initialBreed:null, breedApprovals:[], tabHrefs:{}, futureAssignments:[], pastAssignments:[], error:e.message };
  }
}

async function fetchAssignments(url) {
  try {
    await page.goto(url, { waitUntil: "load", timeout: 20000 });
    await sleep(500);
    return page.evaluate(() => {
      const assignments = [];
      document.querySelectorAll("table").forEach(table => {
        if (/RESULTSET|pr_judge_search|SELECT/i.test(table.textContent)) return;
        const rows = Array.from(table.querySelectorAll("tr"));
        if (rows.length < 2) return;
        // Find header row
        let headers = null;
        let headerIdx = -1;
        for (let i=0; i<rows.length; i++) {
          const cells = Array.from(rows[i].querySelectorAll("td,th")).map(c=>c.textContent.trim());
          // Assignment tables have Date, Show Name, Location, Breeds etc.
          if (cells.some(c=>/date|show|location|breed|club/i.test(c)) && cells.length >= 2) {
            headers = cells;
            headerIdx = i;
            break;
          }
        }
        if (!headers) return;
        rows.slice(headerIdx+1).forEach(tr => {
          const cells = Array.from(tr.querySelectorAll("td")).map(td=>td.textContent.trim().replace(/\s+/g," "));
          if (cells.length < 2 || cells.every(c=>!c)) return;
          const obj = {};
          headers.forEach((h,i) => { if (h && cells[i]) obj[h.toLowerCase().replace(/\s+/g,"_")] = cells[i]; });
          if (Object.keys(obj).length > 0) assignments.push(obj);
        });
      });
      return assignments;
    });
  } catch(e) { return []; }
}

// ── Map to judge schema ───────────────────────────────────────────────────────
function mapToJudge(basic, detail) {
  const { judgeNumber, nameRaw, state, country, email } = basic;
  const nameFromPage = detail.pageNameRaw || nameRaw;
  const nameParts = nameFromPage.split(/\s+/).filter(Boolean);
  const fullName = toTitleCase(nameParts.join(" "));
  const initials = [nameParts[nameParts.length >= 2 ? nameParts.length-2 : 0]?.[0],
                    nameParts[nameParts.length-1]?.[0]].filter(Boolean).join("").toUpperCase() || "??";

  const provisionalBreeds = (detail.breedApprovals||[]).filter(b=>b.status==="Provisional").map(b=>b.breed);
  const allBreeds         = (detail.breedApprovals||[]).map(b=>b.breed);
  const disciplines       = detail.judgeTypes?.length ? detail.judgeTypes : ["Conformation"];
  const disciplineGroups  = akcTypesToGroups(detail.judgeTypes||[]);

  // BIS judge if "Best In Show" is in their approved list
  const bisJudge = allBreeds.some(b=>/best in show/i.test(b));

  return {
    id: `akc_${judgeNumber}`,
    fciUrlId: null, fciLicenceId: null, fciLicenceCountry: null, fciLicenceNumber: null,

    name: fullName,
    lastName:  toTitleCase(nameParts[nameParts.length-1]||""),
    firstName: toTitleCase(nameParts[nameParts.length>=2?nameParts.length-2:0]||""),
    photo: initials,

    country: country==="USA" ? "United States" : toTitleCase(country),
    flag: "🇺🇸",
    kennelClub: "American Kennel Club",
    kennelClubCountry: "United States",
    countryOfResidence: state ? `${state}, United States` : "United States",

    orgs: [{ org: "AKC", id: judgeNumber }],
    akcJudgeNumber: parseInt(judgeNumber) || null,
    akcInitialBreed: detail.initialBreed||null,
    akcProvisionalBreeds: provisionalBreeds,

    disciplines,
    disciplineGroups,
    allBreedJudge: false,
    groupNames: [], groupJudge: [],
    authorizedBreeds: (detail.breedApprovals||[]).map(b=>({
      name: b.breed, fciNumber: null,
      status: b.status,
      approvedDate: b.approvedDate||null,
      provDate: b.provDate||null,
    })),
    breeds: allBreeds,
    bisJudge,

    // Assignments — stored for internal calendar, not shown publicly yet
    futureAssignments: detail.futureAssignments||[],
    pastAssignments:   detail.pastAssignments||[],

    suspensions: [],
    contact: { email: email||null, phone: null, address: null },
    birthYear: null, licensedDate: null, licensedYear: null,
    fciLanguages: [], otherLanguages: [], kennelName: null,
    slug: toSlug(fullName), slugAliases: [],
    verified: false, claimedBy: null, bio: "", social: {}, highlights: [], headline: "",
    source: "AKC", status: "active",
    scrapedAt: new Date().toISOString(), lastUpdated: new Date().toISOString(),
  };
}

function assignSlugs(judges) {
  const counts = {};
  judges.forEach(j => { const b = toSlug(j.name); counts[b]=(counts[b]||0)+1; });
  const used = {};
  return judges.map(j => {
    const base = toSlug(j.name);
    if (counts[base]===1) return {...j, slug:base};
    used[base]=(used[base]||0)+1;
    return {...j, slug:`${base}-${used[base]}`};
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🐕 AKC Full Judge Scraper");
  console.log("   Phase 1: collect all judge IDs from all disciplines");
  console.log("   Phase 2: detail + assignments per unique judge\n");

  // Load checkpoint
  let existingJudges = [];
  let scrapedIds = new Set();
  if (fs.existsSync(OUTPUT)) {
    const prev = JSON.parse(fs.readFileSync(OUTPUT,"utf8"));
    existingJudges = prev.judges||[];
    scrapedIds = new Set(existingJudges.map(j=>j.akcJudgeNumber?.toString()));
    console.log(`📂 Resuming — ${existingJudges.length} judges already scraped`);
  }

  let collectedProgress = {};
  if (fs.existsSync(PROGRESS)) {
    collectedProgress = JSON.parse(fs.readFileSync(PROGRESS,"utf8"));
  }

  await initBrowser("start");

  // ── Phase 1: Collect all unique judge IDs ──────────────────────────────────
  const judgeMap = new Map(); // judgeNumber → basic info

  // 1a. Conformation complete list
  if (!collectedProgress.confDone) {
    const confJudges = await getConformationIds();
    confJudges.forEach(j => { if (!judgeMap.has(j.judgeNumber)) judgeMap.set(j.judgeNumber, j); });
    collectedProgress.confDone = true;
    fs.writeFileSync(PROGRESS, JSON.stringify({...collectedProgress, confCount:judgeMap.size}));
    console.log(`   Conformation: ${confJudges.length} judges (${judgeMap.size} unique total)`);
    await sleep(1000);
  } else {
    console.log("   Conformation: already collected (resuming)");
    // Rebuild from existing scraped IDs as placeholders — real names from detail page
    if (collectedProgress.allIds) {
      collectedProgress.allIds.forEach(id => judgeMap.set(id, { judgeNumber: id, nameRaw:"", state:"", country:"USA", email:"" }));
    }
  }

  // 1b. Discipline-specific state searches
  for (const action of DISCIPLINE_ACTIONS) {
    const actionKey = `done_${action}`;
    if (collectedProgress[actionKey]) {
      console.log(`   ${action}: already collected (resuming)`);
      continue;
    }
    const beforeCount = judgeMap.size;
    process.stdout.write(`   ${action}: `);
    for (const state of STATES) {
      const judges = await getDisciplineStateIds(action, state);
      let added = 0;
      judges.forEach(j => { if (!judgeMap.has(j.judgeNumber)) { judgeMap.set(j.judgeNumber, j); added++; } });
      process.stdout.write(`${state}(+${added}) `);
      await sleep(DELAY_MS);
    }
    const newJudges = judgeMap.size - beforeCount;
    console.log(`\n   → ${newJudges} new judges from ${action} (${judgeMap.size} unique total)`);
    collectedProgress[actionKey] = true;
    collectedProgress.allIds = [...judgeMap.keys()];
    fs.writeFileSync(PROGRESS, JSON.stringify(collectedProgress));
    await sleep(1000);
  }

  // Remove already-scraped judges
  const toProcess = [...judgeMap.values()].filter(j => !scrapedIds.has(j.judgeNumber));
  console.log(`\n✅ Phase 1 complete: ${judgeMap.size} unique judges`);
  console.log(`🔍 Phase 2: ${toProcess.length} judges to scrape (${scrapedIds.size} already done)\n`);

  // ── Phase 2: Detail fetch ──────────────────────────────────────────────────
  const allJudges = [...existingJudges];
  let processed = 0;

  for (let i=0; i<toProcess.length; i++) {
    const basic = toProcess[i];

    // Restart browser periodically
    if (i>0 && i%RESTART_EVERY===0) {
      await initBrowser(`restart at ${i}/${toProcess.length}`);
    }

    const detail = await fetchJudgeDetail(basic.judgeNumber);
    const judge  = mapToJudge(basic, detail);
    allJudges.push(judge);
    processed++;

    const flag = detail.error ? "⚠️ " : "✅";
    const disciplines = detail.judgeTypes?.join(",") || "Conformation";
    const future = detail.futureAssignments?.length||0;
    const past   = detail.pastAssignments?.length||0;
    if (processed <= 10 || processed%25===0 || detail.error) {
      console.log(`${flag} [${basic.judgeNumber}] ${judge.name} | ${disciplines} | breeds:${detail.breedApprovals?.length||0} | future:${future} past:${past}`);
    }

    if (processed%SAVE_EVERY===0 || i===toProcess.length-1) {
      const withSlugs = assignSlugs(allJudges);
      fs.writeFileSync(OUTPUT, JSON.stringify({count:withSlugs.length, judges:withSlugs},null,2));
      fs.writeFileSync(PROGRESS, JSON.stringify({...collectedProgress, scraped:processed, savedAt:new Date().toISOString()}));
      process.stdout.write(`💾 Saved ${allJudges.length}\n`);
    }

    await sleep(DELAY_MS);
  }

  const final = assignSlugs(allJudges);
  fs.writeFileSync(OUTPUT, JSON.stringify({count:final.length, judges:final},null,2));
  console.log(`\n🎉 Done! ${final.length} AKC judges → ${OUTPUT}`);
  await browser.close();
}

main().catch(e => { console.error("❌ Fatal:", e.message); process.exit(1); });
