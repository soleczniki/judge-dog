// ── AKC Judge Scraper ─────────────────────────────────────────────────────────
// Uses Puppeteer (handles browser fingerprint headers + cookie session).
// Phase 1: POST state search → extract judge IDs from hidden cfdump table
// Phase 2: GET each judge's detail page → breeds, types, fee info
//
// Run (first 100):  node scrape-akc.js
// Run (all):        node scrape-akc.js --all
// Output:           akc-full-raw.json

import puppeteer from "puppeteer";
import fs from "fs";
import { akcTypesToGroups } from "./akc-disciplines.js";

const args = process.argv.slice(2);
const ALL_MODE   = args.includes("--all");
const MAX_JUDGES = ALL_MODE ? 99999 : 100;
const DELAY_MS   = parseInt(args.find(a=>a.startsWith("--delay="))?.split("=")[1] || "500");
const OUTPUT     = "akc-full-raw.json";
const PROGRESS   = "akc-progress.json";
const BASE       = "https://www.apps.akc.org/apps/judges_directory";

// All US states + DC + territories (ordered largest → smallest for variety)
const STATES = [
  "CA","TX","FL","NY","PA","OH","IL","MI","GA","NC",
  "NJ","VA","WA","AZ","MA","TN","IN","MO","MD","WI",
  "CO","MN","SC","AL","LA","KY","OR","OK","CT","UT",
  "IA","NV","AR","MS","KS","NE","NM","WV","ID","HI",
  "NH","ME","MT","RI","DE","SD","ND","AK","VT","WY",
  "DC","PR","GU","VI","AS","MP",
];

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

// ColdFusion cfdump outputs "[empty string]" (any case) for null/empty cell values.
// Strip those so they don't pollute name and address fields.
function cfClean(v) {
  if (!v) return "";
  if (/^\[empty string\]$/i.test(v.trim())) return "";
  return v.trim();
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

// ── Parse the cfdump table ────────────────────────────────────────────────────
// AKC cfdump is NESTED:
//   Outer table: caption row + "RESULTSET | [inner data table]" row
//   Inner table: proper column headers (NUM_JUDGE, TEXT_NAME_FIRST, …) + data rows
//
// Strategy: scan ALL tables (querySelectorAll is recursive), find the one whose
// header row has 5+ direct-child cells matching ALLCAPS_UNDERSCORE (column names).
// Use :scope selectors to avoid bleeding into nested cells.
async function parseCfDump(page) {
  return page.evaluate(() => {
    const tables = document.querySelectorAll("table");
    let dumpTable = null;
    let hdrIdx = 0;

    for (const t of tables) {
      const rows = Array.from(t.querySelectorAll("tr"));
      for (let i = 0; i < rows.length; i++) {
        // Direct children only — avoids picking up nested table cell text
        const cells = Array.from(rows[i].querySelectorAll(":scope > th, :scope > td"));
        const texts = cells.map(c => c.textContent.trim());
        const allCapsCount = texts.filter(x => /^[A-Z]{2,}(_[A-Z]+)*$/.test(x)).length;
        // Must include NUM_JUDGE — this uniquely identifies the judge data table
        // (other tables on the page may coincidentally have 5+ ALLCAPS cells)
        if (allCapsCount >= 5 && texts.includes("NUM_JUDGE")) {
          dumpTable = t;
          hdrIdx = i;
          break;
        }
      }
      if (dumpTable) break;
    }

    if (!dumpTable) return [];

    const rows = Array.from(dumpTable.querySelectorAll("tr"));
    const headers = Array.from(rows[hdrIdx].querySelectorAll(":scope > th, :scope > td"))
      .map(c => c.textContent.trim());

    return rows.slice(hdrIdx + 1).map(row => {
      const cells = Array.from(row.querySelectorAll(":scope > td, :scope > th"))
        .map(c => c.textContent.trim());
      const obj = {};
      headers.forEach((h, i) => { if(h) obj[h] = cells[i] || ""; });
      return obj;
    }).filter(r => r.NUM_JUDGE);
  });
}

// ── Load complete conformation judge list + prime CF session ──────────────────
// The page https://www.apps.akc.org/a/judges_directory/judge_search/ lists all
// 3,100+ AKC conformation judges as links. Loading it also primes the CF session
// so subsequent detail page requests work for any judge (no state search needed).
const COMPLETE_LIST_URL = "https://www.apps.akc.org/a/judges_directory/judge_search/";

async function primeSessionAndGetIds(page) {
  console.log("📋 Loading AKC complete conformation judge list...");
  await page.goto(COMPLETE_LIST_URL, { waitUntil: "networkidle2", timeout: 30000 });
  await sleep(2000);
  const judges = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("a"))
      .map(a => {
        const m = a.href.match(/judge_id=([^&]+)/);
        if (!m) return null;
        const text = a.textContent.trim();
        // Format: "Mr. Richard D Albee Alabama USA - 57263"
        const dashIdx = text.lastIndexOf(" - ");
        const namePart = dashIdx > -1 ? text.slice(0, dashIdx).trim() : text;
        // Extract state and country from end of name part
        // e.g. "Mr. Richard D Albee Alabama USA"
        const words = namePart.split(" ");
        const country = words[words.length - 1] || "USA";
        const stateOrProvince = words[words.length - 2] || "";
        // Name is everything before the state
        const nameRaw = words.slice(0, words.length - 2).join(" ");
        return { judgeNumber: m[1], nameRaw, stateOrProvince, country };
      })
      .filter(Boolean);
  });
  console.log(`✅ Found ${judges.length} conformation judges. Session primed.`);
  return judges;
}

