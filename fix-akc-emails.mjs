// Fix AKC emails: capture E_MAIL2, E_MAIL3 and detail page emails for judges with null email.
import puppeteer from 'puppeteer';
import admin from 'firebase-admin';
import { createRequire } from 'module';
const req = createRequire(import.meta.url);
const sa = req('./serviceAccount.json');
if(!admin.apps.length) admin.initializeApp({credential:admin.credential.cert(sa)});
const db = admin.firestore();

const sleep = ms => new Promise(r=>setTimeout(r,ms));
const BASE = 'https://www.apps.akc.org/apps/judges_directory';
const LIST = 'https://www.apps.akc.org/a/judges_directory/judge_search/';

const browser = await puppeteer.launch({ headless:true, args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage'], defaultViewport:{width:1280,height:900} });
const page = await browser.newPage();
await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
// Prime AKC session
await page.goto(LIST, {waitUntil:'networkidle2',timeout:30000});
await sleep(2000);

let updated = 0, processed = 0;
let lastDoc = null;

while(true) {
  let q = db.collection('judges')
    .where('source','==','AKC')
    .where('contact.email','==',null)
    .limit(200);
  if(lastDoc) q = q.startAfter(lastDoc);
  const snap = await q.get();
  if(snap.empty) break;

  for(const doc of snap.docs) {
    const judgeNum = doc.data().akcJudgeNumber;
    if(!judgeNum) continue;

    // Re-prime session every 200 requests
    if(processed>0 && processed%200===0) {
      await page.goto(LIST, {waitUntil:'networkidle2',timeout:20000});
      await sleep(1500);
    }

    try {
      await page.goto(`${BASE}/index.cfm?action=refresh_index&active_tab_row=1&active_tab_col=1&fixed_tab=1&judge_id=${judgeNum}`, {waitUntil:'load',timeout:20000});
      await sleep(400);

      const email = await page.evaluate(()=>{
        // Check all cells for email pattern
        const cells = Array.from(document.querySelectorAll('td'));
        for(const cell of cells){
          const t = cell.textContent.trim();
          const m = t.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i);
          if(m) return m[0];
        }
        return null;
      });

      if(email) {
        await doc.ref.update({'contact.email': email});
        console.log(`✅ ${doc.data().name}: ${email}`);
        updated++;
      }
    } catch(e) {}

    processed++;
    await sleep(600);
  }

  lastDoc = snap.docs[snap.docs.length-1];
  console.log(`📊 Processed ${processed} | Updated ${updated}`);
  if(snap.size < 200) break;
}

await browser.close();
console.log(`\n✅ Done. Updated ${updated} AKC judges with emails.`);
process.exit(0);
