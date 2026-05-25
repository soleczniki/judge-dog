// Creates a judge profile for Bogdan Karpovic and assigns it to hello@lendas.lt
// Run: node create-judge-bogdan.js

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore }        from "firebase-admin/firestore";
import { readFileSync }        from "fs";

const sa = JSON.parse(readFileSync("./serviceAccount.json", "utf8"));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const JUDGE_ID   = "bogdan-karpovic";
const USER_EMAIL = "hello@lendas.lt";

// ── Create judge document ──────────────────────────────────────────────────────
await db.doc(`judges/${JUDGE_ID}`).set({
  id:           JUDGE_ID,
  slug:         "bogdan-karpovic",
  name:         "Bogdan Karpovic",
  country:      "Lithuania",
  orgs:         [{ org: "FCI", id: "test" }],
  breeds:       [],
  groupNames:   [],
  disciplines:  ["Conformation"],
  bio:          "",
  headline:     "",
  highlights:   [],
  galleryPhotos:[],
  social:       {},
  verified:     true,
  claimedBy:    USER_EMAIL,
  hidden:       true,
  allBreedJudge:false,
  bisJudge:     false,
  suspensions:  [],
  flag:         "LT",
});

console.log(`Judge document created: judges/${JUDGE_ID}`);

// ── Find the user by email and set role to judge ───────────────────────────────
const usersSnap = await db.collection("users").where("email", "==", USER_EMAIL).get();

if (usersSnap.empty) {
  console.log(`No user found for ${USER_EMAIL} yet.`);
  console.log("Sign in once on the site first, then re-run this script.");
  process.exit(0);
}

const userDoc = usersSnap.docs[0];
await userDoc.ref.update({ role: "judge", judgeId: JUDGE_ID });
console.log(`User ${USER_EMAIL} (${userDoc.id}) updated → role: judge, judgeId: ${JUDGE_ID}`);
process.exit(0);