// ── Fetch full detail for one judge (breeds + types) ─────────────────────────
async function fetchJudgeDetail(page, judgeNumber) {
  try {
    const url = `${BASE}/index.cfm?action=refresh_index&active_tab_row=1&active_tab_col=1&fixed_tab=1&judge_id=${judgeNumber}`;
    await page.goto(url, { waitUntil: "load", timeout: 25000 });
    await sleep(800);

    return page.evaluate(() => {
      // ── Judge types ────────────────────────────────────────────────────────
      // The detail page has a cell that contains "Judge Type: Herding Test, Herding Trial"
      // It may be in the same cell as "Judge's Number: XXXXX" (combined label cell).
      // Search for "Judge Type:" anywhere inside any cell's text.
      const allCells = Array.from(document.querySelectorAll("td,th"))
        .map(el => el.textContent);
      const judgeTypes = [];
      for (const cell of allCells) {
        const m = cell.match(/judge type:\s*([^\n\r]+)/i);
        if (m) {
          m[1].trim().split(/[,;]/).map(s => s.trim()).filter(Boolean).forEach(t => {
            if (!judgeTypes.includes(t)) judgeTypes.push(t);
          });
          break;
        }
      }

      // ── Breed approvals table ──────────────────────────────────────────────
      // The breed table has header "Breed/Group/Class | Status [| Date]"
      // The first column may be empty (leading blank in cfdump layout) — detect
      // column indices dynamically from the header row.
      const breedApprovals = [];
      const seenBreeds = new Set();
      const CF_JUNK = new Set(["RESULTSET","SQL","CACHENAME","DATASOURCE","DBTYPE",
                               "EXECUTIONTIME","CACHED","RECORDCOUNT","COLUMNLIST"]);

      document.querySelectorAll("table").forEach(table => {
        if (!/breed|group|class/i.test(table.textContent)) return;
        const rows = Array.from(table.querySelectorAll("tr"));
        if (rows.length < 2) return;

        // Find header row and determine column offsets
        let breedIdx = 0, statusIdx = 1, dateIdx = 2;
        for (const row of rows) {
          const cells = Array.from(row.querySelectorAll(":scope > td, :scope > th"))
            .map(c => c.textContent.trim());
          if (cells.some(c => /breed|group|class/i.test(c))) {
            breedIdx  = cells.findIndex(c => /breed|group|class/i.test(c));
            statusIdx = cells.findIndex(c => /status/i.test(c));
            if (statusIdx === -1) statusIdx = breedIdx + 1;
            dateIdx   = statusIdx + 1;
            break;
          }
        }

        rows.forEach(tr => {
          // Skip header rows (th elements)
          if (tr.querySelectorAll(":scope > th").length > 0) return;
          const cells = Array.from(tr.querySelectorAll(":scope > td"))
            .map(td => td.textContent.trim());
          if (cells.length <= breedIdx) return;
          const breed = cells[breedIdx];
          if (!breed || breed.length < 2 || seenBreeds.has(breed)) return;
          if (/^[A-Z_\s]+$/.test(breed) || CF_JUNK.has(breed)) return;
          if (/^\[empty string\]$/i.test(breed)) return;
          // Only skip the exact header text, not "Hound Group", "Toy Group" etc.
          if (/^breed\/group\/class$/i.test(breed.trim())) return;
          // Filter SQL / cfdump query text leaking through
          if (/SELECT\s|FROM\s|WHERE\s|pr_judge_search/i.test(breed)) return;
          if (breed.includes('\n') || breed.length > 80) return;
          const statusRaw = cells[statusIdx] || "";
          // Status can be: "Approved", "Approved - Jul, 02 2025",
          // "(Appr. Oct, 14 2008  Prov/Permit May, 01 2007)", "Prov/Permit Jan, 11 2018"
          // A breed is Approved if it contains "Appr" (not part of "Prov").
          // A breed is Provisional only if it has Prov/Permit with NO approval date.
          const isApproved = /\bappr\b/i.test(statusRaw) || /^approved/i.test(statusRaw.trim());
          const isProv     = !isApproved && /prov|permit/i.test(statusRaw);
          if (!isApproved && !isProv) return;
          seenBreeds.add(breed);
          // Extract the approval date if present
          const approvedMatch = statusRaw.match(/appr\.?\s+([A-Z][a-z]+,?\s+\d+,?\s+\d{4})/i);
          const provMatch     = statusRaw.match(/prov[^,]*\s+([A-Z][a-z]+,?\s+\d+,?\s+\d{4})/i);
          const dateStr = approvedMatch ? approvedMatch[1] : (provMatch ? provMatch[1] : null);
          breedApprovals.push({
            breed,
            status: isApproved ? "Approved" : "Provisional",
            date: dateStr,
          });
        });
      });

      return { judgeTypes, breedApprovals };
    });
  } catch(e) {
    return { judgeTypes: [], breedApprovals: [], error: e.message };
  }
}

