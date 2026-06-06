import React, { useRef, useState, useEffect } from "react";
import { Printer, X } from "lucide-react";
import { formatCurrency } from "../data";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";

interface DebtReceiptModalProps {
  transaction: any;
  debt: any;
  onClose: () => void;
}

export function DebtReceiptModal({
  transaction,
  debt,
  onClose,
}: DebtReceiptModalProps) {
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [calculatedPrevDebt, setCalculatedPrevDebt] = useState(0);
  const [calculatedRemDebt, setCalculatedRemDebt] = useState(0);

  const handlePrint = () => {
    window.print();
  };

  const formatDate = (ts: any) => {
    if (!ts) return "";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  };

  useEffect(() => {
    const fetchAndCalculate = async () => {
      try {
        setLoadingHistory(true);
        // Query database for all completed transactions for this specific debt account
        const q = query(
          collection(db, "debt_transactions"),
          where("debtId", "==", debt.id),
          where("status", "==", "completed")
        );
        const snap = await getDocs(q);
        const txs = snap.docs
          .map((doc) => ({ id: doc.id, ...doc.data() } as any))
          .sort((a, b) => {
            const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : new Date(a.timestamp).getTime();
            const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : new Date(b.timestamp).getTime();
            return timeA - timeB;
          });

        let runningBalance = 0;
        let selectedTxIndex = -1;

        const runningTxs = txs.map((tx, idx) => {
          if (tx.type === "add") {
            runningBalance += tx.amount || 0;
          } else if (tx.type === "pay") {
            runningBalance -= tx.amount || 0;
          }
          
          if (tx.id === transaction.id) {
            selectedTxIndex = idx;
          }
          return {
            ...tx,
            balanceAfter: runningBalance
          };
        });

        const amt = transaction.originalAmount || transaction.amount || 0;

        if (transaction.isGeneric) {
          setCalculatedRemDebt(debt.remainingAmount || 0);
          setCalculatedPrevDebt(debt.remainingAmount || 0);
        } else if (selectedTxIndex !== -1) {
          const targetTx = runningTxs[selectedTxIndex];
          const remDebt = targetTx.balanceAfter;
          const prevDebt = targetTx.type === "pay" ? remDebt + amt : remDebt - amt;
          
          setCalculatedRemDebt(remDebt);
          setCalculatedPrevDebt(prevDebt);
        } else {
          // Fallback if not inside the completed list
          if (transaction.type === "pay") {
            setCalculatedRemDebt(debt.remainingAmount || 0);
            setCalculatedPrevDebt((debt.remainingAmount || 0) + amt);
          } else {
            setCalculatedRemDebt(debt.remainingAmount || 0);
            setCalculatedPrevDebt((debt.remainingAmount || 0) - amt);
          }
        }
      } catch (e) {
        console.error("Error calculating balances:", e);
        const amt = transaction.originalAmount || transaction.amount || 0;
        setCalculatedRemDebt(debt.remainingAmount || 0);
        setCalculatedPrevDebt((debt.remainingAmount || 0) + amt);
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchAndCalculate();
  }, [debt.id, transaction.id, transaction.isGeneric, debt.remainingAmount]);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 print:static print:inset-auto print:bg-white print:p-0 print:w-full print:h-auto overflow-y-auto">
      <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-3xl flex flex-col print:shadow-none print:w-full print:max-w-none print:rounded-none">
        {/* Header */}
        <div className="px-6 py-4 flex justify-between items-center bg-slate-50 border-b border-slate-100 print:hidden hidden md:flex">
          <h2 className="font-extrabold text-slate-800 text-lg flex items-center gap-2">
            چاپی وەسڵی قەبز
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => handlePrint()}
              className="px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-colors shadow-sm"
            >
              <Printer size={16} /> چاپکردن
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white hover:bg-slate-100 border border-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors shadow-sm"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Mobile controls */}
        <div className="md:hidden p-3 flex justify-between items-center bg-white border-b border-slate-100 pb-3 print:hidden">
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center animate-hover"
          >
            <X size={20} />
          </button>
          <button
            onClick={() => handlePrint()}
            className="px-6 py-2.5 bg-pink-600 active:bg-pink-700 text-white rounded-full text-sm font-bold flex items-center gap-2 shadow-lg shadow-pink-200"
          >
            <Printer size={18} /> چاپکردن
          </button>
        </div>

        {/* Printable Area - Landscape layout */}
        <div className="p-4 sm:p-8 shrink-0 bg-slate-100 print:bg-white print:p-0 print:overflow-visible">
          <div
            className="w-full bg-white text-black p-[6mm] box-border relative shadow-sm mx-auto flex flex-col justify-between print:shadow-none print:w-full print:m-0"
            dir="rtl"
            style={{ fontFamily: "Arial, sans-serif" }}
          >
            <style type="text/css" media="print">
              {`
                @page { size: A5 landscape; margin: 0; }
                body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              `}
            </style>

            {/* Simple aesthetic border */}
            <div className="absolute inset-[5mm] border-[2px] border-double border-pink-700/80 rounded-sm pointer-events-none"></div>

            {/* Header */}
            <div>
              <div className="flex justify-between items-center mb-2 border-b-[3px] border-black pb-2 relative z-10 px-4 pt-2">
                {/* Right side - Logo/Title */}
                <div className="text-right flex items-center gap-3">
                  <div className="shrink-0 w-16 h-16">
                    <img
                      src="https://cheerful-pink-qakkchpr.edgeone.app/Pink%20Elle%20logo%20new-1_page-0001.jpg"
                      alt="Pink Elle Logo"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div>
                    <h1
                      className="text-xl font-extrabold text-pink-600 tracking-widest leading-none"
                      style={{ fontFamily: "Impact, sans-serif" }}
                    >
                      گروپی PINK ELLE
                    </h1>
                    <h4 className="text-[9px] font-bold text-slate-500 mt-1">
                      بۆ بازرگانی گشتی - سنووردار
                    </h4>
                  </div>
                </div>

                {/* Title Center */}
                <div className="flex flex-col items-center justify-center">
                  <div className="border-[2px] border-pink-600 px-5 py-1 rounded-full bg-pink-50/20">
                    <h2 className="text-lg font-black text-pink-700 tracking-wider">
                      وەسڵـــی قەبـــز
                    </h2>
                    <span className="text-[9px] text-pink-600 font-bold opacity-80 uppercase flex justify-center leading-none">
                      Receipt
                    </span>
                  </div>
                </div>

                {/* Left side - Meta */}
                <div className="text-left font-mono font-bold text-[10px] space-y-0.5 bg-slate-50 p-1.5 border border-black/10 rounded-md">
                  <div dir="ltr" className="flex items-center gap-1">
                    <span className="text-[9px] text-slate-500 font-sans border-r border-slate-300 pr-1">
                      No:
                    </span>
                    <span>
                      {transaction.id?.slice(0, 8).toUpperCase() || "N/A"}
                    </span>
                  </div>
                  <div dir="ltr" className="flex items-center gap-1">
                    <span className="text-[9px] text-slate-500 font-sans border-r border-slate-300 pr-1">
                      Date:
                    </span>
                    <span>{formatDate(transaction.timestamp)}</span>
                  </div>
                  <div dir="ltr" className="flex items-center gap-1">
                    <span className="text-[9px] text-slate-500 font-sans border-r border-slate-300 pr-1">
                      Contact:
                    </span>
                    <span className="text-[8px] font-bold font-sans">07512018372</span>
                  </div>
                </div>
              </div>

              {/* Address Bar */}
              <div className="text-center font-extrabold text-[10px] mb-2 bg-gray-100 py-0.5 border border-black rounded mx-4 relative z-10">
                سۆران - شۆڕش - بەرامبەر مزگەوتی شۆڕش{" "}
                <span className="text-pink-600 text-[10px]">📍</span>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 space-y-3 z-10 relative flex-1 flex flex-col justify-center">
              <div className="grid grid-cols-12 gap-4">
                {/* Right side: Customer & Agent Info */}
                <div className="col-span-7 bg-pink-50/30 border-2 border-pink-100/50 rounded-xl p-3 flex flex-col justify-center space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold border-b border-pink-100/40 pb-1.5">
                    <span className="text-pink-900">ناوی کڕیار (اسم المشتري):</span>
                    <span className="text-sm text-slate-800 font-extrabold">{debt.customerName}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-bold border-b border-pink-100/40 pb-1.5">
                    <span className="text-pink-900">مەندوبی فرۆش (المندوب):</span>
                    <span className="text-slate-700 font-bold">{debt.sellerName || "کۆمپانیا"}</span>
                  </div>
                  {transaction.notes && (
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span className="text-slate-500">تێبینی (ملاحظات):</span>
                      <span className="text-slate-700 italic">{transaction.notes}</span>
                    </div>
                  )}
                </div>

                {/* Left side: Debt Details Badges */}
                <div className="col-span-5 flex flex-col justify-between gap-1.5">
                  {transaction.isGeneric ? (
                    <>
                      {/* Total Debt */}
                      <div className="border border-black/10 rounded-lg bg-slate-50 p-2 text-center flex justify-between items-center px-3">
                        <span className="text-[10px] text-slate-500 font-bold">کۆی گشتی قەرز (إجمالي الدين):</span>
                        <span className="font-mono text-xs font-bold text-slate-700">
                          {formatCurrency(debt.amount || 0)}
                        </span>
                      </div>
                      
                      {/* Total Paid */}
                      <div className="border border-emerald-200 rounded-lg bg-emerald-50/50 p-2 text-center flex justify-between items-center px-3">
                        <span className="text-[10px] text-emerald-700 font-bold">کۆی دراوە (إجمالي المدفوع):</span>
                        <span className="font-mono text-xs font-bold text-emerald-700">
                          {formatCurrency((debt.amount || 0) - (debt.remainingAmount || 0))}
                        </span>
                      </div>

                      {/* Remaining Balance */}
                      <div className="border-2 border-red-600 rounded-lg bg-red-50 p-2 text-center flex justify-between items-center px-3">
                        <span className="text-[10px] text-red-600 font-black">قەرزی ماوە (الدين المتبقي):</span>
                        <span className="font-mono text-sm font-black text-red-600">
                          {formatCurrency(debt.remainingAmount || 0)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Previous Debt */}
                      <div className="border border-black/10 rounded-lg bg-slate-50 p-2 text-center flex justify-between items-center px-3">
                        <span className="text-[10px] text-slate-500 font-bold">قەرزی پێشوو (الدين السابق):</span>
                        <span className="font-mono text-xs font-bold text-slate-700">
                          {loadingHistory ? "..." : formatCurrency(calculatedPrevDebt)}
                        </span>
                      </div>

                      {/* Received Amount */}
                      <div className="border-2 border-pink-600 rounded-lg bg-pink-50/80 p-2 text-center flex justify-between items-center px-3">
                        <span className="text-[10px] text-pink-700 font-black">بڕی وەرگیراو (المبلغ المستلم):</span>
                        <span className="font-mono text-sm font-black text-pink-700">
                          {formatCurrency(
                            transaction.originalAmount || transaction.amount || 0
                          )}
                        </span>
                      </div>

                      {/* Remaining Debt */}
                      <div className="border border-red-200 rounded-lg bg-red-400/5 p-2 text-center flex justify-between items-center px-3">
                        <span className="text-[10px] text-red-600 font-bold">قەرزی ماوە (الدين المتبقي):</span>
                        <span className="font-mono text-xs font-bold text-red-600">
                          {loadingHistory ? "..." : formatCurrency(calculatedRemDebt)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Elegant formal statement */}
              <div className="text-center font-bold text-[9px] text-slate-500 bg-gray-50/50 py-1 px-3 border border-gray-100 rounded-lg italic">
                ”ئەم وەسڵە وەک بەڵگەی وەرگرتنی بڕی پارەی ئاماژەپێکراو لە کڕیاری بەڕێز ڕێکخراوە.“
              </div>
            </div>

            {/* Signatures */}
            <div className="mb-4 mx-12 flex justify-between z-10 relative">
              <div className="text-center flex flex-col items-center">
                <div className="mb-4 font-bold text-slate-700 text-[10px]">ناوی و واژووی پارەدەندەر</div>
                <div className="w-28 border-b border-dashed border-slate-300"></div>
              </div>
              <div className="text-center flex flex-col items-center">
                <div className="mb-4 font-bold text-slate-700 text-[10px]">مۆر و واژووی بەڕێوەبەری حسابات</div>
                <div className="w-28 border-b border-dashed border-slate-300"></div>
              </div>
            </div>

            {/* Watermark in background */}
            <div className="absolute inset-0 flex items-center justify-center opacity-[0.02] pointer-events-none select-none overflow-hidden">
              <h1
                className="text-[90px] font-black text-rose-900 transform -rotate-[15deg] whitespace-nowrap"
                style={{ fontFamily: "Impact, sans-serif" }}
              >
                PINK ELLE
              </h1>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
