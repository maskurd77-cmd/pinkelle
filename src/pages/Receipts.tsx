import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  ReceiptText,
  Printer,
  Eye,
  X,
  CheckCircle2,
  Edit,
  Trash2,
} from "lucide-react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  getDoc,
  updateDoc,
  writeBatch,
  Timestamp,
  getDocs,
  where,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { formatCurrency } from "../data";

export default function Receipts() {
  const [receipts, setReceipts] = useState<any[]>([]);
  const [debts, setDebts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);
  const [userRole, setUserRole] = useState("");
  const [isProcessingId, setIsProcessingId] = useState<string | null>(null);

  useEffect(() => {
    const unsubDebts = onSnapshot(collection(db, "debts"), (snap) => {
      setDebts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsubDebts();
  }, []);

  useEffect(() => {
    if (auth.currentUser) {
      getDoc(doc(db, "users", auth.currentUser.uid)).then((snap) => {
        if (snap.exists() && snap.data().role) setUserRole(snap.data().role);
      });
    }
  }, []);

  useEffect(() => {
    const q = query(collection(db, "receipts"), orderBy("timestamp", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setReceipts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const handleApprove = async (rec: any) => {
    if (isProcessingId) return;
    setIsProcessingId(rec.id);
    try {
      const batch = writeBatch(db);

      // Deduct stocks
      if (rec.items?.length > 0) {
        for (const item of rec.items) {
          const productSnap = await getDoc(doc(db, "products", item.productId));
          if (productSnap.exists()) {
            const currentStock = productSnap.data().stock || 0;
            batch.update(doc(db, "products", item.productId), {
              stock: currentStock - item.quantity,
            });
          }
        }
      }

      // Add debt if paymentType is 'debt'
      if (
        rec.paymentType === "debt" &&
        rec.totalAmount > 0 &&
        rec.customerName
      ) {
        const debtsSnap = await getDocs(
          query(
            collection(db, "debts"),
            where("customerName", "==", rec.customerName),
            where("status", "==", "active"),
          ),
        );
        if (!debtsSnap.empty) {
          const existingDebt = debtsSnap.docs[0];
          const dData = existingDebt.data();
          batch.update(existingDebt.ref, {
            amount: (dData.amount || 0) + rec.totalAmount,
            remainingAmount: (dData.remainingAmount || 0) + rec.totalAmount,
            updatedAt: Timestamp.now(),
          });
          batch.set(doc(collection(db, "debt_transactions")), {
            debtId: existingDebt.id,
            amount: rec.totalAmount,
            type: "add",
            timestamp: Timestamp.now(),
            notes:
              "زیادبوونی قەرز لە وەسڵی پەسەندکراوی ژمارە: " +
              rec.id.slice(-8).toUpperCase(),
          });
        } else {
          const newDebtRef = doc(collection(db, "debts"));
          batch.set(newDebtRef, {
            customerName: rec.customerName,
            phone: rec.phone || "",
            amount: rec.totalAmount,
            remainingAmount: rec.totalAmount,
            status: "active",
            notes:
              "پاشماوەی وەسڵی پەسەندکراو: " + rec.id.slice(-8).toUpperCase(),
            timestamp: Timestamp.now(),
          });
          batch.set(doc(collection(db, "debt_transactions")), {
            debtId: newDebtRef.id,
            amount: rec.totalAmount,
            type: "add",
            timestamp: Timestamp.now(),
            notes:
              "قەرزی نوێ لە وەسڵی پەسەندکراوی ژمارە: " +
              rec.id.slice(-8).toUpperCase(),
          });
        }
      }

      batch.update(doc(db, "receipts", rec.id), { status: "completed" });
      await batch.commit();
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessingId(null);
    }
  };

  const handleCancelReceipt = async () => {
    if(!selectedReceipt) return;
    const confirmInput = window.prompt("بۆ سڕینەوەی ئەم وەسڵە تکایە بنووسە 'سڕینەوە' یان 'delete'");
    if(confirmInput !== "سڕینەوە" && confirmInput !== "delete") return;

    try {
      const batch = writeBatch(db);
      
      batch.update(doc(db, "receipts", selectedReceipt.id), { status: "canceled" });

      if (selectedReceipt.items && Array.isArray(selectedReceipt.items)) {
         for (const item of selectedReceipt.items) {
             const prodId = item.productId || item.id;
             const qty = item.unitType === "carton" ? (item.quantity * (item.cartonSize || 1)) : item.quantity;
             if (prodId) {
                const pRef = doc(db, "products", prodId);
                const pSnap = await getDoc(pRef);
                if (pSnap.exists()) {
                   batch.update(pRef, { stock: (pSnap.data().stock || 0) + qty });
                }
             }
         }
      }

      if (selectedReceipt.paymentType === "debt" && selectedReceipt.customerName) {
         // Find the closest matching debt document, preferably active, or just the first match
         const dSnap = debts.find(d => d.customerName === selectedReceipt.customerName && d.status === "active") || debts.find(d => d.customerName === selectedReceipt.customerName);
         const debtAmount = selectedReceipt.finalTotal || selectedReceipt.totalAmount || selectedReceipt.total || 0;
         if (dSnap && debtAmount > 0) {
            const newRemaining = (dSnap.remainingAmount || 0) - debtAmount;
            const finalRemaining = newRemaining < 0 ? 0 : newRemaining;
            batch.update(doc(db, "debts", dSnap.id), {
               amount: (dSnap.amount || 0) - debtAmount,
               remainingAmount: finalRemaining,
               status: finalRemaining === 0 ? "paid" : "active",
               updatedAt: Timestamp.now()
            });
            const dtRef = doc(collection(db, "debt_transactions"));
            batch.set(dtRef, {
               debtId: dSnap.id,
               receiptId: selectedReceipt.id,
               type: "sub",
               amount: debtAmount,
               timestamp: Timestamp.now(),
               notes: "سڕینەوەی وەسڵی ژمارە: " + (selectedReceipt.invoiceNo || "")
            });
         }
      }

      if ((selectedReceipt.paymentType === "cash" || selectedReceipt.paymentType === "نەقد") && selectedReceipt.status !== "pending") {
         const cashAmount = selectedReceipt.finalTotal || selectedReceipt.totalAmount || selectedReceipt.total || 0;
         if (cashAmount > 0) {
            const settingsSnap = await getDoc(doc(db, "system", "settings"));
            const sData = settingsSnap.exists() ? settingsSnap.data() : {};
            const defSafe = sData.defaultSafeForDebt;
            if (defSafe) {
               const safeSnap = await getDoc(doc(db, "safes", defSafe));
               if (safeSnap.exists()) {
                  batch.update(doc(db, "safes", defSafe), { balance: (safeSnap.data().balance || 0) - cashAmount });
                  batch.set(doc(collection(db, "safe_transactions")), {
                     safeId: defSafe,
                     amount: cashAmount,
                     type: "out",
                     origin: "سڕینەوەی وەسڵی نەقد ئەژمارە: " + (selectedReceipt.invoiceNo || ""),
                     timestamp: Timestamp.now(),
                     notes: "گەڕانەوە لەبەر سڕینەوە",
                     handlerName: auth.currentUser?.email || "کاشێر"
                  });
               }
            }
         }
      }

      await batch.commit();
      alert("وەسڵەکە هەڵوەشێنرایەوە / سڕایەوە بە سەرکەوتوویی");
      setSelectedReceipt(null);
    } catch(e: any) {
      alert("هەڵە ڕوویدا: " + e.message);
    }
  };

  const [activeTab, setActiveTab] = useState<"completed" | "pending">(
    "completed",
  );

  const filtered = receipts.filter((r) => {
    if (!r) return false;
    const matchSearch =
      (r.customerName || "").includes(search) || r.id.includes(search);
    const matchTab = (r.status || "completed") === activeTab;
    return matchSearch && matchTab;
  });

  const formatDate = (ts: any) => {
    if (!ts) return "";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return (
      d.toLocaleDateString("en-GB") +
      " " +
      d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    );
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Normal View (Hidden when printing) */}
      <div className="print:hidden flex-1 bg-white rounded-[24px] border border-slate-200 shadow-sm flex flex-col overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex flex-col xl:flex-row items-start xl:items-center justify-between bg-white gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-pink-50 text-pink-600 rounded-xl flex items-center justify-center">
              <ReceiptText size={20} />
            </div>
            <h2 className="text-xl font-extrabold text-slate-800">وەسڵەکان</h2>

            <div className="flex bg-slate-100 p-1 rounded-xl mr-6">
              <button
                onClick={() => setActiveTab("completed")}
                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${activeTab === "completed" ? "bg-white text-pink-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                پسوولە پەسەندکراوەکان
              </button>
              <button
                onClick={() => setActiveTab("pending")}
                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === "pending" ? "bg-white text-orange-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                چاوەڕێکراوەکان
                {receipts.filter((r) => r.status === "pending").length > 0 && (
                  <span className="bg-orange-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full leading-none">
                    {receipts.filter((r) => r.status === "pending").length}
                  </span>
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full xl:w-auto">
            <div className="relative flex-1 sm:w-72 sm:flex-none">
              <Search
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                size={16}
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                type="text"
                placeholder="گەڕان بۆ ژمارەی وەسڵ یان کڕیار..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pr-10 pl-4 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all font-medium text-slate-800 shadow-sm"
              />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="w-full text-right border-collapse min-w-[900px]">
            <thead className="bg-slate-50/80 backdrop-blur-sm text-slate-500 text-[11px] uppercase tracking-wider sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 font-bold border-b border-slate-200">
                  ژمارەی وەسڵ
                </th>
                <th className="px-6 py-4 font-bold border-b border-slate-200">
                  کڕیار
                </th>
                <th className="px-6 py-4 font-bold border-b border-slate-200">
                  بەروار و کات
                </th>
                <th className="px-6 py-4 font-bold border-b border-slate-200">
                  بڕی کالاکان
                </th>
                <th className="px-6 py-4 font-bold border-b border-slate-200">
                  مەندوب
                </th>
                <th className="px-6 py-4 font-bold border-b border-slate-200 text-slate-800">
                  کۆی گشتی پــارە
                </th>
                <th className="px-6 py-4 font-bold border-b border-slate-200">
                  جۆری پێدان
                </th>
                <th className="px-6 py-4 font-bold border-b border-slate-200 text-center">
                  کردارەکان
                </th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-100">
              {filtered.map((rec) => (
                <tr
                  key={rec.id}
                  className="hover:bg-slate-50/50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 font-mono text-xs font-bold shadow-sm">
                      #{rec.id.slice(-6)}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-extrabold text-slate-800">
                    {rec.customerName}
                  </td>
                  <td
                    className="px-6 py-4 text-slate-500 font-medium text-xs whitespace-nowrap"
                    dir="ltr"
                  >
                    {formatDate(rec.timestamp)}
                  </td>
                  <td className="px-6 py-4 text-slate-600 font-bold whitespace-nowrap">
                    {(() => {
                      const cartonCount = rec.items?.reduce((sum: number, item: any) => {
                        if (item.unitType === 'carton') {
                          return sum + (item.originalQuantity || (item.quantity / (item.cartonSize || 1)));
                        }
                        return sum;
                      }, 0) || 0;

                      const pieceCount = rec.items?.reduce((sum: number, item: any) => {
                        if (item.unitType !== 'carton') {
                          return sum + item.quantity;
                        }
                        return sum;
                      }, 0) || 0;

                      return (
                        <div className="flex flex-col text-xs gap-0.5">
                          {cartonCount > 0 && <span className="text-pink-600 font-mono font-extrabold">{cartonCount} کارتن</span>}
                          {pieceCount > 0 && <span className="text-slate-600 font-mono font-bold">{pieceCount} دانە</span>}
                          {cartonCount === 0 && pieceCount === 0 && <span className="text-slate-400 font-mono">0 دانە</span>}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4 font-bold text-pink-700">
                    {rec.sellerName || "نەزانراو"}
                  </td>
                  <td className="px-6 py-4 font-extrabold text-slate-900 font-mono whitespace-nowrap">
                    {formatCurrency(
                      rec.totalAmount,
                      rec.invoiceCurrency || "USD",
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex px-3 py-1 rounded-lg text-xs font-bold shadow-sm ${rec.paymentType === "نەقد" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}
                    >
                      {rec.paymentType}
                    </span>
                    {rec.status === "pending" && (
                      <span className="ml-2 inline-flex px-3 py-1 rounded-lg text-xs font-bold shadow-sm bg-orange-100 text-orange-700">
                        چاوەڕێکراو
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center gap-2">
                      {rec.status === "pending" &&
                        (userRole === "admin" || userRole === "accountant") && (
                          <button
                            onClick={() => handleApprove(rec)}
                            disabled={isProcessingId === rec.id}
                            className="text-white bg-green-500 hover:bg-green-600 font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm text-xs disabled:opacity-50"
                          >
                            <CheckCircle2 size={14} /> پەسەندکردن
                          </button>
                        )}
                      <button
                        onClick={() => setSelectedReceipt(rec)}
                        className="text-pink-600 bg-pink-50 hover:bg-pink-100 hover:text-pink-700 font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm text-xs"
                      >
                        <Eye size={14} /> بینین و چاپ
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-16 text-center text-slate-500 text-sm"
                  >
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                        <ReceiptText size={40} className="text-slate-300" />
                      </div>
                      <p className="text-base font-bold text-slate-600">
                        هیچ وەسڵێک نەدۆزرایەوە
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal View for Print Preview */}
      {selectedReceipt && (
        <div className="print:hidden fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-[32px] sm:rounded-[24px] shadow-2xl max-w-4xl w-full max-h-[95dvh] sm:max-h-full overflow-hidden flex flex-col animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-pink-50 text-pink-600 rounded-xl flex items-center justify-center shrink-0">
                  <Printer size={18} className="sm:w-5 sm:h-5" />
                </div>
                <h2 className="font-extrabold text-slate-800 text-base sm:text-lg">
                  پێشبینینی چاپ
                </h2>
              </div>
              <div className="flex gap-2">
                {selectedReceipt.status !== "canceled" && (
                <button
                  onClick={() => {
                    if(!confirm("دڵنیایت دەتەوێت دەستکاری ئەم وەسڵە بکەیت؟ داتاکە دەچێتە بەشی فرۆشتن.")) return;
                    localStorage.setItem("pendingEditReceipt", JSON.stringify(selectedReceipt));
                    window.dispatchEvent(new CustomEvent("navigate", { detail: "pos" }));
                  }}
                  className="px-4 py-2.5 bg-sky-600 text-white rounded-xl flex items-center gap-2 hover:bg-sky-700 hover:shadow-lg hover:shadow-sky-500/20 font-bold text-sm transition-all"
                >
                  <Edit size={16} /> دەستکاری
                </button>
                )}
                <button
                  onClick={handlePrint}
                  className="px-5 py-2.5 bg-pink-600 text-white rounded-xl flex items-center gap-2 hover:bg-pink-700 hover:shadow-lg hover:shadow-pink-500/20 font-bold text-sm transition-all"
                >
                  <Printer size={16} /> چاپکردن
                </button>
                {selectedReceipt.status !== "canceled" && (
                <button
                  onClick={handleCancelReceipt}
                  className="px-5 py-2.5 bg-red-600 text-white rounded-xl flex items-center gap-2 hover:bg-red-700 hover:shadow-lg hover:shadow-red-500/20 font-bold text-sm transition-all"
                >
                  <Trash2 size={16} /> سڕینەوە
                </button>
                )}
                <button
                  onClick={() => setSelectedReceipt(null)}
                  className="w-10 h-10 flex items-center justify-center text-slate-400 bg-slate-100 hover:bg-slate-200 hover:text-slate-600 rounded-xl transition-all"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-slate-100/50 p-4 sm:p-8 flex items-start justify-center custom-scrollbar pb-[max(calc(env(safe-area-inset-bottom)+1rem),1rem)] sm:pb-8">
              {/* A4 Paper Scaled Down slightly for preview */}
              <div className="bg-white shadow-lg w-[210mm] h-[297mm] p-0 relative">
                <ReceiptPrintLayout receipt={selectedReceipt} debts={debts} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Actual Print Layout (Only visible during print) */}
      <div className="hidden print:block w-full">
        {selectedReceipt && <ReceiptPrintLayout receipt={selectedReceipt} debts={debts} />}
      </div>
    </div>
  );
}

export function ReceiptPrintLayout({ receipt, debts = [] }: { receipt: any; debts?: any[] }) {
  const ts = receipt.timestamp?.toDate
    ? receipt.timestamp.toDate()
    : new Date();

  const customerDebt = debts.find(
    (d) => d.customerName === receipt.customerName && d.status === "active"
  );
  let prevDebt = 0;
  let overallDebt = 0;
  if (customerDebt) {
    const currentIsDebt = receipt.paymentType === "قەرز" || receipt.paymentType === "debt";
    const addedAmount = currentIsDebt ? (receipt.totalAmount || receipt.total || 0) : 0;
    
    if (receipt.status === 'pending') {
       prevDebt = customerDebt.remainingAmount || 0;
       overallDebt = prevDebt + addedAmount;
    } else {
       overallDebt = customerDebt.remainingAmount || 0;
       prevDebt = Math.max(0, overallDebt - addedAmount);
    }
  }

  const hasDebtRows = !!customerDebt && overallDebt > 0;
  const targetTotalRows = hasDebtRows ? 10 : 12;
  const emptyRowsToRender = Math.max(0, targetTotalRows - (receipt.items?.length || 0));

  return (
    <div
      className="w-[210mm] h-[297mm] max-h-[297mm] overflow-hidden bg-white text-black p-[7mm] mx-auto box-border flex flex-col relative receipt-print-area"
      dir="rtl"
      style={{ fontFamily: "'Rudaw', Tahoma, 'Noto Sans Arabic', Arial, sans-serif" }}
    >
      <style type="text/css" media="print">
        {`
          @page { 
            size: A4 portrait;
            margin: 0;
          }
          body {
            margin: 0;
            padding: 0;
            background: white;
          }
          .receipt-print-area, .receipt-print-area * {
            font-family: 'Rudaw', 'Noto Sans Arabic', Tahoma, Arial, sans-serif !important;
          }
        `}
      </style>
      {/* Top Header - Compact Row Layout */}
      <div className="flex justify-between items-center mb-2 border-b-[3px] border-black pb-2 relative">
        {/* Right Side - Logo */}
        <div className="flex items-center justify-center shrink-0 w-24 h-24">
          <img
            src="https://cheerful-pink-qakkchpr.edgeone.app/Pink%20Elle%20logo%20new-1_page-0001.jpg"
            alt="Pink Elle Logo"
            className="w-full h-full object-contain drop-shadow-sm"
          />
        </div>

        {/* Center - Company Info */}
        <div className="flex-1 text-center px-4">
          <h1
            className="text-3xl font-extrabold text-pink-600 tracking-wider mb-0.5 flex items-center justify-center gap-1.5"
          >
            <span className="text-black font-extrabold text-2xl">گروپی</span>
            <span className="font-sans">PINK ELLE</span>
          </h1>
          <h4 className="text-[11px] font-black text-slate-800 leading-tight">
            بۆ بازرگانی گشتی - سنووردار
          </h4>
        </div>

        {/* Left Side - Contacts */}
        <div className="shrink-0 text-right flex flex-col gap-1">
          <div className="bg-slate-50 border-2 border-black rounded p-1.5 shadow-sm text-[13px] font-bold w-52">
            <div className="text-center text-[10px] mb-1 border-b border-black/20 pb-0.5">
              ژمارەی کۆمپانیا
            </div>
            <div className="flex justify-around items-center" dir="ltr">
              <span>0751 201 8372</span>
              <span className="text-pink-600">-</span>
              <span>0750 425 1338</span>
            </div>
          </div>
        </div>
      </div>

      {/* Address Bar */}
      <div className="text-center font-extrabold text-sm mb-2 bg-gray-100 py-1 border border-black rounded">
        سۆران - شۆڕش - بەرامبەر مزگەوتی شۆڕش{" "}
        <span className="text-pink-600 text-[14px]">📍</span>
      </div>

      {/* Info Boxes Header */}
      <div className="flex justify-between items-start mb-2 gap-2 text-[11px]">
        {/* Left Side Info */}
        <div className="flex-1 flex flex-col gap-1">
          <div className="flex items-end">
            <div className="w-36 text-right font-bold ml-2 flex flex-col justify-between items-start">
              <span>ژمارەی پسووڵە :</span>
              <span className="text-[10px] text-gray-600 font-normal">رقم القائمة</span>
            </div>
            <div className="border-b-2 border-slate-800 border-dotted flex-1 text-center font-bold font-mono text-sm leading-none pb-0.5">
              {receipt.invoiceNo || receipt.id?.slice(-8).toUpperCase() || "N/A"}
            </div>
          </div>
          <div className="flex items-end">
            <div className="w-36 text-right font-bold ml-2 flex flex-col justify-between items-start">
              <span>بەروار :</span>
              <span className="text-[10px] text-gray-600 font-normal">التاريخ</span>
            </div>
            <div className="border-b-2 border-slate-800 border-dotted flex-1 text-center font-bold font-mono text-sm leading-none pb-0.5">
              {ts.getFullYear()}/{String(ts.getMonth() + 1).padStart(2, "0")}/
              {String(ts.getDate()).padStart(2, "0")}
            </div>
          </div>
          <div className="flex items-end">
            <div className="w-36 text-right font-bold ml-2 flex flex-col justify-between items-start">
              <span>جۆری پێدان :</span>
              <span className="text-[10px] text-gray-600 font-normal">طريقة الدفع</span>
            </div>
            <div className="border-b-2 border-slate-800 border-dotted flex-1 text-center font-bold text-xs leading-none pb-0.5">
              {receipt.paymentType === "cash" || receipt.paymentType === "نەقد" ? "نەقد (نقدي)" : "قەرز (آجل)"}
            </div>
          </div>
          <div className="flex items-end">
            <div className="w-36 text-right font-bold ml-2 flex flex-col justify-between items-start">
               <span>مەندوب :</span>
              <span className="text-[10px] text-gray-600 font-normal">المندوب</span>
            </div>
            <div className="border-b-2 border-slate-800 border-dotted flex-1 px-2 font-bold text-sm text-center leading-none pb-0.5">
              {receipt.sellerName || "نەزانراو"}
            </div>
          </div>
        </div>

        {/* Center Title */}
        <div className="w-28 flex items-center justify-center font-black text-lg italic mt-1 border-b-4 border-double border-pink-600 pb-0.5">
          پسووڵەی فرۆش
        </div>

        {/* Right Side Info */}
        <div className="flex-1 flex flex-col gap-1">
          <div className="flex items-end">
            <div className="w-32 text-right font-bold ml-2 flex flex-col justify-between items-start">
              <span>کڕیار :</span>
              <span className="text-[10px] text-gray-600 font-normal">اسم المشتري</span>
            </div>
            <div className="border-b-2 border-slate-800 border-dotted flex-1 px-2 font-bold text-sm text-center leading-none pb-0.5">
              {receipt.customerName}
            </div>
          </div>
          <div className="flex items-end">
            <div className="w-32 text-right font-bold ml-2 flex flex-col justify-between items-start">
              <span>ناونیشان :</span>
              <span className="text-[10px] text-gray-600 font-normal">العنوان</span>
            </div>
            <div className="border-b-2 border-slate-800 border-dotted flex-1 px-2 font-bold text-sm text-center leading-none pb-0.5">
              {receipt.address || "..."}
            </div>
          </div>
          <div className="flex items-end">
            <div className="w-32 text-right font-bold ml-2 flex flex-col justify-between items-start">
              <span>مۆبایل :</span>
              <span className="text-[10px] text-gray-600 font-normal">رقم الموبايل</span>
            </div>
            <div
              className="border-b-2 border-slate-800 border-dotted flex-1 px-2 font-bold font-mono text-sm text-center leading-none pb-0.5"
              dir="ltr"
            >
              {receipt.phone || "..."}
            </div>
          </div>
        </div>
      </div>

      {/* Items Table - Strict structure */}
      <div className="mt-1 text-xs">
        <table className="w-full border-collapse border-2 border-black text-center font-bold">
          <thead>
            <tr className="bg-gray-100 border-b-2 border-black">
              <th className="border-l border-black px-1 py-1 w-8">ت</th>
              <th className="border-l border-black px-2 py-1 flex-1 min-w-[200px] text-right">
                <div className="flex justify-between items-center">
                  <span>ناوی ماددە</span>
                  <span className="text-[10px] text-gray-600 font-normal">اسم المادة</span>
                </div>
              </th>
              <th className="border-l border-black px-1 py-1 w-12">
                <div className="flex flex-col items-center">
                  <span>بڕ</span>
                  <span className="text-[9px] text-gray-600 font-normal">الكمية</span>
                </div>
              </th>
              <th className="border-l border-black px-1 py-1 w-14">
                <div className="flex flex-col items-center">
                  <span>یەکە</span>
                  <span className="text-[9px] text-gray-600 font-normal">الوحدة</span>
                </div>
              </th>
              <th className="border-l border-black px-1 py-1 w-20">
                <div className="flex flex-col items-center">
                  <span>نرخ</span>
                  <span className="text-[9px] text-gray-600 font-normal">السعر</span>
                </div>
              </th>
              <th className="border-l border-black px-1 py-1 w-18">
                <div className="flex flex-col items-center">
                  <span>نرخی دانە</span>
                  <span className="text-[9px] text-gray-600 font-normal">سعر م</span>
                </div>
              </th>
              <th className="border-l border-black px-1 py-1 w-16">
                <div className="flex flex-col items-center">
                  <span>داشکاندن</span>
                  <span className="text-[9px] text-gray-600 font-normal">الخصم</span>
                </div>
              </th>
              <th className="px-1 py-1 w-24">
                <div className="flex flex-col items-center">
                  <span>کۆی گشتی</span>
                  <span className="text-[9px] text-gray-600 font-normal">المجموع</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Render real rows */}
            {receipt.items?.map((item: any, i: number) => {
              const itemCurrency = "USD";
              // Calculate discount if any
              const isDiscounted =
                item.originalUnitPrice &&
                item.originalUnitPrice > item.unitPrice;
              let diff = 0;
              if (
                item.originalUnitPrice &&
                item.originalUnitPrice > 0 &&
                isDiscounted
              ) {
                diff =
                  (item.originalUnitPrice - item.unitPrice) * item.quantity;
              }

              const isCarton = item.unitType === 'carton';
              const displayQty = isCarton ? (item.originalQuantity || item.quantity) : item.quantity;
              const displayUnit = isCarton ? `${item.cartonSize || 1} دانە` : 'دانە';
              
              // unitPriceObj is the base price per single piece (as inputted or default)
              const basePiecePrice = item.originalUnitPrice || item.unitPrice;
              
              // The main price column ("نرخ") shows the carton price if carton, otherwise individual piece price
              const mainPrice = isCarton ? (basePiecePrice * (item.cartonSize || 1)) : basePiecePrice;
              
              // The single piece price column ("نرخی دانە") shows the single piece price in all cases
              const piecePriceFormatted = formatCurrency(basePiecePrice, itemCurrency).replace(itemCurrency, "");

              return (
                <tr key={i} className="border-b border-black">
                  <td className="border-l border-black p-1">{i + 1}</td>
                  <td className="border-l border-black p-1 text-right font-bold pr-2">
                    {item.name} {item.isWholesale ? "(جوملە)" : ""}
                  </td>
                  <td className="border-l border-black p-1 font-mono text-sm leading-tight align-middle text-center">
                    {displayQty}
                  </td>
                  <td className="border-l border-black p-1 text-xs leading-tight text-center">
                    <span className="font-bold">{displayUnit}</span>
                  </td>
                  <td className="border-l border-black p-1 font-mono text-sm leading-tight align-middle text-center">
                    <div>
                      {formatCurrency(mainPrice, itemCurrency).replace(itemCurrency, "")}
                    </div>
                  </td>
                  <td className="border-l border-black p-1 font-mono text-sm leading-tight align-middle text-center text-slate-800">
                    {piecePriceFormatted}
                  </td>
                  <td className="border-l border-black p-1 font-mono text-sm text-red-600 leading-none">
                    {diff > 0 ? diff.toLocaleString() : "0"}
                  </td>
                  <td className="p-1 font-mono text-sm leading-none">
                    {formatCurrency(
                      item.unitPrice * item.quantity,
                      itemCurrency,
                    ).replace(itemCurrency, "")}
                  </td>
                </tr>
              );
            })}
            {/* Fill empty rows to make table look complete */}
            {Array.from({
              length: emptyRowsToRender,
            }).map((_, i) => (
              <tr
                key={`empty-${i}`}
                className="border-b border-black text-transparent"
              >
                <td className="border-l border-black p-1">.</td>
                <td className="border-l border-black p-1">.</td>
                <td className="border-l border-black p-1">.</td>
                <td className="border-l border-black p-1">.</td>
                <td className="border-l border-black p-1">.</td>
                <td className="border-l border-black p-1">.</td>
                <td className="border-l border-black p-1">.</td>
                <td className="p-1">.</td>
              </tr>
            ))}
            <tr className="border-t-2 border-black">
              <td
                colSpan={4}
                className="border-l border-black p-1.5 pr-2 text-[10px] text-gray-500 font-bold tracking-wide flex-col items-start text-right"
              >
                <div>هیچ کاڵایەکی بەسەرچوو وەرناگیرێتەوە</div>
                <div className="font-normal text-[9px] mt-0.5">البضاعة التالفة لا ترد ولا تستبدل</div>
              </td>
              <td
                colSpan={3}
                className="border-l border-black p-1.5 text-center font-bold bg-gray-100"
              >
                <div className="leading-tight">
                  کۆی گشتی <span className="font-normal text-slate-500">({receipt.invoiceCurrency === "USD" ? "دۆلار $" : "د.ع"})</span>
                  <div className="text-[9px] text-gray-600 font-normal">مجموع القائمة</div>
                </div>
              </td>
              <td className="p-1.5 font-bold bg-pink-50 text-base font-mono">
                {formatCurrency(
                  receipt.totalAmount || receipt.total || 0,
                )}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Summary section */}
        <div className="flex gap-2 mt-2 text-xs font-bold w-full">
          {/* Notes */}
          <div className="flex-1 border-2 border-black bg-slate-50 p-2 rounded text-right min-h-[50px]">
            <div className="border-b border-black/20 pb-0.5 mb-1 text-[11px] flex gap-2">
              <span>تێبینی پسووڵە:</span>
              <span className="text-[10px] text-gray-500 font-normal">ملاحظات</span>
            </div>
            <p className="font-bold text-xs text-slate-705">
              {receipt.notes || "..."}
            </p>
          </div>

          {/* Totals */}
          <div className="w-[90mm]">
            <table className="w-full border-collapse border-2 border-black text-center text-[11px]">
              <tbody>
                <tr>
                  <td className="border border-black p-1 w-28 font-mono text-xs leading-none">
                    {receipt.paymentType === "نەقد"
                      ? formatCurrency(
                          receipt.totalAmount || receipt.total || 0,
                        )
                      : "0"}
                  </td>
                  <td className="border border-black p-1 bg-gray-100">
                    <div className="flex justify-between items-center px-1">
                      <span>بڕی دراو</span>
                      <span className="text-[9px] text-gray-500 font-normal">الواصل</span>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td className="border border-black p-1 w-28 font-mono text-xs text-red-600 leading-none">
                    {receipt.paymentType === "قەرز"
                      ? formatCurrency(
                          receipt.totalAmount || receipt.total || 0,
                        )
                      : "0"}
                  </td>
                  <td className="border border-black p-1 bg-gray-100">
                    <div className="flex justify-between items-center px-1">
                      <span>بڕی ماوە</span>
                      <span className="text-[9px] text-gray-500 font-normal">المتبقي</span>
                    </div>
                  </td>
                </tr>
                {(receipt.discount || receipt.discountAmount) > 0 && (
                  <>
                    <tr>
                      <td className="border border-black p-1 w-28 font-mono text-xs text-gray-600 leading-none">
                        {formatCurrency(
                          receipt.subtotal || 0,
                        )}
                      </td>
                      <td className="border border-black p-1 bg-gray-100">
                        <div className="flex justify-between items-center px-1">
                          <span>بڕی بێ داشکاندن</span>
                          <span className="text-[9px] text-gray-500 font-normal">الإجمالي</span>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-black p-1 w-28 font-mono text-xs text-red-600 leading-none">
                        {formatCurrency(
                          receipt.discount || receipt.discountAmount || 0,
                        )}
                      </td>
                      <td className="border border-black p-1 bg-gray-100">
                        <div className="flex justify-between items-center px-1">
                          <span>داشکاندن</span>
                          <span className="text-[9px] text-gray-500 font-normal">الخصم</span>
                        </div>
                      </td>
                    </tr>
                  </>
                )}
                <tr>
                  <td className="border border-black p-1 w-28 font-mono text-sm font-black bg-pink-50 leading-none">
                    {formatCurrency(
                      receipt.totalAmount || receipt.total || 0,
                    )}
                  </td>
                  <td className="border border-black p-1 bg-pink-100 text-sm font-black">
                    <div className="flex justify-between items-center px-1">
                      <span>کۆی گشتی</span>
                      <span className="text-[9px] text-pink-700 font-normal">المجموع</span>
                    </div>
                  </td>
                </tr>
                {customerDebt && overallDebt > 0 && (
                  <>
                    <tr>
                      <td className="border border-black p-1 w-28 font-mono text-xs text-cyan-800 bg-cyan-50/40 leading-none">
                        {formatCurrency(prevDebt)}
                      </td>
                      <td className="border border-black p-1 bg-slate-50 text-slate-800 font-bold">
                        <div className="flex justify-between items-center px-1">
                          <span>کۆی قەرزی پێشوو</span>
                          <span className="text-[9px] text-gray-600 font-normal">الديون السابقة</span>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-black p-1 w-28 font-mono text-xs text-pink-700 bg-pink-50/30 leading-none">
                        {formatCurrency(overallDebt)}
                      </td>
                      <td className="border border-black p-1 bg-pink-50 text-pink-950 font-black">
                        <div className="flex justify-between items-center px-1 text-xs">
                          <span>قەرزی ماوەی کڕیار</span>
                          <span className="text-[9px] text-pink-700/70 font-normal">إجمالي الدين المتبقي</span>
                        </div>
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Signatures Section */}
      <div className="flex justify-between items-center px-16 mt-auto mb-1 text-[11px] font-bold text-slate-800">
        <div className="text-center flex flex-col items-center">
          <div className="mb-4">مۆر و ئیمزای وەرگر</div>
          <div className="w-28 border-b-2 border-slate-400"></div>
        </div>
        <div className="text-center flex flex-col items-center">
          <div className="mb-4">مۆر و ئیمزای کۆمپانیا</div>
          <div className="w-28 border-b-2 border-slate-400"></div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-4 pt-1 border-t border-black text-center flex justify-between text-[10px] text-gray-500 font-bold items-end">
        <div className="flex items-center gap-1.5 direction-rtl" dir="rtl">
          <span>کاتی چاپکردن:</span>
          <span className="font-mono pt-[1px]" dir="ltr">
            {new Date().toLocaleString("en-US", { hour12: true })}
          </span>
        </div>
        <div>
          سیستەمی حساباتی PINK ELLE <br />{" "}
          <span className="font-sans text-[8px] tracking-wider text-pink-500">
            Powered by Masmenu
          </span>
        </div>
        <div>
          کۆی ئایتمەکان:{" "}
          {receipt.totalItems ||
            receipt.items?.reduce((a: any, b: any) => a + b.quantity, 0) ||
            0}
        </div>
      </div>
    </div>
  );
}
