// Re-scrapes fci_8 (Annika Ulltveit-Moe, FCI ID 9304) to add missing
// otherLanguages and kennelName fields, then patches Firestore.
// Run: node patch-annika-fields.js

import puppeteer from "puppeteer";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore }        from "firebase-admin/firestore";
import { readFileSync }        from "fs";

const sa = JSON.parse(readFileSync("./serviceAccount.json", "utf8"));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const browser = await puppeteer.launch({ headless: true });
const page    = await browser.newPage();

console.log("Scraping FCI ID 9304…");
await page.goto("https://www.fci.be/en/judges/Judge.aspx?id=9304", {
  waitUntil: "networkidle2", timeout: 30000
});

const extra = await page.evaluate(() => {
  // ── Other languages ──────────────────────────────────────────────────
  const otherLanguages = [];
  // The Languages section has two columns; other languages are in a table
  // in the right column (col-md-6:last-child within the Languages row)
  document.querySelectorAll(".col-md-6").forEach(col => {
    const h3 = col.querySelector("h3, h4, strong, b");
    if (!h3) return;
    if (!h3.innerText.toLowerCase().includes("other language")) return;
    col.querySelectorAll("td").forEach(td => {
      const t = td.innerText.trim();
      if (t) otherLanguages.push(t);
    });
  });
  // Fallback: scan all tables for one inside a "Languages" section
  if (!otherLanguages.length) {
    document.querySelectorAll("table.table").forEach(tbl => {
      let el = tbl.parentElement;
      for (let i = 0; i < 8; i++) {
        if (!el) break;
        if (el.innerText.toLowerCase().includes("other language")) {
          tbl.querySelectorAll("td").forEach(td => {
            const t = td.innerText.trim();
            if (t && !otherLanguages.includes(t)) otherLanguages.push(t);
          });
          break;
        }
        el = el.parentElement;
      }
    });
  }

  // ── Kennel names — col-md-4 label / col-md-8 value row pattern ──────
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

  return { otherLanguages, kennelNames };
});

await browser.close();

console.log("Scraped:", extra);

const update = {};
if (extra.otherLanguages.length) update.otherLanguages = extra.otherLanguages;
if (extra.kennelNames.length)    update.kennelName     = extra.kennelNames[0];

if (!Object.keys(update).length) {
  console.log("Nothing new found — check selectors manually.");
  process.exit(0);
}

await db.doc("judges/fci_8").update(update);
console.log("Firestore fci_8 updated:", update);
process.exit(0);
