// Click the button and poll DOM — no waitForNavigation
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

// ── Enable console forwarding so we can see browser logs ─────────────────────
page.on("console", msg => console.log("[browser]", msg.text()));

await page.goto(`${BASE}/index.cfm`, { waitUntil: "domcontentloaded", timeout: 30000 });
await sleep(1500);

// Select WY
await page.select('select[name="states"]', "WY");
await sleep(300);

// What is the button exactly?
const btnInfo = await page.evaluate(() => {
  const btn = document.querySelector('[name="submit_button"]');
  if (!btn) return "NOT FOUND";
  return {
    tag: btn.tagName,
    type: btn.type,
    value: btn.value,
    outerHTML: btn.outerHTML.slice(0, 200),
  };
});
console.log("Button:", JSON.stringify(btnInfo, null, 2));

// Click and poll DOM every second for 20 seconds
console.log("\nClicking submit button...");
await page.click('[name="submit_button"]');

for (let i = 1; i <= 20; i++) {
  await sleep(1000);
  const snap = await page.evaluate(() => {
    const tables = Array.from(document.querySelectorAll("table"));
    const cfdump = tables.find(t => {
      const th = t.querySelector("th");
      return th && /^[A-Z]{2,}(_[A-Z]+)*$/.test(th.textContent?.trim());
    });
    const bodyText = document.body.textContent.slice(0, 200).replace(/\s+/g, " ").trim();
    return {
      tableCount: tables.length,
      hasCfDump: !!cfdump,
      cfDumpFirstTh: cfdump ? cfdump.querySelector("th")?.textContent?.trim() : null,
      cfDumpRowCount: cfdump ? cfdump.querySelectorAll("tr").length : 0,
      bodySnippet: bodyText,
      url: window.location.href,
    };
  });
  console.log(`  t+${i}s: tables=${snap.tableCount} cfdump=${snap.hasCfDump} rows=${snap.cfDumpRowCount} | ${snap.bodySnippet.slice(0,80)}`);
  if (snap.hasCfDump) {
    console.log(`  ✅ cfdump found at t+${i}s! First th: "${snap.cfDumpFirstTh}", rows: ${snap.cfDumpRowCount}`);
    break;
  }
}

await browser.close();
