import { IQDInput } from '../components/IQDInput';
import React, { useState, useEffect } from "react";
import {
  collection,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  writeBatch,
  Timestamp,
  query,
  orderBy,
  getDoc,
  getDocs,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import {
  Banknote,
  Plus,
  ArrowRightLeft,
  History,
  X,
  ShieldCheck,
  ArrowDownToLine,
  ArrowUpFromLine,
  Calculator,
  Send,
  FileClock,
  Edit,
  Trash2,
  Search,
  Filter,
} from "lucide-react";
import { formatCurrency } from "../data";

export default function SafesPage({ settings: propSettings }: any) {
  const [safes, setSafes] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);

  const [isAddingSafe, setIsAddingSafe] = useState(false);
  const [newSafeName, setNewSafeName] = useState("");
  const [newSafeUSD, setNewSafeUSD] = useState("");
  const [editingSafe, setEditingSafe] = useState<{id: string, name: string, balance?: number} | null>(null);

  const [isTransferring, setIsTransferring] = useState(false);
  const [transferFrom, setTransferFrom] = useState("");
  const [transferTo, setTransferTo] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferNote, setTransferNote] = useState("");

  const [isAdjusting, setIsAdjusting] = useState(false);
  const [adjustSafeId, setAdjustSafeId] = useState("");
  const [adjustType, setAdjustType] = useState<"add" | "subtract">("add");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustNote, setAdjustNote] = useState("");

  const [isHawala, setIsHawala] = useState(false);
  const [hawalaSafe, setHawalaSafe] = useState("");
  const [hawalaAmount, setHawalaAmount] = useState("");
  const [hawalaFee, setHawalaFee] = useState("0");
  const [hawalaReceiver, setHawalaReceiver] = useState("");
  const [hawalaOffice, setHawalaOffice] = useState("");
  const [hawalaNote, setHawalaNote] = useState("");

  const [userRole, setUserRole] = useState("");
  const [pendingTransactions, setPendingTransactions] = useState<any[]>([]);

  // Himdad Safe Reversion states
  const [sysSettings, setSysSettings] = useState<any>(propSettings || null);
  const [himdadRevertAmount, setHimdadRevertAmount] = useState("6000");
  const [himdadDestSafeId, setHimdadDestSafeId] = useState("");
  const [himdadRevertSuccess, setHimdadRevertSuccess] = useState(false);
  const [isExecutingHimdadRevert, setIsExecutingHimdadRevert] = useState(false);

  // Transaction Edit/Delete states
  const [editingTransaction, setEditingTransaction] = useState<any | null>(null);
  const [editTxAmount, setEditTxAmount] = useState("");
  const [editTxNote, setEditTxNote] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");

  useEffect(() => {
    if (auth.currentUser) {
      getDoc(doc(db, "users", auth.currentUser.uid)).then((snap) => {
        if (snap.exists()) setUserRole(snap.data().role || "user");
      });
    }

    // Load settings from db
    getDoc(doc(db, "system", "settings")).then((snap) => {
      if (snap.exists()) {
        const sData = snap.data();
        setSysSettings(sData);
        if (sData.defaultSafeForDebt) {
          setHimdadDestSafeId(sData.defaultSafeForDebt);
        }
      }
    });

    const unsubSafes = onSnapshot(collection(db, "safes"), (snap) => {
      const loadedSafes = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setSafes(loadedSafes);
    });

    // Limits history to last 100 for perf in view
    const qTrans = query(
      collection(db, "safe_transactions"),
      orderBy("timestamp", "desc"),
    );
    const unsubTrans = onSnapshot(qTrans, (snap) => {
      const allTrans = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setTransactions(allTrans.filter((t: any) => t.status !== "pending"));
      setPendingTransactions(
          allTrans.filter((t: any) => t.status === "pending"),
      );
    });

    return () => {
      unsubSafes();
      unsubTrans();
    };
  }, []);

  // One-time automatic migration for Himdad Rizgar Hassan safe:
  // Cleans up previous transactions, keeps only the $281 deposit, and sets safe balance to exactly $281.
  useEffect(() => {
    const runMigration = async () => {
      if (localStorage.getItem("himdad_safe_cleaned_v3")) return;
      try {
        console.log("Starting Himdad Rizgar Hassan safe cleanup...");
        const safesSnap = await getDocs(collection(db, "safes"));
        let targetSafe: any = null;
        safesSnap.forEach((doc) => {
          const data = doc.data();
          if (
            data.name &&
            (data.name.includes("هيمداد") ||
              data.name.includes("Himdad") ||
              data.name.includes("hemdad"))
          ) {
            targetSafe = { id: doc.id, ...data };
          }
        });

        if (!targetSafe) {
          console.log("No safe found for Himdad");
          return;
        }

        console.log("Found Himdad's safe:", targetSafe);

        // Get all transactions
        const txSnap = await getDocs(collection(db, "safe_transactions"));
        const toDelete: string[] = [];
        let found281 = false;

        txSnap.forEach((doc) => {
          const t = doc.data();
          const matchesSafe =
            t.safeId === targetSafe.id ||
            t.fromSafeId === targetSafe.id ||
            t.toSafeId === targetSafe.id;

          if (matchesSafe) {
            // Keep exactly the transaction showing 281 USD
            if (t.amount === 281 || t.receivedAmount === 281) {
              found281 = true;
              console.log("Keeping 281 transaction:", doc.id, t);
            } else {
              toDelete.push(doc.id);
            }
          }
        });

        const batch = writeBatch(db);

        // Delete all other historical transactions of this safe
        for (const id of toDelete) {
          batch.delete(doc(db, "safe_transactions", id));
        }

        // If no $281 transaction was found, create a deposit of $281
        if (!found281) {
          console.log("281 USD transaction not found. Creating a $281 deposit...");
          const newTxRef = doc(collection(db, "safe_transactions"));
          batch.set(newTxRef, {
            type: "deposit",
            safeId: targetSafe.id,
            safeName: targetSafe.name,
            amount: 281,
            currency: "USD",
            note: "پارەی وەرگیراو",
            status: "completed",
            timestamp: Timestamp.now(),
          });
        }

        // Force update the safe's balance to exactly 281 USD
        batch.update(doc(db, "safes", targetSafe.id), {
          balance: 281,
        });

        await batch.commit();
        console.log("Himdad's safe successfully cleaned and set to $281.");
        localStorage.setItem("himdad_safe_cleaned_v3", "true");
      } catch (err) {
        console.error("Himdad safe cleanup failed:", err);
      }
    };

    runMigration();
  }, []);

  // One-time AUTO reversion of the ~6000 USD transfer to the safe specified in settings
  useEffect(() => {
    const autoRevertSub = async () => {
      // Check if already auto reverted to prevent loops
      if (localStorage.getItem("himdad_safe_auto_revert_v5")) return;
      if (safes.length === 0) return;

      try {
        // Find Himdad's safe
        const himdadSafe = safes.find(s => 
          s.name && (s.name.includes("هيمداد") || s.name.includes("هئمداد") || s.name.includes("Himdad"))
        );
        if (!himdadSafe) return;

        // Find settings-specified safe or fallback
        const settingsSafeId = sysSettings?.defaultSafeForDebt;
        const targetSafe = safes.find(s => s.id === settingsSafeId) || 
                           safes.find(s => s.name?.includes("سەرەکی") || s.name?.includes("Main")) || 
                           safes.find(s => s.id !== himdadSafe.id);
        
        if (!targetSafe) return;

        console.log("Auto-reverting 6000 USD from Himdad's safe to settings/default safe:", targetSafe.name);

        const batch = writeBatch(db);

        // Add 6000 USD to settings/default safe
        batch.update(doc(db, "safes", targetSafe.id), {
          balance: (targetSafe.balance || 0) + 6000
        });

        // Ensure Himdad's safe is exactly 281 USD
        batch.update(doc(db, "safes", himdadSafe.id), {
          balance: 281
        });

        // Create transaction record for the reversion (pure safe adjustment, no invoice/debt influence)
        const revTxRef = doc(collection(db, "safe_transactions"));
        batch.set(revTxRef, {
          type: "transfer",
          fromSafeId: himdadSafe.id,
          fromSafeName: himdadSafe.name,
          toSafeId: targetSafe.id,
          toSafeName: targetSafe.name,
          amount: 6000,
          receivedAmount: 6000,
          currency: "USD",
          receivedCurrency: "USD",
          exchangeRate: 1,
          note: "گەراندنەوەی خۆکاری حەواڵەی پێشووی قاسمی هیمداد بۆ قاسمی ڕێکخستنی سێتینگ",
          status: "completed",
          timestamp: Timestamp.now()
        });

        await batch.commit();
        localStorage.setItem("himdad_safe_auto_revert_v5", "true");
        console.log("Himdad safe 6000 USD auto-reversion successfully executed.");
      } catch (err) {
        console.error("Auto reversion failed:", err);
      }
    };

    if (safes.length > 0 && sysSettings) {
      autoRevertSub();
    }
  }, [safes, sysSettings]);

  const handleHimdadRevert = async () => {
    if (!himdadDestSafeId) {
      alert("تکایە قاسەیەکی مەبەست هەڵبژێرە بۆ گەڕاندنەوەی پارەکە.");
      return;
    }
    const amountToReturn = Number(himdadRevertAmount) || 0;
    if (amountToReturn <= 0) {
      alert("تکایە بڕی گەڕاندنەوە بە دروستی بنووسە.");
      return;
    }

    setIsExecutingHimdadRevert(true);
    try {
      // Find Himdad safe
      let himdadSafe = safes.find(s => 
        s.name && (s.name.includes("هيمداد") || s.name.includes("هئمداد") || s.name.includes("Himdad"))
      );

      if (!himdadSafe) {
        alert("قاسەی هیمداد ڕزگار نەدۆزرایەوە!");
        setIsExecutingHimdadRevert(false);
        return;
      }

      const destSafe = safes.find((s) => s.id === himdadDestSafeId);
      if (!destSafe) {
        alert("قاسەی مەبەست بۆ گەڕاندنەوە نەدۆزرایەوە!");
        setIsExecutingHimdadRevert(false);
        return;
      }

      const batch = writeBatch(db);

      // 1. Force Himdad's safe balance to exactly 281 USD
      batch.update(doc(db, "safes", himdadSafe.id), {
        balance: 281,
      });

      // 2. Add the reverted amount to the destination safe
      batch.update(doc(db, "safes", destSafe.id), {
        balance: (destSafe.balance || 0) + amountToReturn,
      });

      // 3. Clear other transactions or create the 281 if missing
      const txSnap = await getDocs(collection(db, "safe_transactions"));
      let found281 = false;
      txSnap.forEach((doc) => {
        const t = doc.data();
        const matchesHimdad =
          t.safeId === himdadSafe.id ||
          t.fromSafeId === himdadSafe.id ||
          t.toSafeId === himdadSafe.id;

        if (matchesHimdad) {
          if (t.amount === 281 || t.receivedAmount === 281) {
            found281 = true;
          } else {
            batch.delete(doc.ref);
          }
        }
      });

      if (!found281) {
        const newTxRef = doc(collection(db, "safe_transactions"));
        batch.set(newTxRef, {
          type: "deposit",
          safeId: himdadSafe.id,
          safeName: himdadSafe.name,
          amount: 281,
          currency: "USD",
          note: "پارەی وەرگیراوی جێگیر",
          status: "completed",
          timestamp: Timestamp.now(),
        });
      }

      // 4. Create a transaction for the reversion
      const revTxRef = doc(collection(db, "safe_transactions"));
      batch.set(revTxRef, {
        type: "transfer",
        fromSafeId: himdadSafe.id,
        fromSafeName: himdadSafe.name,
        toSafeId: destSafe.id,
        toSafeName: destSafe.name,
        amount: amountToReturn,
        receivedAmount: amountToReturn,
        currency: "USD",
        receivedCurrency: "USD",
        exchangeRate: 1,
        note: `گەڕاندنەوەی حەواڵەی پێشوو بۆ قاسمی سەرەکی بەپێی داوای کڕیار`,
        status: "completed",
        timestamp: Timestamp.now(),
      });

      await batch.commit();
      setHimdadRevertSuccess(true);
      localStorage.setItem("himdad_safe_revert_done_v5", "true");
      alert("حەواڵەکە بە سەرکەوتوویی گەڕێندرایەوە و باڵانسەکان چاککران!");
    } catch (err: any) {
      console.error(err);
      alert("هەڵەیەک ڕوویدا لە کاتی چاککردن: " + err.message);
    } finally {
      setIsExecutingHimdadRevert(false);
    }
  };

  const handleEditTransactionClick = (tx: any) => {
    setEditingTransaction(tx);
    setEditTxAmount(tx.amount.toString());
    setEditTxNote(tx.note || "");
  };

  const handleUpdateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTransaction) return;

    const newAmount = Number(editTxAmount) || 0;
    const oldAmount = Number(editingTransaction.amount) || 0;
    const diff = newAmount - oldAmount;

    try {
      const batch = writeBatch(db);

      // If the transaction was completed, we need to adjust the safe balance(s)
      if (editingTransaction.status === "completed") {
        if (editingTransaction.type === "transfer") {
          const fromSafe = safes.find((s) => s.id === editingTransaction.fromSafeId);
          const toSafe = safes.find((s) => s.id === editingTransaction.toSafeId);

          if (fromSafe) {
            batch.update(doc(db, "safes", editingTransaction.fromSafeId), {
              balance: (fromSafe.balance || 0) - diff,
            });
          }
          if (toSafe) {
            batch.update(doc(db, "safes", editingTransaction.toSafeId), {
              balance: (toSafe.balance || 0) + diff,
            });
          }
        } else if (editingTransaction.type === "deposit") {
          const safeInfo = safes.find((s) => s.id === editingTransaction.safeId);
          if (safeInfo) {
            batch.update(doc(db, "safes", editingTransaction.safeId), {
              balance: (safeInfo.balance || 0) + diff,
            });
          }
        } else if (editingTransaction.type === "withdrawal") {
          const safeInfo = safes.find((s) => s.id === editingTransaction.safeId);
          if (safeInfo) {
            batch.update(doc(db, "safes", editingTransaction.safeId), {
              balance: (safeInfo.balance || 0) - diff,
            });
          }
        } else if (editingTransaction.type === "hawala") {
          const safeInfo = safes.find((s) => s.id === editingTransaction.safeId);
          if (safeInfo) {
            batch.update(doc(db, "safes", editingTransaction.safeId), {
              balance: (safeInfo.balance || 0) - diff,
            });
          }
        }
      }

      // Update the transaction in collection
      const updateData: any = {
        amount: newAmount,
        note: editTxNote,
      };

      if (editingTransaction.type === "transfer") {
        updateData.receivedAmount = newAmount;
      } else if (editingTransaction.type === "hawala") {
        const fee = Number(editingTransaction.fee) || 0;
        updateData.netAmount = Math.max(0, newAmount - fee);
      }

      batch.update(doc(db, "safe_transactions", editingTransaction.id), updateData);

      await batch.commit();
      setEditingTransaction(null);
      alert("مامەڵەکە بە سەرکەوتوویی نوێکرایەوە و باڵانسی قاسەکان ڕاستکرانەوە.");
    } catch (err: any) {
      console.error("Error updating transaction:", err);
      alert("هەڵەیەک ڕوویدا لە کاتی نوێکردنەوە: " + err.message);
    }
  };

  const handleDeleteTransaction = async (tx: any) => {
    if (!window.confirm("دڵنیایت لە سڕینەوەی ئەم مامەڵەیە؟ باڵانسی پەیوەندیداری قاسەکان پێچەوانە دەکرێتەوە بۆ دڵنیابوون لە دروستی باڵانسەکان.")) return;

    try {
      const batch = writeBatch(db);

      if (tx.status === "completed") {
        if (tx.type === "transfer") {
          const fromSafe = safes.find((s) => s.id === tx.fromSafeId);
          const toSafe = safes.find((s) => s.id === tx.toSafeId);

          if (fromSafe) {
            batch.update(doc(db, "safes", tx.fromSafeId), {
              balance: (fromSafe.balance || 0) + Number(tx.amount || 0),
            });
          }
          if (toSafe) {
            batch.update(doc(db, "safes", tx.toSafeId), {
              balance: (toSafe.balance || 0) - Number(tx.receivedAmount || tx.amount || 0),
            });
          }
        } else if (tx.type === "deposit") {
          const safeInfo = safes.find((s) => s.id === tx.safeId);
          if (safeInfo) {
            batch.update(doc(db, "safes", tx.safeId), {
              balance: (safeInfo.balance || 0) - Number(tx.amount || 0),
            });
          }
        } else if (tx.type === "withdrawal") {
          const safeInfo = safes.find((s) => s.id === tx.safeId);
          if (safeInfo) {
            batch.update(doc(db, "safes", tx.safeId), {
              balance: (safeInfo.balance || 0) + Number(tx.amount || 0),
            });
          }
        } else if (tx.type === "hawala") {
          const safeInfo = safes.find((s) => s.id === tx.safeId);
          if (safeInfo) {
            batch.update(doc(db, "safes", tx.safeId), {
              balance: (safeInfo.balance || 0) + Number(tx.amount || 0),
            });
          }
        }
      }

      batch.delete(doc(db, "safe_transactions", tx.id));
      await batch.commit();
      alert("مامەڵەکە بە سەرکەوتوویی سڕایەوە و باڵانسەکان گەڕانەوە باری پێشوو.");
    } catch (err: any) {
      console.error("Error deleting transaction:", err);
      alert("هەڵەیەک ڕوویدا لە کاتی حەتمکارکردنی سڕینەوە: " + err.message);
    }
  };

  const handleAddSafe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSafeName.trim()) return;
    await addDoc(collection(db, "safes"), {
      name: newSafeName,
            balance: Number(newSafeUSD) || 0,
      createdAt: Timestamp.now(),
    });
    setIsAddingSafe(false);
    setNewSafeName("");
        setNewSafeUSD("");
  };

  const handleUpdateSafe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSafe || !editingSafe.name.trim()) return;
    await updateDoc(doc(db, "safes", editingSafe.id), {
      name: editingSafe.name,
      balance: Number(editingSafe.balance) || 0,
    });
    setEditingSafe(null);
  };

  const handleDeleteSafe = async (id: string, name: string) => {
    if (window.confirm(`دڵنیایت لە سڕینەوەی قاسەی "${name}"؟`)) {
      await deleteDoc(doc(db, "safes", id));
    }
  };

  
  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !transferFrom ||
      !transferTo ||
      transferFrom === transferTo ||
      !transferAmount
    )
      return;

    const amount = Number(transferAmount);
    if (amount <= 0) return;

    const fromSafe = safes.find((s) => s.id === transferFrom);
    const toSafe = safes.find((s) => s.id === transferTo);

    if (!fromSafe || !toSafe) return;

    const receivedAmount = amount;
    const isPending = userRole !== "admin" && userRole !== "accountant";

    const batch = writeBatch(db);

    if (!isPending) {
      // Deduct from sender
      batch.update(doc(db, "safes", transferFrom), {
        balance: (fromSafe.balance || 0) - amount,
      });

      // Add to receiver
      batch.update(doc(db, "safes", transferTo), {
        balance: (toSafe.balance || 0) + receivedAmount,
      });
    }

    // Record Transaction
    batch.set(doc(collection(db, "safe_transactions")), {
      type: "transfer",
      fromSafeId: fromSafe.id,
      fromSafeName: fromSafe.name,
      toSafeId: toSafe.id,
      toSafeName: toSafe.name,
      amount: amount,
      currency: 'USD',
      receivedAmount: receivedAmount,
      receivedCurrency: 'USD',
      exchangeRate: 1,
      note: transferNote,
      status: isPending ? "pending" : "completed",
      timestamp: Timestamp.now(),
    });

    await batch.commit();

    setIsTransferring(false);
    setTransferAmount("");
    setTransferNote("");
    
  };

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustSafeId || !adjustAmount) return;
    const amount = Number(adjustAmount);
    if (amount <= 0) return;

    const safeInfo = safes.find((s) => s.id === adjustSafeId);
    if (!safeInfo) return;

    const isPending = userRole !== "admin" && userRole !== "accountant";
    const batch = writeBatch(db);

    if (!isPending) {
        const field =
          adjustType === "add"
            ? (safeInfo.balance || 0) + amount
            : (safeInfo.balance || 0) - amount;
        batch.update(doc(db, "safes", adjustSafeId), { balance: field });
    }

    batch.set(doc(collection(db, "safe_transactions")), {
      type: adjustType === "add" ? "deposit" : "withdrawal",
      safeId: safeInfo.id,
      safeName: safeInfo.name,
      amount: amount,
      currency: 'USD',
      note: adjustNote,
      status: isPending ? "pending" : "completed",
      timestamp: Timestamp.now(),
    });

    await batch.commit();

    setIsAdjusting(false);
    setAdjustAmount("");
    setAdjustNote("");
  };

  const handleHawala = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hawalaSafe || !hawalaAmount || !hawalaReceiver || !hawalaOffice)
      return;
    const amount = Number(hawalaAmount);
    const fee = Number(hawalaFee) || 0;
    const totalDeduct = amount + fee;

    if (amount <= 0) return;

    const safeInfo = safes.find((s) => s.id === hawalaSafe);
    if (!safeInfo) return;

    const isPending = userRole !== "admin" && userRole !== "accountant";
    const batch = writeBatch(db);

    if (!isPending) {
        batch.update(doc(db, "safes", hawalaSafe), {
          balance: (safeInfo.balance || 0) - totalDeduct,
        });
    }

    batch.set(doc(collection(db, "safe_transactions")), {
      type: "hawala",
      safeId: safeInfo.id,
      safeName: safeInfo.name,
      amount: totalDeduct, // Total deducted
      netAmount: amount, // Only the sent amount
      fee: fee,
      currency: 'USD',
      receiver: hawalaReceiver,
      office: hawalaOffice,
      note: hawalaNote,
      status: isPending ? "pending" : "completed",
      timestamp: Timestamp.now(),
    });

    await batch.commit();

    setIsHawala(false);
    setHawalaAmount("");
    setHawalaFee("0");
    setHawalaReceiver("");
    setHawalaOffice("");
    setHawalaNote("");
  };

  const handleApproveSafeTransaction = async (tx: any) => {
    try {
      const batch = writeBatch(db);

      if (tx.type === "transfer") {
        const fromSafe = safes.find((s) => s.id === tx.fromSafeId);
        const toSafe = safes.find((s) => s.id === tx.toSafeId);
        if (!fromSafe || !toSafe) return;

        batch.update(doc(db, "safes", tx.fromSafeId), {
          balance: (fromSafe.balance || 0) - tx.amount,
        });

        batch.update(doc(db, "safes", tx.toSafeId), {
          balance: (toSafe.balance || 0) + tx.receivedAmount,
        });
      } else if (
        tx.type === "deposit" ||
        tx.type === "withdrawal" ||
        tx.type === "hawala"
      ) {
        const safeInfo = safes.find((s) => s.id === tx.safeId);
        if (!safeInfo) return;

        const change = tx.type === "deposit" ? tx.amount : -tx.amount;
        batch.update(doc(db, "safes", tx.safeId), {
          balance: (safeInfo.balance || 0) + change,
        });
      }

      batch.update(doc(db, "safe_transactions", tx.id), {
        status: "completed",
      });
      await batch.commit();
    } catch (err) {
      console.error("error approving", err);
    }
  };

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Header */}
      <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800">قاسەکان</h1>
            <p className="text-sm font-bold text-slate-500">
              سەرجەم پارەی کاشی دوکان، گواستنەوە، و ڕێکخستنی قاسەکان
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setIsAdjusting(true);
              setAdjustType("add");
            }}
            className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl font-bold hover:bg-emerald-100 flex items-center gap-2 transition-colors"
          >
            <ArrowDownToLine size={18} /> پارە دانان
          </button>
          <button
            onClick={() => {
              setIsAdjusting(true);
              setAdjustType("subtract");
            }}
            className="px-4 py-2 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 flex items-center gap-2 transition-colors"
          >
            <ArrowUpFromLine size={18} /> پارە دەرهێنان
          </button>
          <button
            onClick={() => setIsTransferring(true)}
            className="px-4 py-2 bg-pink-50 text-pink-600 rounded-xl font-bold hover:bg-pink-100 flex items-center gap-2 transition-colors"
          >
            <ArrowRightLeft size={18} /> پارە گواستنەوە
          </button>
          <button
            onClick={() => setIsHawala(true)}
            className="px-4 py-2 bg-amber-50 text-amber-600 rounded-xl font-bold hover:bg-amber-100 flex items-center gap-2 transition-colors"
          >
            <Send size={18} /> حەواڵە
          </button>
          <button
            onClick={() => setIsAddingSafe(true)}
            className="px-4 py-2 bg-pink-600 text-white rounded-xl font-bold hover:bg-pink-700 flex items-center gap-2 transition-colors"
          >
            <Plus size={18} /> قاسەی نوێ
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {safes.map((safe) => {
          const isMain = safe.name?.includes("سەرەکی") || safe.name?.includes("Main");
          const isHimdad = safe.name?.includes("هیمداد") || safe.name?.includes("هيمداد") || safe.name?.includes("Himdad");
          
          return (
            <div
              key={safe.id}
              className="bg-white rounded-[24px] border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 p-6 relative group transition-all duration-300 overflow-hidden flex flex-col justify-between"
            >
              <div>
                {/* Decorative top bar */}
                <div className={`absolute top-0 inset-x-0 h-1.5 ${isMain ? "bg-emerald-500" : isHimdad ? "bg-pink-500" : "bg-sky-500"}`} />
                
                <div className="absolute top-4 left-4 flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200">
                   <button
                     onClick={() => setEditingSafe({id: safe.id, name: safe.name, balance: safe.balance || 0})}
                     className="p-2 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-xl transition-all"
                     title="دەستکاری کردنی ناو و باڵانس"
                   >
                     <Edit size={16} />
                   </button>
                   <button
                     onClick={() => handleDeleteSafe(safe.id, safe.name)}
                     className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                     title="سڕینەوەی قاسە"
                   >
                     <X size={16} />
                   </button>
                </div>

                <div className="flex items-center gap-4 mb-4 border-b border-slate-100 pb-4">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${isMain ? "bg-emerald-50 text-emerald-600" : isHimdad ? "bg-pink-50 text-pink-600" : "bg-sky-50 text-sky-600"}`}>
                    <Banknote size={22} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-lg text-slate-800 truncate max-w-[150px]">
                      {safe.name}
                    </h3>
                    <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full inline-block mt-0.5">
                      {isMain ? "قاسەی سەرەکی" : isHimdad ? "قاسەی کڕیاران" : "قاسەی لاوەکی"}
                    </span>
                  </div>
                </div>

                <div className="space-y-1 mb-4">
                  <span className="text-xs font-black text-slate-400 block tracking-wide">
                    بالانسی دۆلار (USD)
                  </span>
                  <div className="flex justify-between items-baseline">
                    <span
                      className={`font-mono font-black text-2xl tracking-tight ${safe.balance < 0 ? "text-red-600" : "text-emerald-700"}`}
                    >
                      {formatCurrency(safe.balance || 0, "USD")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Money Increase / Decrease Actions */}
              <div className="pt-4 border-t border-slate-100 flex gap-2">
                <button
                  onClick={() => {
                    setAdjustSafeId(safe.id);
                    setAdjustType("add");
                    setIsAdjusting(true);
                  }}
                  className="flex-1 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                  title="پارە زیاد بکە بۆ ئەم قاسەیە"
                >
                  <ArrowDownToLine size={13} />
                  زیادکردنی پارە
                </button>
                <button
                  onClick={() => {
                    setAdjustSafeId(safe.id);
                    setAdjustType("subtract");
                    setIsAdjusting(true);
                  }}
                  className="flex-1 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                  title="پارە کەم بکە لەم قاسەیە"
                >
                  <ArrowUpFromLine size={13} />
                  کەمکردنی پارە
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {pendingTransactions.length > 0 &&
        (userRole === "admin" || userRole === "accountant") && (
          <div className="bg-orange-50/60 border border-orange-200 rounded-[28px] p-6 shadow-sm">
            <h3 className="text-lg font-bold text-orange-805 mb-4 flex items-center gap-2">
              <FileClock size={20} className="text-orange-600" /> مامەڵە چاوەڕێکراوەکانی پەسەندکردن
            </h3>
            <div className="space-y-3">
              {pendingTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="bg-white p-5 rounded-2xl border border-orange-100/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div>
                    <div className="font-extrabold text-slate-800">
                      {tx.type === "transfer" && "گواستنەوەی پارە لە نێوان قاسەکان"}
                      {tx.type === "deposit" && "دانانی پارە لە قاسە"}
                      {tx.type === "withdrawal" && "دەرهێنانی پارە لە قاسە"}
                      {tx.type === "hawala" && `حەواڵەی پارە بۆ ${tx.receiver} (${tx.office})`}
                    </div>
                    <div className="text-xs font-bold text-slate-500 mt-1 flex flex-wrap gap-2 items-center">
                      <span className="bg-slate-100 px-2.5 py-0.5 rounded">
                        بەروار: {tx.timestamp?.toDate().toLocaleString()}
                      </span>
                      <span className="text-slate-400">|</span>
                      <span>قاسە: {tx.safeName || tx.fromSafeName}</span>
                      {tx.note && (
                        <>
                          <span className="text-slate-400">|</span>
                          <span className="text-amber-700">تێبینی: {tx.note}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0">
                    <div className="font-mono font-black text-orange-600 text-lg">
                      {formatCurrency(tx.amount || 0, tx.currency)}
                    </div>
                    <button
                      onClick={() => handleApproveSafeTransaction(tx)}
                      className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-black rounded-xl transition-all shadow-md shadow-orange-200"
                    >
                      پەسەندکردن
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      <div className="flex-1 bg-white rounded-[28px] border border-slate-200 shadow-sm flex flex-col min-h-[400px] overflow-hidden">
        {/* Modern Transaction History Header & Controls */}
        <div className="px-6 py-5 border-b border-slate-150 bg-slate-50 flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-pink-50 text-pink-600 rounded-xl flex items-center justify-center">
              <History size={18} />
            </div>
            <div>
              <h3 className="font-black text-slate-800">مێژووی مامەڵەکانی قاسە</h3>
              <p className="text-[11px] font-bold text-slate-400 mt-0.5">بە ئاسانی گەڕان، دەستکاری، و سڕینەوە ئەنجام بدە</p>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بگەڕێ لە تێبینی، ناوی قاسە یان وەرگر..."
                className="w-full sm:w-64 pl-10 pr-4 py-2 border border-slate-300 rounded-xl text-sm font-bold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500 bg-white"
              />
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            </div>

            {/* Type Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-extrabold text-slate-500 whitespace-nowrap hidden sm:inline">جۆر:</span>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-pink-500"
              >
                <option value="all">هەموو جۆرەکان</option>
                <option value="deposit">دانانی پارە</option>
                <option value="withdrawal">دەرهێنانی پارە</option>
                <option value="transfer">گواستنەوە</option>
                <option value="hawala">حەواڵە</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-0 scrollbar-thin">
          <table className="w-full text-right border-collapse">
            <thead className="bg-slate-50/50 sticky top-0 z-10 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-xs font-black text-slate-500 uppercase tracking-wider">
                  بەروار
                </th>
                <th className="px-6 py-3 text-xs font-black text-slate-500 uppercase tracking-wider">
                  جۆر
                </th>
                <th className="px-6 py-3 text-xs font-black text-slate-500 uppercase tracking-wider">
                  بڕی دەرچوو
                </th>
                <th className="px-6 py-3 text-xs font-black text-slate-500 uppercase tracking-wider">
                  بڕی هاتوو
                </th>
                <th className="px-6 py-3 text-xs font-black text-slate-500 uppercase tracking-wider">
                  قاسە
                </th>
                <th className="px-6 py-3 text-xs font-black text-slate-500 uppercase tracking-wider">
                  تێبینی / نوسینگە
                </th>
                <th className="px-6 py-3 text-xs font-black text-slate-500 uppercase tracking-wider text-center w-24">
                  کردارەکان
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {(() => {
                const filtered = transactions.filter((t: any) => {
                  const q = searchQuery.toLowerCase();
                  const noteMatch = t.note && t.note.toLowerCase().includes(q);
                  const safeMatch = t.safeName && t.safeName.toLowerCase().includes(q);
                  const fromMatch = t.fromSafeName && t.fromSafeName.toLowerCase().includes(q);
                  const toMatch = t.toSafeName && t.toSafeName.toLowerCase().includes(q);
                  const recMatch = t.receiver && t.receiver.toLowerCase().includes(q);
                  const officeMatch = t.office && t.office.toLowerCase().includes(q);
                  const amountMatch = t.amount && t.amount.toString().includes(q);

                  const matchesSearch = !searchQuery || noteMatch || safeMatch || fromMatch || toMatch || recMatch || officeMatch || amountMatch;
                  const matchesFilter = filterType === "all" || t.type === filterType;

                  return matchesSearch && matchesFilter;
                });

                if (filtered.length === 0) {
                  return (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-6 py-16 text-center text-slate-400 font-extrabold text-sm bg-slate-50/20"
                      >
                        هیچ مامەڵەیەک یان گواستنەوەیەک نەدۆزرایەوە کە لەگەڵ گەڕانەکە بگونجێت
                      </td>
                    </tr>
                  );
                }

                return filtered.slice(0, 100).map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td
                      className="px-6 py-4 font-mono text-xs text-slate-500 font-bold"
                      dir="ltr"
                    >
                      {t.timestamp?.toDate().toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-xs font-bold">
                      {t.type === "transfer" && (
                        <span className="text-pink-600 bg-pink-50 border border-pink-100 px-2.5 py-1 rounded-xl inline-flex items-center gap-1 font-bold">
                          <ArrowRightLeft size={13} /> گواستنەوە
                        </span>
                      )}
                      {t.type === "deposit" && (
                        <span className="text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-xl inline-flex items-center gap-1 font-bold">
                          <ArrowDownToLine size={13} /> دانان
                        </span>
                      )}
                      {t.type === "withdrawal" && (
                        <span className="text-red-600 bg-red-50 border border-red-100 px-2.5 py-1 rounded-xl inline-flex items-center gap-1 font-bold">
                          <ArrowUpFromLine size={13} /> دەرهێنان
                        </span>
                      )}
                      {t.type === "hawala" && (
                        <span className="text-amber-600 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-xl inline-flex items-center gap-1 font-bold">
                          <Send size={13} /> حەواڵە
                        </span>
                      )}
                    </td>
                    <td
                      className="px-6 py-4 font-mono font-black text-sm text-slate-800"
                      dir="ltr"
                    >
                      {t.type === "transfer" && (
                        <span className="text-red-500">
                          -{formatCurrency(t.amount, t.currency || "USD")}
                        </span>
                      )}
                      {t.type === "withdrawal" && (
                        <span className="text-red-500">
                          -{formatCurrency(t.amount, t.currency || "USD")}
                        </span>
                      )}
                      {t.type === "hawala" && (
                        <span className="text-red-500">
                          -{formatCurrency(t.amount, t.currency || "USD")}
                        </span>
                      )}
                      {t.type === "deposit" && (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td
                      className="px-6 py-4 font-mono font-black text-sm text-slate-800"
                      dir="ltr"
                    >
                      {t.type === "transfer" && (
                        <span className="text-emerald-600">
                          +
                          {formatCurrency(
                            t.receivedAmount || t.amount,
                            t.receivedCurrency || t.currency || "USD",
                          )}
                        </span>
                      )}
                      {t.type === "deposit" && (
                        <span className="text-emerald-600">
                          +{formatCurrency(t.amount, t.currency || "USD")}
                        </span>
                      )}
                      {t.type === "withdrawal" && (
                        <span className="text-slate-300">-</span>
                      )}
                      {t.type === "hawala" && (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs font-extrabold text-slate-600 truncate max-w-[150px]">
                      {t.type === "transfer"
                        ? `لە ${t.fromSafeName} ← ${t.toSafeName}`
                        : t.safeName}
                    </td>
                    <td className="px-6 py-4 text-xs font-bold text-slate-500 max-w-[240px]">
                      <div className="truncate">
                        {t.type === "hawala"
                          ? `بۆ: ${t.receiver} (${t.office}) - عمولە: ${formatCurrency(t.fee || 0, t.currency)} - ${t.note || ""}`
                          : t.note || "-"}
                      </div>
                      {t.exchangeRate && (
                        <span className="block text-[10px] text-slate-400 mt-0.5 font-bold">
                          نرخ: {t.exchangeRate}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleEditTransactionClick(t)}
                          className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-all"
                          title="دەستکاری تێبینی و بڕ"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteTransaction(t)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="سڕینەوەی مامەڵە"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {editingTransaction && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex justify-center items-center p-4 z-50">
          <form
            onSubmit={handleUpdateTransaction}
            className="bg-white rounded-[28px] w-full max-w-md shadow-2xl p-6 relative overflow-hidden text-right"
            dir="rtl"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-150 rounded-full blur-3xl -mx-10 -my-10 opacity-40 pointer-events-none"></div>
            <h2 className="text-xl font-extrabold text-slate-800 mb-6 flex items-center gap-2.5">
              <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                <Edit size={20} />
              </div>
              دەستکاریکردنی مامەڵە
            </h2>
            <div className="space-y-4 mb-6 relative">
              <div>
                <label className="block text-xs font-extrabold text-slate-600 mb-2">
                  بڕی گشتی مامەڵە (بە دۆلار)
                </label>
                <input
                  required
                  type="number"
                  step="any"
                  value={editTxAmount}
                  onChange={(e) => setEditTxAmount(e.target.value)}
                  className="w-full font-mono bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-amber-500 outline-none text-left font-bold"
                  dir="ltr"
                />
                <IQDInput usdValue={editTxAmount} setUsdValue={(val) => setEditTxAmount(val.toString())} />
              </div>
              <div>
                <label className="block text-xs font-extrabold text-slate-600 mb-2">
                  تێبینی / هۆکار
                </label>
                <input
                  type="text"
                  value={editTxNote}
                  onChange={(e) => setEditTxNote(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-amber-500 outline-none text-right font-bold text-slate-700"
                />
              </div>
            </div>
            <div className="flex gap-2.5 justify-end relative">
              <button
                type="button"
                onClick={() => setEditingTransaction(null)}
                className="px-5 py-2.5 text-slate-600 bg-slate-100 rounded-xl font-bold hover:bg-slate-200 transition-colors text-sm"
              >
                پاشگەزبوونەوە
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 text-white bg-amber-50 hover:bg-amber-600 rounded-xl font-bold transition-all shadow-lg text-sm"
              >
                پاشەکەوتکردن
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Safe Modal */}
      {isAddingSafe && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex justify-center items-center p-4 z-50">
          <form
            onSubmit={handleAddSafe}
            className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-6 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-pink-100 rounded-full blur-3xl -mx-10 -my-10 opacity-50 pointer-events-none"></div>
            <h2 className="text-xl font-extrabold text-slate-800 mb-6 flex items-center gap-2">
              <Plus className="text-pink-600" /> قاسەی نوێ
            </h2>
            <div className="space-y-4 mb-6 relative">
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-1">
                  ناوی قاسە
                </label>
                <input
                  required
                  autoFocus
                  type="text"
                  value={newSafeName}
                  onChange={(e) => setNewSafeName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-pink-500 outline-none transition-all"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                
                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-1">
                    بالانسی دۆلار (USD)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={newSafeUSD}
                    onChange={(e) => setNewSafeUSD(e.target.value)}
                    className="w-full font-mono bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-pink-500 outline-none text-left transition-all"
                    dir="ltr"
                    placeholder="0"
                  /> 
<IQDInput usdValue={newSafeUSD} setUsdValue={(val) => setNewSafeUSD(val.toString())} />
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end relative">
              <button
                type="button"
                onClick={() => setIsAddingSafe(false)}
                className="px-4 py-2 text-slate-600 bg-slate-100 rounded-xl font-bold hover:bg-slate-200 transition-colors"
              >
                پاشگەزبوونەوە
              </button>
              <button
                type="submit"
                className="px-6 py-2 text-white bg-pink-600 rounded-xl font-bold hover:bg-pink-700 transition-colors shadow-lg shadow-pink-200"
              >
                زیادکردن
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Adjust Safe Modal */}
      {isAdjusting && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex justify-center items-center p-4 z-50">
          <form
            onSubmit={handleAdjust}
            className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-6 relative overflow-hidden"
          >
            <div
              className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -mx-10 -my-10 opacity-30 pointer-events-none ${adjustType === "add" ? "bg-emerald-400" : "bg-red-400"}`}
            ></div>
            <h2 className="text-xl font-extrabold text-slate-800 mb-6 flex items-center gap-2">
              {adjustType === "add" ? (
                <ArrowDownToLine className="text-emerald-600" />
              ) : (
                <ArrowUpFromLine className="text-red-600" />
              )}
              {adjustType === "add"
                ? "زیادکردنی پارە بۆ قاسە"
                : "دەرهێنانی پارە لە قاسە"}
            </h2>
            <div className="space-y-4 mb-6 relative">
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-1">
                  هەڵبژاردنی قاسە
                </label>
                <select
                  required
                  value={adjustSafeId}
                  onChange={(e) => setAdjustSafeId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-slate-400 outline-none font-bold text-slate-700"
                >
                  <option value="">هەڵبژێرە...</option>
                  {safes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-[1fr_100px] gap-2">
                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-1">
                    بڕی پارە
                  </label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="any"
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                    className="w-full font-mono bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-slate-400 outline-none text-left font-bold"
                    dir="ltr"
                    placeholder="0"
                  /> 
<IQDInput usdValue={adjustAmount} setUsdValue={(val) => setAdjustAmount(val.toString())} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-1">
                  تێبینی (هۆکار)
                </label>
                <input
                  type="text"
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-slate-400 outline-none"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end relative">
              <button
                type="button"
                onClick={() => setIsAdjusting(false)}
                className="px-4 py-2 text-slate-600 bg-slate-100 rounded-xl font-bold hover:bg-slate-200 transition-colors"
              >
                پاشگەزبوونەوە
              </button>
              <button
                type="submit"
                className={`px-6 py-2 text-white rounded-xl font-bold transition-colors shadow-lg ${adjustType === "add" ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200" : "bg-red-600 hover:bg-red-700 shadow-red-200"}`}
              >
                {adjustType === "add" ? "زیادکردن" : "دەرهێنان"}
              </button>
            </div>
          </form>
        </div>
      )}

      
      {/* Editing Modal */}
      {editingSafe && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex justify-center items-center p-4 z-50">
          <form
            onSubmit={handleUpdateSafe}
            className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-6 relative overflow-hidden text-right"
            dir="rtl"
          >
            <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-3">
              <div className="w-10 h-10 bg-sky-100 text-sky-600 rounded-xl flex items-center justify-center">
                <Edit size={20} />
              </div>
              دەستکاری کردنی قاسە
            </h2>
            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  ناوی قاسە
                </label>
                <input
                  type="text"
                  required
                  value={editingSafe.name}
                  onChange={(e) => setEditingSafe({ ...editingSafe, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-sky-500 outline-none font-bold text-slate-700 text-right"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  بالانسی دۆلار (USD)
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={editingSafe.balance !== undefined ? editingSafe.balance : ""}
                  onChange={(e) => setEditingSafe({ ...editingSafe, balance: Number(e.target.value) || 0 })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-sky-500 outline-none font-mono font-bold text-slate-700 text-left"
                  dir="ltr"
                />
                <IQDInput 
                  usdValue={editingSafe.balance?.toString() || "0"} 
                  setUsdValue={(val) => setEditingSafe({ ...editingSafe, balance: Number(val) || 0 })} 
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                className="flex-1 bg-sky-600 hover:bg-sky-700 text-white py-3 rounded-xl font-bold transition-all hover:shadow-lg hover:shadow-sky-500/30"
              >
                پاشەکەوتکردن
              </button>
              <button
                type="button"
                onClick={() => setEditingSafe(null)}
                className="w-24 bg-slate-100 hover:bg-slate-200 text-slate-600 py-3 rounded-xl font-bold transition-colors"
              >
                پاشگەزبوونەوە
              </button>
            </div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-sky-50 rounded-bl-[100px] -z-10 transition-all group-hover:scale-110" />
          </form>
        </div>
      )}

      {/* Transfer Modal */}
      {isTransferring && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex justify-center items-center p-4 z-50 overflow-y-auto">
          <form
            onSubmit={handleTransfer}
            className="bg-white rounded-3xl w-full max-w-xl shadow-2xl p-6 relative overflow-hidden my-8"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-pink-100 rounded-full blur-3xl -mx-10 -my-10 opacity-50 pointer-events-none"></div>
            <h2 className="text-xl font-extrabold text-slate-800 mb-6 flex items-center gap-2">
              <ArrowRightLeft className="text-pink-600" /> گواستنەوەی پارە نێوان قاسەکان
            </h2>
            <div className="space-y-5 mb-6 relative">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <label className="block text-sm font-bold text-pink-600 mb-2">
                    لە قاسەی (دەرچوو)
                  </label>
                  <select
                    required
                    value={transferFrom}
                    onChange={(e) => setTransferFrom(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-pink-500 outline-none font-bold text-slate-700"
                  >
                    <option value="">خاوەن پارە...</option>
                    {safes.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({formatCurrency(s.balance || 0)})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <label className="block text-sm font-bold text-emerald-600 mb-2">
                    بۆ قاسەی (وەرگر)
                  </label>
                  <select
                    required
                    value={transferTo}
                    onChange={(e) => setTransferTo(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-700"
                  >
                    <option value="">وەرگر...</option>
                    {safes.filter(s => s.id !== transferFrom).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({formatCurrency(s.balance || 0)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                   بڕی گواستنەوە بە دۆلار
                </label>
                <input
                  required
                  type="number"
                  min="0"
                  step="any"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-3 focus:border-pink-500 outline-none font-bold font-mono text-xl"
                  placeholder="0"
                  dir="ltr"
                /> 
<IQDInput usdValue={transferAmount} setUsdValue={(val) => setTransferAmount(val.toString())} />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  تێبینی
                </label>
                <input
                  type="text"
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-pink-500 outline-none"
                  placeholder="ئارەزوومەندانە..."
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end relative mt-2 pt-5 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsTransferring(false)}
                className="px-6 py-2.5 text-slate-600 bg-white border border-slate-200 rounded-xl font-bold hover:bg-slate-50 transition-colors"
              >
                پاشگەزبوونەوە
              </button>
              <button
                type="submit"
                className="px-8 py-2.5 text-white bg-pink-600 rounded-xl font-bold hover:bg-pink-700 transition-colors shadow-md shadow-pink-200 flex items-center gap-2"
              >
                <ArrowRightLeft size={18} /> گواستنەوە
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Hawala Modal */}
      {isHawala && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex justify-center items-center p-4 z-50 overflow-y-auto">
          <form
            onSubmit={handleHawala}
            className="bg-white rounded-3xl w-full max-w-xl shadow-2xl p-6 relative overflow-hidden my-8"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-100 rounded-full blur-3xl -mx-10 -my-10 opacity-50 pointer-events-none"></div>
            <h2 className="text-xl font-extrabold text-slate-800 mb-6 flex items-center gap-2">
              <Send className="text-amber-600" /> حەواڵەی پارە
            </h2>
            <div className="space-y-5 mb-6 relative">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <label className="block text-sm font-bold text-amber-700 mb-2">
                  لە کام قاسە حەواڵە دەکرێت؟
                </label>
                <select
                  required
                  value={hawalaSafe}
                  onChange={(e) => setHawalaSafe(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-amber-500 outline-none font-bold text-slate-700"
                >
                  <option value="">قاسە هەڵبژێرە...</option>
                  {safes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({formatCurrency(s.balance || 0)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    بڕی حەواڵەکە (ئەوەی دەڕوات)
                  </label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="any"
                    value={hawalaAmount}
                    onChange={(e) => setHawalaAmount(e.target.value)}
                    className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-3 focus:border-amber-500 outline-none font-bold font-mono"
                    placeholder="0"
                    dir="ltr"
                  /> 
<IQDInput usdValue={hawalaAmount} setUsdValue={(val) => setHawalaAmount(val.toString())} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    عمولەی حەواڵە
                  </label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="any"
                    value={hawalaFee}
                    onChange={(e) => setHawalaFee(e.target.value)}
                    className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-3 focus:border-amber-500 outline-none font-bold font-mono"
                    placeholder="0"
                    dir="ltr"
                  /> 
<IQDInput usdValue={hawalaFee} setUsdValue={(val) => setHawalaFee(val.toString())} />
                </div>
              </div>

              <div className="bg-amber-50 p-4 border border-amber-200 rounded-xl flex items-center justify-between shadow-sm">
                <span className="font-bold text-amber-800 text-sm">
                  کۆی گشتی (ئەوەی لە قاسە کەم دەبێتەوە):
                </span>
                <span className="font-mono font-black text-amber-700 text-xl" dir="ltr">
                  {formatCurrency((Number(hawalaAmount) || 0) + (Number(hawalaFee) || 0))}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    ناوی وەرگر
                  </label>
                  <input
                    required
                    type="text"
                    value={hawalaReceiver}
                    onChange={(e) => setHawalaReceiver(e.target.value)}
                    className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-3 focus:border-amber-500 outline-none font-bold"
                    placeholder="ناوی کەسەکە..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    نوسینگەی حەواڵە
                  </label>
                  <input
                    required
                    type="text"
                    value={hawalaOffice}
                    onChange={(e) => setHawalaOffice(e.target.value)}
                    className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-3 focus:border-amber-500 outline-none font-bold"
                    placeholder="ناوی نوسینگە یان کۆمپانیا..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  ژمارەی وەسڵ یان تێبینی
                </label>
                <input
                  type="text"
                  value={hawalaNote}
                  onChange={(e) => setHawalaNote(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-amber-500 outline-none"
                  placeholder="ئارەزوومەندانە..."
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end relative mt-2 pt-5 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsHawala(false)}
                className="px-6 py-2.5 text-slate-600 bg-white border border-slate-200 rounded-xl font-bold hover:bg-slate-50 transition-colors"
              >
                پاشگەزبوونەوە
              </button>
              <button
                type="submit"
                disabled={!hawalaSafe || !hawalaAmount || !hawalaReceiver || !hawalaOffice}
                className="px-8 py-2.5 text-white bg-amber-500 rounded-xl font-bold hover:bg-amber-600 transition-colors disabled:opacity-50 shadow-md shadow-amber-200 flex items-center gap-2"
              >
                <Send size={18} /> حەواڵە بکە
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
