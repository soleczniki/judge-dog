// ── FCI Judge Full Scraper v2 ──────────────────────────────────────────────────
// Enumerates ?id=1 → auto-stop after N consecutive empty
// Run:    node scrape-fci-full.js
// Resume: node scrape-fci-full.js   (auto-resumes from checkpoint)
//
// Output: fci-full-raw.json + fci-full-progress.json

import puppeteer from "puppeteer";
import fs from "fs";
import { FCI_GROUP_NAMES, FCI_GROUP_BREEDS } from "./fci-groups.js";

const args = process.argv.slice(2);
const startFrom = parseInt(args.find(a=>a.startsWith("--start-from="))?.split("=")[1] || "1");
const maxId     = parseInt(args.find(a=>a.startsWith("--max-id="))?.split("=")[1]     || "99999");
const MAX_EMPTY = parseInt(args.find(a=>a.startsWith("--max-empty="))?.split("=")[1]  || "300");
const DELAY_MS  = parseInt(args.find(a=>a.startsWith("--delay="))?.split("=")[1]      || "1200");
// --backfill=827-1126  → ignore progress file, scrape only that ID range, save to fci-backfill-raw.json
const backfillArg = args.find(a=>a.startsWith("--backfill="))?.split("=")[1];
const BACKFILL_MODE = !!backfillArg;
const [bfStart, bfEnd] = backfillArg ? backfillArg.split("-").map(Number) : [null, null];
// Restart browser every N IDs to prevent session expiry / popup re-appearance
const RESTART_EVERY = parseInt(args.find(a=>a.startsWith("--restart-every="))?.split("=")[1] || "50");
const SAVE_EVERY = 50;
const OUTPUT    = BACKFILL_MODE ? "fci-backfill-raw.json" : "fci-full-raw.json";
const PROGRESS  = "fci-full-progress.json";

const FLAGS = {
  "AFGHANISTAN":"🇦🇫","ALBANIA":"🇦🇱","ALGERIA":"🇩🇿","ANDORRA":"🇦🇩","ARGENTINA":"🇦🇷",
  "ARMENIA":"🇦🇲","AUSTRALIA":"🇦🇺","AUSTRIA":"🇦🇹","AZERBAIJAN":"🇦🇿","BAHRAIN":"🇧🇭",
  "BELARUS":"🇧🇾","BELGIUM":"🇧🇪","BOLIVIA":"🇧🇴","BOSNIA AND HERZEGOVINA":"🇧🇦","BRAZIL":"🇧🇷",
  "BULGARIA":"🇧🇬","CANADA":"🇨🇦","CHILE":"🇨🇱","CHINA":"🇨🇳","CHINA (PEOPLE'S REPUBLIC OF)":"🇨🇳",
  "COLOMBIA":"🇨🇴","COSTA RICA":"🇨🇷","CROATIA":"🇭🇷","CUBA":"🇨🇺","CYPRUS":"🇨🇾",
  "CZECH REPUBLIC":"🇨🇿","DENMARK":"🇩🇰","DOMINICAN REPUBLIC":"🇩🇴","ECUADOR":"🇪🇨",
  "EGYPT":"🇪🇬","ESPAÑA":"🇪🇸","ESTONIA":"🇪🇪","FINLAND":"🇫🇮","FRANCE":"🇫🇷",
  "GEORGIA":"🇬🇪","GERMANY":"🇩🇪","GREECE":"🇬🇷","GUATEMALA":"🇬🇹","HONG KONG":"🇭🇰",
  "HUNGARY":"🇭🇺","ICELAND":"🇮🇸","INDIA":"🇮🇳","INDONESIA":"🇮🇩","IRAN":"🇮🇷",
  "IRELAND":"🇮🇪","ISRAEL":"🇮🇱","ITALY":"🇮🇹","JAPAN":"🇯🇵","KAZAKHSTAN":"🇰🇿",
  "KENYA":"🇰🇪","KOREA (REPUBLIC OF)":"🇰🇷","SOUTH KOREA":"🇰🇷","KUWAIT":"🇰🇼",
  "LATVIA":"🇱🇻","LIECHTENSTEIN":"🇱🇮","LITHUANIA":"🇱🇹","LUXEMBOURG":"🇱🇺",
  "MALAYSIA":"🇲🇾","MALTA":"🇲🇹","MEXICO":"🇲🇽","MOLDOVA":"🇲🇩","MONACO":"🇲🇨",
  "MONTENEGRO":"🇲🇪","MOROCCO":"🇲🇦","NETHERLANDS":"🇳🇱","NEW ZEALAND":"🇳🇿",
  "NIGERIA":"🇳🇬","NORTH MACEDONIA":"🇲🇰","NORWAY":"🇳🇴","PANAMA":"🇵🇦",
  "PARAGUAY":"🇵🇾","PERU":"🇵🇪","PHILIPPINES":"🇵🇭","POLAND":"🇵🇱","PORTUGAL":"🇵🇹",
  "PUERTO RICO":"🇵🇷","QATAR":"🇶🇦","ROMANIA":"🇷🇴","RUSSIA":"🇷🇺","SAN MARINO":"🇸🇲",
  "SAUDI ARABIA":"🇸🇦","SERBIA":"🇷🇸","SINGAPORE":"🇸🇬","SLOVAKIA":"🇸🇰",
  "SLOVENIA":"🇸🇮","SOUTH AFRICA":"🇿🇦","SPAIN":"🇪🇸","SWEDEN":"🇸🇪","SWITZERLAND":"🇨🇭",
  "TAIWAN":"🇹🇼","THAILAND":"🇹🇭","TUNISIA":"🇹🇳","TURKEY":"🇹🇷","UKRAINE":"🇺🇦",
  "UNITED ARAB EMIRATES":"🇦🇪","UAE":"🇦🇪","UNITED KINGDOM":"🇬🇧","UK":"🇬🇧",
  "UNITED STATES":"🇺🇸","USA":"🇺🇸","URUGUAY":"🇺🇾","VENEZUELA":"🇻🇪","VIETNAM":"🇻🇳",
};

