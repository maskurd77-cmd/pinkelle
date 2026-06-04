import React, { useRef } from "react";
import { useReactToPrint } from "react-to-print";
import { Printer, X } from "lucide-react";
import { formatCurrency } from "../data";

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
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `وەسڵی قەبز - ${debt.customerName}`,
  });

  const formatDate = (ts: any) => {
    if (!ts) return "";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col">
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
        <div className="md:hidden p-3 flex justify-between items-center bg-white border-b border-slate-100">
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center"
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

        {/* Printable Area - Landscape A5 style layout roughly */}
        <div className="p-4 sm:p-8 overflow-auto bg-slate-100 flex-1 flex justify-center custom-scrollbar">
          <div
            ref={printRef}
            className="w-[210mm] min-h-[148mm] bg-white text-black p-[10mm] box-border relative shadow-sm mx-auto"
            dir="rtl"
            style={{ fontFamily: "Arial, sans-serif" }}
          >
            {/* Simple aesthetic border */}
            <div className="absolute inset-[6mm] border-[2px] border-double border-pink-700/80 rounded-sm pointer-events-none"></div>

            {/* Header */}
            <div className="flex justify-between items-start mb-6 border-b border-slate-300 pb-4 relative z-10 px-4 pt-4">
              {/* Right side - Logo/Title */}
              <div className="text-right">
                <h1
                  className="text-3xl font-black text-rose-700 tracking-tight mb-1"
                  style={{ fontFamily: "Impact, sans-serif" }}
                >
                  گروپی PINK ELLE
                </h1>
                <h2 className="text-lg font-bold text-slate-800">
                  تاکە بریکاری PINK ELLE
                </h2>
                <div className="text-[11px] font-bold text-slate-600 mt-1 whitespace-pre-wrap">
                  ژمارەی کۆمپانیا: 0751 201 8372 - 0750 425 1338
                </div>
              </div>

              {/* Title Center */}
              <div className="flex flex-col items-center justify-center pt-2">
                <div className="border-[3px] border-rose-700 px-6 py-2 rounded-full transform -rotate-2">
                  <h2 className="text-2xl font-black text-rose-700 tracking-wider">
                    وەسڵـــی قەبـــز
                  </h2>
                  <span className="text-xs text-rose-700 font-bold opacity-80 uppercase flex justify-center mt-0.5">
                    Receipt
                  </span>
                </div>
              </div>

              {/* Left side - Meta */}
              <div className="text-left font-mono font-bold text-sm space-y-2 pt-2 text-rose-900 bg-rose-50/50 p-2 border border-rose-100 rounded-lg">
                <div dir="ltr">
                  <span className="text-xs text-slate-500 font-sans mr-2 border-r border-slate-300 pr-2">
                    No:
                  </span>{" "}
                  {transaction.id?.slice(0, 8).toUpperCase() || "N/A"}
                </div>
                <div dir="ltr">
                  <span className="text-xs text-slate-500 font-sans mr-2 border-r border-slate-300 pr-2">
                    Date:
                  </span>{" "}
                  {formatDate(transaction.timestamp)}
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="px-8 mt-12 space-y-8 z-10 relative">
              <div className="flex items-end gap-2 text-lg font-bold">
                <span className="shrink-0 text-rose-900 w-32 border-b-2 border-rose-800 pb-1 align-bottom flex justify-between pr-2">
                  وەرم گرت لەبەڕێز <span>:</span>
                </span>
                <span className="border-b-[1.5px] border-dashed border-slate-400 flex-1 pb-1 px-4 text-xl text-slate-800">
                  {debt.customerName}
                </span>
              </div>

              <div className="flex items-end gap-2 text-lg font-bold">
                <span className="shrink-0 text-rose-900 w-32 border-b-2 border-rose-800 pb-1 align-bottom flex justify-between pr-2">
                  بڕی پارە <span>:</span>
                </span>
                <span className="border-b-[1.5px] border-dashed border-slate-400 flex-1 pb-1 px-4 font-mono text-xl text-emerald-700 tracking-wider flex justify-between items-center">
                  {transaction.originalCurrency === "USD" ? (
                    <>
                      <span>
                        {formatCurrency(
                          transaction.originalAmount || transaction.amount,
                          "USD",
                        ).replace("USD", "")}
                      </span>
                      <span className="text-xs text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 ml-2">
                        دۆلار / USD
                      </span>
                    </>
                  ) : (
                    <>
                      <span>
                        {formatCurrency(
                          transaction.originalAmount || transaction.amount,
                          "IQD",
                        ).replace("IQD", "")}
                      </span>
                      <span className="text-xs text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 ml-2">
                        دینار / IQD
                      </span>
                    </>
                  )}
                </span>
              </div>

              <div className="flex items-end gap-2 text-lg font-bold">
                <span className="shrink-0 text-rose-900 w-32 border-b-2 border-rose-800 pb-1 align-bottom flex justify-between pr-2">
                  دینار / دۆلار <span>:</span>
                </span>
                <span className="border-b-[1.5px] border-dashed border-slate-400 flex-1 pb-1 px-4 font-mono text-xl tracking-wider text-slate-400/50 flex justify-between items-center">
                  {transaction.originalCurrency === "USD" ? (
                    <>
                      <span className="text-sm text-slate-500 font-sans tracking-normal">
                        (بەرامبەر بە دینار:{" "}
                        {formatCurrency(
                          (transaction.originalAmount || transaction.amount) *
                            (transaction.exchangeRate || 1500),
                          "IQD",
                        )}
                        )
                      </span>
                    </>
                  ) : (
                    <span className="text-sm">...</span>
                  )}
                </span>
              </div>

              <div className="flex items-end gap-2 text-lg font-bold mt-12">
                <span className="shrink-0 text-rose-900 w-32 border-b-2 border-rose-800 pb-1 align-bottom flex justify-between pr-2">
                  بڕی ماوە <span>:</span>
                </span>
                <span className="border-b-[1.5px] border-dashed border-slate-400 w-64 pb-1 px-4 font-mono text-xl text-red-600 tracking-wider flex justify-between items-center">
                  <span>
                    {formatCurrency(debt.remainingAmount || 0, "IQD").replace(
                      "IQD",
                      "",
                    )}
                  </span>
                  <span className="text-[10px] text-red-500 bg-red-50 px-1.5 py-0.5 rounded border border-red-100 ml-1 leading-none">
                    دینار / IQD
                  </span>
                </span>
              </div>
            </div>

            {/* Signatures */}
            <div className="mt-20 mx-8 flex justify-between z-10 relative">
              <div className="text-center font-bold text-slate-800 border-t-2 border-slate-300 pt-3 w-48">
                ناوی و واژووی پارەدەندەر
              </div>
              <div className="text-center font-bold text-slate-800 border-t-2 border-slate-300 pt-3 w-48">
                بەڕێوەبەری حساب
              </div>
            </div>

            {/* Watermark in background */}
            <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none select-none overflow-hidden">
              <h1
                className="text-[120px] font-black text-rose-900 transform -rotate-[15deg] whitespace-nowrap"
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
