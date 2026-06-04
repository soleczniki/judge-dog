// Fix FCI emails: the (private) phone tag was blocking ALL email extraction.
// This script fetches the FCI page for every judge with a null email and updates Firestore.
import puppeteer from 'puppeteer';
import admin from 'firebase-admin';
import { createRequire } from 'module';
const req = createRequire(import.meta.url);
const sa = req('./serviceAccount.json');
if(!admin.apps.length) admin.initializeApp({credential:admin.credential.cert(sa)});
const db = admin.firestore();

const sleep = ms => new Promise(r=>setTimeout(r,ms));

async function initBrowser() {
  const browser = await puppeteer.launch({ headless:true, args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage'], defaultViewport:{width:1280,height:900} });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
  await page.goto('https://www.fci.be/en/judges', {waitUntil:'networkidle2',timeout:20000});
  await sleep(1500);
  return { browser, page };
}

let { browser, page } = await initBrowser();
let reqCount = 0;

// Fetch all FCI judges with null email in batches
let total = 0, updated = 0, processed = 0;
let lastDoc = null;

while(true) {
  let q = db.collection('judges')
    .where('source','==','FCI')
    .where('contact.email','==',null)
    .limit(200);
  if(lastDoc) q = q.startAfter(lastDoc);

  const snap = await q.get();
  if(snap.empty) break;
  total += snap.size;

  for(const doc of snap.docs) {
    const urlId = doc.data().fciUrlId;
    if(!urlId) continue;

    // Restart browser every 300 requests
    if(reqCount > 0 && reqCount % 300 === 0) {
      await browser.close();
      const nb = await initBrowser();
      browser = nb.browser; page = nb.page;
    }

    try {
      await page.goto(`https://www.fci.be/en/judges/Judge.aspx?id=${urlId}`, {waitUntil:'networkidle2',timeout:15000});
      const email = await page.evaluate(()=>{
        const links = Array.from(document.querySelectorAll('a[href^="mailto:"]'));
        if(links.length>0) return links[0].href.replace('mailto:','').trim().split('?')[0];
        // Fallback regex
        const m = document.body.innerText.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i);
        return m ? m[0] : null;
      });
      if(email) {
        await doc.ref.update({'contact.email': email});
        console.log(`✅ ${doc.data().name}: ${email}`);
        updated++;
      }
      reqCount++;
    } catch(e) { /* skip timeouts */ }

    await sleep(400);
    processed++;
  }

  lastDoc = snap.docs[snap.docs.length-1];
  console.log(`📊 Processed ${processed} | Updated ${updated} | Batch done`);
  if(snap.size < 200) break;
}

await browser.close();
console.log(`\n✅ Done. Processed ${processed} FCI judges, updated ${updated} with emails.`);
process.exit(0);