const DISCIPLINE_GROUPS = {
  "Shows":"A","British Pointers":"B","Continental and British Pointers":"B",
  "Continental Pointers":"B","Retrievers":"B","Spaniels":"B","Nordic Hunting Dogs":"B",
  "Hounds of the 6th Group":"B","Earth Dogs":"B","Water Work":"B",
  "Obedience":"C","Rally Obedience":"C","Utility Dogs":"C","Mondioring":"C",
  "Agility":"D","Hoopers":"D","Flyball":"D","Sighthound Lure Coursing":"D",
  "Sighthound Race":"D","Canicross & Turnierhundsport":"D",
  "Natural truffle search":"E","Square truffle search":"E","Truffle search (Work)":"E",
  "Herding Dogs":"F","Rescue Dogs":"F","Sledge Dogs":"F",
  "Grooming":"G","Dog Dancing":"H",
};

function sleep(ms) { return new Promise(r=>setTimeout(r,ms)); }

function parseDate(str) {
  if (!str) return null;
  const m = str.trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

const LOWERCASE_PARTICLES = new Set(["de","van","von","del","der","la","le","di","da","dos","das"]);
function toTitleCase(str) {
  if (!str) return "";
  return str.trim().split(/\s+/).map(w => {
    const l = w.toLowerCase();
    if (LOWERCASE_PARTICLES.has(l)) return l;
    return w.split("-").map(part => {
      const pl = part.toLowerCase();
      if (LOWERCASE_PARTICLES.has(pl)) return pl;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    }).join("-");
  }).join(" ");
}

// Restart browser every N IDs to keep the CF session fresh.
// Set low (50) so sessions can never expire between restarts.
// This replaces the unreliable health check approach.

// ── Browser management ────────────────────────────────────────────────────────
let browser = null;
let page    = null;

async function dismissPopup() {
  try {
    const clicked = await page.evaluate(() => {
      // FCI uses a cookie/GDPR popup with a "Close" button
      const btn = Array.from(document.querySelectorAll("button,a"))
        .find(x => x.innerText?.trim() === "Close");
      if (btn) { btn.click(); return true; }
      return false;
    });
    if (clicked) await sleep(800);
  } catch(e) {}
}

async function initBrowser(label = "") {
  if (browser) {
    try { await browser.close(); } catch(e) {}
    browser = null; page = null;
  }
  browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage"],
    defaultViewport: { width: 1280, height: 900 }
  });
  page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );

  // Prime session + dismiss popup on the listing page
  try {
    await page.goto("https://www.fci.be/en/judges", { waitUntil:"networkidle2", timeout:20000 });
    await sleep(1500);
    await dismissPopup();
    console.log(`✅ Browser ready${label ? " (" + label + ")" : ""}`);
  } catch(e) {
    console.log(`⚠️  Session prime failed${label ? " (" + label + ")" : ""}: ${e.message}`);
  }
}

