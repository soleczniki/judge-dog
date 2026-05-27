// Get full submit_form() + verify selectedIndex before click
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

// Log ALL requests
const reqs = [];
await page.setRequestInterception(true);
page.on("request", req => {
  reqs.push({ method: req.method(), url: req.url(), body: req.postData()||"", t: Date.now() });
  req.continue();
});
page.on("pageerror", err => console.log("[pageerror]", err.message));

await page.goto(`${BASE}/index.cfm`, { waitUntil: "domcontentloaded", timeout: 30000 });
await sleep(2000);

// Get submit_form full source
const submitFn = await page.evaluate(() =>
  typeof submit_form === "function" ? submit_form.toString() : "NOT DEFINED"
);
console.log("=== submit_form() ===\n" + submitFn + "\n");

// Select WY and check selectedIndex BEFORE clicking
await page.select('select[name="states"]', "WY");
await sleep(300);

const selectState = await page.evaluate(() => {
  const sel = document.getElementById("states");
  return {
    selectedIndex: sel?.selectedIndex,
    value: sel?.value,
    selectedOption: sel?.options[sel.selectedIndex]?.text,
    optionCount: sel?.options.length,
  };
});
console.log("Select state after page.select():", selectState);

// Also compute what error_flag would be
const errFlag = await page.evaluate(() => {
  const jid = document.getElementById("judge_id")?.value || "";
  const lName = document.getElementById("lastName")?.value || "";
  const fName = document.getElementById("firstName")?.value || "";
  const sel = document.getElementById("states");
  const si = sel?.selectedIndex ?? -1;
  const sv = sel?.value ?? "";

  let ef = 0;
  if (jid.length === 0 && lName.length === 0 && fName.length === 0 && si === -1) ef = 1;
  if (jid.length === 0 && lName.length === 0 && fName.length === 0 && (si === 0 || sv === "")) ef = 1;

  return { jidLen: jid.length, lNameLen: lName.length, fNameLen: fName.length,
           si, sv, computedErrorFlag: ef };
});
console.log("error_flag computation:", errFlag);

// Mark t0 and click
const t0 = Date.now();
console.log("\nClicking...");
await page.click('[name="submit_button"]');
await sleep(8000);

// Filter requests after click
const postClick = reqs.filter(r => r.t >= t0);
console.log(`\nRequests after click (${postClick.length}):`);
postClick.forEach(r => {
  const u = r.url.length > 100 ? r.url.slice(0,100)+"…" : r.url;
  console.log(`  ${r.method} ${u}`);
  if (r.body) console.log(`    body: ${r.body}`);
});

const snap = await page.evaluate(() => ({
  url: window.location.href,
  tableCount: document.querySelectorAll("table").length,
  bodySnip: document.body.textContent.slice(0,300).replace(/\s+/g," ").trim(),
}));
console.log("\nPage after 8s:", snap);

await browser.close();
