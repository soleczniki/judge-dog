// Debug script: inspect AKC form fields and raw POST response
import puppeteer from "puppeteer";

const BASE = "https://www.apps.akc.org/apps/judges_directory";

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage"],
    defaultViewport: { width: 1280, height: 900 },
  });
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

  // ── Step 1: Load the search form ─────────────────────────────────────────────
  console.log("1. Loading form page...");
  await page.goto(`${BASE}/index.cfm`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await new Promise(r => setTimeout(r, 1500));

  // ── Step 2: Dump ALL form fields (including hidden) ───────────────────────────
  const formInfo = await page.evaluate(() => {
    const forms = Array.from(document.querySelectorAll("form"));
    return forms.map(form => ({
      action: form.action,
      method: form.method,
      fields: Array.from(form.querySelectorAll("input,select,textarea")).map(el => ({
        name: el.name,
        type: el.type,
        value: el.type === "select-one" || el.type === "select-multiple"
          ? Array.from(el.options).find(o => o.selected)?.value
          : el.value,
      })),
    }));
  });
  console.log("\n2. Form fields found:");
  formInfo.forEach((f, i) => {
    console.log(`  Form #${i}: action=${f.action} method=${f.method}`);
    f.fields.forEach(fld => console.log(`    [${fld.type}] name="${fld.name}" value="${fld.value}"`));
  });

  // ── Step 3: Try real form submit via Puppeteer (click) for state WY ──────────
  console.log("\n3. Selecting WY and clicking submit...");
  try {
    await page.select('select[name="states"]', "WY");
    await new Promise(r => setTimeout(r, 300));

    // Intercept the request to see actual POST data
    await page.setRequestInterception(true);
    page.once("request", req => {
      if (req.method() === "POST") {
        console.log("   POST URL:", req.url());
        console.log("   POST body:", req.postData());
      }
      req.continue();
    });

    const navPromise = page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 20000 }).catch(e => `NAV_FAIL: ${e.message}`);
    await page.click('input[name="submit_button"]');
    const navResult = await navPromise;
    console.log("   Navigation result:", navResult || "OK");

    const url = page.url();
    const title = await page.title();
    console.log("   Current URL:", url);
    console.log("   Page title:", title);

    const snippet = await page.evaluate(() => document.body.textContent.slice(0, 400).replace(/\s+/g, " "));
    console.log("   Body snippet:", snippet);
  } catch(e) {
    console.log("   Click/submit error:", e.message);
  }

  // ── Step 4: Try direct fetch() with ALL form fields ───────────────────────────
  console.log("\n4. Reload form and try fetch() with all fields...");
  await page.goto(`${BASE}/index.cfm`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await new Promise(r => setTimeout(r, 800));

  const fetchResult = await page.evaluate(async (base) => {
    // Grab all form fields automatically
    const form = document.querySelector("form");
    if (!form) return { error: "no form found" };

    const fd = new FormData(form);
    // Override state to WY
    fd.set("states", "WY");
    // Make sure submit button value is included
    fd.set("submit_button", "Search");

    // Log what we're sending
    const entries = {};
    for (const [k, v] of fd.entries()) entries[k] = v;

    const body = new URLSearchParams(fd).toString();
    const url = form.action || window.location.href;

    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        credentials: "include",
      });
      const html = await resp.text();
      return {
        url,
        status: resp.status,
        formFields: entries,
        bodyLength: html.length,
        htmlSnippet: html.slice(0, 800),
        hasTable: html.includes("NUM_JUDGE"),
        hasCfDump: html.includes("cfdump"),
      };
    } catch(e) {
      return { url, error: e.message, formFields: entries };
    }
  }, BASE);

  console.log("   Fetch to:", fetchResult.url);
  console.log("   Status:", fetchResult.status);
  console.log("   Form fields sent:", JSON.stringify(fetchResult.formFields, null, 2));
  console.log("   Response length:", fetchResult.bodyLength);
  console.log("   Has NUM_JUDGE:", fetchResult.hasTable);
  console.log("   Has cfdump:", fetchResult.hasCfDump);
  console.log("   HTML snippet:\n", fetchResult.htmlSnippet);

  await browser.close();
}

main().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
