import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAzhZBxmAVpjj72tdkOxtIYrL59ptkEr9U",
  authDomain: "pink-elle.firebaseapp.com",
  projectId: "pink-elle",
  storageBucket: "pink-elle.firebasestorage.app",
  messagingSenderId: "808342220613",
  appId: "1:808342220613:web:f0395891e530fa5832182c"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function check() {
  console.log("=== SAFES ===");
  const safesSnap = await getDocs(collection(db, "safes"));
  safesSnap.forEach(doc => {
    console.log(doc.id, "=>", doc.data());
  });

  console.log("\n=== SYSTEM SETTINGS ===");
  const sysSnap = await getDocs(collection(db, "system"));
  sysSnap.forEach(doc => {
    console.log(doc.id, "=>", doc.data());
  });

  console.log("\n=== RECENT TRANSITIONS (~6000 USD MATCHES) ===");
  const txSnap = await getDocs(collection(db, "safe_transactions"));
  txSnap.forEach(doc => {
    const data = doc.data();
    if (data.amount > 5000 || data.previousBalance > 5000 || data.fromSafeId) {
      console.log(doc.id, "=>", data);
    }
  });
}

check();