// ── Session health check ──────────────────────────────────────────────────────
// Re-prime the session by visiting the listing page first, then verify a
// recently-scraped judge ID is reachable. This prevents false "alive" signals
// where ID=1 responds but higher IDs silently return empty due to stale session.
async function isSessionAlive(knownGoodId) {
  try {
    // Always re-prime first — this is what makes the gap scraper reliable
    await page.goto("https://www.fci.be/en/judges", { waitUntil: "networkidle2", timeout: 20000 });
    await sleep(800);
    await dismissPopup();

    // Now check a real recently-scraped judge (not always ID=1)
    const resp = await page.goto(
      `https://www.fci.be/en/judges/Judge.aspx?id=${knownGoodId}`,
      { waitUntil: "networkidle2", timeout: 20000 }
    );
    if (!resp || resp.status() === 404) return false;
    const found = await page.evaluate(() => !!document.querySelector("h3.pink"));
    return found;
  } catch(e) {
    return false;
  }
}

// ── Scrape a single judge page ────────────────────────────────────────────────
async function scrapeJudge(id) {
  try {
    const resp = await page.goto(
      `https://www.fci.be/en/judges/Judge.aspx?id=${id}`,
      { waitUntil: "networkidle2", timeout: 25000 }
    );
    if (!resp || resp.status() === 404) return null;

    // Always try to dismiss popup — it may have reappeared
    await dismissPopup();

    const data = await page.evaluate(() => {
      // ── Detect valid judge page ──────────────────────────────────────────
      const h3pink = document.querySelector("h3.pink");
      if (!h3pink) return null;
      const rawName = h3pink.innerText.trim();
      if (!rawName) return null;
      // Mark as bad name but still return — store as hidden so we keep the ID
      const badName = rawName.length < 3 || /^[\s.,\-_0-9]+$/.test(rawName) || (rawName.match(/[a-zA-ZÀ-žА-я]/g)||[]).length < 2;

      // ── Birth year ───────────────────────────────────────────────────────
      let birthYear = null;
      const bCols = document.querySelectorAll(".col-md-11.vcenter");
      for (const col of bCols) {
        const txt = col.innerText.trim();
        if (/^\d{4}$/.test(txt)) { birthYear = parseInt(txt); break; }
      }

      // ── NCO & country ────────────────────────────────────────────────────
      let kennelClub = "", kennelClubCountry = "", countryOfResidence = "";
      const rows = document.querySelectorAll(".row .row");
      for (const row of rows) {
        const h3 = row.querySelector("h3");
        const val = row.querySelector(".col-md-6:last-child");
        if (!h3 || !val) continue;
        const label = h3.innerText.trim();
        const value = val.innerText.trim();
        if (label.includes("National Canine")) {
          const m = value.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
          if (m) { kennelClub = m[1].trim(); kennelClubCountry = m[2].trim(); }
          else kennelClub = value;
        }
        if (label.includes("Country of legal")) {
          countryOfResidence = value;
        }
      }

      // ── Languages ────────────────────────────────────────────────────────
      const fciLanguages = [];
      const langLabels = { "0":"English","1":"French","2":"German","3":"Spanish" };
      for (const [idx, lang] of Object.entries(langLabels)) {
        const inp = document.getElementById(`ContentPlaceHolder1_LanguesCheckBoxList_${idx}`);
        if (inp && inp.checked) fciLanguages.push(lang);
      }
      const otherLanguages = [];
      document.querySelectorAll(".col-md-6").forEach(col => {
        const h = col.querySelector("h3, h4, strong, b");
        if (!h || !h.innerText.toLowerCase().includes("other language")) return;
        col.querySelectorAll("td").forEach(td => {
          const t = td.innerText.trim();
          if (t) otherLanguages.push(t);
        });
      });
      const kennelNames = [];
      document.querySelectorAll(".row").forEach(row => {
        const label = row.querySelector(".col-md-4");
        const value = row.querySelector(".col-md-8");
        if (!label || !value) return;
        if (label.innerText.trim().toLowerCase() === "kennel name") {
          const val = value.innerText.trim();
          if (val) kennelNames.push(val);
        }
      });

      // ── Disciplines + 1st auth dates ────────────────────────────────────
      const disciplines = [];
      const disciplineFirstAuth = {};
      const discTable = document.querySelector("#ContentPlaceHolder1_UpdatePanel1 table.table");
      if (discTable) {
        discTable.querySelectorAll("tr").forEach(tr => {
          const tds = tr.querySelectorAll("td");
          if (tds.length >= 2) {
            const discName = tds[0].innerText.trim();
            const dateStr  = tds[1]?.innerText.trim() || "";
            if (discName && discName !== "Disciplines") {
              disciplines.push(discName);
              const d = dateStr.match(/(\d{2}-\d{2}-\d{4})/);
              if (d) disciplineFirstAuth[discName] = d[1];
            }
          }
        });
      }

      // ── All-breed & BIS ──────────────────────────────────────────────────
      const allBreedCb = document.getElementById("ContentPlaceHolder1_AutorisationsControl_AllBreedCheckBox");
      const bisCb      = document.getElementById("ContentPlaceHolder1_AutorisationsControl_BisCheckBox");
      const allBreedJudge = allBreedCb?.checked || false;
      const bisJudge      = bisCb?.checked      || false;

      // ── Group judges (BogCheckBox checked) ──────────────────────────────
      const groupJudge = [];
      document.querySelectorAll("[id*='BogCheckBox']").forEach(cb => {
        if (cb.checked) {
          const m = cb.id.match(/_(\d+)$/);
          if (m) groupJudge.push(parseInt(m[1]) + 1);
        }
      });

      // ── Authorized breeds (RaceCheckBox checked) ─────────────────────────
      const authorizedBreeds = [];
      document.querySelectorAll("[id*='RaceCheckBox']").forEach(cb => {
        if (cb.checked) {
          const label = document.querySelector(`label[for="${cb.id}"]`);
          if (label) {
            const txt = label.innerText.trim();
            const m = txt.match(/^(.+?)\s*\((\d+)\)\s*$/);
            if (m) {
              authorizedBreeds.push({ name: m[1].trim(), fciNumber: parseInt(m[2]) });
            } else if (txt.length > 1) {
              authorizedBreeds.push({ name: txt, fciNumber: null });
            }
          }
        }
      });

      // ── Suspensions ──────────────────────────────────────────────────────
      const suspensions = [];
      const suspTables = document.querySelectorAll("table.table");
      suspTables.forEach(t => {
        if (t.innerText.includes("Suspension")) {
          t.querySelectorAll("tr").forEach((tr, i) => {
            if (i === 0) return;
            const cells = Array.from(tr.querySelectorAll("td")).map(c=>c.innerText.trim());
            if (cells.some(c=>c)) suspensions.push(cells);
          });
        }
      });

      // ── Contact ──────────────────────────────────────────────────────────
      // Extract email from mailto links — most reliable source on FCI pages.
      // Previous approach checked bodyText.includes("(private)") which incorrectly
      // blocked emails when the phone number was marked private.
      let email = null;
      const mailtoLinks = Array.from(document.querySelectorAll('a[href^="mailto:"]'));
      if (mailtoLinks.length > 0) {
        email = mailtoLinks[0].href.replace('mailto:', '').trim().split('?')[0];
      } else {
        // Fallback: regex on body text
        const bodyText = document.body.innerText;
        const emailMatch = bodyText.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i);
        if (emailMatch) email = emailMatch[0];
      }

      return {
        rawName, badName, birthYear, kennelClub, kennelClubCountry, countryOfResidence,
        fciLanguages, otherLanguages, kennelNames, disciplines, disciplineFirstAuth,
        allBreedJudge, bisJudge, groupJudge, authorizedBreeds, suspensions,
        contact: { email, phone: null, address: null }
      };
    });

    if (!data) return null;

    // ── Post-process in Node ──────────────────────────────────────────────
    let lastName = "", firstName = "", title = "", fciLicenceId = "";
    const raw = data.rawName;

    const licMatch = raw.match(/\(([A-Z]{2,3}\d+)\)\s*$/);
    if (licMatch) fciLicenceId = licMatch[1];

    const titleMatch = raw.match(/\((Ms|Mr|Mrs|Dr|Prof)\)/i);
    if (titleMatch) title = titleMatch[1];

    const nameCore = raw
      .replace(/\([A-Z]{2,3}\d+\)/g, "")
      .replace(/\((Ms|Mr|Mrs|Dr|Prof)\)/gi, "")
      .trim();

    if (nameCore.includes(",")) {
      const parts = nameCore.split(",").map(s=>s.trim());
      lastName  = parts[0];
      firstName = parts[1] || "";
    } else {
      const parts = nameCore.trim().split(/\s+/);
      const initials = parts.filter(p => /^[A-Z]\.?$/.test(p));
      const lastParts = parts.filter(p => !/^[A-Z]\.?$/.test(p));
      lastName  = lastParts.join(" ");
      firstName = initials.join(" ");
    }

    const fullName = [
      toTitleCase(firstName),
      toTitleCase(lastName)
    ].filter(Boolean).join(" ");

    const licensedDateISO = parseDate(
      data.disciplineFirstAuth[data.disciplines[0]] || null
    );

    const country = data.kennelClubCountry || data.countryOfResidence || "";
    const flag = FLAGS[country.toUpperCase()] || "🌍";
    const disciplineGroups = [...new Set(data.disciplines.map(d=>DISCIPLINE_GROUPS[d]).filter(Boolean))];

    const licParts = fciLicenceId.match(/^([A-Z]{2,3})(\d+)$/);

    const initials = fullName.split(" ")
      .filter(w => w && /[A-Z]/.test(w[0]))
      .map(w=>w[0])
      .slice(0,2).join("").toUpperCase() || "??";

    return {
      id: `fci_${id}`,
      fciUrlId: id,
      fciLicenceId,
      fciLicenceCountry: licParts?.[1] || "",
      fciLicenceNumber:  licParts ? parseInt(licParts[2]) : null,

      name: fullName,
      lastName: toTitleCase(lastName),
      firstName: toTitleCase(firstName),
      title: title || null,
      photo: initials,

      birthYear: data.birthYear,
      licensedDate: licensedDateISO,
      licensedYear: licensedDateISO ? parseInt(licensedDateISO.slice(0,4)) : null,

      country: toTitleCase(country),
      flag,
      kennelClub: data.kennelClub || null,
      kennelClubCountry: toTitleCase(country),
      countryOfResidence: toTitleCase(data.countryOfResidence || country),

      fciLanguages: data.fciLanguages,
      otherLanguages: data.otherLanguages,
      kennelName: data.kennelNames?.[0] || null,

      disciplines: data.disciplines,
      disciplineFirstAuth: data.disciplineFirstAuth,
      disciplineGroups,

      allBreedJudge: data.allBreedJudge,
      bisJudge: data.bisJudge,
      groupJudge: data.groupJudge,
      authorizedBreeds: data.authorizedBreeds,
      groupNames: data.groupJudge.map(g => ({ group: g, name: FCI_GROUP_NAMES[g] || `Group ${g}` })),
      breeds: (() => {
        if (data.allBreedJudge) return ["All breeds"];
        const individual = data.authorizedBreeds.map(b => b.name);
        const groupB = [];
        for (const g of data.groupJudge) {
          if (FCI_GROUP_BREEDS[g]) groupB.push(...FCI_GROUP_BREEDS[g]);
        }
        const seen = new Set(groupB.map(b => b.toLowerCase()));
        const extra = individual.filter(b => !seen.has(b.toLowerCase()));
        return [...groupB, ...extra];
      })(),
      group: disciplineGroups[0] || "A",
      orgs: [{ org:"FCI", id: fciLicenceId || `FCI-${id}` }],

      suspensions: data.suspensions,
      contact: data.contact,

      verified: false,
      claimedBy: null,
      bio: "",
      social: {},

      fciUrl: `https://www.fci.be/en/judges/Judge.aspx?id=${id}`,
      source: "FCI",
      status: "active",
      hidden: data.badName ? true : false,
      scrapedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    };

  } catch(e) {
    return null;
  }
}

