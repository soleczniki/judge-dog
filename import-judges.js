// ── FCI Judge Importer v2 (Admin SDK) ─────────────────────────────────────────
// Run with: node import-judges.js
// Requires: fci-raw.json and serviceAccount.json in same folder

import { readFileSync, writeFileSync, existsSync } from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const admin = require("firebase-admin");
const serviceAccount = JSON.parse(readFileSync("./serviceAccount.json", "utf8"));

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const DUMMY_IDS = ["j1","j2","j3","j4","j5","j6","j7","j8"];

const FLAGS = {
  "DENMARK":"🇩🇰","NORWAY":"🇳🇴","FINLAND":"🇫🇮","SWEDEN":"🇸🇪","GERMANY":"🇩🇪",
  "FRANCE":"🇫🇷","ITALY":"🇮🇹","SPAIN":"🇪🇸","PORTUGAL":"🇵🇹","NETHERLANDS":"🇳🇱",
  "BELGIUM":"🇧🇪","AUSTRIA":"🇦🇹","SWITZERLAND":"🇨🇭","POLAND":"🇵🇱","CZECH REPUBLIC":"🇨🇿",
  "SLOVAKIA":"🇸🇰","HUNGARY":"🇭🇺","ROMANIA":"🇷🇴","BULGARIA":"🇧🇬","CROATIA":"🇭🇷",
  "SERBIA":"🇷🇸","SLOVENIA":"🇸🇮","GREECE":"🇬🇷","TURKEY":"🇹🇷","RUSSIA":"🇷🇺",
  "UKRAINE":"🇺🇦","ESTONIA":"🇪🇪","LATVIA":"🇱🇻","LITHUANIA":"🇱🇹","BELARUS":"🇧🇾",
  "MOLDOVA":"🇲🇩","ALBANIA":"🇦🇱","NORTH MACEDONIA":"🇲🇰","MONTENEGRO":"🇲🇪",
  "BOSNIA AND HERZEGOVINA":"🇧🇦","LUXEMBOURG":"🇱🇺","IRELAND":"🇮🇪","UNITED KINGDOM":"🇬🇧",
  "USA":"🇺🇸","UNITED STATES":"🇺🇸","CANADA":"🇨🇦","MEXICO":"🇲🇽","BRAZIL":"🇧🇷",
  "ARGENTINA":"🇦🇷","CHILE":"🇨🇱","COLOMBIA":"🇨🇴","PERU":"🇵🇪","VENEZUELA":"🇻🇪",
  "URUGUAY":"🇺🇾","PARAGUAY":"🇵🇾","ECUADOR":"🇪🇨","BOLIVIA":"🇧🇴","PANAMA":"🇵🇦",
  "COSTA RICA":"🇨🇷","GUATEMALA":"🇬🇹","DOMINICAN REPUBLIC":"🇩🇴","PUERTO RICO":"🇵🇷",
  "CUBA":"🇨🇺","JAPAN":"🇯🇵","CHINA":"🇨🇳","SOUTH KOREA":"🇰🇷","TAIWAN":"🇹🇼",
  "HONG KONG":"🇭🇰","THAILAND":"🇹🇭","PHILIPPINES":"🇵🇭","INDONESIA":"🇮🇩",
  "MALAYSIA":"🇲🇾","SINGAPORE":"🇸🇬","VIETNAM":"🇻🇳","INDIA":"🇮🇳","ISRAEL":"🇮🇱",
  "SAUDI ARABIA":"🇸🇦","UAE":"🇦🇪","KUWAIT":"🇰🇼","QATAR":"🇶🇦","AUSTRALIA":"🇦🇺",
  "NEW ZEALAND":"🇳🇿","SOUTH AFRICA":"🇿🇦","MOROCCO":"🇲🇦","EGYPT":"🇪🇬",
  "KAZAKHSTAN":"🇰🇿","AZERBAIJAN":"🇦🇿","GEORGIA":"🇬🇪","ARMENIA":"🇦🇲",
  "CYPRUS":"🇨🇾","MALTA":"🇲🇹","ICELAND":"🇮🇸","ISRAEL":"🇮🇱","IRAN":"🇮🇷",
  "CHINA (PEOPLE'S REPUBLIC OF)":"🇨🇳","KOREA (REPUBLIC OF)":"🇰🇷",
};

const DISCIPLINE_MAP = {
  "Shows":"Conformation / Shows",
  "Agility":"Agility",
  "Obedience":"Obedience",
  "Utility Dogs":"Working / Utility",
  "Tracking":"Tracking",
  "Flyball":"Flyball",
  "Coursing":"Coursing",
  "Racing":"Racing",
  "Canicross":"Canicross",
};

function extractCountry(kcString) {
  const match = kcString.match(/\(([^)]+)\)$/);
  return match ? match[1].trim() : kcString;
}

