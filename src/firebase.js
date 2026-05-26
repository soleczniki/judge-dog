import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getAnalytics, logEvent } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyB4qLXRui9ZaOT5bF6Cd1EMuEbQwmDgUMA",
  authDomain: "judge-dog.firebaseapp.com",
  projectId: "judge-dog",
  storageBucket: "judge-dog.firebasestorage.app",
  messagingSenderId: "585681431524",
  appId: "1:585681431524:web:c3f4fbd7b8839433f775f1",
  measurementId: "G-0BXPLPM3LN"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

// Analytics — only initialised after cookie consent
let _analytics = null;
export function initAnalytics() {
  if (!_analytics) _analytics = getAnalytics(app);
}
export function trackPageView(path) {
  if (_analytics) logEvent(_analytics, "page_view", { page_path: path });
}

export async function uploadPhoto(judgeId, file, slot) {
  const ext = file.name.split(".").pop() || "jpg";
  const storageRef = ref(storage, `judges/${judgeId}/${slot}-${Date.now()}.${ext}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

// Returns existing user data, or { needsConsent: true, ...googleData } for new users
export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  const user = result.user;
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    return { uid: user.uid, name: user.displayName, email: user.email, photo: user.photoURL, ...userSnap.data() };
  }
  // New user — return Google data but don't create the doc yet (needs consent first)
  return { uid: user.uid, name: user.displayName, email: user.email, photo: user.photoURL, role: "exhibitor", needsConsent: true };
}

// Called after the user accepts ToS + Privacy Policy
export async function completeRegistration(uid, { name, email, photo }) {
  const userRef = doc(db, "users", uid);
  await setDoc(userRef, {
    uid, name, email, photo,
    role: "exhibitor",
    consentedToS: true,
    consentedPrivacyPolicy: true,
    consentedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  });
  const fresh = await getDoc(userRef);
  return { uid, name, email, photo, ...fresh.data() };
}

export async function firebaseSignOut() {
  await signOut(auth);
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        callback({ uid: user.uid, ...userSnap.data() });
      } else {
        // Firebase Auth session exists but no profile doc — needs consent
        callback({ uid: user.uid, name: user.displayName, email: user.email, photo: user.photoURL, role: "exhibitor", needsConsent: true });
      }
    } else {
      callback(null);
    }
  });
}
