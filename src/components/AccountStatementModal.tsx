import React, { useState, useEffect } from "react";
import { X, Printer } from "lucide-react";
import { formatCurrency } from "../data";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";

export default function AccountStatementModal({
  customer,
  debts,
  onClose,
}: any) {
  const [debtTransactions, setDebtTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  const customerDebts = debts.filter(
    (d: any) => d.customerName === customer.name,
  );
  const totalDebtAmount = customerDebts.reduce(
    (sum: number, d: any) => sum + (d.remainingAmount || 0),
    0,
  );

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

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
    const ts = tx.timestamp?.toDate ? tx.timestamp.toDate() : new Date();

    if (tx.type === "add") {
      // Include all debt additions, including from POS
      ledgerEntries.push({
        date: ts,
        docNo: tx.id.slice(-6).toUpperCase(),
        details: tx.notes || "زیادکردنی قەرز",
        type: "دۆلار",
        debit: tx.originalAmount || tx.amount,
        credit: 0,
      });
    } else if (tx.type === "pay") {
      // Payment (Credit)
      ledgerEntries.push({
        date: ts,
        docNo: tx.id.slice(-6).toUpperCase(),
        details: tx.notes || "دانەوەی قەرز",
        type: "دۆلار",
        debit: 0,
        credit: tx.originalAmount || tx.amount || tx.paidAmount || 0,
      });
    }
  });

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

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex py-10 justify-center p-4 z-[9999] print:static print:inset-auto print:bg-white print:p-0 print:w-full print:h-auto overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-5xl h-fit shadow-2xl print:shadow-none print:w-full print:max-w-none print:rounded-none print:m-0 flex flex-col">
        <div className="sticky top-0 bg-white/80 backdrop-blur-md p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 z-[50] print:hidden rounded-t-3xl border-b-2">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-800">
              ڕاپۆرتی کەشفی حیساب
            </h2>
            <p className="text-slate-500 font-bold mt-1">
              کڕیار: {customer.name}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm font-bold text-slate-500">
                لە بەرواری:
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="border border-slate-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-pink-500 outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-bold text-slate-500">
                تا بەرواری:
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="border border-slate-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-pink-500 outline-none"
              />
            </div>

            <button
              onClick={handlePrint}
              className="bg-pink-50 text-pink-600 hover:bg-pink-100 px-4 py-2 rounded-xl flex items-center gap-2 font-bold transition-colors"
            >
              <Printer size={18} /> چاپکردن
            </button>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Print Layout */}
        <div className="p-4 sm:p-8 shrink-0 bg-slate-50 print:bg-white print:p-0 print:overflow-visible flex justify-center">
          <div 
            className="w-[210mm] min-h-[297mm] bg-white text-black p-[7mm] box-border relative shadow-sm mx-auto flex flex-col print:shadow-none print:w-[210mm] print:m-0"
            dir="rtl"
            style={{ fontFamily: "Arial, sans-serif" }}
          >
            <style type="text/css" media="print">
              {`
                @page { size: A4 portrait; margin: 0; }
                body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              `}
            </style>
            
            {/* Top Header - Compact Row Layout */}
            <div className="flex justify-between items-center mb-2 border-b-[3px] border-black pb-2 relative">
              {/* Right Side - Logo */}
              <div className="flex items-center justify-center shrink-0 w-24 h-24">
                <img
                  src="https://cheerful-pink-qakkchpr.edgeone.app/Pink%20Elle%20logo%20new-1_page-0001.jpg"
                  alt="Pink Elle Logo"
                  className="w-full h-full object-contain mix-blend-multiply drop-shadow-sm"
                />
              </div>

              {/* Center - Company Info */}
              <div className="flex-1 text-center px-4">
                <h1
                  className="text-3xl font-extrabold text-pink-600 tracking-widest mb-1 leading-none"
                  style={{ fontFamily: "Impact, sans-serif" }}
                >
                  گروپی PINK ELLE
                </h1>
                <h4 className="text-xs font-bold text-slate-600 mb-1">
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
                <div className="flex items-center">
                  <div className="w-24 text-right font-bold ml-2 whitespace-nowrap">
                    رقم العميل (ژمارەی کڕیار):
                  </div>
                  <div className="border-b border-black flex-1 px-2 font-bold font-mono text-sm leading-none text-center">
                    {customer.id ? customer.id.slice(-6).toUpperCase() : "-"}
                  </div>
                </div>
                <div className="flex items-center">
                  <div className="w-24 text-right font-bold ml-2">
                    بەروار:
                  </div>
                  <div className="border-b border-black flex-1 px-2 font-bold font-mono text-sm text-center leading-none">
                    {fromDate ? fromDate.replace(/-/g, "/") : "-"} تا {toDate ? toDate.replace(/-/g, "/") : "-"}
                  </div>
                </div>
                <div className="flex items-center">
                  <div className="w-24 text-right font-bold ml-2">
                    بەرواری چاپ:
                  </div>
                  <div
                    className="border-b border-black flex-1 px-2 font-bold font-mono text-sm text-center leading-none"
                    dir="ltr"
                  >
                    {printDate} {printTime}
                  </div>
                </div>
              </div>

              {/* Center Title */}
              <div className="w-28 flex items-center justify-center font-black text-lg italic mt-1 border-b-4 border-double border-pink-600 pb-0.5">
                کەشفی حیساب
              </div>

              {/* Right Side Info */}
              <div className="flex-1 flex flex-col gap-1">
                <div className="flex items-center">
                  <div className="w-24 text-right font-bold ml-2">
                    اسم المشتري (کڕیار):
                  </div>
                  <div className="border-b border-black flex-1 px-2 font-bold text-sm text-center leading-none">
                    {customer.name}
                  </div>
                </div>
                <div className="flex items-center">
                  <div className="w-24 text-right font-bold ml-2">
                    رقم الموبايل (مۆبایل):
                  </div>
                  <div
                    className="border-b border-black flex-1 px-2 font-bold font-mono text-sm text-center leading-none"
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
            <div className="hidden print:flex justify-between items-center px-12 mt-12 mb-2 text-[11px] font-bold text-slate-800">
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
        </div>
      </div>
    </div>
  );
}
