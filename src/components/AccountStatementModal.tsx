import React, { useState, useEffect } from "react";
import { X, Printer, Edit, RefreshCcw } from "lucide-react";
import { formatCurrency } from "../data";
import { collection, query, where, getDocs, doc, writeBatch, Timestamp, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

export default function AccountStatementModal({
  customer,
  debts,
  receipts,
  onClose,
}: any) {
  const [debtTransactions, setDebtTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [safesMap, setSafesMap] = useState<Record<string, string>>({});
  const [systemSafes, setSystemSafes] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);

  const [editingTx, setEditingTx] = useState<any>(null);
  const [editPaymentAmount, setEditPaymentAmount] = useState("");
  const [editPaymentReduction, setEditPaymentReduction] = useState("");
  const [editPaymentNote, setEditPaymentNote] = useState("");

  const handleOpenEditTx = (tx: any) => {
    setEditingTx(tx);
    setEditPaymentAmount(tx.credit?.toString() || "");
    setEditPaymentReduction(tx.reductionAmount?.toString() || "0");
    setEditPaymentNote(tx.details || "");
  };

  const handleSaveEditTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx || !editingTx.rawTx) return;
    try {
      const newAmount = parseFloat(editPaymentAmount) || 0;
      const newReduction = parseFloat(editPaymentReduction) || 0;
      const oldAmount = editingTx.rawTx.amount || 0;
      const oldReduction = editingTx.rawTx.reductionAmount || 0;
      
      const amountDiff = newAmount - oldAmount;
      const reductionDiff = newReduction - oldReduction;
      
      const batch = writeBatch(db);
      
      batch.update(doc(db, "debt_transactions", editingTx.rawTx.id), {
        amount: newAmount,
        reductionAmount: newReduction,
        notes: editPaymentNote,
        updatedAt: Timestamp.now()
      });
      
      if (editingTx.rawTx.debtId) {
         const debtToUpdate = debts.find((d: any) => d.id === editingTx.rawTx.debtId);
         if (debtToUpdate) {
            batch.update(doc(db, "debts", debtToUpdate.id), {
               remainingAmount: (debtToUpdate.remainingAmount || 0) - amountDiff - reductionDiff,
               updatedAt: Timestamp.now(),
            });
         }
      }
      
      const safeId = editingTx.rawTx.safeId || settings?.defaultSafeForDebt;
      let shouldSyncNow = false;
      let syncAmountDiff = amountDiff;
      if (!editingTx.rawTx.syncedToSafe && safeId) {
         shouldSyncNow = true;
         syncAmountDiff = newAmount;
         batch.update(doc(db, "debt_transactions", editingTx.rawTx.id), { syncedToSafe: true, safeId });
      }

      if ((shouldSyncNow || editingTx.rawTx.syncedToSafe) && safeId && syncAmountDiff !== 0) {
         const safeSnap = systemSafes.find((s: any) => s.id === safeId);
         if (safeSnap) {
            batch.update(doc(db, "safes", safeId), {
               balance: (safeSnap.balance || 0) + syncAmountDiff
            });
            batch.set(doc(collection(db, "safe_transactions")), {
               safeId: safeId,
               amount: Math.abs(syncAmountDiff),
               type: syncAmountDiff > 0 ? "in" : "out",
               origin: "دەستکاری و گواستنەوەی پارەی قەرز",
               timestamp: Timestamp.now(),
               notes: "دەستکاری پێشوو / نەگواستراوە",
            });
         }
      }
      
      await batch.commit();
      setEditingTx(null);
      
      setDebtTransactions(prev => prev.map(t => {
         if (t.id === editingTx.rawTx.id) {
            return { ...t, amount: newAmount, reductionAmount: newReduction, notes: editPaymentNote };
         }
         return t;
      }));
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const syncAllUnsyncedToSafe = async () => {
    if (!settings?.defaultSafeForDebt) {
       alert("قاسەی بنەڕەتی دیارینەکراوە لە سێتینگەکان!");
       return;
    }
    const unsynced = debtTransactions.filter(t => t.type === "pay" && !t.syncedToSafe);
    if (unsynced.length === 0) {
       alert("هیچ پارەیەکی نەگواستراوە نییە.");
       return;
    }
    
    if (!confirm(`دڵنیایت لە گواستنەوەی ${unsynced.length} وەسڵ بۆ قاسە؟`)) return;
    
    try {
       const batch = writeBatch(db);
       let totalAmount = 0;
       
       unsynced.forEach(tx => {
          batch.update(doc(db, "debt_transactions", tx.id), { syncedToSafe: true, safeId: settings.defaultSafeForDebt });
          totalAmount += (tx.amount || 0);
       });
       
       const safeSnap = systemSafes.find(s => s.id === settings.defaultSafeForDebt);
       if (safeSnap) {
          batch.update(doc(db, "safes", settings.defaultSafeForDebt), {
             balance: (safeSnap.balance || 0) + totalAmount
          });
          batch.set(doc(collection(db, "safe_transactions")), {
             safeId: settings.defaultSafeForDebt,
             amount: totalAmount,
             type: "in",
             origin: "گواستنەوەی پارەی قەرزە کۆنەکان",
             timestamp: Timestamp.now(),
             notes: `کۆی ${unsynced.length} وەسڵ`,
          });
       }
       
       await batch.commit();
       alert("بە سەرکەوتوویی گواسترانەوە.");
       
       setDebtTransactions(prev => prev.map(t => {
          if (!t.syncedToSafe && t.type === "pay") {
             return { ...t, syncedToSafe: true, safeId: settings.defaultSafeForDebt };
          }
          return t;
       }));
    } catch (e: any) {
       alert("هەڵە: " + e.message);
    }
  };

  const normalizeName = (name: string | null | undefined): string => {
    if (!name) return "";
    return name
      .trim()
      .replace(/\s+/g, " ")
      .replace(/[ییێىي]/g, "ی")
      .replace(/[ەەھة]/g, "ە")
      .toLowerCase();
  };

  const customerDebts = debts.filter(
    (d: any) => normalizeName(d.customerName) === normalizeName(customer.name),
  );
  const totalDebtAmount = customerDebts.reduce(
    (sum: number, d: any) => sum + (d.remainingAmount || 0),
    0,
  );

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      // Fetch safes for names reference
      const unsubSafes = onSnapshot(collection(db, "safes"), (safeSnap) => {
         const sMap: Record<string, string> = {};
         const sArr: any[] = [];
         safeSnap.docs.forEach(doc => {
            sMap[doc.id] = doc.data().name;
            sArr.push({ id: doc.id, ...doc.data() });
         });
         setSafesMap(sMap);
         setSystemSafes(sArr);
      });
      const unsubSettings = onSnapshot(doc(db, "system", "settings"), (snap) => {
         if (snap.exists()) setSettings(snap.data());
      });

      const debtIds = customerDebts.map((d: any) => d.id);
      let trans: any[] = [];

      if (debtIds.length > 0) {
        // Fetch transactions specifically belonging to this customer's debtId to guarantee no mixing and high performance
        const allTransPromises = debtIds.map(async (debtId: string) => {
          const q = query(
            collection(db, "debt_transactions"),
            where("debtId", "==", debtId)
          );
          const snap = await getDocs(q);
          return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        });
        const results = await Promise.all(allTransPromises);
        trans = results.flat();
      }

      setDebtTransactions(trans);
      setLoading(false);
    };
    fetchData();
  }, [customer.name, debts]);

  // Build the ledger
  let ledgerEntries: any[] = [];

  // Add Debt Transactions
  debtTransactions.forEach((tx: any) => {
    if (tx.status && tx.status !== "completed") return;
    const ts = tx.timestamp?.toDate ? tx.timestamp.toDate() : new Date();

    if (tx.type === "add") {
      // Include all debt additions, including from POS
      ledgerEntries.push({
        date: ts,
        docNo: tx.id.slice(-6).toUpperCase(),
        details: tx.notes || tx.note || "زیادکردنی قەرز",
        type: "دۆلار",
        debit: tx.originalAmount || tx.amount,
        credit: 0,
        rawTx: tx,
      });
    } else if (tx.type === "pay" || tx.type === "sub") {
      // Payment (Credit) or subtraction
      let detailDesc = tx.notes || tx.note || (tx.type === "sub" ? "کەمکردنی قەرز" : "دانەوەی قەرز");
      if (tx.safeId && safesMap[tx.safeId]) {
         detailDesc += ` (قاسە: ${safesMap[tx.safeId]})`;
      }
      if (tx.reductionAmount > 0) {
         detailDesc += ` - داشکاندن/لێخۆشبوون: ${formatCurrency(tx.reductionAmount)}`;
      }
      ledgerEntries.push({
        date: ts,
        docNo: tx.id.slice(-6).toUpperCase(),
        details: detailDesc,
        type: "دۆلار",
        debit: 0,
        credit: tx.originalAmount || tx.amount || tx.paidAmount || 0,
        rawTx: tx,
      });
    }
  });

  // Add Cash Receipts
  if (receipts) {
    const cashReceipts = receipts.filter((r: any) => normalizeName(r.customerName) === normalizeName(customer.name) && r.status === "completed" && (r.paymentType === "cash" || r.paymentType === "نەقد"));
    cashReceipts.forEach((r: any) => {
       const ts = r.timestamp?.toDate ? r.timestamp.toDate() : new Date(r.timestamp);
       ledgerEntries.push({
          date: ts,
          docNo: r.id.slice(-6).toUpperCase(),
          details: `وەسڵی نەقد - ჟمارە: ${r.invoiceNo}`,
          type: "دۆلار",
          debit: r.totalAmount || r.total || 0,
          credit: r.totalAmount || r.total || 0,
          rawTx: null,
       });
    });
  }

  // Sort by date (oldest to newest)
  ledgerEntries.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Apply Date Filtering & Calculate Previous Balance
  let previousBalance = 0;
  let filteredEntries: any[] = [];

  ledgerEntries.forEach((entry) => {
    let include = true;

    // Remove time component for fair comparison
    const entryDate = new Date(
      entry.date.getFullYear(),
      entry.date.getMonth(),
      entry.date.getDate(),
    );

    if (fromDate) {
      const fromD = new Date(fromDate);
      if (entryDate < fromD) {
        previousBalance += entry.debit - entry.credit;
        include = false;
      }
    }
    if (toDate) {
      const toD = new Date(toDate);
      if (entryDate > toD) {
        include = false;
      }
    }

    if (include) {
      filteredEntries.push(entry);
    }
  });

  // Calculate Balance (ماوە) for filtered period
  let runningBalance = previousBalance;
  filteredEntries = filteredEntries.map((entry) => {
    runningBalance += entry.debit - entry.credit;
    return { ...entry, balance: runningBalance };
  });

  const fixDebtBookMismatch = async () => {
    const totalCalculatedBalance = ledgerEntries.reduce((sum, e) => sum + e.debit - e.credit, 0);
    const textStatus = totalCalculatedBalance === 0 ? '(پاکتاو / سفر)' : (totalCalculatedBalance < 0 ? '(قەرزارین)' : '(قەرزارە)');
    if (!confirm(`ئایا دڵنیایت دەتەوێت قەرزی ئەم کڕیارە چاک بکەیت بۆ ئەوەی بڕەکەی ببێتە ${formatCurrency(Math.abs(totalCalculatedBalance))} ${textStatus}؟`)) return;

    try {
      const batch = writeBatch(db);
      const activeDebt = customerDebts.find((d: any) => d.status === "active") || customerDebts[0];
      
      if (!activeDebt) {
         if (totalCalculatedBalance > 0) {
            const newDebtRef = doc(collection(db, "debts"));
            batch.set(newDebtRef, {
               customerName: customer.name,
               phone: customer.phone || "",
               amount: totalCalculatedBalance,
               remainingAmount: totalCalculatedBalance,
               status: "active",
               timestamp: Timestamp.now(),
               notes: "چاککردنەوەی کەشف حساب"
            });
         }
      } else {
         const finalRemaining = totalCalculatedBalance < 0 ? 0 : totalCalculatedBalance;
         batch.update(doc(db, "debts", activeDebt.id), {
            remainingAmount: finalRemaining,
            status: finalRemaining === 0 ? "paid" : "active",
            updatedAt: Timestamp.now()
         });
      }

      await batch.commit();
      alert("دەفتەر قەرز چاککرا بە سەرکەوتوویی. تکایە پەڕەکە ڕیفرێش بکە.");
    } catch (e: any) {
      alert("هەڵە: " + e.message);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const now = new Date();
  const printDate = now
    .toLocaleDateString("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    .replace(/-/g, "/");
  const printTime = now.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });

  const renderStatementContent = () => (
    <div 
      className="printable-statement-area w-full bg-white text-black p-[7mm] box-border relative flex flex-col border-2 border-black"
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
            visibility: hidden !important; 
            background-color: white !important;
          }
          .printable-statement-area, .printable-statement-area * {
            visibility: visible !important;
            font-family: 'Rudaw', 'Noto Sans Arabic', Tahoma, Arial, sans-serif !important;
          }
          .printable-statement-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 210mm !important;
            min-height: 297mm !important;
            margin: 0 !important;
            padding: 10mm !important;
            box-sizing: border-box !important;
            background-color: white !important;
            box-shadow: none !important;
            border: none !important;
          }
          * {
            -webkit-print-color-adjust: exact !important; 
            print-color-adjust: exact !important; 
          }
          /* Maintain exact backgrounds of header cells upon PDF generation */
          th {
            background-color: #f3f4f6 !important;
            -webkit-print-color-adjust: exact !important; 
            print-color-adjust: exact !important;
          }
          th.bg-red-50 {
            background-color: #fef2f2 !important;
          }
          th.bg-emerald-50 {
            background-color: #ecfdf5 !important;
          }
          th.bg-slate-200, td.bg-slate-200 {
            background-color: #e2e8f0 !important;
          }
          td.bg-slate-50 {
            background-color: #f8fafc !important;
          }
          tr.bg-gray-200 {
            background-color: #e5e7eb !important;
          }
        `}
      </style>
      
      {/* Top Header - Exact Match of the Uploaded Reference Image */}
      <div className="flex justify-between items-stretch mb-2 border-b-[3px] border-black pb-2 relative gap-4">
        {/* Right Side - Logo Box (aligned to right inside RTL) */}
        <div className="shrink-0 flex items-center justify-center">
          <div className="border-[2px] border-black rounded p-1 w-28 h-20 flex items-center justify-center bg-white shadow-sm">
            <img
              src="https://cheerful-pink-qakkchpr.edgeone.app/Pink%20Elle%20logo%20new-1_page-0001.jpg"
              alt="Pink Elle Logo"
              className="w-full h-full object-contain"
            />
          </div>
        </div>

        {/* Center - Company Info */}
        <div className="flex-1 flex flex-col justify-center items-center text-center px-2">
          <h1
            className="text-3xl font-extrabold text-pink-600 tracking-wider mb-0.5 flex items-center gap-1.5 justify-center"
            style={{ fontFamily: "'Rudaw', Tahoma, 'Noto Sans Arabic', Arial, sans-serif" }}
          >
            <span className="text-black font-extrabold text-2xl">گروپی</span>
            <span>PINK ELLE</span>
          </h1>
          <h4 className="text-[11px] font-black text-slate-800 leading-tight">
            بۆ بازرگانی گشتی - سنووردار
          </h4>
        </div>

        {/* Left Side - Contacts Box */}
        <div className="shrink-0 flex items-center justify-center">
          <div className="border-[2px] border-black rounded p-1.5 text-center font-black w-60 bg-white shadow-sm">
            <div className="text-[11px] text-zinc-900 font-extrabold mb-1 border-b-[1.5px] border-black pb-0.5">
              ژمارەی کۆمپانیا
            </div>
            <div className="flex justify-center items-center gap-1 text-[13px] font-extrabold" dir="ltr">
              <span>0751 201 8372</span>
              <span className="text-black">-</span>
              <span>0750 425 1338</span>
            </div>
          </div>
        </div>
      </div>

      {/* Address Bar */}
      <div className="text-center font-extrabold text-xs mb-3 bg-gray-100 py-1.5 border border-black rounded shadow-sm">
        سۆران - شۆڕش - بەرامبەر مزگەوتی شۆڕش{" "}
        <span className="text-pink-600 text-[13px] inline-block align-middle">📍</span>
      </div>

      {/* Info Boxes Header - Perfect Two-Column Layout with Clean Underlines */}
      <div className="flex justify-between items-start mb-3 gap-6 text-[11px] px-1">
        {/* Right Side Info - Customer ID, Date Range, Print Date */}
        <div className="w-[320px] flex flex-col gap-1.5">
          <div className="flex items-center">
            <div className="w-40 text-right font-black text-zinc-950">
              رقم العميل (ژمارەی کڕیار):
            </div>
            <div className="border-b border-black flex-1 px-1 font-bold font-mono text-[13px] leading-none text-center pb-0.5">
              {customer.id ? customer.id.slice(-6).toUpperCase() : "-"}
            </div>
          </div>
          <div className="flex items-center">
            <div className="w-16 text-right font-black text-zinc-950">
              بەروار:
            </div>
            <div className="border-b border-black flex-1 px-1 font-bold font-mono text-[11px] text-center leading-none pb-0.5">
              {fromDate ? fromDate.replace(/-/g, "/") : "-"} - تا - {toDate ? toDate.replace(/-/g, "/") : "-"}
            </div>
          </div>
          <div className="flex items-center">
            <div className="w-24 text-right font-black text-zinc-950">
              بەرواری چاپ:
            </div>
            <div
              className="border-b border-black flex-1 px-1 font-bold font-mono text-[11px] text-center leading-none pb-0.5"
              dir="ltr"
            >
              {printDate} {printTime}
            </div>
          </div>
        </div>

        {/* Center Document Title */}
        <div className="flex-1 flex flex-col justify-center items-center pt-1.5">
          <div className="text-xl font-black italic relative px-3 pb-1 border-b-4 border-double border-pink-500">
            کەشفی حیساب
          </div>
        </div>

        {/* Left Side Info - Customer Name and Mobile */}
        <div className="w-[320px] flex flex-col gap-1.5">
          <div className="flex items-center">
            <div className="w-28 text-right font-black text-zinc-950">
              اسم المشتري (کڕیار):
            </div>
            <div className="border-b border-black flex-1 px-1 font-bold text-[13px] text-center leading-none pb-0.5">
              {customer.name}
            </div>
          </div>
          <div className="flex items-center">
            <div className="w-32 text-right font-black text-zinc-950">
              رقم الموبايل (مۆبایل):
            </div>
            <div
              className="border-b border-black flex-1 px-1 font-bold font-mono text-[12px] text-center leading-none pb-0.5"
              dir="ltr"
            >
              {customer.phone || "..."}
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center font-bold text-slate-500 animate-pulse">
          داتا ئامادە دەکرێت...
        </div>
      ) : (
        <div className="mt-1 text-xs">
          <table className="w-full border-collapse border-2 border-black text-center font-bold">
            <thead>
              <tr className="bg-gray-100 border-b-2 border-black">
                <th className="border-l border-black px-1 py-1 w-8">ت</th>
                <th className="border-l border-black px-1 py-1 w-20">بەڵگە</th>
                <th className="border-l border-black px-1 py-1 w-24">بەروار</th>
                <th className="border-l border-black px-2 py-1 flex-1 min-w-[200px] text-right">
                  ڕوون کردنەوەی بەڵگە
                  <br />
                  <span className="text-[10px] text-gray-600 font-normal">
                    تفاصيل
                  </span>
                </th>
                <th className="border-l border-black px-1 py-1 w-16">جۆر</th>
                <th className="border-l border-black px-1 py-1 w-20 text-red-700 bg-red-50 text-[10px]">
                  قەرزدار
                  <br />(لەسەریەتی)
                </th>
                <th className="border-l border-black px-1 py-1 w-20 text-emerald-700 bg-emerald-50 text-[10px]">
                  قەرزدەر
                  <br />(داویەتی)
                </th>
                <th className="px-1 py-1 w-24 bg-slate-200">کۆی ماوە</th>
              </tr>
            </thead>
            <tbody>
              {/* Initial Balance */}
              <tr className="border-b border-black">
                <td className="border-l border-black px-1 py-1 font-mono">1</td>
                <td className="border-l border-black px-1 py-1 font-mono">-</td>
                <td className="border-l border-black px-1 py-1 font-mono">-</td>
                <td className="border-l border-black px-2 py-1 text-right font-semibold">
                  مانەوەی یەکەم دەورە
                </td>
                <td className="border-l border-black px-1 py-1">دۆلار</td>
                <td className="border-l border-black px-1 py-1 text-slate-400 font-mono">-</td>
                <td className="border-l border-black px-1 py-1 text-slate-400 font-mono">-</td>
                <td className="px-1 py-1 font-mono font-bold bg-slate-50" dir="ltr">
                  {formatCurrency(previousBalance)}
                </td>
              </tr>
              
              {/* Render rows */}
              {filteredEntries.map((entry, idx) => (
                <tr key={idx + 2} className="border-b border-black">
                  <td className="border-l border-black px-1 py-1 font-mono">{idx + 2}</td>
                  <td className="border-l border-black px-1 py-1 font-mono">{entry.docNo}</td>
                  <td className="border-l border-black px-1 py-1 font-mono text-[10px]">
                    {entry.date.toLocaleDateString("en-CA").replace(/-/g, "/")}
                  </td>
                  <td className="border-l border-black px-2 py-1 text-right text-[11px] font-semibold text-slate-800 leading-tight">
                    {entry.details}
                  </td>
                  <td className="border-l border-black px-1 py-1 text-[11px]">{entry.type}</td>
                  <td className="border-l border-black px-1 py-1 font-mono font-bold text-red-700 bg-red-50/30">
                    {entry.debit > 0 ? formatCurrency(entry.debit) : ""}
                  </td>
                  <td className="border-l border-black px-1 py-1 font-mono font-bold text-emerald-700 bg-emerald-50/30">
                    {entry.credit > 0 ? formatCurrency(entry.credit) : ""}
                  </td>
                  <td className="px-1 py-1 font-mono font-bold bg-slate-50" dir="ltr">
                    {formatCurrency(entry.balance)}
                  </td>
                </tr>
              ))}

              {/* Final Totals Row */}
              <tr className="bg-gray-200 border-t-[3px] border-black">
                <td colSpan={5} className="border-l border-black px-2 py-1 text-left font-black">
                  کۆی گشتی حیساب:
                </td>
                <td className="border-l border-black px-1 py-1 font-mono font-bold text-red-700">
                  {formatCurrency(filteredEntries.reduce((sum, e) => sum + e.debit, 0))}
                </td>
                <td className="border-l border-black px-1 py-1 font-mono font-bold text-emerald-700">
                  {formatCurrency(filteredEntries.reduce((sum, e) => sum + e.credit, 0))}
                </td>
                <td className="px-1 py-1 font-mono font-black text-[13px]" dir="ltr">
                  {formatCurrency(runningBalance)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Print Signatures Floor */}
      <div className="flex justify-between items-center px-12 mt-12 mb-2 text-[11px] font-bold text-slate-800">
        <div className="text-center flex flex-col items-center">
          <div className="mb-6">ڕاستی و دروستی لایەنی یەکەم</div>
          <div className="w-32 border-b-2 border-slate-400"></div>
        </div>
        <div className="text-center flex flex-col items-center">
          <div className="mb-6">ڕاستی و دروستی لایەنی دووەم</div>
          <div className="w-32 border-b-2 border-slate-400"></div>
        </div>
        <div className="text-center flex flex-col items-center">
          <div className="mb-6">بەڕێوەبەری حسابات</div>
          <div className="w-32 border-b-2 border-slate-400"></div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* On-screen Modal View: Beautiful responsive interface */}
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center p-0 sm:p-4 z-[9999] print:hidden">
        <div className="bg-white/95 sm:bg-white backdrop-blur-md rounded-none sm:rounded-[32px] w-full max-w-5xl h-full sm:h-[90vh] shadow-2xl flex flex-col overflow-hidden relative border border-slate-200">
          
          {/* Header */}
          <div className="bg-gradient-to-l from-slate-900 to-slate-800 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-white shrink-0 shadow-lg relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-full bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjIiIGZpbGw9IiNmZmZmZmYwYyIvPjwvc3ZnPg==')] opacity-30"></div>
             <div className="relative z-10">
               <h2 className="text-2xl font-black mb-1 flex items-center gap-2">
                 کەشفی حیساب
               </h2>
               <p className="text-slate-300 font-medium text-sm flexitems-center gap-2">
                 <span className="text-sky-400">کڕیار:</span> {customer.name} {customer.phone ? `(${customer.phone})` : ""}
               </p>
             </div>

             <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 relative z-10 w-full sm:w-auto">
                <div className="flex flex-col sm:flex-row gap-2 bg-slate-800/50 p-2 rounded-2xl border border-slate-700 backdrop-blur-sm w-full sm:w-auto">
                  <div className="flex items-center gap-2 bg-slate-900/50 rounded-xl px-3 py-1.5 focus-within:ring-2 ring-sky-500 transition-all flex-1 sm:flex-none">
                    <label className="text-xs font-bold text-slate-400 whitespace-nowrap">
                      لە:
                    </label>
                    <input
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="bg-transparent text-white text-sm focus:outline-none w-full"
                    />
                  </div>
                  <div className="flex items-center gap-2 bg-slate-900/50 rounded-xl px-3 py-1.5 focus-within:ring-2 ring-sky-500 transition-all flex-1 sm:flex-none">
                    <label className="text-xs font-bold text-slate-400 whitespace-nowrap">
                      تا:
                    </label>
                    <input
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="bg-transparent text-white text-sm focus:outline-none w-full"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                  <button
                    onClick={handlePrint}
                    className="flex-1 sm:flex-none justify-center bg-sky-500 hover:bg-sky-400 text-white px-5 py-3 rounded-xl flex items-center gap-2 font-bold transition-all shadow-lg shadow-sky-500/30"
                  >
                    <Printer size={18} /> چاپکردن
                  </button>
                  <button
                    onClick={syncAllUnsyncedToSafe}
                    className="flex-1 sm:flex-none justify-center bg-emerald-500 hover:bg-emerald-400 text-white px-5 py-3 rounded-xl flex items-center gap-2 font-bold transition-all shadow-lg shadow-emerald-500/30"
                    title="ناردنی بڕە قەرزە نەگواستراوەکان بۆ قاسە"
                  >
                    <RefreshCcw size={18} /> ناردن قاسە
                  </button>
                  {customerDebts.length > 0 && Math.abs(totalDebtAmount - ledgerEntries.reduce((sum, e) => sum + e.debit - e.credit, 0)) > 0.01 && (
                     <button
                       onClick={fixDebtBookMismatch}
                       className="flex-1 sm:flex-none justify-center bg-orange-500 hover:bg-orange-400 text-white px-5 py-3 rounded-xl flex items-center gap-2 font-bold transition-all shadow-lg shadow-orange-500/30"
                       title="گونجاندنی دەفتەر قەرز بەپێی کەشف حساب"
                     >
                       <RefreshCcw size={18} /> چاککردنی دەفتەر
                     </button>
                  )}
                  <button
                    onClick={onClose}
                    className="w-12 h-12 rounded-xl bg-slate-800 hover:bg-rose-500 text-slate-300 hover:text-white flex items-center justify-center shrink-0 border border-slate-700 hover:border-rose-400 transition-all shadow-sm"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
             </div>
          </div>

          {/* Stats Bar */}
          <div className="bg-white border-b border-slate-100 flex items-center justify-between px-6 py-4 shrink-0 shadow-sm z-10 w-full overflow-x-auto">
             <div className="flex gap-8 whitespace-nowrap">
                <div className="flex flex-col">
                   <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">کۆی قەرزاری حیساب (ده‌ین)</span>
                   <span className="font-mono text-xl font-black text-rose-600">{formatCurrency(filteredEntries.reduce((sum, e) => sum + e.debit, 0))}</span>
                </div>
                <div className="w-[1px] bg-slate-200"></div>
                <div className="flex flex-col">
                   <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">کۆی دراو (واصل)</span>
                   <span className="font-mono text-xl font-black text-emerald-600">{formatCurrency(filteredEntries.reduce((sum, e) => sum + e.credit, 0))}</span>
                </div>
                <div className="w-[1px] bg-slate-200"></div>
                <div className="flex flex-col">
                   <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">کۆتایی ماوە لەم ماوەیەدا</span>
                   <span className="font-mono text-xl font-black text-sky-600 shadow-sm">{formatCurrency(runningBalance)}</span>
                </div>
             </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-auto bg-slate-50 relative custom-scrollbar">
             {loading ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400">
                   <div className="w-10 h-10 border-4 border-sky-200 border-t-sky-500 rounded-full animate-spin"></div>
                   <p className="font-bold">داتا ئامادە دەکرێت...</p>
                </div>
             ) : filteredEntries.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400 py-20">
                   <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center">
                     <span className="text-4xl opacity-50">📂</span>
                   </div>
                   <p className="font-bold text-lg">هیچ مامەڵەیەک نییە بۆ ئەم ماوەیە</p>
                </div>
             ) : (
                <>
                   {/* Desktop Table View */}
                   <div className="hidden md:block w-full">
                      <table className="w-full text-right border-collapse">
                         <thead className="bg-white sticky top-0 z-10 shadow-sm border-b border-slate-200">
                            <tr>
                              <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500 whitespace-nowrap">#</th>
                              <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500 whitespace-nowrap">بەروار</th>
                              <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500 whitespace-nowrap">بەڵگە</th>
                              <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500">ڕوون کردنەوە / تێبینی</th>
                              <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500 whitespace-nowrap">قەرزدار</th>
                              <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500 whitespace-nowrap">قەرزدەر</th>
                              <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500 whitespace-nowrap font-mono bg-sky-50/50">ماوە</th>
                              <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500 whitespace-nowrap print:hidden">کردارەکان</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-100">
                            <tr className="bg-slate-100/50">
                              <td className="px-6 py-4 font-mono text-slate-400 text-sm">1</td>
                              <td className="px-6 py-4 text-slate-400 font-mono text-sm">-</td>
                              <td className="px-6 py-4 text-slate-400 font-mono text-sm">-</td>
                              <td className="px-6 py-4 text-sm font-bold text-slate-600">مانەوەی یەکەم دەورە</td>
                              <td className="px-6 py-4 text-slate-400 font-mono text-sm">-</td>
                              <td className="px-6 py-4 text-slate-400 font-mono text-sm">-</td>
                              <td className="px-6 py-4 font-mono font-black text-slate-700 bg-sky-50/50" dir="ltr">{formatCurrency(previousBalance)}</td>
                              <td className="px-6 py-4 print:hidden"></td>
                            </tr>
                            {filteredEntries.map((entry, idx) => (
                               <tr key={idx} className="hover:bg-white transition-colors">
                                  <td className="px-6 py-4 font-mono text-slate-400 text-sm">{idx + 2}</td>
                                  <td className="px-6 py-4">
                                     <div className="text-sm font-bold text-slate-700 font-mono whitespace-nowrap">
                                        {entry.date.toLocaleDateString("en-GB")}
                                     </div>
                                  </td>
                                  <td className="px-6 py-4 font-mono text-sm text-slate-500">{entry.docNo}</td>
                                  <td className="px-6 py-4 text-sm font-bold text-slate-800 leading-relaxed max-w-xs">{entry.details}</td>
                                  <td className="px-6 py-4 font-mono font-bold text-rose-600 bg-rose-50/10">
                                     {entry.debit > 0 ? formatCurrency(entry.debit) : ""}
                                  </td>
                                  <td className="px-6 py-4 font-mono font-bold text-emerald-600 bg-emerald-50/10">
                                     {entry.credit > 0 ? formatCurrency(entry.credit) : ""}
                                  </td>
                                  <td className="px-6 py-4 font-mono font-black text-sky-700 bg-sky-50/50" dir="ltr">
                                     {formatCurrency(entry.balance)}
                                  </td>
                                  <td className="px-6 py-4 print:hidden">
                                     {entry.rawTx && entry.rawTx.type === "pay" && (
                                        <button onClick={() => handleOpenEditTx(entry)} className="p-2 text-sky-600 bg-sky-50 hover:bg-sky-100 rounded-lg transition-colors">
                                           <Edit size={16} />
                                        </button>
                                     )}
                                     {entry.rawTx && entry.rawTx.type === "pay" && !entry.rawTx.syncedToSafe && (
                                        <div className="text-[9px] text-rose-500 font-bold mt-1">نەچووەتە قاسە</div>
                                     )}
                                  </td>
                               </tr>
                            ))}
                         </tbody>
                      </table>
                   </div>

                   {/* Mobile Cards View */}
                   <div className="md:hidden flex flex-col p-4 gap-4 pb-12">
                      <div className="bg-slate-200 border border-slate-300 rounded-[20px] p-4 flex justify-between items-center shadow-inner">
                         <span className="text-sm font-bold text-slate-600">مانەوەی یەکەم دەورە</span>
                         <span className="font-mono font-black text-lg text-slate-800">{formatCurrency(previousBalance)}</span>
                      </div>
                      
                      {filteredEntries.map((entry, idx) => (
                         <div key={idx} className="bg-white border border-slate-200 rounded-[24px] overflow-hidden shadow-sm flex flex-col relative">
                            {/* Card Header */}
                            <div className="bg-slate-50/80 px-5 py-3 border-b border-slate-100 flex justify-between items-center">
                               <div className="text-xs font-bold text-slate-500">
                                  بەروار: <span className="font-mono text-slate-700 ml-1">{entry.date.toLocaleDateString("en-GB")}</span>
                               </div>
                               <div className="text-xs font-bold text-slate-400 bg-slate-200/50 px-2 py-1 rounded-md">
                                  بەڵگە: <span className="font-mono uppercase">{entry.docNo}</span>
                               </div>
                            </div>
                            
                            {/* Card Body */}
                            <div className="p-5 flex flex-col gap-4">
                               <div className="flex justify-between items-end gap-2">
                                  <div className="flex-1 bg-slate-50 border border-slate-100 rounded-xl p-3 flex flex-col justify-center min-h-[4rem]">
                                     <span className="text-[10px] font-bold text-slate-400 uppercase mb-1">ڕوون کردنەوە / تێبینی</span>
                                     <span className="text-sm font-bold text-slate-800 leading-snug">{entry.details}</span>
                                  </div>
                               </div>
                               
                               <div className="flex gap-2">
                                  <div className={`flex-1 rounded-xl p-3 flex flex-col border border-dashed ${entry.debit > 0 ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200'}`}>
                                     <span className="text-[10px] font-bold mb-1 opacity-60">قەرزدار (لەسەریەتی)</span>
                                     <span className={`font-mono font-black text-lg ${entry.debit > 0 ? 'text-rose-600' : 'text-slate-300'}`}>
                                        {entry.debit > 0 ? formatCurrency(entry.debit) : "0"}
                                     </span>
                                  </div>
                                  <div className={`flex-1 rounded-xl p-3 flex flex-col border border-dashed ${entry.credit > 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                                     <span className="text-[10px] font-bold mb-1 opacity-60">قەرزدەر (داویەتی)</span>
                                     <span className={`font-mono font-black text-lg ${entry.credit > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>
                                        {entry.credit > 0 ? formatCurrency(entry.credit) : "0"}
                                     </span>
                                  </div>
                               </div>
                            </div>
                            
                            {/* Card Footer */}
                            <div className="bg-sky-50/60 px-5 py-4 border-t border-sky-100/50 flex justify-between items-center mt-1">
                               <span className="text-sm font-bold text-sky-700/70">کۆی ماوە</span>
                               <span className="font-mono font-black text-2xl text-sky-600" dir="ltr">{formatCurrency(entry.balance)}</span>
                            </div>
                         </div>
                      ))}
                   </div>
                </>
             )}
          </div>
        </div>
      </div>

      {/* Actual Print Layout: Strictly visible during printing. */}
      <div className="hidden print:block w-full text-black bg-white">
        {renderStatementContent()}
      </div>

      {editingTx && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center p-4 z-[10000]">
           <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden" dir="rtl">
              <div className="bg-gradient-to-l from-slate-900 to-slate-800 p-5 flex justify-between items-center text-white">
                 <h2 className="text-lg font-black">دەستکاری پارەدان</h2>
                 <button onClick={() => setEditingTx(null)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                    <X size={20} />
                 </button>
              </div>
              <form onSubmit={handleSaveEditTx} className="p-6 space-y-4">
                 <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">بڕی دراوە</label>
                    <input
                       type="number"
                       step="any"
                       value={editPaymentAmount}
                       onChange={e => setEditPaymentAmount(e.target.value)}
                       className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 font-mono font-bold text-lg"
                       required
                    />
                 </div>
                 <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">بڕی لێخۆشبوون (داشکاندن)</label>
                    <input
                       type="number"
                       step="any"
                       value={editPaymentReduction}
                       onChange={e => setEditPaymentReduction(e.target.value)}
                       className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 font-mono font-bold text-lg"
                    />
                 </div>
                 <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">تێبینی</label>
                    <textarea
                       value={editPaymentNote}
                       onChange={e => setEditPaymentNote(e.target.value)}
                       className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm resize-none h-24"
                    />
                 </div>
                 <button type="submit" className="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold py-3.5 rounded-xl shadow-lg transition-colors">
                    پاشەکەوتکردن
                 </button>
              </form>
           </div>
        </div>
      )}
    </>
  );
}