// ── Map raw data → Firestore judge schema ─────────────────────────────────────
function mapToJudge(basic, detail) {
  const { judgeNumber, nameFirst, nameLast, nameMiddle, prefix, suffix,
          city, stateCode, feeInfo, judgeUrl, visitingJudge, email } = basic;

  const nameParts = [
    toTitleCase(prefix),
    toTitleCase(nameFirst),
    nameMiddle ? toTitleCase(nameMiddle.replace(/\.*$/,"").trim()) + "." : "",
    toTitleCase(nameLast),
    suffix ? suffix.replace(/\.*$/,"").trim() : "",
  ].filter(Boolean);
  const fullName = nameParts.join(" ").trim();

  const provisionalBreeds = (detail.breedApprovals||[]).filter(b=>b.status==="Provisional").map(b=>b.breed);
  const allBreeds         = (detail.breedApprovals||[]).map(b=>b.breed);
  const disciplines       = detail.judgeTypes?.length ? detail.judgeTypes : ["Conformation"];
  const disciplineGroups  = akcTypesToGroups(detail.judgeTypes || []);
  const initials = [toTitleCase(nameFirst)[0], toTitleCase(nameLast)[0]].filter(Boolean).join("").toUpperCase() || "??";

  return {
    id: `akc_${judgeNumber}`,
    fciUrlId: null, fciLicenceId: null, fciLicenceCountry: null, fciLicenceNumber: null,

    name: fullName,
    lastName:  toTitleCase(nameLast),
    firstName: toTitleCase(nameFirst),
    title: toTitleCase(prefix) || null,
    photo: initials,

    country: "United States",
    flag: "🇺🇸",
    kennelClub: "American Kennel Club",
    kennelClubCountry: "United States",
    countryOfResidence: city ? `${toTitleCase(city)}, ${stateCode}` : "United States",

    orgs: [{ org: "AKC", id: judgeNumber }],
    akcJudgeNumber: parseInt(judgeNumber) || null,
    akcFeeInfo: feeInfo || null,
    akcJudgeUrl: judgeUrl || null,
    akcVisitingJudge: visitingJudge || false,
    akcProvisionalBreeds: provisionalBreeds,

    disciplines,
    disciplineGroups,
    allBreedJudge: false,
    groupNames: [], groupJudge: [],
    authorizedBreeds: (detail.breedApprovals||[]).map(b=>({
      name: b.breed, fciNumber: null, status: b.status, approvedDate: b.date||null,
    })),
    breeds: allBreeds,

    suspensions: [],
    contact: { email: email||null, phone: null, address: null },
    birthYear: null, licensedDate: null, licensedYear: null,
    fciLanguages: [], otherLanguages: [], kennelName: null, bisJudge: false,
    slug: toSlug(fullName), slugAliases: [],
    verified: false, claimedBy: null, bio: "", social: {}, highlights: [], headline: "",
    source: "AKC", status: "active",
    scrapedAt: new Date().toISOString(), lastUpdated: new Date().toISOString(),
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`🐕 AKC Judge Scraper — target: ${MAX_JUDGES===99999?"ALL":MAX_JUDGES} judges | delay ${DELAY_MS}ms`);

  let existingJudges = [];
  let scrapedIds = new Set();
  if (fs.existsSync(OUTPUT)) {
    const prev = JSON.parse(fs.readFileSync(OUTPUT,"utf8"));
    existingJudges = prev.judges || [];
    scrapedIds = new Set(existingJudges.map(j=>j.akcJudgeNumber?.toString()));
    console.log(`📂 Resuming — ${existingJudges.length} judges already scraped`);
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage"],
    defaultViewport: { width: 1280, height: 900 },
  });
  const page = await browser.newPage();
  // Use a real Chrome UA to pass WAF checks
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

  // ── Phase 1: collect judge IDs ───────────────────────────────────────────
  console.log("\n📋 Phase 1: Collecting judge IDs from state searches...");
  const collectedBasic = [];
  const seenIds = new Set(scrapedIds);

  for (const state of STATES) {
    const needed = MAX_JUDGES - (existingJudges.length + collectedBasic.filter(j=>!scrapedIds.has(j.judgeNumber)).length);
    if (needed <= 0) break;

    process.stdout.write(`   ${state}... `);
    const stateJudges = await fetchStateIds(page, state);
    const newOnes = stateJudges.filter(j => !seenIds.has(j.judgeNumber));
    newOnes.forEach(j => seenIds.add(j.judgeNumber));
    collectedBasic.push(...newOnes);
    console.log(`${stateJudges.length} judges (${collectedBasic.length} new collected)`);
    await sleep(DELAY_MS);
  }

  const toProcess = collectedBasic
    .filter(j => !scrapedIds.has(j.judgeNumber))
    .slice(0, MAX_JUDGES - existingJudges.length);

  console.log(`\n🔍 Phase 2: Detail pages for ${toProcess.length} judges...`);

  const allJudges = [...existingJudges];
  for (let i=0; i<toProcess.length; i++) {
    const basic = toProcess[i];
    const detail = await fetchJudgeDetail(page, basic.judgeNumber);
    const judge = mapToJudge(basic, detail);
    allJudges.push(judge);

    const total = allJudges.length;
    if (total<=10 || total%10===0 || detail.error) {
      const flag = detail.error ? "⚠️ " : "✅";
      console.log(`${flag} [#${basic.judgeNumber}] ${judge.name} | ${detail.judgeTypes?.join(",")||"Conformation"} | breeds:${detail.breedApprovals?.length||0} | total:${total}`);
    }
    if (total%10===0 || i===toProcess.length-1) {
      const withSlugs = assignSlugs(allJudges);
      fs.writeFileSync(OUTPUT, JSON.stringify({count:withSlugs.length,judges:withSlugs},null,2));
      fs.writeFileSync(PROGRESS, JSON.stringify({count:total,savedAt:new Date().toISOString()}));
      process.stdout.write(`💾 Saved ${total}\n`);
    }
    await sleep(DELAY_MS);
  }

  const final = assignSlugs(allJudges);
  fs.writeFileSync(OUTPUT, JSON.stringify({count:final.length,judges:final},null,2));
  fs.writeFileSync(PROGRESS, JSON.stringify({count:final.length,done:true,savedAt:new Date().toISOString()}));
  console.log(`\n🎉 Done! ${final.length} AKC judges → ${OUTPUT}`);
  await browser.close();
}

main().catch(e => { console.error("❌ Fatal:", e.message); process.exit(1); });
