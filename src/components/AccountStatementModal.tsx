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
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] print:p-0 print:bg-white print:block print:z-[99999] overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-[95vw] lg:max-w-6xl my-auto shadow-2xl print:shadow-none print:w-full print:max-w-none print:rounded-none">
        <div className="sticky top-0 bg-white/80 backdrop-blur-md p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 z-[50] print:hidden">
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
        <div className="p-4 sm:p-8 overflow-auto bg-slate-50 flex-1 flex justify-center custom-scrollbar print:bg-white print:p-0 print:overflow-visible">
          <div 
            className="w-full max-w-[210mm] min-h-[297mm] bg-white text-black p-[6mm] box-border relative shadow-sm mx-auto flex flex-col print:shadow-none print:w-full print:m-0"
            dir="rtl"
            style={{ fontFamily: "Arial, sans-serif" }}
          >
            <style type="text/css" media="print">
              {`
                @page { size: A4 portrait; margin: 0; }
                body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              `}
            </style>
            
            {/* Top row */}
            <div className="flex justify-between items-center border-b-[3px] border-black pb-3 mb-4 relative">
              {/* Logo Right */}
              <div className="shrink-0 w-24 h-24">
                <img
                  src="https://cheerful-pink-qakkchpr.edgeone.app/Pink%20Elle%20logo%20new-1_page-0001.jpg"
                  alt="Pink Elle Logo"
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Center Title and subtitle */}
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
                <div className="inline-block mt-2 bg-pink-100 text-pink-700 font-extrabold border-2 border-pink-700 px-6 py-1 rounded-full text-base">
                  ڕاپۆرتی کەشفی حیساب (کشف حساب)
                </div>
              </div>

              {/* Left Side Phones */}
              <div className="shrink-0 text-right flex flex-col gap-1">
                <div className="bg-slate-50 border-2 border-black rounded p-1.5 shadow-sm text-[12px] font-bold w-52">
                  <div className="text-center text-[10px] mb-1 border-b border-black/20 pb-0.5">
                    ژمارەی کۆمپانیا
                  </div>
                  <div className="flex justify-around items-center" dir="ltr">
                    <span>0751 201 8372</span>
                    <span className="text-black/30">|</span>
                    <span>0750 425 1338</span>
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 font-bold mt-1 text-center font-mono">
                  بەرواری چاپ: {printDate} {printTime}
                </div>
              </div>
            </div>

            {/* Address Bar */}
            <div className="text-center font-black text-sm mb-4 bg-gray-200 py-1.5 border-2 border-black rounded-lg print:bg-gray-200">
              سۆران - شۆڕش - بەرامبەر مزگەوتی شۆڕش <span className="text-pink-600 text-[14px]">📍</span>
            </div>

            {/* Customer Details Box */}
            <div className="border-2 border-black rounded-xl p-3 bg-slate-100 flex justify-between items-center text-sm font-bold print:bg-slate-100 mb-6 shadow-sm">
              <div>
                بەرێز (اسم العميل): <span className="text-pink-600 text-base">{customer.name}</span>
              </div>
              <div>
                تەلەفۆن (الهاتف): <span className="font-mono">{customer.phone || "..."}</span>
              </div>
              {(fromDate || toDate) && (
                <div className="text-xs text-slate-700 bg-white border border-slate-200 py-1 px-3 rounded">
                  {fromDate && (
                    <span>
                      له‌ بەرواری: <span className="font-mono">{fromDate.replace(/-/g, "/")}</span>
                    </span>
                  )}
                  {toDate && (
                    <span>
                      {" "}تا بەرواری: <span className="font-mono">{toDate.replace(/-/g, "/")}</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {loading ? (
            <div className="py-20 text-center font-bold text-slate-500 animate-pulse">
              داتا ئامادە دەکرێت...
            </div>
          ) : (
            <div className="overflow-x-auto print:overflow-visible border border-black rounded-lg print:rounded-none">
              <table className="w-full text-sm text-center font-bold border-collapse print:text-black">
                <thead className="bg-[#f8f9fa] print:bg-transparent">
                  <tr>
                    <th className="p-2 border-2 border-black whitespace-nowrap bg-gray-200 print:bg-gray-200 w-12 text-sm">
                      ڕیزبەندی
                    </th>
                    <th className="p-2 border-2 border-black whitespace-nowrap bg-gray-200 print:bg-gray-200 w-20 text-sm">
                      بەڵگە
                    </th>
                    <th className="p-2 border-2 border-black whitespace-nowrap bg-gray-200 print:bg-gray-200 w-28 text-sm">
                      بەروار
                    </th>
                    <th className="p-2 border-2 border-black bg-gray-200 print:bg-gray-200 flex-1 min-w-[200px] text-sm">
                      ڕوون کردنەوەی بەڵگە
                    </th>
                    <th className="p-2 border-2 border-black whitespace-nowrap bg-gray-200 print:bg-gray-200 w-20 text-sm">
                      جۆری بەڵگە
                    </th>
                    <th className="p-1 border-2 border-black whitespace-nowrap bg-red-100 print:bg-red-100 w-24 text-red-700 text-xs">
                      قەرزدار (-)
                    </th>
                    <th className="p-1 border-2 border-black whitespace-nowrap bg-emerald-100 print:bg-emerald-100 w-24 text-emerald-700 text-xs">
                      قەرزدەر (+)
                    </th>
                    <th className="p-1 border-2 border-black whitespace-nowrap bg-slate-200 print:bg-slate-200 w-28 text-xs font-black">
                      ماوە
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* Initial Balance (zero or previous balance) */}
                  <tr>
                    <td className="p-2 border-2 border-black font-mono font-medium text-sm">1</td>
                    <td className="p-2 border-2 border-black font-mono font-medium text-sm">-</td>
                    <td className="p-2 border-2 border-black font-mono font-medium text-sm">-</td>
                    <td className="p-2 border-2 border-black text-right pr-4 font-extrabold text-sm">
                      مانەوەی یەکەم دەورە
                    </td>
                    <td className="p-2 border-2 border-black text-sm">دۆلار</td>
                    <td className="p-2 border-2 border-black font-mono text-slate-400 text-sm">
                      -
                    </td>
                    <td className="p-2 border-2 border-black font-mono text-slate-400 text-sm">
                      -
                    </td>
                    <td className="p-2 border-2 border-black font-mono font-extrabold text-sm" dir="ltr">
                      {formatCurrency(previousBalance)}
                    </td>
                  </tr>
                  {filteredEntries.map((entry, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="p-2 border-2 border-black font-mono font-medium text-sm">
                        {idx + 2}
                      </td>
                      <td className="p-2 border-2 border-black font-mono font-medium text-sm">
                        {entry.docNo}
                      </td>
                      <td className="p-2 border-2 border-black font-mono font-medium text-sm">
                        {entry.date
                          .toLocaleDateString("en-CA", {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                          })
                          .replace(/-/g, "/")}
                      </td>
                      <td className="p-2 border-2 border-black text-right pr-4 text-xs sm:text-sm font-semibold">
                        {entry.details}
                      </td>
                      <td className="p-2 border-2 border-black text-sm">{entry.type}</td>
                      <td className="p-1 border-2 border-black font-mono font-bold text-xs text-red-600 print:text-red-700">
                        {entry.debit > 0 ? formatCurrency(entry.debit) : "0"}
                      </td>
                      <td className="p-1 border-2 border-black font-mono font-bold text-xs text-emerald-600 print:text-emerald-700">
                        {entry.credit > 0 ? formatCurrency(entry.credit) : "0"}
                      </td>
                      <td
                        className="p-1 border-2 border-black font-mono font-extrabold bg-slate-50 print:bg-slate-100 text-xs"
                        dir="ltr"
                      >
                        {formatCurrency(entry.balance)}
                      </td>
                    </tr>
                  ))}
                  {/* Final Balance Row */}
                  <tr className="bg-gray-200 print:bg-gray-200 border-t-[3px] border-black">
                    <td
                      colSpan={5}
                      className="p-2 border-2 border-black font-extrabold text-left pl-4 text-sm"
                    >
                      کۆی گشتی حیساب:
                    </td>
                    <td className="p-2 border-2 border-black font-mono font-bold text-red-700 text-sm">
                      {formatCurrency(
                        filteredEntries.reduce((sum, e) => sum + e.debit, 0),
                      )}
                    </td>
                    <td className="p-2 border-2 border-black font-mono font-bold text-emerald-700 text-sm">
                      {formatCurrency(
                        filteredEntries.reduce((sum, e) => sum + e.credit, 0),
                      )}
                    </td>
                    <td
                      className="p-2 border-2 border-black font-mono font-black text-base"
                      dir="ltr"
                    >
                      {formatCurrency(runningBalance)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Sigs only on print */}
          <div className="hidden print:flex justify-between items-center px-16 mt-12 mb-2 text-[11px] font-bold text-slate-800">
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
  );
}