async function main() {
  console.log(`🐕 FCI Full Scraper v2 — starting from ID ${startFrom}`);
  console.log(`   Auto-stop after ${MAX_EMPTY} consecutive empty | delay ${DELAY_MS}ms`);
  console.log(`   Browser restart every ${RESTART_EVERY} IDs | Session health check every ${HEALTH_CHECK_EVERY} empties`);

  // Load checkpoint
  let judges = [];
  let resumeFrom = startFrom;
  if (BACKFILL_MODE) {
    resumeFrom = bfStart;
    console.log(`🔄 Backfill mode: IDs ${bfStart}–${bfEnd} → ${OUTPUT}`);
  } else if (fs.existsSync(PROGRESS) && fs.existsSync(OUTPUT)) {
    const prog = JSON.parse(fs.readFileSync(PROGRESS,"utf8"));
    judges = JSON.parse(fs.readFileSync(OUTPUT,"utf8")).judges || [];
    resumeFrom = prog.lastId + 1;
    console.log(`📂 Resuming from ID ${resumeFrom} — ${judges.length} judges loaded`);
  }

  await initBrowser("initial");

  let consecutive = 0;
  let i = resumeFrom;
  let idsSinceRestart = 0;
  // ID of first successfully scraped judge — used for health checks.


  const loopMax = BACKFILL_MODE ? bfEnd : maxId;
  while (i <= loopMax) {

    // Periodic browser restart to prevent session/popup issues
    if (idsSinceRestart > 0 && idsSinceRestart % RESTART_EVERY === 0) {
      console.log(`♻️  Restarting browser at ID ${i} (${idsSinceRestart} IDs since last restart)...`);
      await initBrowser(`restart at id=${i}`);
      idsSinceRestart = 0;
    }

    const judge = await scrapeJudge(i);

    if (judge) {
      judges.push(judge);
      consecutive = 0;
      const total = judges.length;
      if (total <= 20 || total % 25 === 0) {
        console.log(`✅ [id=${i}] ${judge.name} (${judge.country}) | disciplines: ${judge.disciplines.join(",")} | breeds: ${judge.authorizedBreeds.length} | total: ${total}`);
      }
    } else {
      consecutive++;

      if (consecutive % 100 === 0) {
        console.log(`⬜ ${consecutive} empty in a row (id=${i}) | judges found: ${judges.length}`);
      }
      if (consecutive >= MAX_EMPTY) {
        console.log(`\n🏁 Stopping — ${MAX_EMPTY} consecutive empty pages. Last id: ${i}`);
        break;
      }
    }

    // Checkpoint save
    if (judges.length > 0 && judges.length % SAVE_EVERY === 0 && (judge !== null)) {
      fs.writeFileSync(OUTPUT,   JSON.stringify({ count: judges.length, judges }, null, 2));
      fs.writeFileSync(PROGRESS, JSON.stringify({ lastId: i, count: judges.length, savedAt: new Date().toISOString() }));
      process.stdout.write(`💾 Saved ${judges.length} judges (id=${i})\n`);
    }

    await sleep(DELAY_MS);
    i++;
    idsSinceRestart++;
  }

  // Final save
  fs.writeFileSync(OUTPUT,   JSON.stringify({ count: judges.length, judges }, null, 2));
  fs.writeFileSync(PROGRESS, JSON.stringify({ lastId: i, count: judges.length, done: true, savedAt: new Date().toISOString() }));

  console.log(`\n🎉 Done! ${judges.length} judges scraped → ${OUTPUT}`);
  await browser.close();
}

main().catch(e => { console.error("❌ Fatal:", e.message); process.exit(1); });