function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// ── Name parser ────────────────────────────────────────────────────────────────
// FCI formats:
//   "ANDERSSON J. (JENNIE)"  → Jennie Andersson
//   "SMITH J."               → J. Smith
//   "DE LA CRUZ M."          → M. De La Cruz
function formatName(raw) {
  if (!raw) return "";
  raw = raw.trim();

  // Extract full first name from parentheses if present: "ANDERSSON J. (JENNIE)"
  const parenMatch = raw.match(/\(([^)]+)\)$/);
  const fullFirst = parenMatch ? parenMatch[1].trim() : null;

  // Remove the parenthesized part
  const withoutParen = raw.replace(/\s*\([^)]+\)\s*$/, "").trim();

  // Split into parts — last word(s) before initials is the last name
  // Format is usually: LASTNAME INITIAL. or LASTNAME FIRSTNAME
  const parts = withoutParen.split(/\s+/);

  // Find where initials end — initials are like "J." or "M.A."
  let lastNameParts = [];
  let initialParts = [];

  for (const part of parts) {
    if (/^[A-Z]\./.test(part)) {
      initialParts.push(part);
    } else {
      lastNameParts.push(part);
    }
  }

  // Format last name: capitalize each word
  const lastName = lastNameParts.map(p => {
    // Handle prefixes like "DE", "VAN", "VON", "DEL"
    const lower = p.toLowerCase();
    if (["de","van","von","del","der","la","le","di","da","dos","das"].includes(lower)) {
      return lower;
    }
    return capitalize(p);
  }).join(" ");

  // Use full first name from parens if available, otherwise use initials
  const firstName = fullFirst 
    ? fullFirst.split(" ").map(capitalize).join(" ")
    : initialParts.join(" ");

  return `${firstName} ${lastName}`.trim();
}

function convertJudge(entry, index) {
  const raw = entry.raw;
  // Columns: [licenceId, name, ?, kennelClub+Country, discipline, status]
  const licenceId  = raw[0]?.trim() || "";
  const nameRaw    = raw[1]?.trim() || "";
  const kcString   = raw[3]?.trim() || "";
  const discipline = raw[4]?.trim() || "";
  const status     = raw[5]?.trim() || "";

  if (status !== "Active") return null;
  if (!nameRaw) return null;

  const country = extractCountry(kcString);
  const countryUpper = country.toUpperCase();
  const flag = FLAGS[countryUpper] || "🌍";
  const name = formatName(nameRaw);
  const group = DISCIPLINE_MAP[discipline] || discipline;

  // Generate initials from formatted name
  const nameParts = name.split(" ").filter(p => p && !/^[a-z]/.test(p));
  const initials = nameParts.map(p=>p[0]).filter(Boolean).slice(0,2).join("").toUpperCase() || "??";

  const countryFormatted = country.split(" ").map(w => {
    const low = w.toLowerCase();
    if (["and","of","the"].includes(low)) return low;
    return capitalize(w);
  }).join(" ");

  return {
    id: `fci_${licenceId || index}`,
    name,
    country: countryFormatted,
    flag,
    breeds: [],
    group,
    licensed: null,
    orgs: [{ org: "FCI", id: licenceId }],
    verified: false,
    claimedBy: null,
    bio: "",
    social: {},
    photo: initials,
    kennelClub: kcString,
    discipline,
    status: "Active",
    source: "FCI",
    lastUpdated: new Date().toISOString(),
  };
}

async function importJudges() {
  console.log("🐕 FCI Judge Importer v2 starting...");

  if (!existsSync("fci-raw.json")) {
    console.error("❌ fci-raw.json not found!"); process.exit(1);
  }

  const raw = JSON.parse(readFileSync("fci-raw.json", "utf8"));
  console.log(`📊 Loaded ${raw.count} raw entries`);

  const judges = raw.judges.map((e,i)=>convertJudge(e,i)).filter(Boolean);
  console.log(`✅ ${judges.length} active judges converted`);

  // Show sample names for verification
  console.log("\n📋 Sample names:");
  judges.slice(0, 15).forEach(j => console.log(`  ${j.flag} ${j.name} (${j.country}) [${j.orgs[0].id}]`));

  console.log(`\n⚠️  Will replace all existing judges with ${judges.length} clean entries.`);
  console.log("Waiting 5 seconds... Press Ctrl+C to cancel.");
  await new Promise(r=>setTimeout(r,5000));

  // Delete ALL existing fci judges first
  console.log("\n🗑️  Clearing existing judges...");
  const existing = await db.collection("judges").get();
  const deleteBatch = db.batch();
  existing.docs.forEach(d => deleteBatch.delete(d.ref));
  await deleteBatch.commit();
  console.log(`  ✅ Deleted ${existing.docs.length} existing judges`);

  // Push in batches of 400
  console.log(`\n📤 Pushing ${judges.length} judges...`);
  const BATCH_SIZE = 400;
  let pushed = 0;

  for (let i = 0; i < judges.length; i += BATCH_SIZE) {
    const batch = db.batch();
    judges.slice(i, i + BATCH_SIZE).forEach(j => {
      batch.set(db.collection("judges").doc(j.id), j);
    });
    await batch.commit();
    pushed += Math.min(BATCH_SIZE, judges.length - i);
    console.log(`  📤 ${pushed}/${judges.length} pushed...`);
  }

  console.log(`\n🎉 Done! ${judges.length} FCI judges imported cleanly.`);
  process.exit(0);
}

importJudges().catch(e => {
  console.error("❌ Error:", e.message);
  process.exit(1);
});
