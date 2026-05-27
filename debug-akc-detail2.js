// Try multiple URL patterns for AKC judge 105762 to find breed/discipline data
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

// First: get CA results so we can inspect the live page for judge 105762
// and find the actual "Group/Breed Detail Dates" link URL
console.log("Loading CA results page...");
await page.goto(`${BASE}/index.cfm`, { waitUntil: "domcontentloaded", timeout: 30000 });
await sleep(800);
await page.select('select[name="states"]', "CA");
await sleep(300);
const navPromise = page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 });
page.evaluate(() => {
  const form = document.querySelector("form");
  form.action = "index.cfm?action=results";
  form.submit();
}).catch(() => {});
await navPromise;
await sleep(2000);

// Find all links containing "breed" or "detail" or judge 105762
const links = await page.evaluate(() => {
  return Array.from(document.querySelectorAll("a"))
    .map(a => ({ text: a.textContent.trim().slice(0,60), href: a.href }))
    .filter(a => a.href && (
      a.href.includes("breed") || a.href.includes("detail") ||
      a.href.includes("105762") || a.href.includes("assign") ||
      a.text.toLowerCase().includes("breed") || a.text.toLowerCase().includes("detail")
    ))
    .slice(0, 20);
});

console.log("\nRelevant links on CA results page:");
links.forEach(l => console.log(`  [${l.text}] → ${l.href}`));

// Also grab the KEYFIELD for judge 105762 if visible
const keyfield = await page.evaluate(() => {
  const body = document.body.innerHTML;
  // Look for 105762 near a keyfield value
  const match = body.match(/105762[^<]{0,200}/);
  return match ? match[0].slice(0,200) : "not found";
});
console.log("\nContext around 105762:", keyfield.replace(/\s+/g," ").slice(0,300));

await browser.close();
