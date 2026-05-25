// Generates a URL slug from each judge's name and writes it to Firestore.
// Safe to re-run — only updates judges that don't already have a slug.
// Run: node migrate-slugs.js

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore }        from "firebase-admin/firestore";
import { readFileSync }        from "fs";

const sa = JSON.parse(readFileSync("./serviceAccount.json", "utf8"));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

function nameToSlug(name) {
  return name
    // Characters that don't decompose via NFD — replace explicitly first
    .replace(/[øØ]/g, "o")
    .replace(/[æÆ]/g, "ae")
    .replace(/[åÅ]/g, "a")
    .replace(/[ðÐ]/g, "d")
    .replace(/[þÞ]/g, "th")
    .replace(/[ßẞ]/g, "ss")
    .normalize("NFD")               // decompose ü→u+¨, ó→o+´, etc.
    .replace(/[̀-ͯ]/g, "") // strip all combining marks
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")  // remove anything else unusual
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

const snap = await db.collection("judges").get();
const judges = snap.docs.map(d => ({ docId: d.id, ...d.data() }));

// Build slug → docId map to detect collisions across existing slugs
const usedSlugs = new Map(); // slug → docId that owns it
for (const j of judges) {
  if (j.slug) usedSlugs.set(j.slug, j.docId);
}

function uniqueSlug(base, docId) {
  if (!usedSlugs.has(base)) {
    usedSlugs.set(base, docId);
    return base;
  }
  if (usedSlugs.get(base) === docId) return base; // already owns it
  let i = 2;
  while (usedSlugs.has(`${base}-${i}`)) i++;
  const slug = `${base}-${i}`;
  usedSlugs.set(slug, docId);
  return slug;
}

let updated = 0, skipped = 0;
const batch = db.batch();

for (const j of judges) {
  const base = nameToSlug(j.name || j.docId);
  const slug = uniqueSlug(base, j.docId);
  batch.update(db.doc(`judges/${j.docId}`), { slug });
  console.log(`  ${j.docId.padEnd(12)} "${j.name}" → /judge/${slug}`);
  updated++;
}

await batch.commit();
console.log(`\nDone — ${updated} updated, ${skipped} already had slugs.`);
process.exit(0);
