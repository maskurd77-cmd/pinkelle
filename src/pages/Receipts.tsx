import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  ReceiptText,
  Printer,
  Eye,
  X,
  CheckCircle2,
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
  const [search, setSearch] = useState("");
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);
  const [userRole, setUserRole] = useState("");
  const [isProcessingId, setIsProcessingId] = useState<string | null>(null);

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
            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
              <ReceiptText size={20} />
            </div>
            <h2 className="text-xl font-extrabold text-slate-800">وەسڵەکان</h2>

            <div className="flex bg-slate-100 p-1 rounded-xl mr-6">
              <button
                onClick={() => setActiveTab("completed")}
                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${activeTab === "completed" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
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
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pr-10 pl-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-800 shadow-sm"
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
                  <td className="px-6 py-4 text-slate-600 font-bold font-mono">
                    {rec.totalItems} دانە
                  </td>
                  <td className="px-6 py-4 font-bold text-indigo-700">
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
                        className="text-indigo-600 bg-indigo-50 hover:bg-indigo-100 hover:text-indigo-700 font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm text-xs"
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
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                  <Printer size={18} className="sm:w-5 sm:h-5" />
                </div>
                <h2 className="font-extrabold text-slate-800 text-base sm:text-lg">
                  پێشبینینی چاپ
                </h2>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handlePrint}
                  className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl flex items-center gap-2 hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-500/20 font-bold text-sm transition-all"
                >
                  <Printer size={16} /> چاپکردن
                </button>
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
              <div className="bg-white shadow-lg w-[210mm] min-h-[297mm] p-0 relative">
                <ReceiptPrintLayout receipt={selectedReceipt} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Actual Print Layout (Only visible during print) */}
      <div className="hidden print:block w-full">
        {selectedReceipt && <ReceiptPrintLayout receipt={selectedReceipt} />}
      </div>
    </div>
  );
}

