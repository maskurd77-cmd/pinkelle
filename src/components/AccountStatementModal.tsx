import React, { useState, useEffect } from "react";
import { X, Printer } from "lucide-react";
import { formatCurrency } from "../data";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";

export default function AccountStatementModal({
  customer,
  receipts: initialReceipts,
  debts,
  onClose,
}: any) {
  const [debtTransactions, setDebtTransactions] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>(initialReceipts || []);
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

      let fetchedReceipts = initialReceipts;
      if (!fetchedReceipts) {
        const qReceipts = query(
          collection(db, "receipts"),
          where("customerName", "==", customer.name),
        );
        const snapReceipts = await getDocs(qReceipts);
        fetchedReceipts = snapReceipts.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setReceipts(fetchedReceipts);
      }

      const debtIds = customerDebts.map((d: any) => d.id);
      let trans: any[] = [];

      if (debtIds.length > 0) {
        const q = query(collection(db, "debt_transactions"));
        const snap = await getDocs(q);
        trans = snap.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((d) => debtIds.includes((d as any).debtId));
      }

      setDebtTransactions(trans);
      setLoading(false);
    };
    fetchData();
  }, [customer.name, debts, initialReceipts]);

  // Build the ledger
  let ledgerEntries: any[] = [];

  // Add receipts
  receipts.forEach((r: any) => {
    if (r.customerName !== customer.name) return;
    const ts = r.timestamp?.toDate ? r.timestamp.toDate() : new Date();

    // Purchase (Debit)
    ledgerEntries.push({
      date: ts,
      docNo: r.id.slice(-6).toUpperCase(),
      details: `پسووڵەی کڕین ژمارە: ${r.id.slice(-6).toUpperCase()}`,
      type: "دۆلار",
      debit:
        r.invoiceCurrency === "USD"
          ? r.totalAmount
          : r.totalAmount / (r.exchangeRate || 1500),
      credit: 0,
      isReceipt: true,
      originalId: r.id,
    });

    // If paid by cash, add payment line
    if (r.paymentType === "cash" || r.paymentType === "نەقد") {
      ledgerEntries.push({
        date: new Date(ts.getTime() + 1000), // add 1s to make it appear after purchase
        docNo: r.id.slice(-6).toUpperCase(),
        details: `پارەدانی نەقد ڕاستەوخۆ بۆ وەسڵی ژمارە: ${r.id.slice(-6).toUpperCase()}`,
        type: "دۆلار",
        debit: 0,
        credit:
          r.invoiceCurrency === "USD"
            ? r.totalAmount
            : r.totalAmount / (r.exchangeRate || 1500),
        isCashPaid: true,
      });
    }
  });

  // Add Debt Transactions
  debtTransactions.forEach((tx: any) => {
    const ts = tx.timestamp?.toDate ? tx.timestamp.toDate() : new Date();

    if (tx.type === "add") {
      // Only include if it doesn't mention 'وەسڵ', to avoid duplicating receipts
      if (!tx.notes?.includes("وەسڵ")) {
        ledgerEntries.push({
          date: ts,
          docNo: tx.id.slice(-6).toUpperCase(),
          details: tx.notes || "زیادکردنی قەرز",
          type: "دۆلار",
          debit: tx.originalAmount || tx.amount,
          credit: 0,
        });
      }
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
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] print:p-0 print:bg-white print:block overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-[95vw] lg:max-w-6xl my-auto shadow-2xl print:shadow-none print:w-full print:max-w-none print:rounded-none">
        <div className="sticky top-0 bg-white/80 backdrop-blur-md p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 z-10 print:hidden">
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
        <div className="p-8 print:p-4" dir="rtl">
          <div className="hidden print:block mb-6 border-2 border-black rounded-lg p-6">
            <style type="text/css" media="print">
              {"@page { size: landscape; margin: 10mm; }"}
            </style>
            <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-4">
              <div className="flex items-start gap-4">
                <div className="shrink-0 w-16 h-16 bg-pink-50 border-2 border-pink-200 rounded-full flex items-center justify-center text-pink-700 shadow-md">
                  <div className="flex flex-col items-center leading-none">
                    <span className="text-xl font-black font-mono tracking-tighter">
                      PE
                    </span>
                  </div>
                </div>
                <div
                  className="text-2xl font-black text-rose-800 tracking-tight"
                  style={{ fontFamily: "Impact, sans-serif" }}
                >
                  گروپی PINK ELLE
                  <div className="text-sm font-bold text-slate-800 mt-1">
                    تاکە بریکاری PINK ELLE
                  </div>
                </div>
              </div>
              <div className="text-center font-black text-2xl border-2 border-black px-6 py-2 rounded-xl">
                کەشفی حساب
              </div>
              <div
                className="text-[12px] font-bold text-slate-700 flex flex-col items-end gap-1"
                dir="rtl"
              >
                <div className="flex items-center gap-1">
                  <span>ژمارەی کۆمپانیا:</span>
                  <span dir="ltr">0751 201 8372</span>
                  <span>-</span>
                  <span dir="ltr">0750 425 1338</span>
                </div>
                <div>
                  بەرواری چاپ: {printDate} {printTime}
                </div>
              </div>
            </div>

            <div className="flex justify-between items-end">
              <div className="text-xl font-bold flex flex-col gap-2">
                <div>بەرێز: {customer.name}</div>
                {(fromDate || toDate) && (
                  <div className="text-sm">
                    {fromDate && (
                      <span>
                        لە بەرواری:{" "}
                        <span className="font-mono">
                          {fromDate.replace(/-/g, "/")}
                        </span>{" "}
                      </span>
                    )}
                    {toDate && (
                      <span>
                        تا بەرواری:{" "}
                        <span className="font-mono">
                          {toDate.replace(/-/g, "/")}
                        </span>
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="text-center">
                <h1 className="text-3xl font-extrabold font-mono tracking-wider">
                  ڕاپۆرتی کەشفی حیساب
                </h1>
              </div>
              <div className="text-left text-sm font-bold flex flex-col items-end gap-1">
                <div>
                  بەرواری چاپ: <span className="font-mono">{printDate}</span>
                </div>
                <div>
                  کاتژمێری چاپ: <span className="font-mono">{printTime}</span>
                </div>
              </div>
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
                    <th className="p-3 border border-black whitespace-nowrap bg-gray-100 w-16">
                      ڕیزبەندی
                    </th>
                    <th className="p-3 border border-black whitespace-nowrap bg-gray-100 w-24">
                      بەڵگە
                    </th>
                    <th className="p-3 border border-black whitespace-nowrap bg-gray-100 w-32">
                      بەروار
                    </th>
                    <th className="p-3 border border-black bg-gray-100 flex-1 min-w-[200px]">
                      ڕوون کردنەوەی بەڵگە
                    </th>
                    <th className="p-3 border border-black whitespace-nowrap bg-gray-100 w-24">
                      جۆری بەڵگە
                    </th>
                    <th className="p-3 border border-black whitespace-nowrap bg-gray-100 w-32 text-red-600">
                      قەرزدار
                    </th>
                    <th className="p-3 border border-black whitespace-nowrap bg-gray-100 w-32 text-emerald-600">
                      قەرزدەر
                    </th>
                    <th className="p-3 border border-black whitespace-nowrap bg-gray-100 w-36">
                      ماوە
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* Initial Balance (zero or previous balance) */}
                  <tr>
                    <td className="p-3 border border-black font-mono">1</td>
                    <td className="p-3 border border-black font-mono">-</td>
                    <td className="p-3 border border-black font-mono">-</td>
                    <td className="p-3 border border-black text-right pr-4">
                      مانەوەی یەکەم دەورە
                    </td>
                    <td className="p-3 border border-black">دۆلار</td>
                    <td className="p-3 border border-black font-mono text-slate-400">
                      -
                    </td>
                    <td className="p-3 border border-black font-mono text-slate-400">
                      -
                    </td>
                    <td className="p-3 border border-black font-mono" dir="ltr">
                      {formatCurrency(previousBalance)}
                    </td>
                  </tr>
                  {filteredEntries.map((entry, idx) => (
                    <tr key={idx}>
                      <td className="p-3 border border-black font-mono">
                        {idx + 2}
                      </td>
                      <td className="p-3 border border-black font-mono">
                        {entry.docNo}
                      </td>
                      <td className="p-3 border border-black font-mono">
                        {entry.date
                          .toLocaleDateString("en-CA", {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                          })
                          .replace(/-/g, "/")}
                      </td>
                      <td className="p-3 border border-black text-right pr-4 text-xs sm:text-sm">
                        {entry.details}
                      </td>
                      <td className="p-3 border border-black">{entry.type}</td>
                      <td className="p-3 border border-black font-mono">
                        {entry.debit > 0 ? formatCurrency(entry.debit) : "0"}
                      </td>
                      <td className="p-3 border border-black font-mono">
                        {entry.credit > 0 ? formatCurrency(entry.credit) : "0"}
                      </td>
                      <td
                        className="p-3 border border-black font-mono font-extrabold"
                        dir="ltr"
                      >
                        {formatCurrency(entry.balance)}
                      </td>
                    </tr>
                  ))}
                  {/* Final Balance Row */}
                  <tr className="bg-gray-100 print:bg-transparent border-t-4 border-black">
                    <td
                      colSpan={5}
                      className="p-3 border border-black font-extrabold text-left pl-4"
                    >
                      کۆی گشتی حیساب:
                    </td>
                    <td className="p-3 border border-black font-mono font-bold text-red-600">
                      {formatCurrency(
                        filteredEntries.reduce((sum, e) => sum + e.debit, 0),
                      )}
                    </td>
                    <td className="p-3 border border-black font-mono font-bold text-emerald-600">
                      {formatCurrency(
                        filteredEntries.reduce((sum, e) => sum + e.credit, 0),
                      )}
                    </td>
                    <td
                      className="p-3 border border-black font-mono font-black text-lg"
                      dir="ltr"
                    >
                      {formatCurrency(runningBalance)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
