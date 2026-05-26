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
export const analytics = getAnalytics(app);

export function trackPageView(path) {
  logEvent(analytics, "page_view", { page_path: path });
}
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

export async function uploadPhoto(judgeId, file, slot) {
  const ext = file.name.split(".").pop() || "jpg";
  const storageRef = ref(storage, `judges/${judgeId}/${slot}-${Date.now()}.${ext}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  const user = result.user;
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      name: user.displayName,
      email: user.email,
      photo: user.photoURL,
      role: "exhibitor",
      createdAt: new Date().toISOString(),
    });
  }
  const fresh = await getDoc(userRef);
  return { uid: user.uid, name: user.displayName, email: user.email, photo: user.photoURL, ...fresh.data() };
}

export async function firebaseSignOut() {
  await signOut(auth);
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      callback(userSnap.exists() ? { uid: user.uid, ...userSnap.data() } : null);
    } else {
      callback(null);
    }
  });
}