export function ReceiptPrintLayout({ receipt }: { receipt: any }) {
  const ts = receipt.timestamp?.toDate
    ? receipt.timestamp.toDate()
    : new Date();

  return (
    <div
      className="w-[210mm] min-h-[297mm] bg-white text-black p-[10mm] mx-auto box-border flex flex-col relative"
      dir="rtl"
      style={{ fontFamily: "Arial, sans-serif" }}
    >
      {/* Top Header - Compact Row Layout */}
      <div className="flex justify-between items-center mb-4 border-b-[3px] border-black pb-4 relative">
        {/* Right Side - Logo */}
        <div className="flex items-center justify-center shrink-0 w-32 h-32">
          <img
            src="https://skilled-indigo-cux52hz9.edgeone.app/Pink%20Elle%20logo%20new-1_page-0001.jpg"
            alt="Pink Elle Logo"
            className="w-full h-full object-contain mix-blend-multiply drop-shadow-sm"
          />
        </div>

        {/* Center - Company Info */}
        <div className="flex-1 text-center px-4">
          <h1
            className="text-4xl font-extrabold text-pink-600 tracking-widest mb-2 leading-none"
            style={{ fontFamily: "Impact, sans-serif" }}
          >
            گروپی PINK ELLE
          </h1>
          <h2 className="text-xl font-extrabold text-slate-800 mb-1">
            تاکە بریکاری{" "}
            <span
              className="text-pink-600 font-extrabold tracking-wide"
              style={{ fontFamily: "Impact, sans-serif" }}
            >
              PINK ELLE
            </span>
          </h2>
          <h3 className="text-lg font-bold text-slate-800 mb-1">
            بۆ دابینکردنی کەلوپەلی پاککەرەوە
          </h3>
          <h4 className="text-sm font-bold text-slate-600 mb-2">
            بۆ بازرگانی گشتی - سنووردار
          </h4>
        </div>

        {/* Left Side - Contacts */}
        <div className="shrink-0 text-right flex flex-col gap-2">
          <div className="bg-slate-50 border-2 border-black rounded p-2 shadow-sm text-sm font-bold w-60">
            <div className="text-center text-xs mb-1 border-b border-black/20 pb-1">
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
      <div className="text-center font-extrabold text-base mb-4 bg-gray-100 py-1.5 border border-black rounded">
        سۆران - شۆڕش - بەرامبەر مزگەوتی شۆڕش{" "}
        <span className="text-pink-600 text-lg">📍</span>
      </div>

      {/* Info Boxes Header */}
      <div className="flex justify-between items-start mb-4 gap-4 text-xs">
        {/* Left Side Info */}
        <div className="flex-1 flex flex-col gap-1.5">
          <div className="flex items-center">
            <div className="w-24 text-right font-bold ml-2">
              رقم القائمة (ژمارەی پسووڵە):
            </div>
            <div className="border-b border-black flex-1 text-center font-bold font-mono text-sm">
              {receipt.id?.slice(-8).toUpperCase() || "N/A"}
            </div>
          </div>
          <div className="flex items-center">
            <div className="w-24 text-right font-bold ml-2">
              التاريخ (بەروار):
            </div>
            <div className="border-b border-black flex-1 text-center font-bold font-mono text-sm">
              {ts.getFullYear()}/{String(ts.getMonth() + 1).padStart(2, "0")}/
              {String(ts.getDate()).padStart(2, "0")}
            </div>
          </div>
          <div className="flex items-center">
            <div className="whitespace-nowrap text-right font-bold ml-2">
              طريقة الدفع (جۆری پێدان):
            </div>
            <div className="border-b-2 border-dashed border-black flex-1 text-center font-bold font-mono text-sm min-h-[20px] mx-2">
            </div>
          </div>
          <div className="flex items-center mt-1">
            <div className="w-24 text-right font-bold ml-2">
              المندوب (مەندوب):
            </div>
            <div className="border-b border-black flex-1 px-2 font-bold text-sm text-center">
              {receipt.sellerName || "نەزانراو"}
            </div>
          </div>
        </div>

        {/* Center Title */}
        <div className="w-32 flex items-center justify-center font-black text-xl italic mt-2 border-b-4 border-double border-pink-600 pb-1">
          پسووڵەی فرۆش
        </div>

        {/* Right Side Info */}
        <div className="flex-1 flex flex-col gap-1.5">
          <div className="flex items-center">
            <div className="w-24 text-right font-bold ml-2">
              اسم المشتري (کڕیار):
            </div>
            <div className="border-b border-black flex-1 px-2 font-bold text-sm text-center">
              {receipt.customerName}
            </div>
          </div>
          <div className="flex items-center">
            <div className="w-24 text-right font-bold ml-2">
              العنوان (ناونیشان):
            </div>
            <div className="border-b border-black flex-1 px-2 font-bold text-sm text-center">
              {receipt.address || "..."}
            </div>
          </div>
          <div className="flex items-center">
            <div className="w-24 text-right font-bold ml-2">
              رقم الموبايل (مۆبایل):
            </div>
            <div
              className="border-b border-black flex-1 px-2 font-bold font-mono text-sm text-center"
              dir="ltr"
            >
              {receipt.phone || "..."}
            </div>
          </div>
        </div>
      </div>

      {/* Items Table - Strict structure */}
      <div className="mt-2 text-xs flex-1">
        <table className="w-full border-collapse border-2 border-black text-center font-bold">
          <thead>
            <tr className="bg-gray-100 border-b-2 border-black">
              <th className="border-l border-black px-1 py-1 w-8">ت</th>
              <th className="border-l border-black px-2 py-1 flex-1 min-w-[200px] text-right">
                ناوی ماددە
                <br />
                <span className="text-[10px] text-gray-600 font-normal">
                  اسم المادة
                </span>
              </th>
              <th className="border-l border-black px-1 py-1 w-12">
                بڕ
                <br />
                <span className="text-[10px] text-gray-600 font-normal">
                  الكمية
                </span>
              </th>
              <th className="border-l border-black px-1 py-1 w-20">
                نرخ
                <br />
                <span className="text-[10px] text-gray-600 font-normal">
                  السعر
                </span>
              </th>
              <th className="border-l border-black px-1 py-1 w-16">
                داشکاندن
                <br />
                <span className="text-[10px] text-gray-600 font-normal">
                  الخصم
                </span>
              </th>
              <th className="px-1 py-1 w-24">
                کۆی گشتی
                <br />
                <span className="text-[10px] text-gray-600 font-normal">
                  المجموع
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Render real rows */}
            {receipt.items?.map((item: any, i: number) => {
              const itemCurrency = receipt.invoiceCurrency || "IQD";
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

              return (
                <tr key={i} className="border-b border-black">
                  <td className="border-l border-black p-1.5">{i + 1}</td>
                  <td className="border-l border-black p-1.5 text-right font-bold pr-2">
                    {item.name} {item.isWholesale ? "(جوملە)" : ""}
                  </td>
                  <td className="border-l border-black p-1.5 font-mono text-sm">
                    {item.quantity}
                  </td>
                  <td className="border-l border-black p-1.5 font-mono text-sm">
                    {formatCurrency(
                      item.originalUnitPrice || item.unitPrice,
                      itemCurrency,
                    ).replace(itemCurrency, "")}
                  </td>
                  <td className="border-l border-black p-1.5 font-mono text-sm text-red-600">
                    {diff > 0 ? diff.toLocaleString() : "0"}
                  </td>
                  <td className="p-1.5 font-mono text-sm">
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
              length: Math.max(0, 15 - (receipt.items?.length || 0)),
            }).map((_, i) => (
              <tr
                key={`empty-${i}`}
                className="border-b border-black text-transparent"
              >
                <td className="border-l border-black p-1.5">.</td>
                <td className="border-l border-black p-1.5">.</td>
                <td className="border-l border-black p-1.5">.</td>
                <td className="border-l border-black p-1.5">.</td>
                <td className="border-l border-black p-1.5">.</td>
                <td className="p-1.5">.</td>
              </tr>
            ))}
            <tr className="border-t-2 border-black">
              <td
                colSpan={3}
                className="border-l border-black p-1.5 text-right pr-2 text-xs text-gray-500 font-bold tracking-wide"
              >
                هیچ موادێک بەسەرچوو وەرناگیرێتەوە
              </td>
              <td
                colSpan={2}
                className="border-l border-black p-1.5 text-center font-bold bg-gray-100"
              >
                مجموع القائمة /{" "}
                {receipt.invoiceCurrency === "USD" ? "دۆلار $" : "د.ع"}
              </td>
              <td className="p-1.5 font-bold bg-pink-50 text-base font-mono">
                {formatCurrency(
                  receipt.totalAmount || receipt.total || 0,
                  receipt.invoiceCurrency || "IQD",
                ).replace(receipt.invoiceCurrency || "IQD", "")}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Summary section */}
        <div className="flex gap-4 mt-4 text-xs font-bold w-full">
          {/* Notes */}
          <div className="flex-1 border-2 border-black bg-slate-50 p-3 rounded text-right min-h-[100px]">
            <div className="border-b border-black/20 pb-1 mb-2">
              تێبینی پسووڵە (ملاحظات) :
            </div>
            <p className="font-bold text-sm text-slate-700">
              {receipt.notes || "..."}
            </p>
          </div>

          {/* Totals */}
          <div className="w-[100mm]">
            <table className="w-full border-collapse border-2 border-black text-center">
              <tbody>
                <tr>
                  <td className="border border-black p-2 w-32 font-mono text-sm">
                    {receipt.paymentType === "نەقد"
                      ? formatCurrency(
                          receipt.totalAmount || receipt.total || 0,
                          receipt.invoiceCurrency || "IQD",
                        ).replace(receipt.invoiceCurrency || "IQD", "")
                      : "0"}
                  </td>
                  <td className="border border-black p-2 bg-gray-100">
                    بڕی دراو (الواصل)
                  </td>
                </tr>
                <tr>
                  <td className="border border-black p-2 w-32 font-mono text-sm text-red-600">
                    {receipt.paymentType === "قەرز"
                      ? formatCurrency(
                          receipt.totalAmount || receipt.total || 0,
                          receipt.invoiceCurrency || "IQD",
                        ).replace(receipt.invoiceCurrency || "IQD", "")
                      : "0"}
                  </td>
                  <td className="border border-black p-2 bg-gray-100">
                    بڕی ماوە (المتبقي)
                  </td>
                </tr>
                {(receipt.discount || receipt.discountAmount) > 0 && (
                  <>
                    <tr>
                      <td className="border border-black p-2 w-32 font-mono text-sm text-gray-600">
                        {formatCurrency(
                          receipt.subtotal || 0,
                          receipt.invoiceCurrency || "IQD",
                        ).replace(receipt.invoiceCurrency || "IQD", "")}
                      </td>
                      <td className="border border-black p-2 bg-gray-100">
                        بڕی بێ داشکاندن
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-black p-2 w-32 font-mono text-sm text-red-600">
                        {formatCurrency(
                          receipt.discount || receipt.discountAmount || 0,
                          receipt.invoiceCurrency || "IQD",
                        ).replace(receipt.invoiceCurrency || "IQD", "")}
                      </td>
                      <td className="border border-black p-2 bg-gray-100">
                        داشکاندن (الخصم)
                      </td>
                    </tr>
                  </>
                )}
                <tr>
                  <td className="border border-black p-2 w-32 font-mono text-lg font-black bg-pink-50">
                    {formatCurrency(
                      receipt.totalAmount || receipt.total || 0,
                      receipt.invoiceCurrency || "IQD",
                    )}
                  </td>
                  <td className="border border-black p-2 bg-pink-100 text-lg font-black">
                    المجموع (کۆی گشتی)
                  </td>
                </tr>
                {receipt.exchangeRate && receipt.exchangeRate > 0 && (
                <tr>
                  <td className="border border-black p-2 w-32 font-mono text-sm font-black bg-slate-50 text-slate-600">
                    {receipt.invoiceCurrency === "USD"
                      ? formatCurrency((receipt.totalAmount || receipt.total || 0) * receipt.exchangeRate, "IQD")
                      : formatCurrency((receipt.totalAmount || receipt.total || 0) / receipt.exchangeRate, "USD")}
                  </td>
                  <td className="border border-black p-2 bg-slate-100 text-sm font-bold text-slate-700">
                    بەرامبەر بە (المقابل)
                  </td>
                </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-8 pt-2 border-t border-black text-center flex justify-between text-[10px] text-gray-500 font-bold items-end">
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
