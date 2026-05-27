// Probe the AKC detail page for judge 105762 to find breed/discipline data
import puppeteer from "puppeteer";
const BASE = "https://www.apps.akc.org/apps/judges_directory";
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage"],
  defaultViewport: { width: 1280, height: 900 },
});
const page = await browser.newPage();
await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

// Try the state search results page directly for a small state to get detail inline
await page.goto(`${BASE}/index.cfm`, { waitUntil: "domcontentloaded", timeout: 30000 });
await sleep(800);
await page.select('select[name="states"]', "WY"); // Small state
await sleep(300);

const navPromise = page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 });
page.evaluate(() => {
  const form = document.querySelector("form");
  form.action = "index.cfm?action=results";
  form.submit();
}).catch(() => {});
await navPromise;
await sleep(2000);

// Dump ALL cfdump tables found on the results page
const tables = await page.evaluate(() => {
  const allTables = document.querySelectorAll("table");
  const results = [];
  for (const t of allTables) {
    const rows = Array.from(t.querySelectorAll("tr"));
    for (let i = 0; i < rows.length; i++) {
      const cells = Array.from(rows[i].querySelectorAll(":scope > th, :scope > td"));
      const texts = cells.map(c => c.textContent.trim());
      // Any row with 2+ ALLCAPS column names is interesting
      const capsCount = texts.filter(x => /^[A-Z]{2,}(_[A-Z0-9]+)*$/.test(x)).length;
      if (capsCount >= 2) {
        results.push({
          hdrRow: i,
          headers: texts,
          sampleRow: (() => {
            const next = rows[i+1];
            if (!next) return null;
            return Array.from(next.querySelectorAll(":scope > td")).map(c => c.textContent.trim().slice(0,40));
          })(),
        });
        break; // one result per table
      }
    }
  }
  return results;
});

console.log(`\nFound ${tables.length} cfdump-style tables on WY results page:\n`);
tables.forEach((t, idx) => {
  console.log(`Table ${idx+1} (hdr at row ${t.hdrRow}):`);
  console.log(`  Headers: ${t.headers.join(" | ")}`);
  if (t.sampleRow) console.log(`  Sample:  ${t.sampleRow.join(" | ")}`);
  console.log();
});

await browser.close();
