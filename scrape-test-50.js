// ── FCI Judge Test Scraper — first 50 judges ─────────────────────────────────
// Scrapes IDs 1–500, stops when 50 judges found.
// Includes ASP.NET UpdatePanel expand fix for breed lists.
// Run: node scrape-test-50.js
// Output: fci-test-50.json

import puppeteer from "puppeteer";
import fs from "fs";
import { FCI_GROUP_NAMES, FCI_GROUP_BREEDS } from "./fci-groups.js";

const TARGET   = 50;
const MAX_ID   = 500;
const DELAY_MS = 1000;
const OUTPUT   = "fci-test-50.json";

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

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

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

async function scrapeJudge(page, id) {
  try {
    const resp = await page.goto(
      `https://www.fci.be/en/judges/Judge.aspx?id=${id}`,
      { waitUntil: "networkidle2", timeout: 25000 }
    );
    if (!resp || resp.status() === 404) return null;

    const data = await page.evaluate(() => {
      const h3pink = document.querySelector("h3.pink");
      if (!h3pink) return null;
      const rawName = h3pink.innerText.trim();
      if (!rawName || rawName.length < 3) return null;

      // Birth year
      let birthYear = null;
      document.querySelectorAll(".col-md-11.vcenter").forEach(col => {
        const txt = col.innerText.trim();
        if (/^\d{4}$/.test(txt)) birthYear = parseInt(txt);
      });

      // NCO & country
      let kennelClub = "", kennelClubCountry = "", countryOfResidence = "";
      document.querySelectorAll(".row .row").forEach(row => {
        const h3 = row.querySelector("h3");
        const val = row.querySelector(".col-md-6:last-child");
        if (!h3 || !val) return;
        const label = h3.innerText.trim();
        const value = val.innerText.trim();
        if (label.includes("National Canine")) {
          const m = value.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
          if (m) { kennelClub = m[1].trim(); kennelClubCountry = m[2].trim(); }
          else kennelClub = value;
        }
        if (label.includes("Country of legal")) countryOfResidence = value;
      });

      // Languages
      const fciLanguages = [];
      const langLabels = { "0":"English","1":"French","2":"German","3":"Spanish" };
      for (const [idx, lang] of Object.entries(langLabels)) {
        const inp = document.getElementById(`ContentPlaceHolder1_LanguesCheckBoxList_${idx}`);
        if (inp && inp.checked) fciLanguages.push(lang);
      }
      // Other languages — in table inside right column of Languages section
      const otherLanguages = [];
      document.querySelectorAll(".col-md-6").forEach(col => {
        const h = col.querySelector("h3, h4, strong, b");
        if (!h || !h.innerText.toLowerCase().includes("other language")) return;
        col.querySelectorAll("td").forEach(td => {
          const t = td.innerText.trim();
          if (t) otherLanguages.push(t);
        });
      });
      // Kennel names — col-md-4 label / col-md-8 value row pattern
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

      // Disciplines + first auth dates
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

      // All-breed & BIS flags
      const allBreedCb = document.getElementById("ContentPlaceHolder1_AutorisationsControl_AllBreedCheckBox");
      const bisCb      = document.getElementById("ContentPlaceHolder1_AutorisationsControl_BisCheckBox");
      const allBreedJudge = allBreedCb?.checked || false;
      const bisJudge      = bisCb?.checked      || false;

      // Group judges
      const groupJudge = [];
      document.querySelectorAll("[id*='BogCheckBox']").forEach(cb => {
        if (cb.checked) {
          const m = cb.id.match(/_(\d+)$/);
          if (m) groupJudge.push(parseInt(m[1]) + 1);
        }
      });

      // Authorized breeds (only populated after expand)
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

      // Suspensions
      const suspensions = [];
      document.querySelectorAll("table.table").forEach(t => {
        if (t.innerText.includes("Suspension")) {
          t.querySelectorAll("tr").forEach((tr, i) => {
            if (i === 0) return;
            const cells = Array.from(tr.querySelectorAll("td")).map(c => c.innerText.trim());
            if (cells.some(c => c)) suspensions.push(cells);
          });
        }
      });

      return {
        rawName, birthYear, kennelClub, kennelClubCountry, countryOfResidence,
        fciLanguages, otherLanguages, kennelNames, disciplines, disciplineFirstAuth,
        allBreedJudge, bisJudge, groupJudge, authorizedBreeds, suspensions,
      };
    });

    if (!data) return null;

    // Parse name
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
      const parts = nameCore.split(",").map(s => s.trim());
      lastName  = parts[0];
      firstName = parts[1] || "";
    } else {
      const parts = nameCore.trim().split(/\s+/);
      const initParts  = parts.filter(p => /^[A-Z]\.?$/.test(p));
      const lastParts  = parts.filter(p => !/^[A-Z]\.?$/.test(p));
      lastName  = lastParts.join(" ");
      firstName = initParts.join(" ");
    }

    const fullName = [toTitleCase(firstName), toTitleCase(lastName)].filter(Boolean).join(" ");
    const licensedDateISO = parseDate(data.disciplineFirstAuth[data.disciplines[0]] || null);
    const country = data.kennelClubCountry || data.countryOfResidence || "";
    const flag = FLAGS[country.toUpperCase()] || "🌍";
    const disciplineGroups = [...new Set(data.disciplines.map(d => DISCIPLINE_GROUPS[d]).filter(Boolean))];
    const licParts = fciLicenceId.match(/^([A-Z]{2,3})(\d+)$/);
    const photo = fullName.split(" ").filter(w => w && /[A-Z]/i.test(w[0])).map(w => w[0]).slice(0, 2).join("").toUpperCase() || "??";

    // Determine breeds list:
    // - All-breed: single sentinel value
    // - Group-authorized: expand each authorized group into its full breed list
    // - Individual breeds: use as-is
    // - Group + individual: union of both (search hits any breed in any group + extras)
    let breeds;
    if (data.allBreedJudge) {
      breeds = ["All breeds"];
    } else {
      const individualBreeds = data.authorizedBreeds.map(b => toTitleCase(b.name));
      // Expand group-level authorizations into full breed lists
      const groupBreeds = [];
      for (const g of data.groupJudge) {
        if (FCI_GROUP_BREEDS[g]) groupBreeds.push(...FCI_GROUP_BREEDS[g]);
      }
      // Union: group breeds first, then any individual breeds not already in the list
      const seen = new Set(groupBreeds.map(b => b.toLowerCase()));
      const extra = individualBreeds.filter(b => !seen.has(b.toLowerCase()));
      breeds = [...groupBreeds, ...extra];
    }

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
      photo,
      birthYear: data.birthYear,
      licensedDate: licensedDateISO,
      licensedYear: licensedDateISO ? parseInt(licensedDateISO.slice(0, 4)) : null,
      country: toTitleCase(country),
      flag,
      kennelClub: data.kennelClub || null,
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
      groupNames: data.groupJudge.map(g => ({ group: g, name: FCI_GROUP_NAMES[g] || `Group ${g}` })),
      authorizedBreeds: data.authorizedBreeds,
      breeds,
      group: disciplineGroups[0] || "A",
      orgs: [{ org: "FCI", id: fciLicenceId || `FCI-${id}` }],
      suspensions: data.suspensions,
      verified: false,
      claimedBy: null,
      bio: "",
      social: {},
      fciUrl: `https://www.fci.be/en/judges/Judge.aspx?id=${id}`,
      source: "FCI",
      scrapedAt: new Date().toISOString(),
    };

  } catch(e) {
    console.error(`  ⚠️  ID ${id}: ${e.message}`);
    return null;
  }
}

