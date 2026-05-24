// ── FCI Judge Scraper v4 ───────────────────────────────────────────────────────
import puppeteer from "puppeteer";
import fs from "fs";

const BASE_URL = "https://www.fci.be/en/judges";

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function extractJudgesFromPage(page) {
  return await page.evaluate(() => {
    const rows = document.querySelectorAll("table tbody tr");
    const judges = [];
    rows.forEach(row => {
      const cells = row.querySelectorAll("td");
      if (cells.length >= 2) {
        const link = row.querySelector("a");
        judges.push({
          raw: Array.from(cells).map(c => c.innerText.trim()),
          href: link ? link.href : null
        });
      }
    });
    return judges;
  });
}

async function scrape() {
  console.log("🐕 FCI Judge Scraper v4 starting...");
  
  const browser = await puppeteer.launch({ 
    headless: false,
    defaultViewport: { width: 1280, height: 900 },
    args: ["--no-sandbox"]
  });

  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
  
  console.log("📡 Loading page...");
  await page.goto(BASE_URL, { waitUntil: "networkidle2", timeout: 30000 });
  await sleep(2000);

  // Close popup
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button, a"));
    const closeBtn = buttons.find(b => b.innerText?.trim() === "Close");
    if (closeBtn) closeBtn.click();
  });
  console.log("✅ Closed popup");
  await sleep(1500);

  // Click the pink Search button and wait for navigation
  console.log("🔍 Clicking Search and waiting for results...");
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }).catch(()=>{}),
    page.evaluate(() => {
      // Find the Search button (pink one with magnifier icon)
      const btns = Array.from(document.querySelectorAll("button, input[type='submit'], a"));
      const searchBtn = btns.find(b => 
        b.innerText?.trim() === "Search" || 
        b.value?.trim() === "Search"
      );
      if (searchBtn) { searchBtn.click(); return "clicked"; }
      return "not found";
    })
  ]);
  await sleep(3000);

  await page.screenshot({ path: "fci-results.png" });
  console.log("📸 Saved fci-results.png - check this screenshot!");

  // Get headers
  const headers = await page.evaluate(() => {
    const ths = document.querySelectorAll("table th");
    return Array.from(ths).map(th => th.innerText.trim());
  });
  console.log("📋 Headers:", headers);

  // Extract judges from page 1
  let allJudges = await extractJudgesFromPage(page);
  console.log(`✅ Page 1: ${allJudges.length} judges`);

  if (allJudges.length === 0) {
    // Save HTML for debugging
    const html = await page.content();
    fs.writeFileSync("fci-results.html", html);
    console.log("💾 Saved fci-results.html for debugging");
    
    // Print page text
    const text = await page.evaluate(() => document.body.innerText.slice(0, 1000));
    console.log("📄 Page text:", text);
  }

  // Paginate
  let pageNum = 1;
  while (pageNum < 100) {
    const hasNext = await page.evaluate(() => {
      // Look for next page link
      const links = Array.from(document.querySelectorAll("a"));
      const next = links.find(a => {
        const txt = a.innerText?.trim();
        return txt === ">" || txt === "Next" || txt === "»" || a.rel === "next";
      });
      if (next) { next.click(); return true; }
      return false;
    });
    if (!hasNext) { console.log("📄 No more pages"); break; }
    await sleep(3000);
    const more = await extractJudgesFromPage(page);
    if (!more.length) break;
    allJudges = allJudges.concat(more);
    pageNum++;
    console.log(`📄 Page ${pageNum}: +${more.length} (total: ${allJudges.length})`);
  }

  // Print sample
  console.log("\n📋 First 5 entries:");
  allJudges.slice(0, 5).forEach((j, i) => {
    console.log(`[${i+1}]`, JSON.stringify(j.raw));
  });

  fs.writeFileSync("fci-raw.json", JSON.stringify({ headers, count: allJudges.length, judges: allJudges }, null, 2));
  console.log(`\n💾 Saved ${allJudges.length} judges to fci-raw.json`);

  await browser.close();
}

scrape().catch(console.error);
