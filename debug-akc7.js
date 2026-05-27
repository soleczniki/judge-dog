// Check form name and manually trigger the correct submit
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

page.on("pageerror", err => console.log("[pageerror]", err.message));

await page.goto(`${BASE}/index.cfm`, { waitUntil: "domcontentloaded", timeout: 30000 });
await sleep(2000);

// Inspect all forms
const formInfo = await page.evaluate(() => {
  return {
    formCount: document.forms.length,
    forms: Array.from(document.forms).map(f => ({
      id: f.id,
      name: f.name,
      action: f.action,
      method: f.method,
    })),
    indexpageform: document.forms.indexpageform
      ? "EXISTS"
      : "UNDEFINED",
    namedForms: Array.from(document.forms).map(f => f.name || "(no name)"),
  };
});
console.log("Forms on page:", JSON.stringify(formInfo, null, 2));

// ── If the form exists, manually submit it to index.cfm?action=results ────────
console.log("\n── Manual submit to index.cfm?action=results ──");
await page.select('select[name="states"]', "WY");
await sleep(300);

// Set up navigation listener BEFORE submitting
const navPromise = page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(e => `NAV FAIL: ${e.message}`);

// Manually set form action and submit via evaluate
await page.evaluate(() => {
  const form = document.querySelector("form");
  if (form) {
    form.target = "_top";
    form.action = "index.cfm?action=results";
    form.submit();
  }
});

const navResult = await navPromise;
console.log("Navigation:", navResult || "OK");
console.log("URL after submit:", page.url());

await sleep(3000);
const snap = await page.evaluate(() => ({
  url: window.location.href,
  title: document.title,
  tableCount: document.querySelectorAll("table").length,
  hasNumJudge: document.body.innerHTML.includes("NUM_JUDGE"),
  bodySnip: document.body.textContent.slice(0,300).replace(/\s+/g," ").trim(),
}));
console.log("Page after manual submit:", JSON.stringify(snap, null, 2));

await browser.close();
