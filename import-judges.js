// ── FCI Judge Importer (Admin SDK) ─────────────────────────────────────────────
// Run with: node import-judges.js
// Requires: fci-raw.json and serviceAccount.json in same folder

import { readFileSync, writeFileSync, existsSync } from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const admin = require("firebase-admin");
const serviceAccount = JSON.parse(readFileSync("./serviceAccount.json", "utf8"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// ── Dummy judge IDs to delete ──────────────────────────────────────────────────
const DUMMY_IDS = ["j1","j2","j3","j4","j5","j6","j7","j8"];

// ── Country flag map ───────────────────────────────────────────────────────────
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
  "CYPRUS":"🇨🇾","MALTA":"🇲🇹","ICELAND":"🇮🇸","LIECHTENSTEIN":"🇱🇮",
  "ANDORRA":"🇦🇩","MONACO":"🇲🇨","SAN MARINO":"🇸🇲","VATICAN":"🇻🇦",
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
};

function extractCountry(kcString) {
  const match = kcString.match(/\(([^)]+)\)$/);
  return match ? match[1].trim() : kcString;
}

function formatName(raw) {
  if (!raw) return raw;
  const parts = raw.trim().split(/\s+/);
  if (parts.length === 1) {
    return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  }
  const last = parts[0];
  const first = parts.slice(1).join(" ");
  const lastFormatted = last.charAt(0).toUpperCase() + last.slice(1).toLowerCase();
  // Handle initials like "J." → keep as is
  return `${first} ${lastFormatted}`;
}

function convertJudge(entry, index) {
  const raw = entry.raw;
  const licenceId = raw[0]?.trim() || "";
  const nameRaw   = raw[1]?.trim() || "";
  const kcString  = raw[3]?.trim() || "";
  const discipline = raw[4]?.trim() || "";
  const status    = raw[5]?.trim() || "";

  if (status !== "Active") return null;
  if (!nameRaw) return null;

  const country = extractCountry(kcString);
  const countryUpper = country.toUpperCase();
  const flag = FLAGS[countryUpper] || "🌍";
  const name = formatName(nameRaw);
  const group = DISCIPLINE_MAP[discipline] || discipline;
  const initials = name.split(" ").map(w=>w[0]).filter(Boolean).slice(0,2).join("").toUpperCase();

  return {
    id: `fci_${licenceId || index}`,
    name,
    country: country.charAt(0).toUpperCase() + country.slice(1).toLowerCase(),
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
  console.log("🐕 FCI Judge Importer (Admin SDK) starting...");

  if (!existsSync("fci-raw.json")) {
    console.error("❌ fci-raw.json not found!"); process.exit(1);
  }

  const raw = JSON.parse(readFileSync("fci-raw.json", "utf8"));
  console.log(`📊 Loaded ${raw.count} raw entries`);

  const judges = raw.judges.map((e,i)=>convertJudge(e,i)).filter(Boolean);
  console.log(`✅ ${judges.length} active judges converted`);
  console.log(`\n📋 Sample judge:\n`, JSON.stringify(judges[0], null, 2));

  console.log(`\n⚠️  Will push ${judges.length} judges and delete ${DUMMY_IDS.length} dummies.`);
  console.log("Waiting 5 seconds... Press Ctrl+C to cancel.");
  await new Promise(r=>setTimeout(r,5000));

  // Delete dummy judges from Firestore
  console.log("\n🗑️  Deleting dummy judges...");
  for (const id of DUMMY_IDS) {
    try {
      await db.collection("judges").doc(id).delete();
      console.log(`  ✅ Deleted: ${id}`);
    } catch(e) {
      console.log(`  ℹ️  ${id} not found (ok)`);
    }
  }

  // Also clear judges from local storage by updating seed key
  // Push in batches of 400
  console.log(`\n📤 Pushing ${judges.length} judges to Firestore...`);
  const BATCH_SIZE = 400;
  let pushed = 0;

  for (let i = 0; i < judges.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = judges.slice(i, i + BATCH_SIZE);
    chunk.forEach(judge => {
      batch.set(db.collection("judges").doc(judge.id), judge);
    });
    await batch.commit();
    pushed += chunk.length;
    console.log(`  📤 ${pushed}/${judges.length} pushed...`);
  }

  console.log(`\n🎉 Done! ${judges.length} FCI judges in Firestore.`);
  process.exit(0);
}

importJudges().catch(e => {
  console.error("❌ Error:", e.message);
  process.exit(1);
});
