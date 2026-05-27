// Minimal AKC debug: what does the server actually return?
import puppeteer from "puppeteer";

const BASE = "https://www.apps.akc.org/apps/judges_directory";

const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage"],
  defaultViewport: { width: 1280, height: 900 },
});
const page = await browser.newPage();
await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

// ── 1. Load form page to prime cookies ───────────────────────────────────────
console.log("Loading form page...");
await page.goto(`${BASE}/index.cfm`, { waitUntil: "domcontentloaded", timeout: 30000 });
await new Promise(r => setTimeout(r, 1500));
console.log("Page URL after load:", page.url());

// ── 2. Collect all form fields including hidden ones ─────────────────────────
const formDump = await page.evaluate(() => {
  const form = document.querySelector("form");
  if (!form) return { action: null, method: null, fields: [] };
  return {
    action: form.action,
    method: form.method,
    fields: Array.from(form.elements).map(el => ({
      tag: el.tagName,
      name: el.name,
      type: el.type || "N/A",
      value: el.value || "(empty)",
    })).filter(f => f.name),
  };
});

console.log(`\nForm: action="${formDump.action}" method="${formDump.method}"`);
formDump.fields.forEach(f => console.log(`  [${f.type}] ${f.name} = "${f.value}"`));

// ── 3. Set state to WY and fetch with ALL form fields ────────────────────────
const result = await page.evaluate(async () => {
  const form = document.querySelector("form");
  if (!form) return { error: "no form" };

  // Collect all fields into URLSearchParams
  const params = new URLSearchParams();
  Array.from(form.elements).forEach(el => {
    if (!el.name) return;
    if (el.type === "select-multiple") {
      Array.from(el.selectedOptions).forEach(opt => params.append(el.name, opt.value));
    } else if (el.type === "checkbox" || el.type === "radio") {
      if (el.checked) params.append(el.name, el.value);
    } else {
      params.append(el.name, el.value);
    }
  });
  // Override state selection
  params.set("states", "WY");
  params.set("submit_button", "Search");

  const postUrl = form.action || window.location.href;
  console.log("[browser] POSTing to:", postUrl);
  console.log("[browser] body:", params.toString());

  const resp = await fetch(postUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
    credentials: "include",
  });

  const html = await resp.text();
  return {
    status: resp.status,
    url: resp.url,
    postUrl,
    body: params.toString(),
    htmlLen: html.length,
    hasNumJudge: html.includes("NUM_JUDGE"),
    hasCfDump: html.includes("cfdump"),
    hasResults: html.includes("results"),
    // First 1200 chars of HTML
    htmlHead: html.slice(0, 1200),
    // Search for table content
    tableSnippet: (() => {
      const m = html.match(/<table[\s\S]{0,5000}/i);
      return m ? m[0].slice(0, 600) : "(no table found)";
    })(),
  };
});

console.log("\n── POST Result ──────────────────────────────────────");
console.log("Status:", result.status);
console.log("Response URL:", result.url);
console.log("POST URL:", result.postUrl);
console.log("POST body:", result.body);
console.log("HTML length:", result.htmlLen);
console.log("Has NUM_JUDGE:", result.hasNumJudge);
console.log("Has cfdump:", result.hasCfDump);
console.log("Has 'results':", result.hasResults);
console.log("\n── HTML Head (first 1200 chars) ─────────────────────");
console.log(result.htmlHead);
console.log("\n── First table ──────────────────────────────────────");
console.log(result.tableSnippet);

await browser.close();
