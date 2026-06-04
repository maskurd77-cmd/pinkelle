import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  Plus,
  FileText,
  UserPlus,
  FileClock,
  DollarSign,
  Printer,
  MessageCircle,
  PlusCircle,
  Edit,
  X,
  Trash2,
} from "lucide-react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  updateDoc,
  Timestamp,
  addDoc,
  getDoc,
  writeBatch,
  where,
  deleteDoc,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { formatCurrency } from "../data";
import { reduceCustomerDebt } from "./MiscPages";
import { DebtReceiptModal } from "../components/DebtReceiptModal";
import AccountStatementModal from "../components/AccountStatementModal";

interface Debt {
  id: string;
  customerName: string;
  phone: string;
  amount: number;
  remainingAmount: number;
  status: string;
  timestamp: any;
  lastPaymentDate?: any;
}

export default function DebtBook() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  // Modals
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [debtHistory, setDebtHistory] = useState<any[]>([]);
  const [printTx, setPrintTx] = useState<any>(null);
  const [statementCustomer, setStatementCustomer] = useState<any>(null);
  const [actionType, setActionType] = useState<"pay" | "add">("pay");
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNote, setPaymentNote] = useState("");

  const [newDebtModalOpen, setNewDebtModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newAmount, setNewAmount] = useState("");

  const [userRole, setUserRole] = useState("");
  const [userName, setUserName] = useState("");
  const [pendingTransactions, setPendingTransactions] = useState<any[]>([]);
  const [pendingReturns, setPendingReturns] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<
    "debts" | "pending_tx" | "pending_returns"
  >("debts");
  const [exchangeRate, setExchangeRate] = useState<number>(1500);

  const [paymentCurrency, setPaymentCurrency] = useState<"IQD" | "USD">("USD");
  const [newCurrency, setNewCurrency] = useState<"IQD" | "USD">("USD");

  useEffect(() => {
    if (auth.currentUser) {
      getDoc(doc(db, "users", auth.currentUser.uid)).then((snap) => {
        if (snap.exists()) {
          setUserRole(snap.data().role || "user");
          setUserName(snap.data().name || auth.currentUser?.email || "کاشێر");
        }
      });
    }

    const q = query(collection(db, "debts"), orderBy("timestamp", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setDebts(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Debt));
    });

    const unsubCus = onSnapshot(collection(db, "customers"), (snap) => {
      setCustomers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const unsubPending = onSnapshot(
      query(
        collection(db, "debt_transactions"),
        where("status", "==", "pending"),
      ),
      (snap) => {
        const txs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setPendingTransactions(txs);
      },
    );

    const unsubReturns = onSnapshot(
      query(
        collection(db, "return_transactions"),
        where("status", "==", "pending"),
      ),
      (snap) => {
        setPendingReturns(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .sort((a: any, b: any) => b.timestamp - a.timestamp),
        );
      },
    );

    const unsubSettings = onSnapshot(doc(db, "settings", "globals"), (snap) => {
      if (snap.exists() && snap.data().exchangeRate) {
        setExchangeRate(snap.data().exchangeRate);
      }
    });

    return () => {
      unsub();
      unsubCus();
      unsubPending();
      unsubReturns();
      unsubSettings();
    };
  }, []);

  const filtered = debts.filter(
    (d) => d.customerName?.includes(search) || d.phone?.includes(search),
  );

  const totalRemaining = useMemo(() => {
    return debts.reduce((sum, d) => sum + (d.remainingAmount || 0), 0);
  }, [debts]);

  const [editDebtModalOpen, setEditDebtModalOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");

  const handleEditDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDebt || !editName) return;

    await updateDoc(doc(db, "debts", selectedDebt.id), {
      customerName: editName,
      phone: editPhone,
    });

    const existingCus = customers.find((c) => c.name === editName);
    if (existingCus && editPhone) {
      await updateDoc(doc(db, "customers", existingCus.id), {
        phone: editPhone,
      });
    }

    setEditDebtModalOpen(false);
    setSelectedDebt(null);
  };

  const handleDeleteDebtAccount = async () => {
    if (!selectedDebt) return;
    const confirm = window.prompt(
      `بۆ سڕینەوەی ئەم دەفتەر قەرزەیە تکایە وشەی "سڕینەوە" بنووسە:`,
    );
    if (confirm === "سڕینەوە") {
      try {
        await deleteDoc(doc(db, "debts", selectedDebt.id));
        setEditDebtModalOpen(false);
        setSelectedDebt(null);
        alert("دەفتەر قەرزەکە بە سەڕکەوتوویی سڕایەوە.");
      } catch (err) {
        console.error("Error deleting debt:", err);
      }
    }
  };

  const handleRejectReturn = async (tx: any) => {
    if (window.confirm("ئایا دڵنیایت لە ڕەتکردنەوەی ئەم مامەڵەیە؟")) {
      try {
        await updateDoc(doc(db, "return_transactions", tx.id), {
          status: "rejected",
        });
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleApproveReturn = async (tx: any) => {
    try {
      if (tx.type === "full") {
        const currentReceiptSnap = await getDoc(
          doc(db, "receipts", tx.receiptId),
        );
        if (!currentReceiptSnap.exists()) {
          alert("ئەم وەسڵە پێشتر سڕاوەتەوە");
          await updateDoc(doc(db, "return_transactions", tx.id), {
            status: "canceled",
          });
          return;
        }

        for (const item of tx.receiptData.items) {
          const pRef = doc(db, "products", item.productId);
          const pSnap = await getDoc(pRef);
          if (pSnap.exists()) {
            await updateDoc(pRef, {
              stock: (pSnap.data().stock || 0) + item.quantity,
            });
          }
        }
        await deleteDoc(doc(db, "receipts", tx.receiptId));
        await reduceCustomerDebt(
          tx.receiptData,
          tx.reductionAmount,
          "گەڕانەوەی تەواوی کاڵاکان",
        );
      } else if (tx.type === "partial") {
        const currentReceiptSnap = await getDoc(
          doc(db, "receipts", tx.receiptId),
        );
        if (!currentReceiptSnap.exists()) {
          alert("ئەم وەسڵە پێشتر سڕاوەتەوە");
          await updateDoc(doc(db, "return_transactions", tx.id), {
            status: "canceled",
          });
          return;
        }

        const currentReceipt = currentReceiptSnap.data();
        const item = tx.receiptData.items[tx.itemIndex];

        const pRef = doc(db, "products", item.productId);
        const pSnap = await getDoc(pRef);
        if (pSnap.exists()) {
          await updateDoc(pRef, {
            stock: (pSnap.data().stock || 0) + tx.returnedQty,
          });
        }

        const newItems = [...currentReceipt.items];
        if (newItems[tx.itemIndex]) {
          newItems[tx.itemIndex].quantity -= tx.returnedQty;
          newItems[tx.itemIndex].total =
            newItems[tx.itemIndex].unitPrice * newItems[tx.itemIndex].quantity;
        }

        const filteredItems = newItems.filter((i: any) => i.quantity > 0);

        if (filteredItems.length === 0) {
          await deleteDoc(doc(db, "receipts", tx.receiptId));
        } else {
          const newTotal = filteredItems.reduce(
            (acc: number, i: any) => acc + i.total,
            0,
          );
          const newTotalItems = filteredItems.reduce(
            (acc: number, i: any) => acc + i.quantity,
            0,
          );
          await updateDoc(doc(db, "receipts", tx.receiptId), {
            items: filteredItems,
            totalAmount: newTotal,
            totalItems: newTotalItems,
          });
        }

        await reduceCustomerDebt(
          tx.receiptData,
          tx.reductionAmount,
          "گەڕانەوەی کاڵا",
        );
      }
      await updateDoc(doc(db, "return_transactions", tx.id), {
        status: "completed",
      });
    } catch (e) {
      console.error(e);
      alert("هەڵەیەک ڕوویدا");
    }
  };

  const handleRejectTransaction = async (tx: any) => {
    if (window.confirm("ئایا دڵنیایت لە ڕەتکردنەوەی ئەم مامەڵەیە؟")) {
      try {
        await updateDoc(doc(db, "debt_transactions", tx.id), {
          status: "rejected",
        });
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleApproveTransaction = async (tx: any) => {
    try {
      const debt = debts.find((d) => d.id === tx.debtId);
      if (!debt) return;

      const batch = writeBatch(db);
      let newRemaining = debt.remainingAmount;
      let newTotalAmount = debt.amount;

      if (tx.type === "pay") {
        newRemaining -= tx.amount;
      } else {
        newRemaining += tx.amount;
        newTotalAmount += tx.amount;
      }

      const finalRemaining = newRemaining < 0 ? 0 : newRemaining;
      const newStatus = finalRemaining === 0 ? "paid" : "active";

      batch.update(doc(db, "debts", debt.id), {
        amount: newTotalAmount,
        remainingAmount: finalRemaining,
        status: newStatus,
        lastPaymentDate: Timestamp.now(),
      });

      batch.update(doc(db, "debt_transactions", tx.id), {
        status: "completed",
      });
      await batch.commit();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDebtAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDebt || !paymentAmount) return;

    const amountInputRaw = parseFloat(paymentAmount);
    if (amountInputRaw <= 0) return;

    const amountInputIQD = amountInputRaw;

    let newRemaining = selectedDebt.remainingAmount;
    let newTotalAmount = selectedDebt.amount;

    const isPending = userRole !== "admin" && userRole !== "accountant";

    if (!isPending) {
      if (actionType === "pay") {
        newRemaining -= amountInputIQD;
      } else {
        newRemaining += amountInputIQD;
        newTotalAmount += amountInputIQD;
      }
      const finalRemaining = newRemaining < 0 ? 0 : newRemaining;
      const newStatus = finalRemaining === 0 ? "paid" : "active";
      await updateDoc(doc(db, "debts", selectedDebt.id), {
        amount: newTotalAmount,
        remainingAmount: finalRemaining,
        status: newStatus,
        lastPaymentDate: Timestamp.now(),
      });
    }

    await addDoc(collection(db, "debt_transactions"), {
      debtId: selectedDebt.id,
      amount: amountInputIQD,
      originalAmount: amountInputRaw,
      originalCurrency: paymentCurrency,
      exchangeRate: paymentCurrency === "USD" ? exchangeRate : 1,
      type: actionType,
      status: isPending ? "pending" : "completed",
      customerName: selectedDebt.customerName, // Added for UI
      createdBy: userName || "نەزانراو",
      timestamp: Timestamp.now(),
      notes:
        paymentNote ||
        (actionType === "pay"
          ? `دانەوەی قەرز بە دەست (${paymentCurrency})`
          : `زیادکردنی قەرز بە دەست (${paymentCurrency})`),
    });

    setPaymentModalOpen(false);
    setSelectedDebt(null);
    setPaymentAmount("");
    setPaymentNote("");
    setPaymentCurrency("IQD");
  };

  const handleCreateDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newAmount) return;

    const amountValRaw = parseFloat(newAmount);
    const amountValIQD = amountValRaw;

    const existingDebt = debts.find((d) => d.customerName === newName);
    const isPending = userRole !== "admin" && userRole !== "accountant";

    if (existingDebt) {
      if (!isPending) {
        await updateDoc(doc(db, "debts", existingDebt.id), {
          amount: existingDebt.amount + amountValIQD,
          remainingAmount: existingDebt.remainingAmount + amountValIQD,
          status: "active",
          lastPaymentDate: Timestamp.now(),
        });
      }
      await addDoc(collection(db, "debt_transactions"), {
        debtId: existingDebt.id,
        amount: amountValIQD,
        originalAmount: amountValRaw,
        originalCurrency: newCurrency,
        exchangeRate: newCurrency === "USD" ? exchangeRate : 1,
        type: "add",
        status: isPending ? "pending" : "completed",
        customerName: existingDebt.customerName,
        createdBy: userName || "نەزانراو",
        timestamp: Timestamp.now(),
        notes: `زیادکردنی قەرز بە دەست (${newCurrency})`,
      });
    } else {
      if (!isPending) {
        const debtRef = await addDoc(collection(db, "debts"), {
          customerName: newName,
          phone: newPhone,
          amount: amountValIQD,
          remainingAmount: amountValIQD,
          status: "active",
          timestamp: Timestamp.now(),
        });
        await addDoc(collection(db, "debt_transactions"), {
          debtId: debtRef.id,
          amount: amountValIQD,
          originalAmount: amountValRaw,
          originalCurrency: newCurrency,
          exchangeRate: newCurrency === "USD" ? exchangeRate : 1,
          type: "add", // new initial debt
          status: "completed",
          customerName: newName,
          createdBy: userName || "نەزانراو",
          timestamp: Timestamp.now(),
          notes: `قەرزی نوێ (${newCurrency})`,
        });
      } else {
        // Create a placeholder debt with 0 amount, and a pending transaction to add the amount
        const debtRef = await addDoc(collection(db, "debts"), {
          customerName: newName,
          phone: newPhone,
          amount: 0,
          remainingAmount: 0,
          status: "active",
          timestamp: Timestamp.now(),
        });
        await addDoc(collection(db, "debt_transactions"), {
          debtId: debtRef.id,
          amount: amountValIQD,
          originalAmount: amountValRaw,
          originalCurrency: newCurrency,
          exchangeRate: newCurrency === "USD" ? exchangeRate : 1,
          type: "add",
          status: "pending",
          customerName: newName,
          createdBy: userName || "نەزانراو",
          timestamp: Timestamp.now(),
          notes: `قەرزی نوێ (چاوەڕێی پەسەندکردن) (${newCurrency})`,
        });
      }
    }

    const existingCus = customers.find((c) => c.name === newName);
    if (!existingCus) {
      await addDoc(collection(db, "customers"), {
        name: newName,
        phone: newPhone,
        address: "",
        createdAt: Timestamp.now(),
        lastPurchase: Timestamp.now(),
      });
    } else if (newPhone && !existingCus.phone) {
      await updateDoc(doc(db, "customers", existingCus.id), {
        phone: newPhone,
      });
    }

    setNewDebtModalOpen(false);
    setNewName("");
    setNewPhone("");
    setNewAmount("");
  };

  const handleViewHistory = async (debt: Debt) => {
    setSelectedDebt(debt);
    setHistoryModalOpen(true);
    setDebtHistory([]);

    const q = query(
      collection(db, "debt_transactions"),
      orderBy("timestamp", "desc"),
    );
    // Since we don't have a compound index by default for debtId + timestamp in descending order,
    // it's easier to fetch all descending and filter by debtId, or fetch by debtId and sort on client.
    // Let's fetch by debtId, we don't need orderBy if we sort client-side, but let's try.
    // Actually, on firestore, without index, debt_transactions with where and orderBy requires composite index.
    // So we just fetch where('debtId', '==', debt.id) and sort locally:
  };

  useEffect(() => {
    if (!selectedDebt || !historyModalOpen) return;
    const unsubHistory = onSnapshot(
      collection(db, "debt_transactions"),
      (snap) => {
        const hist = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((h: any) => h.debtId === selectedDebt.id)
          .sort((a: any, b: any) => b.timestamp - a.timestamp);
        setDebtHistory(hist);
      },
    );
    return () => unsubHistory();
  }, [selectedDebt, historyModalOpen]);

  const formatDate = (ts: any) => {
    if (!ts) return "هیچ";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("en-GB");
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-red-50 to-red-100 p-6 rounded-[24px] border border-red-200 shadow-sm flex items-center justify-between relative overflow-hidden">
          <div className="absolute -right-6 -top-6 text-red-500/10">
            <FileClock size={120} />
          </div>
          <div className="relative z-10">
            <p className="text-red-600 text-sm font-bold mb-2">
              کۆی گشتی قەرزەکان (نەدراوە)
            </p>
            <h3 className="text-2xl font-black font-mono text-red-700 tracking-tight flex flex-col gap-1">
              <span>
                {formatCurrency(totalRemaining / (exchangeRate || 1500), "USD")}
              </span>
            </h3>
          </div>
          <div className="w-14 h-14 bg-white/60 backdrop-blur-sm rounded-2xl flex items-center justify-center text-red-600 shadow-sm relative z-10">
            <FileClock size={28} />
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="flex-1 bg-white rounded-[24px] border border-slate-200 shadow-sm flex flex-col overflow-hidden">
        {/* Table Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <FileText className="text-pink-600" /> دەفتەری قەرز
            </h2>
            <div className="flex bg-slate-100 p-1 rounded-xl mr-4">
              <button
                onClick={() => setActiveTab("debts")}
                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${activeTab === "debts" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                دەفتەر قەرز
              </button>
              {(userRole === "admin" || userRole === "accountant") && (
                <>
                  <button
                    onClick={() => setActiveTab("pending_tx")}
                    className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === "pending_tx" ? "bg-white text-orange-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    چاوەڕێکراوی پارە
                    {pendingTransactions.length > 0 && (
                      <span className="bg-orange-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full leading-none">
                        {pendingTransactions.length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab("pending_returns")}
                    className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === "pending_returns" ? "bg-white text-red-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    چاوەڕێکراوی گەڕانەوە
                    {pendingReturns.length > 0 && (
                      <span className="bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full leading-none">
                        {pendingReturns.length}
                      </span>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64 sm:flex-none">
              <Search
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                size={16}
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                type="text"
                placeholder="گەڕان بۆ ناوی قەرزار..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pr-10 pl-4 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all font-medium text-slate-800 shadow-sm"
                disabled={activeTab !== "debts"}
              />
            </div>
            {activeTab === "debts" && (
              <>
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors whitespace-nowrap flex items-center gap-2 shadow-sm print:hidden"
                >
                  <Printer size={16} /> چاپکردن
                </button>
                <button
                  onClick={() => setNewDebtModalOpen(true)}
                  className="px-4 py-2.5 bg-pink-600 text-white rounded-xl text-sm font-bold hover:bg-pink-700 transition-all transform active:scale-95 whitespace-nowrap flex items-center gap-2 shadow-md shadow-pink-500/20 print:hidden"
                >
                  <UserPlus size={16} /> قەرزارڕێک زیاد بکە
                </button>
              </>
            )}
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-auto custom-scrollbar">
          {activeTab === "pending_tx" ? (
            <div className="p-6 space-y-3 bg-slate-50 h-full">
              {pendingTransactions.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-400 flex-col gap-4 py-20">
                  <FileClock size={48} strokeWidth={1} />
                  <p>هیچ مامەڵەیەکی چاوەڕێکراو نییە.</p>
                </div>
              ) : (
                pendingTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="bg-white p-4 rounded-xl border border-orange-100 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-slate-800">
                        {tx.customerName}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {formatDate(tx.timestamp)} - {tx.notes}{" "}
                        {tx.createdBy ? `(لایەن: ${tx.createdBy})` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-mono font-bold text-orange-600 ml-2">
                        {formatCurrency(tx.amount)}
                      </div>
                      <button
                        onClick={() => handleApproveTransaction(tx)}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition-colors"
                      >
                        پەسەندکردنی{" "}
                        {tx.type === "pay" ? "گرتنەوەی قەرز" : "زیادکردنی قەرز"}
                      </button>
                      <button
                        onClick={() => handleRejectTransaction(tx)}
                        className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-colors"
                      >
                        ڕەتکردنەوە
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : activeTab === "pending_returns" ? (
            <div className="p-6 space-y-3 bg-slate-50 h-full">
              {pendingReturns.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-400 flex-col gap-4 py-20">
                  <FileClock size={48} strokeWidth={1} />
                  <p>هیچ پسوولەیەکی گەڕانەوە نییە بۆ چاوەڕێکردن.</p>
                </div>
              ) : (
                pendingReturns.map((tx) => (
                  <div
                    key={tx.id}
                    className="bg-white p-4 rounded-xl border border-orange-100 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-slate-800">
                        وەسڵی ژمارە:{" "}
                        {tx.receiptData?.id?.slice(-8).toUpperCase()} -{" "}
                        {tx.receiptData?.customerName || "کڕیارێکی نەناسراو"}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        مامەڵەی:{" "}
                        {tx.type === "full"
                          ? "گەڕانەوەی تەواوی کۆتایی"
                          : "گەڕانەوەی بەشێک"}{" "}
                        - لایەن: {tx.createdBy || "نەناسراو"}
                      </div>
                      <div className="text-xs text-orange-600 mt-1">
                        بڕی کەمکردنەوەی قەرز:{" "}
                        {formatCurrency(
                          tx.reductionAmount || 0,
                          tx.receiptData?.invoiceCurrency || "IQD",
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => handleApproveReturn(tx)}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition-colors"
                      >
                        پەسەندکردن
                      </button>
                      <button
                        onClick={() => handleRejectReturn(tx)}
                        className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-colors"
                      >
                        ڕەتکردنەوە
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <table className="w-full text-right border-collapse min-w-[1000px]">
              <thead className="bg-slate-50/80 backdrop-blur-sm text-slate-500 text-[11px] uppercase tracking-wider sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 font-bold border-b border-slate-200">
                    ناوی کڕیار / دوکان
                  </th>
                  <th className="px-6 py-4 font-bold border-b border-slate-200">
                    مۆبایل
                  </th>
                  <th className="px-6 py-4 font-bold border-b border-slate-200">
                    بەرواری قەرز
                  </th>
                  <th className="px-6 py-4 font-bold border-b border-slate-200">
                    کۆی قەرز
                  </th>
                  <th className="px-6 py-4 font-bold border-b border-slate-200 text-red-600">
                    ماوە بۆ دانەوە
                  </th>
                  <th className="px-6 py-4 font-bold border-b border-slate-200">
                    دواین دانەوە
                  </th>
                  <th className="px-6 py-4 font-bold border-b border-slate-200 print:hidden text-center">
                    کردارەکان
                  </th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-100">
                {filtered.map((debt) => (
                  <tr
                    key={debt.id}
                    className={`hover:bg-slate-50/50 transition-colors ${debt.status === "paid" ? "bg-slate-50/50 opacity-60" : ""}`}
                  >
                    <td className="px-6 py-4 font-bold text-slate-800">
                      {debt.customerName}
                    </td>
                    <td className="px-6 py-4">
                      {debt.phone ? (
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 font-mono text-xs"
                          dir="ltr"
                        >
                          {debt.phone}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-xs font-medium whitespace-nowrap">
                      {formatDate(debt.timestamp)}
                    </td>
                    <td className="px-6 py-4 text-slate-700 font-bold font-mono whitespace-nowrap">
                      {formatCurrency(debt.amount)}
                    </td>
                    <td className="px-6 py-4">
                      {debt.status === "paid" ? (
                        <span className="inline-flex px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700 font-bold text-xs">
                          قەرزی نەماوە
                        </span>
                      ) : (
                        (() => {
                          const pendingPay = pendingTransactions
                            .filter(
                              (pt) =>
                                pt.debtId === debt.id && pt.type === "pay",
                            )
                            .reduce((acc, curr) => acc + curr.amount, 0);
                          const pendingAdd = pendingTransactions
                            .filter(
                              (pt) =>
                                pt.debtId === debt.id && pt.type === "add",
                            )
                            .reduce((acc, curr) => acc + curr.amount, 0);
                          return (
                            <div className="flex flex-col gap-1.5 w-fit">
                              <span className="inline-flex px-3 py-1 rounded-lg bg-orange-50 text-orange-700 font-bold font-mono whitespace-nowrap shadow-sm border border-orange-200">
                                {formatCurrency(
                                  debt.remainingAmount / (exchangeRate || 1500),
                                  "USD",
                                )}
                              </span>
                              {pendingPay > 0 && (
                                <span
                                  className="inline-flex px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 font-bold font-mono text-[11px] border border-emerald-200"
                                  title="لە چاوەڕوانی پەسەندکردنی وەرگرتنی قەرز"
                                >
                                  - {formatCurrency(pendingPay)} (چاوەڕێی سەحب)
                                </span>
                              )}
                              {pendingAdd > 0 && (
                                <span
                                  className="inline-flex px-2 py-0.5 rounded-md bg-orange-100 text-orange-700 font-bold font-mono text-[11px] border border-orange-200"
                                  title="لە چاوەڕوانی پەسەندکردنی زیادکردنی قەرز"
                                >
                                  + {formatCurrency(pendingAdd)} (چاوەڕێی
                                  زیادکردن)
                                </span>
                              )}
                            </div>
                          );
                        })()
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-xs font-medium whitespace-nowrap">
                      {formatDate(debt.lastPaymentDate)}
                    </td>
                    <td className="px-6 py-4 print:hidden">
                      <div className="flex items-center justify-center gap-2 flex-wrap min-w-[280px]">
                        {debt.status !== "paid" && (
                          <button
                            onClick={() => {
                              setActionType("pay");
                              setSelectedDebt(debt);
                              setPaymentAmount(debt.remainingAmount.toString());
                              setPaymentNote("");
                              setPaymentModalOpen(true);
                            }}
                            className="text-emerald-700 text-xs font-bold px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-200 flex items-center gap-1.5 shadow-sm"
                          >
                            <DollarSign size={14} /> پارە وەرگرتن
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setActionType("add");
                            setSelectedDebt(debt);
                            setPaymentAmount("");
                            setPaymentNote("");
                            setPaymentModalOpen(true);
                          }}
                          className="text-red-700 text-xs font-bold px-2.5 py-1.5 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-200 flex items-center gap-1.5 shadow-sm"
                        >
                          <PlusCircle size={14} /> قەرزی نوێ
                        </button>
                        <button
                          onClick={() => handleViewHistory(debt)}
                          className="text-indigo-700 text-xs font-bold px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-200 flex items-center gap-1.5 shadow-sm"
                        >
                          <FileClock size={14} /> مێژوو
                        </button>
                        <button
                          onClick={() => {
                            setSelectedDebt(debt);
                            setPrintTx({
                              id: "Generic",
                              timestamp: new Date(),
                              amount: debt.remainingAmount || 0,
                              isGeneric: true,
                              originalAmount: debt.remainingAmount || 0,
                              originalCurrency: debt.customerCurrency || "IQD",
                            });
                          }}
                          className="text-pink-700 text-xs font-bold px-2.5 py-1.5 bg-pink-50 hover:bg-pink-100 rounded-lg transition-colors border border-pink-200 flex items-center gap-1.5 shadow-sm"
                          title="چاپکردنی قەبزی قەرز"
                        >
                          <Printer size={14} /> قەبز
                        </button>
                        <button
                          onClick={() =>
                            setStatementCustomer({ name: debt.customerName })
                          }
                          className="text-emerald-700 text-xs font-bold px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-200 flex items-center gap-1.5 shadow-sm"
                          title="ڕاپۆرتی کەشفی حیساب"
                        >
                          <FileText size={14} /> کەشف حساب
                        </button>
                        <button
                          onClick={() => {
                            setSelectedDebt(debt);
                            setEditName(debt.customerName || "");
                            setEditPhone(debt.phone || "");
                            setEditDebtModalOpen(true);
                          }}
                          className="text-orange-700 text-xs font-bold px-2.5 py-1.5 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors border border-orange-200 shadow-sm"
                          title="دەستکاری ناوی قەرزار"
                        >
                          <Edit size={14} />
                        </button>
                        {debt.phone && (
                          <button
                            onClick={() => {
                              const msg = encodeURIComponent(
                                `سڵاو بەڕێز ${debt.customerName}،\nقەرزی ماوەتان لای (پینک ئێللێ) بریتییە لە: ${formatCurrency(debt.remainingAmount / (exchangeRate || 1500), "USD")}.\nتکایە لە کاتی گونجاودا سەردانمان بکەنەوە.`,
                              );
                              window.open(
                                `https://wa.me/${debt.phone.replace(/[^0-9]/g, "")}?text=${msg}`,
                                "_blank",
                              );
                            }}
                            className="text-emerald-600 text-xs font-bold px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-200 shadow-sm"
                            title="ناردنی نامەی واتسئاپ"
                          >
                            <MessageCircle size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-16 text-center text-slate-500"
                    >
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                          <FileText size={40} className="text-slate-300" />
                        </div>
                        <p className="text-base font-bold text-slate-600">
                          هیچ قەرزێک بوونی نییە
                        </p>
                        <p className="text-sm font-medium text-slate-400 mt-1">
                          ئێستا هیچ کڕیارێک قەرزدار نییە
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      {paymentModalOpen && selectedDebt && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleDebtAction}
            className="bg-white rounded-[24px] shadow-2xl w-full max-w-md overflow-hidden"
          >
            <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-l from-slate-50 to-white flex justify-between items-center">
              <h2
                className={`text-lg font-bold flex items-center gap-2 ${actionType === "pay" ? "text-emerald-700" : "text-red-700"}`}
              >
                {actionType === "pay" ? (
                  <DollarSign size={20} />
                ) : (
                  <PlusCircle size={20} />
                )}
                {actionType === "pay"
                  ? "وەرگرتنی پارەی قەرز"
                  : "زیادکردنی قەرز"}
              </h2>
              <button
                type="button"
                onClick={() => setPaymentModalOpen(false)}
                className="text-slate-400 hover:bg-slate-100 p-2 rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div
                className={`p-4 rounded-xl border ${actionType === "pay" ? "bg-emerald-50/50 border-emerald-100" : "bg-red-50/50 border-red-100"}`}
              >
                <p className="text-xs font-bold text-slate-500 mb-1">کڕیار</p>
                <p className="text-base font-bold text-slate-800 mb-2">
                  {selectedDebt.customerName}
                </p>
                <p className="text-xs font-bold text-slate-500 mb-1">
                  کۆی ماوە لەسەر کڕیار
                </p>
                <p
                  className={`text-lg font-black font-mono ${actionType === "pay" ? "text-emerald-700" : "text-red-700"}`}
                >
                  {formatCurrency(selectedDebt.remainingAmount)}
                </p>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${actionType === "pay" ? "bg-emerald-500" : "bg-red-500"}`}
                  ></span>
                  {actionType === "pay" ? "بڕی وەرگیراو" : "بڕی زیادکراو"}
                </label>
                <div className="flex gap-2">
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    max={
                      actionType === "pay" && paymentCurrency === "IQD"
                        ? selectedDebt.remainingAmount
                        : actionType === "pay" && paymentCurrency === "USD"
                          ? selectedDebt.remainingAmount / exchangeRate
                          : undefined
                    }
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className={`w-full bg-white border-2 rounded-xl p-3 focus:outline-none transition-colors font-mono text-xl text-center font-bold ${actionType === "pay" ? "border-emerald-200 focus:border-emerald-500 text-emerald-700" : "border-red-200 focus:border-red-500 text-red-700"}`}
                    placeholder="0"
                    dir="ltr"
                  />
                  <div
                    className={`w-24 border-2 rounded-xl flex items-center justify-center font-bold text-lg font-mono ${actionType === "pay" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}
                  >
                    USD
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  تێبینی (ئارەزوومەندانە)
                </label>
                <input
                  type="text"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-slate-400 transition-colors"
                  placeholder="بۆ نموونە: حەواڵەی بانکی، هتد..."
                />
              </div>
            </div>
            <div className="px-6 py-5 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPaymentModalOpen(false)}
                className="px-6 py-2.5 text-slate-600 bg-white border border-slate-200 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors"
              >
                پاشگەزبوونەوە
              </button>
              <button
                type="submit"
                className={`px-6 py-2.5 text-white rounded-xl text-sm font-bold transition-all shadow-sm ${actionType === "pay" ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200" : "bg-red-600 hover:bg-red-700 shadow-red-200"}`}
              >
                {actionType === "pay"
                  ? "پەسەندکردنی وەرگرتن"
                  : "زیادکردن لەسەر قەرز"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* New Debt Modal */}
      {newDebtModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateDebt}
            className="bg-white rounded-[24px] shadow-2xl w-full max-w-md overflow-hidden"
          >
            <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-l from-pink-50 to-white flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <UserPlus className="text-pink-600" size={20} />
                زیادکردنی قەرزی نوێ
              </h2>
              <button
                type="button"
                onClick={() => setNewDebtModalOpen(false)}
                className="text-slate-400 hover:bg-slate-100 p-2 rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    ناوی کڕیار (هەڵبژاردن یان نووسین)
                  </label>
                  <div className="flex gap-2">
                    <select
                      className="bg-white border-2 border-slate-200 rounded-xl p-3 focus:outline-none focus:border-pink-500 transition-colors w-1/2"
                      value={
                        customers.find((c) => c.name === newName) ? newName : ""
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val) {
                          setNewName(val);
                          const found = customers.find((c) => c.name === val);
                          if (found && !newPhone)
                            setNewPhone(found.phone || "");
                        }
                      }}
                    >
                      <option value="">-- کڕیارەکان --</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <input
                      required
                      type="text"
                      value={newName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewName(val);
                        const found = customers.find((c) => c.name === val);
                        if (found && !newPhone) {
                          setNewPhone(found.phone || "");
                        }
                      }}
                      className="w-1/2 bg-white border-2 border-slate-200 rounded-xl p-3 focus:outline-none focus:border-pink-500 transition-colors"
                      placeholder="ناوی نوێ بنووسە..."
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  ژمارە مۆبایل
                </label>
                <input
                  type="text"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  dir="ltr"
                  className="w-full bg-white border-2 border-slate-200 rounded-xl p-3 focus:outline-none focus:border-pink-500 font-mono text-left transition-colors"
                  placeholder="0750 XXX XXXX"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  بڕی قەرز
                </label>
                <div className="flex gap-2">
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    className="w-full bg-pink-50/50 border-2 border-pink-200 rounded-xl p-3 focus:outline-none focus:border-pink-500 font-mono text-xl text-center font-bold text-pink-700 transition-colors"
                    placeholder="0"
                    dir="ltr"
                  />
                  <div className="w-24 border-2 border-pink-200 bg-pink-50 rounded-xl flex items-center justify-center font-bold text-lg font-mono text-pink-700">
                    USD
                  </div>
                </div>
              </div>
            </div>
            <div className="px-6 py-5 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setNewDebtModalOpen(false)}
                className="px-6 py-2.5 text-slate-600 bg-white border border-slate-200 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors"
              >
                پاشگەزبوونەوە
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-pink-600 text-white hover:bg-pink-700 rounded-xl text-sm font-bold transition-all shadow-sm shadow-pink-200"
              >
                پاشەکەوتکردن
              </button>
            </div>
          </form>
        </div>
      )}
      {/* History Modal */}
      {historyModalOpen && selectedDebt && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-pink-50 rounded-bl-full -z-10 opacity-50"></div>
              <div>
                <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
                  <FileClock className="text-indigo-600" size={24} />
                  مێژووی مامەڵەکان
                </h2>
                <p className="text-sm font-medium text-slate-500 mt-1">
                  کڕیار:{" "}
                  <span className="font-bold text-slate-700">
                    {selectedDebt.customerName}
                  </span>
                </p>
              </div>
              <button
                onClick={() => setHistoryModalOpen(false)}
                className="w-10 h-10 rounded-full bg-slate-50 hover:bg-white border border-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors shadow-sm"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-0 overflow-auto flex-1 custom-scrollbar">
              {debtHistory.length > 0 ? (
                <table className="w-full text-right border-collapse">
                  <thead className="bg-slate-50/90 backdrop-blur-sm sticky top-0 z-10 border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                        بەروار
                      </th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                        بڕی پارە
                      </th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                        جۆر
                      </th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                        تێبینی
                      </th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 text-center">
                        کردارەکان
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {debtHistory.map((h) => (
                      <tr
                        key={h.id}
                        className="hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="px-6 py-4 text-sm text-slate-600 font-mono font-medium">
                          {formatDate(h.timestamp)}
                        </td>
                        <td className="px-6 py-4 flex flex-col gap-1 text-sm text-slate-900 font-extrabold font-mono">
                          <span>
                            {formatCurrency(
                              h.originalCurrency === "USD"
                                ? h.originalAmount ||
                                    h.amount /
                                      (h.exchangeRate || exchangeRate || 1500)
                                : h.amount /
                                    (h.exchangeRate || exchangeRate || 1500),
                              "USD",
                            )}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm font-bold flex flex-wrap gap-2 items-center">
                          {h.type === "pay" ? (
                            <span className="text-emerald-700 bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg text-xs">
                              دانەوە (کەمکردن)
                            </span>
                          ) : (
                            <span className="text-red-700 bg-red-100 border border-red-200 px-2.5 py-1 rounded-lg text-xs">
                              زیادکردن (قەرزی نوێ)
                            </span>
                          )}
                          {h.status === "pending" && (
                            <span className="text-orange-700 bg-orange-100 border border-orange-200 px-2.5 py-1 rounded-lg text-[10px] inline-flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse"></span>
                              لە چاوەڕوانی پەسەندکردن
                            </span>
                          )}
                        </td>
                        <td
                          className="px-6 py-4 text-xs text-slate-500 max-w-[200px] truncate"
                          title={h.notes || ""}
                        >
                          {h.notes || "-"}{" "}
                          {h.createdBy ? `(لایەن: ${h.createdBy})` : ""}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {h.type === "pay" && h.status !== "pending" && (
                            <button
                              onClick={() => setPrintTx(h)}
                              className="text-pink-600 hover:bg-pink-50 p-2 rounded-lg transition-colors border border-transparent hover:border-pink-200"
                              title="چاپکردنی وەسڵی قەبز"
                            >
                              <Printer size={16} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-16 flex flex-col items-center justify-center text-center">
                  <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mb-5 text-slate-300 shadow-inner">
                    <FileClock size={40} />
                  </div>
                  <p className="text-slate-700 font-bold text-lg">
                    هیچ مێژوویەک نەدۆزرایەوە
                  </p>
                  <p className="text-slate-400 font-medium mt-1 text-sm">
                    بۆ ئەم قەرزە تا ئێستا هیچ مامەڵەیەک نەکراوە.
                  </p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setHistoryModalOpen(false)}
                className="px-8 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 active:bg-slate-200 shadow-sm rounded-xl text-sm font-bold transition-all"
              >
                داخستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Debt Modal */}
      {editDebtModalOpen && selectedDebt && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleEditDebt}
            className="bg-white rounded-[24px] shadow-2xl w-full max-w-md overflow-hidden"
          >
            <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-l from-orange-50 to-white flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Edit className="text-orange-500" size={20} />
                دەستکاری قەرز
              </h2>
              <button
                type="button"
                onClick={() => setEditDebtModalOpen(false)}
                className="text-slate-400 hover:bg-slate-100 p-2 rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  ناوی کڕیار
                </label>
                <input
                  required
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-white border-2 border-slate-200 rounded-xl p-3 focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  ژمارە مۆبایل
                </label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  dir="ltr"
                  className="w-full bg-white border-2 border-slate-200 rounded-xl p-3 focus:outline-none focus:border-orange-500 font-mono text-left transition-colors"
                />
              </div>
            </div>
            <div className="px-6 py-5 bg-slate-50 border-t border-slate-100 flex justify-between gap-3">
              <button
                type="button"
                onClick={handleDeleteDebtAccount}
                className="px-4 py-2 text-red-600 bg-red-50 border border-red-200 rounded-xl text-sm font-bold hover:bg-red-100 transition-colors flex items-center gap-2"
              >
                <Trash2 size={16} /> سڕینەوە
              </button>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditDebtModalOpen(false)}
                  className="px-6 py-2.5 text-slate-600 bg-white border border-slate-200 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors"
                >
                  پاشگەزبوونەوە
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-orange-500 text-white hover:bg-orange-600 rounded-xl text-sm font-bold transition-all shadow-sm shadow-orange-200"
                >
                  گۆڕین و پاشەکەوتکردن
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Print Modal */}
      {printTx && selectedDebt && (
        <DebtReceiptModal
          transaction={printTx}
          debt={selectedDebt}
          onClose={() => setPrintTx(null)}
        />
      )}

      {/* Account Statement */}
      {statementCustomer && (
        <AccountStatementModal
          customer={statementCustomer}
          debts={debts}
          onClose={() => setStatementCustomer(null)}
        />
      )}
    </div>
  );
}