async function main() {
  console.log(`🐕 FCI Test Scraper — finding first ${TARGET} judges (IDs 1–${MAX_ID})`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage"],
    defaultViewport: { width: 1280, height: 900 }
  });
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

  // Accept cookie banner / close popup once
  try {
    await page.goto("https://www.fci.be/en/judges", { waitUntil: "networkidle2", timeout: 20000 });
    await sleep(1500);
    await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll("button,a")).find(x => x.innerText?.trim() === "Close");
      if (b) b.click();
    });
    await sleep(800);
  } catch(e) {}

  const judges = [];
  let empty = 0;

  for (let i = 1; i <= MAX_ID && judges.length < TARGET; i++) {
    const judge = await scrapeJudge(page, i);
    if (judge) {
      judges.push(judge);
      empty = 0;
      console.log(`✅ [${judges.length}/${TARGET}] id=${i} ${judge.flag} ${judge.name} (${judge.country}) | disciplines: ${judge.disciplines.join(",")||"—"} | breeds: ${judge.breeds.length} | allBreed: ${judge.allBreedJudge}`);
    } else {
      empty++;
      if (empty % 20 === 0) console.log(`  ⬜ ${empty} empty in a row (id=${i})`);
    }
    await sleep(DELAY_MS);
  }

  fs.writeFileSync(OUTPUT, JSON.stringify({ count: judges.length, judges }, null, 2));
  console.log(`\n🎉 Done! ${judges.length} judges → ${OUTPUT}`);
  await browser.close();
}

main().catch(e => { console.error("❌ Fatal:", e.message); process.exit(1); });
