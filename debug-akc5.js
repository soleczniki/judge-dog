// Get full enable_search() and check what blocks it from submitting
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

page.on("console", msg => console.log(`[browser:${msg.type()}]`, msg.text().slice(0, 200)));
page.on("pageerror", err => console.log("[pageerror]", err.message));

await page.goto(`${BASE}/index.cfm`, { waitUntil: "domcontentloaded", timeout: 30000 });
await sleep(2000);

// Get FULL enable_search source + check what submit() actually calls
const info = await page.evaluate(() => {
  // Full enable_search
  const fn = typeof enable_search === "function" ? enable_search.toString() : "NOT DEFINED";

  // Find all global functions that mention "submit" or "form"
  const fns = Object.keys(window)
    .filter(k => typeof window[k] === "function" && k !== "fn")
    .filter(k => {
      try {
        const s = window[k].toString();
        return s.includes("submit") || s.includes(".cfm");
      } catch(e) { return false; }
    })
    .map(k => ({
      name: k,
      source: window[k].toString().slice(0, 300),
    }));

  // Also check if there's a form with onsubmit
  const form = document.querySelector("form");
  const formInfo = form ? {
    action: form.action,
    onsubmit: form.onsubmit?.toString() || "(none)",
    method: form.method,
  } : null;

  return { fn, fns, formInfo };
});

console.log("=== enable_search() FULL ===\n" + info.fn);
console.log("\n=== Form info ===");
console.log(JSON.stringify(info.formInfo, null, 2));
console.log("\n=== Other submit-related functions ===");
info.fns.forEach(f => console.log(`-- ${f.name}:\n${f.source}\n`));

await browser.close();
