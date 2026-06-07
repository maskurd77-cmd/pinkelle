const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, doc, updateDoc, addDoc, Timestamp } = require("firebase/firestore");
const fs = require("fs");

// We need the config from src/firebase.ts, but let's just make a simple node script that reads config.
const firebaseConfig = {
  apiKey: "AIzaSyAzhZBxmAVpjj72tdkOxtIYrL59ptkEr9U",
  authDomain: "cheerful-pink-qakkchpr.edgeone.app",
  projectId: "cheerful-pink-qakkchpr",
  storageBucket: "cheerful-pink-qakkchpr.firebaseapp.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function migrate() {
  console.log("Starting migration...");
  const receiptsSnap = await getDocs(collection(db, "receipts"));
  let updated = 0;
  
  for (const r of receiptsSnap.docs) {
    const data = r.data();
    if (data.paymentType === "cash") {
      console.log(`Updating receipt ${r.id}...`);
      await updateDoc(doc(db, "receipts", r.id), {
        paymentType: "debt"
      });
      updated++;
      
      // We also need to add them to debts, right?
      // Wait, if it was cash, it didn't create a debt transaction.
      // We should create a debt.
      
      const debtAmount = data.finalTotal || data.total || 0;
      const profit = data.profit || 0;
      
      // Let's create a debt transaction for this
      const customerName = data.customerName || "کڕیاری گشتی";
      
      // Let's look for existing debt for this customer
      const debtsRef = collection(db, "debts");
      const debtsSnap = await getDocs(debtsRef);
      let existingDebt = null;
      for (const d of debtsSnap.docs) {
         if (d.data().customerName === customerName) {
            existingDebt = d;
            break;
         }
      }
      
      if (existingDebt) {
        await updateDoc(doc(db, "debts", existingDebt.id), {
          amount: (existingDebt.data().amount || 0) + debtAmount,
          remainingAmount: (existingDebt.data().remainingAmount || 0) + debtAmount
        });
        
        await addDoc(collection(db, "debt_transactions"), {
          debtId: existingDebt.id,
          receiptId: r.id,
          type: "add",
          amount: debtAmount,
          customerName: customerName,
          sellerName: data.sellerName || "",
          timestamp: data.timestamp || Timestamp.now(),
          status: "completed",
          notes: data.invoiceNo ? `پسوڵەی ژمارە ${data.invoiceNo}` : "پسوڵەی فرۆشتن"
        });
      } else {
        const newDebtRef = await addDoc(collection(db, "debts"), {
          customerName: customerName,
          amount: debtAmount,
          remainingAmount: debtAmount,
          phone: data.phone || "",
          address: data.address || "",
          timestamp: data.timestamp || Timestamp.now(),
          sellerName: data.sellerName || ""
        });
        
        await addDoc(collection(db, "debt_transactions"), {
          debtId: newDebtRef.id,
          receiptId: r.id,
          type: "add",
          amount: debtAmount,
          customerName: customerName,
          sellerName: data.sellerName || "",
          timestamp: data.timestamp || Timestamp.now(),
          status: "completed",
          notes: data.invoiceNo ? `پسوڵەی ژمارە ${data.invoiceNo}` : "پسوڵەی فرۆشتن"
        });
      }
    }
  }
  
  console.log(`Done! Updated ${updated} receipts.`);
  process.exit(0);
}

migrate().catch(console.error);
