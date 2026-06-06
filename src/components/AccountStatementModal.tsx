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
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex py-10 justify-center p-4 z-[9999] print:static print:inset-auto print:bg-white print:p-0 print:w-full print:h-auto overflow-y-auto print:overflow-visible">
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
            className="printable-statement-area w-[210mm] min-h-[297mm] bg-white text-black p-[7mm] box-border relative shadow-sm mx-auto flex flex-col border-2 border-black print:shadow-none print:w-[210mm] print:m-0"
            dir="rtl"
            style={{ fontFamily: "Arial, sans-serif" }}
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
                  -webkit-print-color-adjust: exact !important; 
                  print-color-adjust: exact !important; 
                }
                .printable-statement-area, .printable-statement-area * {
                  visibility: visible !important;
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
                  border: 2px solid black !important;
                  display: flex !important;
                  flex-direction: column !important;
                }
                .print\\:hidden {
                  display: none !important;
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
                    className="w-full h-full object-contain mix-blend-multiply"
                  />
                </div>
              </div>

              {/* Center - Company Info */}
              <div className="flex-1 flex flex-col justify-center items-center text-center px-2">
                <h1
                  className="text-3xl font-extrabold text-pink-600 tracking-wider mb-0.5 flex items-center gap-1.5 justify-center"
                  style={{ fontFamily: "'Cairo', 'Arial', sans-serif" }}
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
