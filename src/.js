// ── FCI Judge Scraper ──────────────────────────────────────────────────────────
// Run with: node scrape-fci.js
// Output:   fci-judges.json
//
// Install dependencies first:
//   npm install puppeteer fs-extra

import puppeteer from "puppeteer";
import fs from "fs";

const BASE_URL = "https://www.fci.be/en/judges";
const OUTPUT = "fci-judges.json";

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function getFlag(country) {
  const flags = {
    "Germany": "🇩🇪", "France": "🇫🇷", "Italy": "🇮🇹", "Spain": "🇪🇸",
    "United States": "🇺🇸", "USA": "🇺🇸", "United Kingdom": "🇬🇧", "UK": "🇬🇧",
    "Australia": "🇦🇺", "Canada": "🇨🇦", "Japan": "🇯🇵", "Brazil": "🇧🇷",
    "Argentina": "🇦🇷", "Netherlands": "🇳🇱", "Belgium": "🇧🇪", "Sweden": "🇸🇪",
    "Norway": "🇳🇴", "Denmark": "🇩🇰", "Finland": "🇫🇮", "Poland": "🇵🇱",
    "Czech Republic": "🇨🇿", "Slovakia": "🇸🇰", "Hungary": "🇭🇺", "Austria": "🇦🇹",
    "Switzerland": "🇨🇭", "Portugal": "🇵🇹", "Ireland": "🇮🇪", "Russia": "🇷🇺",
    "Ukraine": "🇺🇦", "Romania": "🇷🇴", "Bulgaria": "🇧🇬", "Greece": "🇬🇷",
    "Turkey": "🇹🇷", "Mexico": "🇲🇽", "Colombia": "🇨🇴", "Chile": "🇨🇱",
    "South Africa": "🇿🇦", "China": "🇨🇳", "South Korea": "🇰🇷", "India": "🇮🇳",
    "New Zealand": "🇳🇿", "Croatia": "🇭🇷", "Serbia": "🇷🇸", "Slovenia": "🇸🇮",
  };
  return flags[country] || "🌍";
}

async function scrape() {
  console.log("🐕 Starting FCI judge scraper...");
  
  const browser = await puppeteer.launch({ 
    headless: false, // Set to true once you confirm it works
    defaultViewport: null,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
  
  console.log("📡 Loading FCI judges page...");
  await page.goto(BASE_URL, { waitUntil: "networkidle2", timeout: 30000 });
  await sleep(2000);

  // Take a screenshot to see what we're working with
  await page.screenshot({ path: "fci-page.png", fullPage: false });
  console.log("📸 Screenshot saved as fci-page.png - check what the page looks like");

  // Get page HTML to analyze structure
  const html = await page.content();
  fs.writeFileSync("fci-page.html", html);
  console.log("💾 Page HTML saved as fci-page.html");

  // Try to find judge data - check for tables, lists, or search forms
  const pageText = await page.evaluate(() => document.body.innerText.slice(0, 2000));
  console.log("📄 Page preview:\n", pageText);

  // Look for any search/filter controls
  const inputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("input, select")).map(el => ({
      type: el.type || el.tagName,
      name: el.name,
      id: el.id,
      placeholder: el.placeholder
    }));
  });
  console.log("🔍 Form controls found:", JSON.stringify(inputs, null, 2));

  // Look for judge entries
  const judgeData = await page.evaluate(() => {
    // Try various selectors that FCI might use
    const selectors = [
      "table tbody tr",
      ".judge-item",
      ".judge-list li",
      "[class*='judge']",
      "tr[data-id]",
    ];
    
    for (const sel of selectors) {
      const items = document.querySelectorAll(sel);
      if (items.length > 0) {
        return {
          selector: sel,
          count: items.length,
          sample: items[0]?.innerText?.slice(0, 200)
        };
      }
    }
    return { selector: "none found", count: 0 };
  });

  console.log("🎯 Judge elements:", JSON.stringify(judgeData, null, 2));

  await browser.close();
  console.log("\n✅ Analysis complete. Check fci-page.png and fci-page.html to see the page structure.");
  console.log("📨 Share the screenshot here so we can build the proper extractor.");
}

scrape().catch(console.error);
