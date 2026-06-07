import React, { useState, useEffect } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  writeBatch,
  Timestamp,
  getDocs,
} from "firebase/firestore";
import { db } from "../firebase";
import { formatCurrency } from "../data";
import {
  Search,
  FileClock,
  Printer,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  ScrollText,
  Edit,
} from "lucide-react";

import { DebtReceiptModal } from "../components/DebtReceiptModal";
import AccountStatementModal from "../components/AccountStatementModal";

export default function DebtPayments({ userRole, userName }: any) {
  const [debts, setDebts] = useState<any[]>([]);
  const [selectedDebt, setSelectedDebt] = useState<any | null>(null);
  const [debtHistory, setDebtHistory] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [paymentReduction, setPaymentReduction] = useState("");
  const [safes, setSafes] = useState<any[]>([]);
  const [selectedSafeId, setSelectedSafeId] = useState("");
  const [settings, setSettings] = useState<any>({});
  
  const [printTx, setPrintTx] = useState<any>(null);
  const [statementCustomer, setStatementCustomer] = useState<any>(null);
  
  const [editingTx, setEditingTx] = useState<any>(null);
  const [editPaymentAmount, setEditPaymentAmount] = useState("");
  const [editPaymentReduction, setEditPaymentReduction] = useState("");
  const [editPaymentNote, setEditPaymentNote] = useState("");

  const handleOpenEditTx = (tx: any) => {
    setEditingTx(tx);
    setEditPaymentAmount(tx.amount?.toString() || "");
    setEditPaymentReduction(tx.reductionAmount?.toString() || "");
    setEditPaymentNote(tx.notes || "");
  };

  const handleSaveEditTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx || !selectedDebt) return;
    try {
      const newAmount = parseFloat(editPaymentAmount) || 0;
      const newReduction = parseFloat(editPaymentReduction) || 0;
      const oldAmount = editingTx.amount || 0;
      const oldReduction = editingTx.reductionAmount || 0;
      
      const amountDiff = newAmount - oldAmount;
      const reductionDiff = newReduction - oldReduction;
      
      const batch = writeBatch(db);
      
      batch.update(doc(db, "debt_transactions", editingTx.id), {
        amount: newAmount,
        reductionAmount: newReduction,
        notes: editPaymentNote,
        updatedAt: Timestamp.now()
      });
      
      batch.update(doc(db, "debts", selectedDebt.id), {
         remainingAmount: (selectedDebt.remainingAmount || 0) - amountDiff - reductionDiff,
         updatedAt: Timestamp.now(),
      });
      
      if (editingTx.syncedToSafe && editingTx.safeId && amountDiff !== 0) {
         const safeSnap = safes.find(s => s.id === editingTx.safeId);
         if (safeSnap) {
            batch.update(doc(db, "safes", editingTx.safeId), {
               balance: (safeSnap.balance || 0) + amountDiff
            });
            batch.set(doc(collection(db, "safe_transactions")), {
               safeId: editingTx.safeId,
               amount: Math.abs(amountDiff),
               type: amountDiff > 0 ? "in" : "out",
               origin: "دەستکاری کردنی وەرگرتنی قەرز",
               timestamp: Timestamp.now(),
               notes: "جیاوازی دەستکاری پێشوو",
            });
         }
      }
      
      await batch.commit();
      setEditingTx(null);
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  useEffect(() => {
    // defaults from settings
    const unsubSystem = onSnapshot(doc(db, "system", "settings"), (snap) => {
      const data = snap.data();
      if (data) {
        setSettings(data);
        if (data.defaultSafeForDebt) {
          setSelectedSafeId(data.defaultSafeForDebt);
        }
      }
    });
    const unsubSafes = onSnapshot(collection(db, "safes"), (snap) => {
      const allSafes = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setSafes(allSafes);
      if (!selectedSafeId && allSafes.length > 0) {
        setSelectedSafeId(allSafes[0].id);
      }
    });
    return () => { unsubSystem(); unsubSafes(); };
  }, []);

  useEffect(() => {
    const q = query(collection(db, "debts"), orderBy("timestamp", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setDebts(data);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!selectedDebt) {
      setDebtHistory([]);
      return;
    }
    const q = query(
      collection(db, "debt_transactions"),
      orderBy("timestamp", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const txs = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((d: any) => d.debtId === selectedDebt.id && d.status !== "pending");
      setDebtHistory(txs);
      
      const latestDebtInList = debts.find(d => d.id === selectedDebt.id);
      if (latestDebtInList) setSelectedDebt(latestDebtInList);
    });
    return () => unsub();
  }, [selectedDebt?.id, debts]);

  const filteredDebts = debts.filter(
    (d) =>
      !!d.customerName &&
      d.customerName.includes(search)
  );

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDebt || !paymentAmount) return;

    const amount = parseFloat(paymentAmount) || 0;
    const reduction = parseFloat(paymentReduction) || 0;
    
    if (amount <= 0 && reduction <= 0) return;
    
    if (!selectedSafeId && safes.length > 0 && amount > 0) {
       alert("تکایە قاسەیەک دیاری بکە بۆ پارە وەرگرتن");
       return;
    }

    try {
      const batch = writeBatch(db);
      
      let safeIdToUse = "";
      let requireApproval = true;
      if (userRole === "admin" || userRole === "accountant") {
         requireApproval = false;
         safeIdToUse = selectedSafeId || safes[0]?.id || "";
      } else {
         safeIdToUse = safes[0]?.id || ""; 
      }

      const txRef = doc(collection(db, "debt_transactions"));
      batch.set(txRef, {
        debtId: selectedDebt.id,
        amount: amount,
        reductionAmount: reduction,
        type: "pay",
        timestamp: Timestamp.now(),
        notes: paymentNote || (amount > 0 ? "پارە وەرگرتن" : "لێخۆشبوونی قەرز"),
        handlerName: userName,
        status: requireApproval ? "pending" : "completed",
        safeId: safeIdToUse,
        syncedToSafe: !requireApproval,
        customerName: selectedDebt.customerName,
      });

      if (!requireApproval) {
        batch.update(doc(db, "debts", selectedDebt.id), {
          remainingAmount: (selectedDebt.remainingAmount || 0) - amount - reduction,
          updatedAt: Timestamp.now(),
        });

        if (safeIdToUse && amount > 0) {
           const safeSnap = safes.find(s => s.id === safeIdToUse);
           if (safeSnap) {
              batch.update(doc(db, "safes", safeIdToUse), {
                 balance: (safeSnap.balance || 0) + amount
              });
              batch.set(doc(collection(db, "safe_transactions")), {
                 safeId: safeIdToUse,
                 amount: amount,
                 type: "in",
                 origin: "پارە وەرگرتنی قەرز",
                 timestamp: Timestamp.now(),
                 notes: "وەرگرتنی قەرز لە " + selectedDebt.customerName,
              });
           }
        }
      }

      await batch.commit();
      setPaymentAmount("");
      setPaymentNote("");
      setPaymentReduction("");
      alert(requireApproval ? "مامەڵەکە نێردرا بۆ پەسەندکردن." : "سەرکەوتوو بوو.");
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  const handlePrintParams = (tx: any) => {
    setPrintTx(tx);
  };
  
  const handlePrintStatement = () => {
    setStatementCustomer(selectedDebt);
  };

  if (!selectedDebt) {
    return (
      <div className="h-[calc(100vh-8rem)] flex flex-col gap-6 p-4">
        <div className="flex flex-col sm:flex-row bg-gradient-to-r from-sky-600 to-indigo-700 rounded-[24px] shadow-lg shadow-indigo-500/20 p-6 items-start sm:items-center justify-between gap-4 text-white">
           <div>
              <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2 mb-1">
                <ScrollText className="text-sky-200" size={28} /> دیوانی کەشف حساب
              </h2>
              <p className="text-sky-100/80 text-xs sm:text-sm font-medium">سەرجەم کڕیارە قەرزدارەکان و مێژووی وەرگرتنەوەی پێشینەکانیان</p>
           </div>
           <div className="w-full sm:w-1/3">
              <div className="relative">
                <Search
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-sky-200"
                  size={18}
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  type="text"
                  placeholder="گەڕان بۆ کڕیار بە ناو..."
                  className="w-full bg-white/10 border border-white/20 rounded-xl py-2.5 pr-10 pl-4 text-sm focus:outline-none focus:ring-2 focus:ring-white/40 focus:border-white transition-all font-medium text-white placeholder:text-sky-200/60"
                />
              </div>
           </div>
        </div>
        <div className="flex-1 overflow-auto custom-scrollbar pt-2 px-1">
           <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
              {filteredDebts.map((d) => (
                 <button
                   key={d.id}
                   onClick={() => setSelectedDebt(d)}
                   className="flex flex-col items-start p-6 bg-white hover:bg-sky-50 shadow-sm border border-slate-200 hover:border-sky-300 rounded-[20px] hover:shadow-md hover:shadow-sky-500/10 transition-all duration-300 text-right group relative overflow-hidden"
                 >
                    <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-l from-sky-400 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="flex justify-between w-full mb-4">
                       <div className="w-12 h-12 bg-slate-100 group-hover:bg-sky-100 rounded-full flex items-center justify-center text-slate-500 group-hover:text-sky-600 transition-colors">
                          <ScrollText size={24} />
                       </div>
                       <ChevronRight className="text-slate-300 group-hover:text-sky-500 transition-colors" />
                    </div>
                    <h3 className="font-bold text-slate-800 text-lg mb-1 group-hover:text-sky-800 truncate w-full">{d.customerName}</h3>
                    {d.phone && <p className="text-sm text-slate-500 mb-4">{d.phone}</p>}
                    <div className="mt-auto pt-4 border-t border-slate-100 w-full flex justify-between items-center bg-slate-50/50 -mx-6 px-6 -mb-6 pb-6 rounded-b-[20px] group-hover:bg-sky-50/50">
                       <span className="text-xs font-bold text-slate-500">قەرزی ماوە:</span>
                       <span className="font-mono font-black text-rose-600/90 text-lg">{formatCurrency(d.remainingAmount || 0)}</span>
                    </div>
                 </button>
              ))}
              {filteredDebts.length === 0 && (
                <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-400">
                   <ScrollText size={64} className="opacity-20 mb-4" />
                   <h3 className="text-xl font-bold">هیچ کڕیارێک نەدۆزرایەوە</h3>
                </div>
              )}
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col lg:flex-row gap-6 p-4 overflow-y-auto custom-scrollbar">
       <div className="w-full lg:w-1/3 flex flex-col gap-6 shrink-0 lg:sticky lg:top-0 h-fit">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-[28px] shadow-lg shadow-slate-900/20 p-8 relative overflow-hidden text-white">
             <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl"></div>
             <button onClick={() => setSelectedDebt(null)} className="absolute top-6 left-6 p-2 text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors backdrop-blur-sm">
                <ChevronRight size={20} />
             </button>
             <h2 className="text-2xl font-black text-white mb-2 ml-12">{selectedDebt.customerName}</h2>
             {selectedDebt.phone && <p className="text-sky-200/80 font-medium">{selectedDebt.phone}</p>}
             <div className="mt-8 p-6 bg-white/5 rounded-[20px] border border-white/10 flex flex-col backdrop-blur-sm">
                <span className="text-sm font-medium text-slate-300 mb-2">کۆی قەرزی ماوە</span>
                <span className="text-4xl font-black font-mono text-white tracking-tight">{formatCurrency(selectedDebt.remainingAmount || 0)}</span>
             </div>
          </div>

          <form onSubmit={handlePay} className="bg-white rounded-[28px] border border-slate-200 shadow-sm shadow-slate-200/50 p-6 sm:p-8 flex flex-col flex-1 relative overflow-hidden">
             <div className="absolute -right-6 -top-6 text-emerald-50 opacity-50">
               <TrendingDown size={120} strokeWidth={4} />
             </div>
             <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2 relative z-10">
                <span className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                  <TrendingDown size={18} strokeWidth={3} />
                </span>
                وەرگرتنی پێشینە
             </h3>
             <div className="space-y-5 relative z-10">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-600 mb-2">بڕی پارەی دراو ($)</label>
                    <input
                      type="number"
                      required
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 focus:outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 font-mono text-xl text-left font-bold text-slate-800 transition-all hover:bg-white"
                      placeholder="0.00"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-600 mb-2">لێخۆشبوون (داشکاندن)</label>
                    <input
                      type="number"
                      value={paymentReduction}
                      onChange={(e) => setPaymentReduction(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 focus:outline-none focus:border-rose-400 focus:ring-4 focus:ring-rose-500/10 font-mono text-xl text-left font-bold text-rose-600 transition-all hover:bg-white"
                      placeholder="0.00"
                      step="0.01"
                    />
                  </div>
                </div>
                {(userRole === "admin" || userRole === "accountant") && (
                   <div>
                      <label className="block text-sm font-bold text-slate-600 mb-2">وەردەگیرێت بۆ قاسەی</label>
                      <select
                        value={selectedSafeId}
                        onChange={(e) => setSelectedSafeId(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 focus:outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 transition-all text-slate-800 font-bold"
                      >
                        {safes.map((s: any) => (
                           <option key={s.id} value={s.id}>{s.name} ({formatCurrency(s.balance||0, "USD")})</option>
                        ))}
                      </select>
                   </div>
                )}
                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-2">ڕوون کردنەوە / تێبینی</label>
                  <input
                    type="text"
                    value={paymentNote}
                    onChange={(e) => setPaymentNote(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 focus:outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 transition-all text-slate-800 hover:bg-white"
                    placeholder="هەر تێبینییەکت هەیە بیپێچەرەوە..."
                  />
                </div>
                <button type="submit" className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-lg shadow-lg shadow-emerald-500/25 transition-all mt-6 active:scale-[0.98]">
                   تۆمارکردن لە قاسە
                </button>
             </div>
          </form>
       </div>

       <div className="w-full lg:w-2/3 bg-white rounded-[28px] border border-slate-200 shadow-sm flex flex-col overflow-hidden shrink-0 min-h-[600px] lg:h-full">
          <div className="p-6 md:p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
             <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                <div className="w-10 h-10 bg-sky-100 rounded-xl flex items-center justify-center text-sky-600 shadow-inner">
                  <FileClock size={22} />
                </div>
                مێژووی کەشف حساب
             </h3>
             <button onClick={handlePrintStatement} className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 rounded-xl font-bold text-sm text-slate-700 hover:bg-slate-50 hover:text-sky-700 transition-colors shadow-sm hover:border-sky-200">
                <Printer size={18} /> چاپکردنی کەشف
             </button>
          </div>
          <div className="flex-1 overflow-auto p-0 custom-scrollbar bg-slate-50/20">
             <div className="hidden md:block min-w-[800px]">
               <table className="w-full text-right border-collapse">
                  <thead className="bg-slate-50/90 backdrop-blur-md sticky top-0 z-10 box-border">
                    <tr>
                      <th className="px-8 py-5 text-xs font-bold uppercase text-slate-400 tracking-wider">بەروار</th>
                      <th className="px-8 py-5 text-xs font-bold uppercase text-slate-400 tracking-wider">چۆنیەتی</th>
                      <th className="px-8 py-5 text-xs font-bold uppercase text-slate-400 tracking-wider">بڕی پارە</th>
                      <th className="px-8 py-5 text-xs font-bold uppercase text-slate-400 tracking-wider">تێبینییەکان</th>
                      <th className="px-8 py-5 text-xs font-bold uppercase text-slate-400 tracking-wider w-16 text-center">وەسڵ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {debtHistory.map((h) => (
                      <tr key={h.id} className="hover:bg-sky-50/30 transition-colors group">
                        <td className="px-8 py-6">
                           <div className="text-sm font-bold text-slate-700 whitespace-nowrap mb-1">
                              {h.timestamp?.toDate().toLocaleDateString("en-GB")}
                           </div>
                           <div className="text-xs font-medium text-slate-400">
                              {h.timestamp?.toDate().toLocaleTimeString("en-US", {hour: '2-digit', minute:'2-digit'})}
                           </div>
                        </td>
                        <td className="px-8 py-6">
                           {h.type === "pay" ? (
                               <span className="inline-flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg text-xs font-bold border border-emerald-100 shadow-sm"><TrendingDown size={14}/> پارەی دراو</span>
                           ) : (
                               <span className="inline-flex items-center gap-1.5 text-rose-700 bg-rose-50 px-3 py-1.5 rounded-lg text-xs font-bold border border-rose-100 shadow-sm"><TrendingUp size={14}/> قەرزی نوێ</span>
                           )}
                        </td>
                        <td className="px-8 py-6">
                            <span className={`font-mono font-black text-base ${h.type === "pay" ? "text-emerald-600" : "text-rose-600"}`}>
                               {formatCurrency(h.amount || 0)}
                            </span>
                            {h.reductionAmount > 0 && <div className="text-[11px] font-bold text-emerald-500 mt-1">لێخۆشبوون: {formatCurrency(h.reductionAmount)}</div>}
                        </td>
                        <td className="px-8 py-6 text-sm font-medium text-slate-600 max-w-[200px] truncate group-hover:text-slate-800 transition-colors">
                            {h.notes || "-"}
                            {h.safeId && (
                               <div className="text-[11px] font-bold text-sky-600 mt-1 bg-sky-50 inline-block px-2 py-0.5 rounded border border-sky-100">
                                  قاسە: {safes.find(s => s.id === h.safeId)?.name || "نەزانراو"}
                               </div>
                            )}
                        </td>
                        <td className="px-8 py-6 text-center">
                           {h.type === "pay" && (
                              <div className="flex gap-2 justify-center">
                                 <button onClick={() => handleOpenEditTx(h)} className="p-2.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all inline-flex shadow-sm border border-transparent hover:border-amber-100" title="دەستکاری">
                                    <Edit size={18} />
                                 </button>
                                 <button onClick={() => handlePrintParams(h)} className="p-2.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-xl transition-all inline-flex shadow-sm border border-transparent hover:border-sky-100" title="چاپ">
                                   <Printer size={18} />
                                 </button>
                              </div>
                           )}
                        </td>
                      </tr>
                    ))}
                    {debtHistory.length === 0 && (
                       <tr><td colSpan={5} className="text-center py-32">
                         <FileClock size={48} className="mx-auto text-slate-200 mb-4" />
                         <p className="text-slate-400 font-bold">هیچ داتایەک نییە بۆ پیشاندان</p>
                       </td></tr>
                    )}
                  </tbody>
               </table>
             </div>
             
             {/* Mobile Cards View */}
             <div className="md:hidden flex flex-col p-4 gap-4">
                {debtHistory.map((h) => (
                  <div key={h.id} className="bg-white border border-slate-100 rounded-[20px] p-5 shadow-sm flex flex-col gap-4">
                     <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                           <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-inner ${h.type === "pay" ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"}`}>
                              {h.type === "pay" ? <TrendingDown size={24} /> : <TrendingUp size={24} />}
                           </div>
                           <div>
                              <span className={`text-sm font-black flex items-center gap-1 ${h.type === "pay" ? "text-emerald-700" : "text-rose-700"}`}>
                                 {h.type === "pay" ? "پارەی دراو" : "قەرزی نوێ"}
                              </span>
                              <div className="text-xs font-medium text-slate-400 mt-0.5">
                                 {h.timestamp?.toDate().toLocaleDateString("en-GB")} - {h.timestamp?.toDate().toLocaleTimeString("en-US", {hour: '2-digit', minute:'2-digit'})}
                              </div>
                           </div>
                        </div>
                        {h.type === "pay" && (
                           <div className="flex gap-2">
                             <button onClick={() => handleOpenEditTx(h)} className="p-2 text-slate-400 hover:text-amber-600 bg-slate-50 rounded-xl transition-all border border-slate-100 shadow-sm flex-1 flex justify-center active:scale-95">
                                <Edit size={20} />
                             </button>
                             <button onClick={() => handlePrintParams(h)} className="p-2 text-slate-400 hover:text-sky-600 bg-slate-50 rounded-xl transition-all border border-slate-100 shadow-sm flex-1 flex justify-center active:scale-95">
                                <Printer size={20} />
                             </button>
                           </div>
                        )}
                     </div>
                     <div className="bg-slate-50 rounded-[16px] p-4 flex flex-col border border-slate-100">
                        <div className="flex justify-between items-center mb-1">
                           <span className="text-xs font-bold text-slate-500">بڕی پارە</span>
                           <span className={`font-mono font-black text-xl ${h.type === "pay" ? "text-emerald-600" : "text-rose-600"}`}>
                              {formatCurrency(h.amount || 0)}
                           </span>
                        </div>
                        {h.reductionAmount > 0 && (
                           <div className="flex justify-between items-center mt-1">
                              <span className="text-xs font-bold text-slate-400">لێخۆشبوون</span>
                              <span className="text-xs font-bold text-emerald-500">{formatCurrency(h.reductionAmount)}</span>
                           </div>
                        )}
                     </div>
                     {h.notes && (
                        <div className="text-sm font-medium text-slate-600 bg-white border border-slate-100 rounded-[14px] px-4 py-3">
                           {h.notes}
                        </div>
                     )}
                     {h.safeId && (
                        <div className="text-xs font-bold text-sky-700 bg-sky-50 border border-sky-100 rounded-[12px] px-4 py-2 flex justify-between items-center">
                           <span>قاسەی وەرگر:</span>
                           <span>{safes.find((s: any) => s.id === h.safeId)?.name || 'نەزانراو'}</span>
                        </div>
                     )}
                  </div>
                ))}
                {debtHistory.length === 0 && (
                   <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white border border-slate-100 rounded-[20px]">
                      <FileClock size={48} className="opacity-20 mb-4" />
                      <h3 className="text-lg font-bold">هیچ داتایەک نییە بۆ پیشاندان</h3>
                   </div>
                )}
             </div>
          </div>
       </div>
       
       {/* Modals for Printing */}
       {printTx && selectedDebt && (
         <DebtReceiptModal
           transaction={printTx}
           debt={selectedDebt}
           onClose={() => setPrintTx(null)}
         />
       )}
       
       {statementCustomer && (
         <AccountStatementModal
           customer={statementCustomer}
           debts={debts}
           onClose={() => setStatementCustomer(null)}
         />
       )}

       {/* Edit Transaction Modal */}
       {editingTx && (
         <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
           <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
             <h2 className="text-xl font-bold text-slate-800 mb-6 font-primary text-center">دەستکاری کردنی بڕی وەرگیراو</h2>
             <form onSubmit={handleSaveEditTx} className="space-y-4">
               <div>
                  <label className="block text-sm font-bold text-slate-600 mb-2">پێشتر وەرگیراوە</label>
                  <input
                    type="number"
                    value={editPaymentAmount}
                    onChange={(e) => setEditPaymentAmount(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono text-left"
                    dir="ltr"
                    required
                  />
               </div>
               <div>
                  <label className="block text-sm font-bold text-slate-600 mb-2">لێخۆشبوونی پێشوو</label>
                  <input
                    type="number"
                    value={editPaymentReduction}
                    onChange={(e) => setEditPaymentReduction(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono text-left"
                    dir="ltr"
                  />
               </div>
               <div>
                  <label className="block text-sm font-bold text-slate-600 mb-2">تێبینی پێشوو</label>
                  <input
                    type="text"
                    value={editPaymentNote}
                    onChange={(e) => setEditPaymentNote(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
               </div>
               <div className="flex gap-3 pt-2">
                 <button type="button" onClick={() => setEditingTx(null)} className="flex-1 px-4 py-3 font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">
                   پاشگەزبوونەوە
                 </button>
                 <button type="submit" className="flex-1 px-4 py-3 font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-colors">
                   هەڵگرتن
                 </button>
               </div>
             </form>
           </div>
         </div>
       )}
    </div>
  );
}
