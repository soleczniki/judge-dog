// One-state end-to-end test matching exact scraper logic
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

await page.goto(`${BASE}/index.cfm`, { waitUntil: "domcontentloaded", timeout: 30000 });
await sleep(800);
await page.select('select[name="states"]', "WY");
await sleep(300);

const navPromise = page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 });
page.evaluate(() => {
  const form = document.querySelector("form");
  form.action = "index.cfm?action=results";
  form.submit();
}).catch(e => console.log("eval err (expected):", e.message.slice(0,80)));
await navPromise;
await sleep(1500);

// Exact parseCfDump logic + debug
const result = await page.evaluate(() => {
  const url = window.location.href;
  const allTables = document.querySelectorAll("table");
  const tableHeaders = Array.from(allTables).map(t => {
    const th = t.querySelector("th");
    return th ? th.textContent.trim().slice(0,30) : "(no th)";
  });

  // parseCfDump logic
  let dumpTable = null;
  for (const t of allTables) {
    const firstTh = t.querySelector("th");
    if (firstTh && /^[A-Z]{2,}(_[A-Z]+)*$/.test(firstTh.textContent?.trim())) {
      dumpTable = t; break;
    }
  }

  const hasNumJudge = document.body.innerHTML.includes("NUM_JUDGE");
  const bodySnip = document.body.textContent.slice(0,200).replace(/\s+/g," ").trim();

  let rows = [];
  if (dumpTable) {
    const trows = Array.from(dumpTable.querySelectorAll("tr"));
    const headers = Array.from(trows[0].querySelectorAll("th,td")).map(c=>c.textContent.trim());
    rows = trows.slice(1).map(row => {
      const cells = Array.from(row.querySelectorAll("td")).map(c=>c.textContent.trim());
      const obj = {};
      headers.forEach((h,i)=>{if(h)obj[h]=cells[i]||"";});
      return obj;
    }).filter(r=>r.NUM_JUDGE);
  }

  return { url, tableCount: allTables.length, tableHeaders: tableHeaders.slice(0,10),
           hasNumJudge, dumpTableFound: !!dumpTable, rowCount: rows.length,
           firstRow: rows[0]||null, bodySnip };
});

console.log("URL:", result.url);
console.log("Tables:", result.tableCount, "| hasNumJudge:", result.hasNumJudge, "| dumpFound:", result.dumpTableFound, "| rows:", result.rowCount);
console.log("Table headers (first 10):", result.tableHeaders);
console.log("Body:", result.bodySnip);
if (result.firstRow) console.log("First row:", JSON.stringify(result.firstRow));

await browser.close();
