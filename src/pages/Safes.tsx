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
} from "lucide-react";
import { formatCurrency } from "../data";

export default function SafesPage({ settings }: any) {
  const [safes, setSafes] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);

  const [isAddingSafe, setIsAddingSafe] = useState(false);
  const [newSafeName, setNewSafeName] = useState("");
  const [newSafeIQD, setNewSafeIQD] = useState("");
  const [newSafeUSD, setNewSafeUSD] = useState("");

  const [isTransferring, setIsTransferring] = useState(false);
  const [transferFrom, setTransferFrom] = useState("");
  const [transferTo, setTransferTo] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferFromCurrency, setTransferFromCurrency] = useState<
    "IQD" | "USD"
  >("IQD");
  const [transferToCurrency, setTransferToCurrency] = useState<"IQD" | "USD">(
    "IQD",
  );
  const [transferExchangeRate, setTransferExchangeRate] = useState<number>(
    settings?.exchangeRate || 1500,
  );
  const [transferNote, setTransferNote] = useState("");

  const [isAdjusting, setIsAdjusting] = useState(false);
  const [adjustSafeId, setAdjustSafeId] = useState("");
  const [adjustType, setAdjustType] = useState<"add" | "subtract">("add");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustCurrency, setAdjustCurrency] = useState<"IQD" | "USD">("IQD");
  const [adjustNote, setAdjustNote] = useState("");

  const [isHawala, setIsHawala] = useState(false);
  const [hawalaSafe, setHawalaSafe] = useState("");
  const [hawalaAmount, setHawalaAmount] = useState("");
  const [hawalaCurrency, setHawalaCurrency] = useState<"IQD" | "USD">("USD");
  const [hawalaFee, setHawalaFee] = useState("0");
  const [hawalaReceiver, setHawalaReceiver] = useState("");
  const [hawalaOffice, setHawalaOffice] = useState("");
  const [hawalaNote, setHawalaNote] = useState("");

  const [userRole, setUserRole] = useState("");
  const [pendingTransactions, setPendingTransactions] = useState<any[]>([]);

  useEffect(() => {
    if (auth.currentUser) {
      getDoc(doc(db, "users", auth.currentUser.uid)).then((snap) => {
        if (snap.exists()) setUserRole(snap.data().role || "user");
      });
    }

    const unsubSafes = onSnapshot(collection(db, "safes"), (snap) => {
      setSafes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    // Limits history to last 100 for perf in view
    const qTrans = query(
      collection(db, "safe_transactions"),
      orderBy("timestamp", "desc"),
    );
    const unsubTrans = onSnapshot(qTrans, (snap) => {
      const allTrans = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setTransactions(allTrans.filter((t: any) => t.status !== "pending"));
      setPendingTransactions(allTrans.filter((t: any) => t.status === "pending"));
    });

    return () => {
      unsubSafes();
      unsubTrans();
    };
  }, []);

  const handleAddSafe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSafeName.trim()) return;
    await addDoc(collection(db, "safes"), {
      name: newSafeName,
      balanceIQD: Number(newSafeIQD) || 0,
      balanceUSD: Number(newSafeUSD) || 0,
      createdAt: Timestamp.now(),
    });
    setIsAddingSafe(false);
    setNewSafeName("");
    setNewSafeIQD("");
    setNewSafeUSD("");
  };

  const handleDeleteSafe = async (id: string, name: string) => {
    if (window.confirm(`دڵنیایت لە سڕینەوەی قاسەی "${name}"؟`)) {
      await deleteDoc(doc(db, "safes", id));
    }
  };

  const calculateReceivedAmount = () => {
    const amount = Number(transferAmount) || 0;
    if (amount <= 0) return 0;
    if (transferFromCurrency === transferToCurrency) return amount;
    if (transferFromCurrency === "USD" && transferToCurrency === "IQD")
      return amount * transferExchangeRate;
    if (transferFromCurrency === "IQD" && transferToCurrency === "USD")
      return amount / transferExchangeRate;
    return amount;
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

    const receivedAmount = calculateReceivedAmount();
    const isPending = userRole !== "admin" && userRole !== "accountant";

    const batch = writeBatch(db);

    if (!isPending) {
      // Deduct from sender
      if (transferFromCurrency === "IQD") {
        batch.update(doc(db, "safes", transferFrom), {
          balanceIQD: (fromSafe.balanceIQD || 0) - amount,
        });
      } else {
        batch.update(doc(db, "safes", transferFrom), {
          balanceUSD: (fromSafe.balanceUSD || 0) - amount,
        });
      }

      // Add to receiver
      if (transferToCurrency === "IQD") {
        batch.update(doc(db, "safes", transferTo), {
          balanceIQD: (toSafe.balanceIQD || 0) + receivedAmount,
        });
      } else {
        batch.update(doc(db, "safes", transferTo), {
          balanceUSD: (toSafe.balanceUSD || 0) + receivedAmount,
        });
      }
    }

    // Record Transaction
    batch.set(doc(collection(db, "safe_transactions")), {
      type: "transfer",
      fromSafeId: fromSafe.id,
      fromSafeName: fromSafe.name,
      toSafeId: toSafe.id,
      toSafeName: toSafe.name,
      amount: amount,
      currency: transferFromCurrency,
      receivedAmount: receivedAmount,
      receivedCurrency: transferToCurrency,
      exchangeRate:
        transferFromCurrency !== transferToCurrency
          ? transferExchangeRate
          : null,
      note: transferNote,
      status: isPending ? "pending" : "completed",
      timestamp: Timestamp.now(),
    });

    await batch.commit();

    setIsTransferring(false);
    setTransferAmount("");
    setTransferNote("");
    setTransferExchangeRate(settings?.exchangeRate || 1500);
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
      if (adjustCurrency === "IQD") {
        const field =
          adjustType === "add"
            ? (safeInfo.balanceIQD || 0) + amount
            : (safeInfo.balanceIQD || 0) - amount;
        batch.update(doc(db, "safes", adjustSafeId), { balanceIQD: field });
      } else {
        const field =
          adjustType === "add"
            ? (safeInfo.balanceUSD || 0) + amount
            : (safeInfo.balanceUSD || 0) - amount;
        batch.update(doc(db, "safes", adjustSafeId), { balanceUSD: field });
      }
    }

    batch.set(doc(collection(db, "safe_transactions")), {
      type: adjustType === "add" ? "deposit" : "withdrawal",
      safeId: safeInfo.id,
      safeName: safeInfo.name,
      amount: amount,
      currency: adjustCurrency,
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
      if (hawalaCurrency === "IQD") {
        batch.update(doc(db, "safes", hawalaSafe), {
          balanceIQD: (safeInfo.balanceIQD || 0) - totalDeduct,
        });
      } else {
        batch.update(doc(db, "safes", hawalaSafe), {
          balanceUSD: (safeInfo.balanceUSD || 0) - totalDeduct,
        });
      }
    }

    batch.set(doc(collection(db, "safe_transactions")), {
      type: "hawala",
      safeId: safeInfo.id,
      safeName: safeInfo.name,
      amount: totalDeduct, // Total deducted
      netAmount: amount, // Only the sent amount
      fee: fee,
      currency: hawalaCurrency,
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

        if (tx.currency === "IQD") {
          batch.update(doc(db, "safes", tx.fromSafeId), {
            balanceIQD: (fromSafe.balanceIQD || 0) - tx.amount,
          });
        } else {
          batch.update(doc(db, "safes", tx.fromSafeId), {
            balanceUSD: (fromSafe.balanceUSD || 0) - tx.amount,
          });
        }

        if (tx.receivedCurrency === "IQD") {
          batch.update(doc(db, "safes", tx.toSafeId), {
            balanceIQD: (toSafe.balanceIQD || 0) + tx.receivedAmount,
          });
        } else {
          batch.update(doc(db, "safes", tx.toSafeId), {
            balanceUSD: (toSafe.balanceUSD || 0) + tx.receivedAmount,
          });
        }
      } else if (
        tx.type === "deposit" ||
        tx.type === "withdrawal" ||
        tx.type === "hawala"
      ) {
        const safeInfo = safes.find((s) => s.id === tx.safeId);
        if (!safeInfo) return;

        if (tx.currency === "IQD") {
          const change = tx.type === "deposit" ? tx.amount : -tx.amount;
          batch.update(doc(db, "safes", tx.safeId), {
            balanceIQD: (safeInfo.balanceIQD || 0) + change,
          });
        } else {
          const change = tx.type === "deposit" ? tx.amount : -tx.amount;
          batch.update(doc(db, "safes", tx.safeId), {
            balanceUSD: (safeInfo.balanceUSD || 0) + change,
          });
        }
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
            className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-bold hover:bg-indigo-100 flex items-center gap-2 transition-colors"
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {safes.map((safe) => (
          <div
            key={safe.id}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 relative group"
          >
            <button
              onClick={() => handleDeleteSafe(safe.id, safe.name)}
              className="absolute top-4 left-4 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X size={18} />
            </button>
            <div className="flex items-center gap-3 mb-4 border-b border-slate-100 pb-4">
              <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 shrink-0">
                <Banknote size={20} />
              </div>
              <h3 className="font-extrabold text-lg text-slate-800 w-full truncate">
                {safe.name}
              </h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-end">
                <span className="text-sm font-bold text-slate-500">
                  بالانسی دینار
                </span>
                <span
                  className={`font-mono font-bold text-lg ${safe.balanceIQD < 0 ? "text-red-600" : "text-emerald-700"}`}
                >
                  {formatCurrency(safe.balanceIQD || 0, "IQD")}
                </span>
              </div>
              <div className="flex justify-between items-end">
                <span className="text-sm font-bold text-slate-500">
                  بالانسی دۆلار
                </span>
                <span
                  className={`font-mono font-bold text-lg ${safe.balanceUSD < 0 ? "text-red-600" : "text-emerald-700"}`}
                >
                  {formatCurrency(safe.balanceUSD || 0, "USD")}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {pendingTransactions.length > 0 &&
        (userRole === "admin" || userRole === "accountant") && (
          <div className="bg-orange-50 border border-orange-200 rounded-[24px] p-6 shadow-sm">
            <h3 className="text-lg font-bold text-orange-800 mb-4 flex items-center gap-2">
              <FileClock size={20} /> مامەڵە چاوەڕێکراوەکانی قاسە
            </h3>
            <div className="space-y-3">
              {pendingTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="bg-white p-4 rounded-xl border border-orange-100 flex items-center justify-between"
                >
                  <div>
                    <div className="font-bold text-slate-800">
                      {tx.type === "transfer" &&
                        "گواستنەوەی پارە لە نێوان قاسەکان"}
                      {tx.type === "deposit" && "دانانی پارە لە قاسە"}
                      {tx.type === "withdrawal" && "دەرهێنانی پارە لە قاسە"}
                      {tx.type === "hawala" &&
                        `حەواڵەی پارە بۆ ${tx.receiver} (${tx.office})`}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      بەروار: {tx.timestamp?.toDate().toLocaleString()} - قاسە:{" "}
                      {tx.safeName || tx.fromSafeName}{" "}
                      {tx.note ? `- تێبینی: ${tx.note}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="font-mono font-bold text-orange-600">
                      {formatCurrency(tx.amount || 0, tx.currency)}
                    </div>
                    <button
                      onClick={() => handleApproveSafeTransaction(tx)}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition-colors"
                    >
                      پەسەندکردن
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      <div className="flex-1 bg-white rounded-[24px] border border-slate-200 shadow-sm flex flex-col min-h-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
          <History className="text-slate-500" size={18} />
          <h3 className="font-bold text-slate-700">مێژووی مامەڵەکانی قاسە</h3>
        </div>
        <div className="flex-1 overflow-auto p-0">
          <table className="w-full text-right">
            <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-6 py-3 text-sm font-bold text-slate-500 border-b border-slate-200">
                  بەروار
                </th>
                <th className="px-6 py-3 text-sm font-bold text-slate-500 border-b border-slate-200">
                  جۆر
                </th>
                <th className="px-6 py-3 text-sm font-bold text-slate-500 border-b border-slate-200">
                  بڕی دەرچوو
                </th>
                <th className="px-6 py-3 text-sm font-bold text-slate-500 border-b border-slate-200">
                  بڕی هاتوو
                </th>
                <th className="px-6 py-3 text-sm font-bold text-slate-500 border-b border-slate-200">
                  قاسە
                </th>
                <th className="px-6 py-3 text-sm font-bold text-slate-500 border-b border-slate-200">
                  تێبینی
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.slice(0, 80).map((t) => (
                <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                  <td
                    className="px-6 py-4 font-mono text-sm text-slate-600"
                    dir="ltr"
                  >
                    {t.timestamp?.toDate().toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold">
                    {t.type === "transfer" && (
                      <span className="text-indigo-600 bg-indigo-50 px-2 py-1 rounded inline-flex items-center gap-1">
                        <ArrowRightLeft size={14} /> گواستنەوە
                      </span>
                    )}
                    {t.type === "deposit" && (
                      <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded inline-flex items-center gap-1">
                        <ArrowDownToLine size={14} /> دانان
                      </span>
                    )}
                    {t.type === "withdrawal" && (
                      <span className="text-red-600 bg-red-50 px-2 py-1 rounded inline-flex items-center gap-1">
                        <ArrowUpFromLine size={14} /> دەرهێنان
                      </span>
                    )}
                    {t.type === "hawala" && (
                      <span className="text-amber-600 bg-amber-50 px-2 py-1 rounded inline-flex items-center gap-1">
                        <Send size={14} /> حەواڵە
                      </span>
                    )}
                  </td>
                  <td
                    className="px-6 py-4 font-mono font-bold text-slate-800"
                    dir="ltr"
                  >
                    {t.type === "transfer" && (
                      <span className="text-red-600">
                        -{formatCurrency(t.amount, t.currency)}
                      </span>
                    )}
                    {t.type === "withdrawal" && (
                      <span className="text-red-600">
                        -{formatCurrency(t.amount, t.currency)}
                      </span>
                    )}
                    {t.type === "hawala" && (
                      <span className="text-red-600">
                        -{formatCurrency(t.amount, t.currency)}
                      </span>
                    )}
                    {t.type === "deposit" && (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td
                    className="px-6 py-4 font-mono font-bold text-slate-800"
                    dir="ltr"
                  >
                    {t.type === "transfer" && (
                      <span className="text-emerald-600">
                        +
                        {formatCurrency(
                          t.receivedAmount || t.amount,
                          t.receivedCurrency || t.currency,
                        )}
                      </span>
                    )}
                    {t.type === "deposit" && (
                      <span className="text-emerald-600">
                        +{formatCurrency(t.amount, t.currency)}
                      </span>
                    )}
                    {t.type === "withdrawal" && (
                      <span className="text-slate-400">-</span>
                    )}
                    {t.type === "hawala" && (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-600 truncate max-w-[150px]">
                    {t.type === "transfer"
                      ? `لە ${t.fromSafeName} بۆ ${t.toSafeName}`
                      : t.safeName}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500 max-w-[200px]">
                    <div className="truncate">
                      {t.type === "hawala"
                        ? `بۆ: ${t.receiver} (${t.office}) - عمولە: ${formatCurrency(t.fee || 0, t.currency)} - ${t.note || ""}`
                        : t.note || "-"}
                    </div>
                    {t.exchangeRate && (
                      <span className="block text-[10px] text-slate-400">
                        سعر: {t.exchangeRate}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-slate-400 font-bold"
                  >
                    هیچ گواستنەوەیەک یان مامەڵەیەک نییە
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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
                    بالانسی دینار (IQD)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={newSafeIQD}
                    onChange={(e) => setNewSafeIQD(e.target.value)}
                    className="w-full font-mono bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-pink-500 outline-none text-left transition-all"
                    dir="ltr"
                    placeholder="0"
                  />
                </div>
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
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-1">
                    دراو
                  </label>
                  <select
                    value={adjustCurrency}
                    onChange={(e) =>
                      setAdjustCurrency(e.target.value as "IQD" | "USD")
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-2.5 focus:ring-2 focus:ring-slate-400 outline-none font-bold text-slate-700"
                  >
                    <option value="IQD">دینار</option>
                    <option value="USD">دۆلار</option>
                  </select>
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

      {/* Transfer Modal */}
      {isTransferring && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex justify-center items-center p-4 z-50 overflow-y-auto">
          <form
            onSubmit={handleTransfer}
            className="bg-white rounded-3xl w-full max-w-xl shadow-2xl p-6 relative overflow-hidden my-8"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-100 rounded-full blur-3xl -mx-10 -my-10 opacity-50 pointer-events-none"></div>
            <h2 className="text-xl font-extrabold text-slate-800 mb-6 flex items-center gap-2">
              <ArrowRightLeft className="text-indigo-600" /> گواستنەوەی پارە
              نێوان قاسەکان
            </h2>
            <div className="space-y-5 mb-6 relative">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <label className="block text-sm font-bold text-indigo-600 mb-2">
                    لە قاسەی (دەرچوو)
                  </label>
                  <select
                    required
                    value={transferFrom}
                    onChange={(e) => setTransferFrom(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700 mb-3"
                  >
                    <option value="">خاوەن پارە...</option>
                    {safes.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} (دینار:{" "}
                        {formatCurrency(s.balanceIQD || 0, "IQD").replace(
                          "IQD",
                          "",
                        )}{" "}
                        | دۆلار:{" "}
                        {formatCurrency(s.balanceUSD || 0, "USD").replace(
                          "USD",
                          "",
                        )}
                        )
                      </option>
                    ))}
                  </select>

                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">
                        بڕی پارە
                      </label>
                      <input
                        required
                        type="number"
                        min="0"
                        step="any"
                        value={transferAmount}
                        onChange={(e) => setTransferAmount(e.target.value)}
                        className="w-full font-mono bg-white border border-slate-200 rounded-xl px-3 py-2 font-bold text-right"
                        placeholder="0"
                        dir="ltr"
                      />
                    </div>
                    <div className="w-[80px]">
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">
                        دراو
                      </label>
                      <select
                        value={transferFromCurrency}
                        onChange={(e) =>
                          setTransferFromCurrency(
                            e.target.value as "IQD" | "USD",
                          )
                        }
                        className="w-full bg-white border border-slate-200 rounded-xl px-1 py-2 font-bold text-slate-700 font-mono text-center"
                      >
                        <option value="IQD">IQD</option>
                        <option value="USD">USD</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <label className="block text-sm font-bold text-emerald-600 mb-2">
                    بۆ قاسەی (هاتوو)
                  </label>
                  <select
                    required
                    value={transferTo}
                    onChange={(e) => setTransferTo(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-700 mb-3"
                  >
                    <option value="">وەرگر...</option>
                    {safes.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} (دینار:{" "}
                        {formatCurrency(s.balanceIQD || 0, "IQD").replace(
                          "IQD",
                          "",
                        )}{" "}
                        | دۆلار:{" "}
                        {formatCurrency(s.balanceUSD || 0, "USD").replace(
                          "USD",
                          "",
                        )}
                        )
                      </option>
                    ))}
                  </select>

                  <div className="flex gap-2 mt-auto">
                    <div className="w-[80px]">
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">
                        دراوی وەرگرتن
                      </label>
                      <select
                        value={transferToCurrency}
                        onChange={(e) =>
                          setTransferToCurrency(e.target.value as "IQD" | "USD")
                        }
                        className="w-full bg-indigo-50 border border-indigo-200 rounded-xl px-1 py-2 font-bold text-indigo-700 font-mono text-center outline-none"
                      >
                        <option value="IQD">IQD</option>
                        <option value="USD">USD</option>
                      </select>
                    </div>
                    <div className="flex-1 border-r border-slate-200 pr-3">
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">
                        دەرئەنجام{" "}
                        <span className="font-normal text-[9px]">
                          (ئەوەی دەچێتە سەر قاسەی وەرگر)
                        </span>
                      </label>
                      <div
                        className="w-full font-mono bg-white border border-dashed border-emerald-300 rounded-xl px-3 py-2 font-bold text-emerald-700 text-left truncate flex items-center h-[42px]"
                        dir="ltr"
                      >
                        {formatCurrency(
                          calculateReceivedAmount(),
                          transferToCurrency,
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {transferFromCurrency !== transferToCurrency && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                  <Calculator
                    className="text-amber-500 shrink-0 mt-0.5"
                    size={20}
                  />
                  <div className="flex-1">
                    <label className="block text-sm font-bold text-amber-800 mb-1">
                      نرخی ئاڵوگۆڕ لەم کاتەدا (Rate)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="any"
                        value={transferExchangeRate}
                        onChange={(e) =>
                          setTransferExchangeRate(Number(e.target.value) || 0)
                        }
                        className="font-mono bg-white border border-amber-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-amber-500 outline-none text-left w-32 font-bold text-amber-900"
                        dir="ltr"
                      />
                      <span className="text-xs text-amber-700 font-bold">
                        1 USD = {transferExchangeRate} IQD
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-slate-600 mb-1">
                  تێبینی
                </label>
                <input
                  type="text"
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="هۆکاری گواستنەوە..."
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end relative">
              <button
                type="button"
                onClick={() => setIsTransferring(false)}
                className="px-4 py-2 text-slate-600 bg-slate-100 rounded-xl font-bold hover:bg-slate-200 transition-colors"
              >
                پاشگەزبوونەوە
              </button>
              <button
                type="submit"
                disabled={
                  !transferAmount ||
                  !transferFrom ||
                  !transferTo ||
                  transferFrom === transferTo
                }
                className="px-6 py-2 text-white bg-indigo-600 rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-lg shadow-indigo-200 flex items-center gap-2"
              >
                <ArrowRightLeft size={18} /> جێبەجێکردن
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Hawala Modal */}
      {isHawala && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center p-4 z-50 overflow-y-auto">
          <form
            onSubmit={handleHawala}
            className="bg-white rounded-[24px] w-full max-w-xl shadow-2xl p-7 relative overflow-hidden my-8"
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-amber-100 rounded-bl-full -z-10 opacity-50 pointer-events-none"></div>
            <h2 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-3">
              <Send className="text-amber-500" size={26} /> حەواڵەی کەسی
              (دەرەکی)
            </h2>
            <div className="space-y-5 mb-8 relative">
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  لە کام قاسەوە پارەکە دەڕوات؟
                </label>
                <select
                  required
                  value={hawalaSafe}
                  onChange={(e) => setHawalaSafe(e.target.value)}
                  className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-3 focus:border-amber-500 outline-none font-bold text-slate-700"
                >
                  <option value="">هەڵبژاردنی قاسە...</option>
                  {safes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (دینار:{" "}
                      {formatCurrency(s.balanceIQD || 0, "IQD").replace(
                        "IQD",
                        "",
                      )}{" "}
                      | دۆلار:{" "}
                      {formatCurrency(s.balanceUSD || 0, "USD").replace(
                        "USD",
                        "",
                      )}
                      )
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    بڕی حەواڵە
                  </label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="any"
                    value={hawalaAmount}
                    onChange={(e) => setHawalaAmount(e.target.value)}
                    className="w-full font-mono bg-white border-2 border-slate-200 rounded-xl px-4 py-3 font-bold text-right focus:border-amber-500 outline-none text-xl text-amber-700"
                    placeholder="0"
                    dir="ltr"
                  />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      کرێی حەواڵە (عمولە)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={hawalaFee}
                      onChange={(e) => setHawalaFee(e.target.value)}
                      className="w-full font-mono bg-white border-2 border-slate-200 rounded-xl px-4 py-3 font-bold text-right focus:border-amber-500 outline-none"
                      placeholder="0"
                      dir="ltr"
                    />
                  </div>
                  <div className="w-[80px]">
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      دراو
                    </label>
                    <select
                      value={hawalaCurrency}
                      onChange={(e) =>
                        setHawalaCurrency(e.target.value as "IQD" | "USD")
                      }
                      className="w-full bg-white border-2 border-slate-200 rounded-xl px-2 py-3 font-bold text-slate-700 font-mono text-center outline-none focus:border-amber-500"
                    >
                      <option value="USD">USD</option>
                      <option value="IQD">IQD</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 p-4 border border-amber-200 rounded-xl flex items-center justify-between shadow-sm">
                <span className="font-bold text-amber-800 text-sm">
                  کۆی گشتی (ئەوەی لە قاسە کەم دەبێتەوە):
                </span>
                <span
                  className="font-mono font-black text-amber-700 text-xl"
                  dir="ltr"
                >
                  {formatCurrency(
                    (Number(hawalaAmount) || 0) + (Number(hawalaFee) || 0),
                    hawalaCurrency,
                  )}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    ناوی وەرگر (کەسی حەواڵە بۆ کراو)
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
                disabled={
                  !hawalaSafe ||
                  !hawalaAmount ||
                  !hawalaReceiver ||
                  !hawalaOffice
                }
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
