// Intercept all requests after button click — find what enable_search() does
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

// ── Log every request ─────────────────────────────────────────────────────────
const requests = [];
await page.setRequestInterception(true);
page.on("request", req => {
  const url = req.url();
  const method = req.method();
  const body = req.postData() || "";
  requests.push({ url, method, body, time: Date.now() });
  req.continue();
});
page.on("requestfailed", req => {
  console.log(`❌ FAILED: ${req.url()}`);
});

await page.goto(`${BASE}/index.cfm`, { waitUntil: "domcontentloaded", timeout: 30000 });
await sleep(2000);

// Dump the enable_search function source
const fnSource = await page.evaluate(() => {
  if (typeof enable_search === "function") {
    return enable_search.toString().slice(0, 800);
  }
  return "NOT DEFINED";
});
console.log("enable_search source:\n", fnSource);

// Mark the start time
const t0 = Date.now();

// Select WY and click
await page.select('select[name="states"]', "WY");
await sleep(300);

console.log("\n──── Clicking submit ────");
await page.click('[name="submit_button"]');

// Wait 10 seconds and collect requests
await sleep(10000);

const postClick = requests.filter(r => r.time >= t0);
console.log(`\nRequests after click (${postClick.length} total):`);
postClick.forEach(r => {
  const urlShort = r.url.length > 120 ? r.url.slice(0, 120) + "…" : r.url;
  console.log(`  ${r.method} ${urlShort}`);
  if (r.body) console.log(`    body: ${r.body.slice(0, 200)}`);
});

// Full page snapshot
const snap = await page.evaluate(() => ({
  url: window.location.href,
  title: document.title,
  bodyText: document.body.textContent.slice(0, 400).replace(/\s+/g, " ").trim(),
  tableCount: document.querySelectorAll("table").length,
}));
console.log("\nPage state after 10s:", snap);

await browser.close();
