import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, CACHE_SIZE_UNLIMITED, getFirestore } from "firebase/firestore";

export const firebaseConfig = {
  apiKey: "AIzaSyAzhZBxmAVpjj72tdkOxtIYrL59ptkEr9U",
  authDomain: "pink-elle.firebaseapp.com",
  projectId: "pink-elle",
  storageBucket: "pink-elle.firebasestorage.app",
  messagingSenderId: "808342220613",
  appId: "1:808342220613:web:f0395891e530fa5832182c"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

let dbInstance;
try {
  dbInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
      cacheSizeBytes: CACHE_SIZE_UNLIMITED
    })
  });
} catch (error) {
  console.warn("Firestore persistent local cache failed to initialize, falling back to default/memory cache:", error);
  dbInstance = getFirestore(app);
}

export const db = dbInstance;

