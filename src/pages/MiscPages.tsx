import React, { useState, useEffect } from "react";
import {
  Search,
  Undo2,
  ArrowLeftRight,
  Settings,
  Users,
  Save,
  Trash2,
  X,
  AlertTriangle,
  Eye,
  Plus,
  Download,
  Upload,
  Database,
  PlusCircle,
} from "lucide-react";
import {
  collection,
  onSnapshot,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  addDoc,
  Timestamp,
} from "firebase/firestore";
import { db, firebaseConfig } from "../firebase";
import { initializeApp, getApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { formatCurrency } from "../data";

export const reduceCustomerDebt = async (
  receipt: any,
  amountToReduce: number,
  reason: string,
) => {
  if (
    !receipt ||
    !receipt.customerName ||
    (receipt.paymentType !== "debt" && receipt.paymentType !== "قەرز")
  )
    return;

  try {
    let finalAmountToReduce = amountToReduce;
    if (receipt.invoiceCurrency === "USD") {
      finalAmountToReduce = amountToReduce;
    }

    const debtsQ = query(
      collection(db, "debts"),
      where("customerName", "==", receipt.customerName),
    );
    const debtSnap = await getDocs(debtsQ);
    if (!debtSnap.empty) {
      const debtDoc = debtSnap.docs[0];
      const currentData = debtDoc.data();

      const newAmount = Math.max(0, (currentData.amount || 0) - finalAmountToReduce);
      const newRemaining = Math.max(
        0,
        (currentData.remainingAmount || 0) - finalAmountToReduce,
      );

      await updateDoc(doc(db, "debts", debtDoc.id), {
        amount: newAmount,
        remainingAmount: newRemaining,
        status: newRemaining <= 0 ? "paid" : "active",
      });

      await addDoc(collection(db, "debt_transactions"), {
        debtId: debtDoc.id,
        amount: finalAmountToReduce,
        type: "pay",
        timestamp: Timestamp.now(),
        notes: `${reason} - وەسڵی ژمارە: ${receipt.id.slice(-6).toUpperCase()}`,
      });
    }
  } catch (e) {
    console.error("Error reducing debt:", e);
  }
};

export function Returns() {
  const [receipts, setReceipts] = useState<any[]>([]);
  const [returningReceipt, setReturningReceipt] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [userRole, setUserRole] = useState("");
  const [userName, setUserName] = useState("");

  useEffect(() => {
    import("../firebase").then(({ auth, db }) => {
      if (auth.currentUser) {
        getDoc(doc(db, "users", auth.currentUser.uid)).then((snap) => {
          if (snap.exists()) {
            setUserRole(snap.data().role || "user");
            setUserName(
              snap.data().name || auth.currentUser?.email || "نەزانراو",
            );
          }
        });
      }
    });

    const q = query(collection(db, "receipts"), orderBy("timestamp", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setReceipts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsub();
    };
  }, []);

  const handleReturnWholeReceipt = async () => {
    if (
      !window.confirm(
        "دڵنیایت لە گەڕاندنەوەی تەواوی ئەم وەسڵە؟ سەردانی کۆگا دەکاتەوە و داتای فرۆشتنەکە دەسڕێتەوە.",
      )
    )
      return;

    const isPending = userRole !== "admin" && userRole !== "accountant";

    try {
      if (isPending) {
        await addDoc(collection(db, "return_transactions"), {
          type: "full",
          receiptId: returningReceipt.id,
          receiptData: returningReceipt,
          reductionAmount: returningReceipt.totalAmount || 0,
          status: "pending",
          createdBy: userName,
          timestamp: Timestamp.now(),
        });
        alert(
          "نێردرا بۆ چاوەڕێکراوەکان تا لەلایەن بەڕێوەبەر یان ژمێریارەوە پەسەند دەکرێت.",
        );
        setReturningReceipt(null);
        return;
      }

      // 1. restore stock
      for (const item of returningReceipt.items) {
        const pRef = doc(db, "products", item.productId);
        const pSnap = await getDoc(pRef);
        if (pSnap.exists()) {
          await updateDoc(pRef, {
            stock: (pSnap.data().stock || 0) + item.quantity,
          });
        }
      }
      // 2. delete receipt
      await deleteDoc(doc(db, "receipts", returningReceipt.id));
      // 3. reduce debt if applicable
      await reduceCustomerDebt(
        returningReceipt,
        returningReceipt.totalAmount || 0,
        "گەڕانەوەی تەواوی کاڵاکان",
      );
      alert("وەسڵەکە بە سەرکەوتوویی سڕایەوە و کالاکان گەڕێنرانەوە کۆگا.");
      setReturningReceipt(null);
    } catch (e) {
      console.error(e);
      alert("هەڵەیەک ڕوویدا");
    }
  };

  const handleReturnSingleItem = async (index: number) => {
    const item = returningReceipt.items[index];
    const qtyToReturnStr = window.prompt(
      `چەند دانە لە "${item.name}" دەگەڕێنیتەوە؟ (بەردەست: ${item.quantity})`,
      item.quantity.toString(),
    );
    if (!qtyToReturnStr) return;
    const qty = parseInt(qtyToReturnStr, 10);
    if (isNaN(qty) || qty <= 0 || qty > item.quantity) {
      alert("بڕەکە هەڵەیە!");
      return;
    }

    const isPending = userRole !== "admin" && userRole !== "accountant";

    try {
      if (isPending) {
        await addDoc(collection(db, "return_transactions"), {
          type: "partial",
          receiptId: returningReceipt.id,
          receiptData: returningReceipt,
          itemIndex: index,
          returnedQty: qty,
          reductionAmount: qty * returningReceipt.items[index].unitPrice,
          status: "pending",
          createdBy: userName,
          timestamp: Timestamp.now(),
        });
        alert(
          "نێردرا بۆ چاوەڕێکراوەکان تا لەلایەن بەڕێوەبەر یان ژمێریارەوە پەسەند دەکرێت.",
        );
        return;
      }

      // Restore stock
      const pRef = doc(db, "products", item.productId);
      const pSnap = await getDoc(pRef);
      if (pSnap.exists()) {
        await updateDoc(pRef, { stock: (pSnap.data().stock || 0) + qty });
      }

      // update receipt
      const newItems = [...returningReceipt.items];
      newItems[index].quantity -= qty;
      newItems[index].total =
        newItems[index].unitPrice * newItems[index].quantity;

      const reductionAmount = qty * newItems[index].unitPrice;

      const filteredItems = newItems.filter((i) => i.quantity > 0);

      if (filteredItems.length === 0) {
        await deleteDoc(doc(db, "receipts", returningReceipt.id));
        await reduceCustomerDebt(
          returningReceipt,
          reductionAmount,
          "گەڕانەوەی کاڵا",
        );
        alert("وەسڵەکە بە تەواوەتی سڕایەوە چونکە هەموو کالاکانی گەڕێنرانەوە.");
        setReturningReceipt(null);
      } else {
        const newTotal = filteredItems.reduce((acc, i) => acc + i.total, 0);
        const newTotalItems = filteredItems.reduce(
          (acc, i) => acc + i.quantity,
          0,
        );
        await updateDoc(doc(db, "receipts", returningReceipt.id), {
          items: filteredItems,
          totalAmount: newTotal,
          totalItems: newTotalItems,
        });
        await reduceCustomerDebt(
          returningReceipt,
          reductionAmount,
          "گەڕانەوەی کاڵا",
        );
        setReturningReceipt({
          ...returningReceipt,
          items: filteredItems,
          totalAmount: newTotal,
        });
        alert("کالاکە بە سەرکەوتوویی گەڕێنرایەوە.");
      }
    } catch (e) {
      console.error(e);
      alert("هەڵەیەک ڕوویدا");
    }
  };

  const filteredReceipts = receipts.filter(
    (r) =>
      r.id.toLowerCase().includes(search.toLowerCase()) ||
      r.items?.some((i: any) => i.name.includes(search)),
  );

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-full flex flex-col overflow-hidden relative">
      <div className="border-b border-slate-100 pb-4 mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Undo2 className="text-pink-600" /> گەڕانەوەی کالا (مرتجعات)
          </h2>
        </div>
        <div className="relative">
          <Search
            size={16}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            placeholder="گەڕان بەدوای کالا یان ژمارەی وەسڵ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-slate-50 border border-slate-200 pr-9 pl-4 py-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-pink-500 w-full sm:w-72"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar">
        {filteredReceipts.length > 0 ? (
          <table className="w-full text-right border-collapse">
            <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider sticky top-0">
              <tr>
                <th className="px-4 py-3 font-semibold">ژمارەی وەسڵ</th>
                <th className="px-4 py-3 font-semibold">کاتی فرۆشتن</th>
                <th className="px-4 py-3 font-semibold">کۆی گشتی</th>
                <th className="px-4 py-3 font-semibold text-center">کردار</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-100">
              {filteredReceipts.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-4 font-mono font-bold text-slate-700">
                    #{r.id.slice(0, 6).toUpperCase()}
                  </td>
                  <td className="px-4 py-4 text-slate-600">
                    {r.timestamp?.toDate
                      ? new Date(r.timestamp.toDate()).toLocaleString("ku")
                      : "کات نەزانراوە"}
                  </td>
                  <td className="px-4 py-4 font-mono font-bold text-green-600">
                    {formatCurrency(r.totalAmount || r.total || 0, r.invoiceCurrency || "USD")}
                  </td>
                  <td className="px-4 py-4 flex justify-center">
                    <button
                      onClick={() => setReturningReceipt(r)}
                      className="text-pink-600 hover:bg-pink-50 p-2 rounded-lg transition-colors flex items-center gap-2 font-bold text-xs border border-pink-100"
                    >
                      <ExchangeIcon /> هەڵبژاردن بۆ گەڕانەوە
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-400 flex-col gap-4">
            <Undo2 size={48} strokeWidth={1} />
            <p>هیچ پسوولەیەکی گەڕانەوە بوونی نییە.</p>
          </div>
        )}
      </div>

      {returningReceipt && (
        <div className="fixed inset-0 bg-slate-900/60 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
          <div className="bg-white rounded-t-[32px] sm:rounded-2xl shadow-xl w-full max-w-2xl max-h-[90dvh] sm:max-h-[90vh] flex flex-col animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
            <div className="p-5 sm:p-6 flex justify-between items-center border-b border-slate-100 shrink-0">
              <h3 className="text-lg font-bold">
                زانیاری وەسڵی #{returningReceipt.id.slice(0, 6).toUpperCase()}
              </h3>
              <button
                onClick={() => setReturningReceipt(null)}
                className="w-10 h-10 flex items-center justify-center text-slate-400 bg-slate-100 hover:bg-slate-200 hover:text-slate-600 rounded-xl transition-all"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 sm:p-6 custom-scrollbar pb-[max(calc(env(safe-area-inset-bottom)+1rem),1rem)] sm:pb-6">
              <div className="border border-slate-100 rounded-lg overflow-hidden">
                <table className="w-full text-right text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2">ناونیشان</th>
                    <th className="px-4 py-2">بڕ</th>
                    <th className="px-4 py-2">نرخ</th>
                    <th className="px-4 py-2">کردار</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {returningReceipt.items?.map((item: any, i: number) => (
                    <tr key={i}>
                      <td className="px-4 py-3 font-bold text-slate-700">
                        {item.name}
                      </td>
                      <td className="px-4 py-3 font-mono">{item.quantity}</td>
                      <td className="px-4 py-3 font-mono text-pink-600">
                        {formatCurrency(item.unitPrice)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleReturnSingleItem(i)}
                          className="px-3 py-1.5 bg-pink-100 text-pink-700 rounded hover:bg-pink-200 text-xs font-bold transition-colors"
                        >
                          گەڕاندنەوە
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
            <div className="p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100 shrink-0 bg-white">
              <button
                onClick={handleReturnWholeReceipt}
                className="w-full sm:w-auto px-4 py-2.5 bg-red-100 text-red-700 hover:bg-red-200 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 size={16} /> گەڕاندنەوەی تەواوی وەسڵەکە
              </button>
              <div className="font-mono font-bold text-lg text-slate-800">
                کۆی گشتی:{" "}
                {formatCurrency(
                  returningReceipt.totalAmount || returningReceipt.total || 0,
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const ExchangeIcon = () => <Undo2 size={14} />;

export function Exchanges() {
  const [receipts, setReceipts] = useState<any[]>([]);
  const [returningReceipt, setReturningReceipt] = useState<any>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const q = query(collection(db, "receipts"), orderBy("timestamp", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setReceipts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const handleReturnWholeReceipt = async () => {
    if (
      !window.confirm(
        "دڵنیایت لە گۆڕینەوەی ئەم وەسڵە؟ کالاکان دەگەڕێنەوە کۆگا وە دەتوانی لە کاشێر وەسڵی نوێ لێ بدەی.",
      )
    )
      return;
    try {
      // 1. restore stock
      for (const item of returningReceipt.items) {
        const pRef = doc(db, "products", item.productId);
        const pSnap = await getDoc(pRef);
        if (pSnap.exists()) {
          await updateDoc(pRef, {
            stock: (pSnap.data().stock || 0) + item.quantity,
          });
        }
      }
      // 2. delete receipt
      await deleteDoc(doc(db, "receipts", returningReceipt.id));
      await reduceCustomerDebt(
        returningReceipt,
        returningReceipt.totalAmount || 0,
        "گۆڕینەوەی کوێربووی تەواوی کاڵاکان",
      );
      alert(
        "وەسڵەکە داخرا و کالاکان گەڕێنرانەوە کۆگا. ئێستا دەتوانی بچیتە بەشی کاشێر بۆ لێدانی وەسڵی نوێ.",
      );
      setReturningReceipt(null);
    } catch (e) {
      console.error(e);
      alert("هەڵەیەک ڕوویدا");
    }
  };

  const handleReturnSingleItem = async (index: number) => {
    const item = returningReceipt.items[index];
    const qtyToReturnStr = window.prompt(
      `چەند دانە لە "${item.name}" دەگۆڕیتەوە؟ (بەردەست: ${item.quantity})`,
      item.quantity.toString(),
    );
    if (!qtyToReturnStr) return;
    const qty = parseInt(qtyToReturnStr, 10);
    if (isNaN(qty) || qty <= 0 || qty > item.quantity) {
      alert("بڕەکە هەڵەیە!");
      return;
    }

    try {
      // Restore stock
      const pRef = doc(db, "products", item.productId);
      const pSnap = await getDoc(pRef);
      if (pSnap.exists()) {
        await updateDoc(pRef, { stock: (pSnap.data().stock || 0) + qty });
      }

      // update receipt
      const newItems = [...returningReceipt.items];
      newItems[index].quantity -= qty;
      newItems[index].total =
        newItems[index].unitPrice * newItems[index].quantity;

      const reductionAmount = qty * newItems[index].unitPrice;

      const filteredItems = newItems.filter((i) => i.quantity > 0);

      if (filteredItems.length === 0) {
        await deleteDoc(doc(db, "receipts", returningReceipt.id));
        await reduceCustomerDebt(
          returningReceipt,
          reductionAmount,
          "گۆڕینەوەی کاڵا",
        );
        alert(
          "وەسڵەکە بە تەواوەتی سڕایەوە. ئێستا دەتوانی لە بەشی کاشێر کالای نوێ بۆ کڕیار لێ بدەی.",
        );
        setReturningReceipt(null);
      } else {
        const newTotal = filteredItems.reduce((acc, i) => acc + i.total, 0);
        const newTotalItems = filteredItems.reduce(
          (acc, i) => acc + i.quantity,
          0,
        );
        await updateDoc(doc(db, "receipts", returningReceipt.id), {
          items: filteredItems,
          totalAmount: newTotal,
          totalItems: newTotalItems,
        });
        await reduceCustomerDebt(
          returningReceipt,
          reductionAmount,
          "گۆڕینەوەی کاڵا",
        );
        setReturningReceipt({
          ...returningReceipt,
          items: filteredItems,
          totalAmount: newTotal,
        });
        alert(
          "کالاکە گەڕێنرایەوە بۆ کۆگا، ئێستا دەتوانی بڕی پارەکەی بۆ کالایەکی نوێ لە کاشێر بەکار بهێنیت.",
        );
      }
    } catch (e) {
      console.error(e);
      alert("هەڵەیەک ڕوویدا");
    }
  };

  const filteredReceipts = receipts.filter(
    (r) =>
      r.id.toLowerCase().includes(search.toLowerCase()) ||
      r.items?.some((i: any) => i.name.includes(search)),
  );

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-full flex flex-col overflow-hidden relative">
      <div className="border-b border-slate-100 pb-4 mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <ArrowLeftRight className="text-pink-600" /> گۆڕینەوەی کالا (إستبدال)
        </h2>
        <div className="relative">
          <Search
            size={16}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            placeholder="گەڕان بەدوای کالا یان ژمارەی وەسڵ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-slate-50 border border-slate-200 pr-9 pl-4 py-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-pink-500 w-full sm:w-72"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar">
        {filteredReceipts.length > 0 ? (
          <table className="w-full text-right border-collapse">
            <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider sticky top-0">
              <tr>
                <th className="px-4 py-3 font-semibold">ژمارەی وەسڵ</th>
                <th className="px-4 py-3 font-semibold">کاتی فرۆشتن</th>
                <th className="px-4 py-3 font-semibold">کۆی گشتی</th>
                <th className="px-4 py-3 font-semibold text-center">کردار</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-100">
              {filteredReceipts.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-4 font-mono font-bold text-slate-700">
                    #{r.id.slice(0, 6).toUpperCase()}
                  </td>
                  <td className="px-4 py-4 text-slate-600">
                    {r.timestamp?.toDate
                      ? new Date(r.timestamp.toDate()).toLocaleString("ku")
                      : "کات نەزانراوە"}
                  </td>
                  <td className="px-4 py-4 font-mono font-bold text-green-600">
                    {formatCurrency(r.totalAmount || r.total || 0)}
                  </td>
                  <td className="px-4 py-4 flex justify-center">
                    <button
                      onClick={() => setReturningReceipt(r)}
                      className="text-pink-600 hover:bg-pink-50 p-2 rounded-lg transition-colors flex items-center gap-2 font-bold text-xs border border-pink-100"
                    >
                      <ArrowLeftRight size={14} /> هەڵبژاردن بۆ گۆڕینەوە
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-400 flex-col gap-4">
            <ArrowLeftRight size={48} strokeWidth={1} />
            <p>هیچ پسوولەیەکی گۆڕینەوە بوونی نییە.</p>
          </div>
        )}
      </div>

      {returningReceipt && (
        <div className="fixed inset-0 bg-slate-900/60 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
          <div className="bg-white rounded-t-[32px] sm:rounded-2xl shadow-xl w-full max-w-2xl max-h-[90dvh] sm:max-h-[90vh] flex flex-col animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
            <div className="p-5 sm:p-6 flex justify-between items-center border-b border-slate-100 shrink-0">
              <h3 className="text-lg font-bold">
                زانیاری وەسڵی #{returningReceipt.id.slice(0, 6).toUpperCase()}{" "}
                بۆ گۆڕینەوە
              </h3>
              <button
                onClick={() => setReturningReceipt(null)}
                className="w-10 h-10 flex items-center justify-center text-slate-400 bg-slate-100 hover:bg-slate-200 hover:text-slate-600 rounded-xl transition-all"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 sm:p-6 custom-scrollbar pb-[max(calc(env(safe-area-inset-bottom)+1rem),1rem)] sm:pb-6">
              <div className="border border-slate-100 rounded-lg overflow-hidden">
                <table className="w-full text-right text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2">ناونیشان</th>
                    <th className="px-4 py-2">بڕ</th>
                    <th className="px-4 py-2">نرخ</th>
                    <th className="px-4 py-2">کردار</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {returningReceipt.items?.map((item: any, i: number) => (
                    <tr key={i}>
                      <td className="px-4 py-3 font-bold text-slate-700">
                        {item.name}
                      </td>
                      <td className="px-4 py-3 font-mono">{item.quantity}</td>
                      <td className="px-4 py-3 font-mono text-pink-600">
                        {formatCurrency(item.unitPrice)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleReturnSingleItem(i)}
                          className="px-3 py-1.5 bg-pink-100 text-pink-700 rounded hover:bg-pink-200 text-xs font-bold transition-colors"
                        >
                          گۆڕینەوە
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
            <div className="p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100 shrink-0 bg-white">
              <button
                onClick={handleReturnWholeReceipt}
                className="w-full sm:w-auto px-4 py-2.5 bg-red-100 text-red-700 hover:bg-red-200 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 size={16} /> هەڵوەشاندنەوەی تەواوی وەسڵەکە
              </button>
              <div className="font-mono font-bold text-lg text-slate-800">
                کۆی گشتی:{" "}
                {formatCurrency(
                  returningReceipt.totalAmount || returningReceipt.total || 0,
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
  const [editUserObj, setEditUserObj] = useState<any>(null);
  const [editUserName, setEditUserName] = useState("");
  const [editUserPassword, setEditUserPassword] = useState("");
  const [editUserAvatar, setEditUserAvatar] = useState("");

  const [editingUser, setEditingUser] = useState<any>(null);
  const [allowedPages, setAllowedPages] = useState<string[]>([]);

  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const permissionsOptions = [
    { id: "dashboard", label: "داشبۆرد (ئامارەکان)" },
    { id: "menu", label: "مێنیو (بینینی کاڵاکان)" },
    { id: "pos", label: "فرۆشتن (کاشێر)" },
    { id: "products", label: "کالاکان" },
    { id: "warehouse", label: "کۆگا" },
    { id: "categories", label: "کەتەگۆرییەکان" },
    { id: "customers", label: "کڕیاران" },
    { id: "visits", label: "سەردانەکان" },
    { id: "companies", label: "شەریکەکان" },
    { id: "debt", label: "دەفتەری قەرز و مامەڵەکان" },
    { id: "receipts", label: "وەسڵەکان" },
    { id: "expenses", label: "خەرجییەکان" },
    { id: "reports", label: "ڕاپۆرتەکان" },
    { id: "returns", label: "گەڕانەوە (مرتجعات)" },
    { id: "exchanges", label: "گۆڕینەوە (استبدال)" },
    { id: "users", label: "بەڕێوەبردنی بەکارهێنەران" },
    { id: "settings", label: "ڕێکخستنی سیستەم" },
    { id: "pos_allow_discount", label: "ڕێگەدان بە داشکاندن (لە فرۆشتن)" },
    { id: "pos_allow_edit_price", label: "ڕێگەدان بە گۆڕینی نرخ (لە فرۆشتن)" },
  ];

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    const roleEl = document.getElementById(
      "edit-role-select",
    ) as HTMLSelectElement;

    await updateDoc(doc(db, "users", editingUser.id), {
      permissions: allowedPages,
      role: roleEl ? roleEl.value : editingUser.role,
    });
    setIsModalOpen(false);
    setEditingUser(null);
  };

  const togglePermission = (pid: string) => {
    setAllowedPages((prev) =>
      prev.includes(pid) ? prev.filter((p) => p !== pid) : [...prev, pid],
    );
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      let secondaryApp;
      try {
        secondaryApp = initializeApp(firebaseConfig, "Secondary");
      } catch (e) {
        secondaryApp = getApp("Secondary");
      }

      const secondaryAuth = getAuth(secondaryApp);
      const userCred = await createUserWithEmailAndPassword(
        secondaryAuth,
        newEmail,
        newPassword,
      );

      // Create document for the new user
      await setDoc(doc(db, "users", userCred.user.uid), {
        name: newName,
        email: newEmail,
        role: "user",
        permissions: [],
        createdAt: new Date().toISOString(),
      });

      setIsAddUserModalOpen(false);
      setNewEmail("");
      setNewName("");
      setNewPassword("");
      alert("بەکارهێنەر دروستکرا بە سەرکەوتوویی!");
    } catch (e: any) {
      console.error(e);
      alert("هەڵە ڕوویدا لە کاتی دروستکردن: " + e.message);
    }
    setIsCreating(false);
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUserObj) return;

    if (editUserPassword) {
      alert(
        "تێبینی: گۆڕینی وشەی تێپەڕ لەم بەشەدا کارناکات، تەنیا ناوی بەکارهێنەر و وێنەی دەگۆڕێت (بەهۆی ڕێکارەکانی ئاسایشی کۆگای داتا). دەتوانیت بەکارهێنەر بسڕیتەوە و سەرلەنوێ دروستی بکەیتەوە ئەگەر پێویست بوو.",
      );
    }

    try {
      await updateDoc(doc(db, "users", editUserObj.id), {
        name: editUserName,
        avatar: editUserAvatar,
      });

      setIsEditUserModalOpen(false);
      setEditUserObj(null);
      setEditUserPassword("");
      alert("زانیارییەکانی بەکارهێنەر گۆڕدرا بە سەرکەوتوویی!");
    } catch (err: any) {
      alert("هەڵە ڕوویدا: " + err.message);
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-full flex flex-col">
      <div className="border-b border-slate-100 pb-4 mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="text-pink-600" /> بەکارهێنەرانی سیستەم
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            بەڕێوەبەری سەرەکی دەتوانێت دەسەڵاتەکان دیاری بکات
          </p>
        </div>
        <button
          onClick={() => setIsAddUserModalOpen(true)}
          className="px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-xl text-sm font-bold flex items-center gap-2 shadow-md transition-colors"
        >
          <Plus size={16} /> زیادکردنی بەکارهێنەر
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 mt-6 overflow-y-auto pb-4 px-1 custom-scrollbar">
        {users.map((u) => (
          <div
            key={u.id}
            className="p-5 border border-slate-200 rounded-2xl flex flex-col justify-between hover:border-pink-300 hover:shadow-md transition-all duration-300 bg-gradient-to-br from-white to-slate-50 relative group"
          >
            {u.role === "admin" && (
              <span className="absolute top-3 left-3 text-[10px] font-black tracking-wider bg-pink-100 text-pink-700 px-2.5 py-1 rounded-lg">
                بەڕێوەبەر
              </span>
            )}
            {u.role === "accountant" && (
              <span className="absolute top-3 left-3 text-[10px] font-black tracking-wider bg-pink-100 text-pink-700 px-2.5 py-1 rounded-lg">
                محاسب
              </span>
            )}
            <div className="flex items-center gap-4 mb-5">
              <div className="w-14 h-14 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 font-bold text-xl uppercase shadow-sm overflow-hidden shrink-0 group-hover:border-pink-300 transition-colors">
                {u.avatar ? (
                  <img src={u.avatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="group-hover:text-pink-500 transition-colors">{u.name?.charAt(0) || u.email?.charAt(0)}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-slate-800 text-lg truncate">
                  {u.name || (u.email && u.email.split("@")[0])}
                </h3>
                <p
                  className="text-[11px] text-slate-500 mt-1 font-mono bg-white inline-block px-1.5 py-0.5 rounded shadow-sm border border-slate-100"
                  dir="ltr"
                >
                  {u.email}
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                {u.role === "admin"
                  ? "هەموو دەسەڵاتەکانی هەیە"
                  : u.role === "accountant"
                    ? "دەسەڵاتی کۆکردنەوە و ڕێکخستنی وەسڵەکان"
                    : (u.permissions?.length || 0) + " بەش کراوەیە"}
              </div>
              <div className="flex flex-wrap gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                {u.id !== getAuth().currentUser?.uid && (
                  <button
                    onClick={async () => {
                      if (
                        confirm(
                          "دڵنیایت لە سڕینەوەی ئەم بەکارهێنەرە؟ \nئەمە تەنها داتای بەکارهێنەرەکە لە سیستەمەکە دەسڕێتەوە، نەک خودی ئیمەیڵەکەی.",
                        )
                      ) {
                        await deleteDoc(doc(db, "users", u.id));
                      }
                    }}
                    className="flex-1 sm:flex-none text-xs font-bold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-xl transition-colors text-center"
                  >
                    سڕینەوە
                  </button>
                )}
                <button
                  onClick={() => {
                    setEditUserObj(u);
                    setEditUserName(u.name || "");
                    setEditUserAvatar(u.avatar || "");
                    setEditUserPassword("");
                    setIsEditUserModalOpen(true);
                  }}
                  className="flex-1 sm:flex-none text-xs font-bold text-emerald-600 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-2 rounded-xl transition-colors text-center"
                >
                  گۆڕین
                </button>
                {u.role !== "admin" && (
                  <button
                    onClick={() => {
                      setEditingUser(u);
                      setAllowedPages(u.permissions || []);
                      setIsModalOpen(true);
                    }}
                    className="flex-1 sm:flex-none text-xs font-bold text-pink-600 hover:text-pink-800 bg-pink-50 hover:bg-pink-100 px-3 py-2 rounded-xl transition-colors text-center"
                  >
                    دەسەڵاتەکان
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && editingUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleUpdateRole}
            className="bg-white rounded-[24px] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col"
          >
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-gradient-to-l from-pink-50/50 to-white">
              <h2 className="font-bold text-pink-900 text-lg flex items-center gap-2">
                دیاریکردنی دەسەڵاتەکان
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:bg-slate-100 p-2 rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500 mb-1">
                    بەکارهێنەر
                  </p>
                  <p
                    className="text-sm font-bold text-pink-600 font-mono"
                    dir="ltr"
                  >
                    {editingUser.email}
                  </p>
                </div>
                <div className="w-10 h-10 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 font-bold uppercase shadow-sm">
                  {editingUser.name?.charAt(0) || editingUser.email?.charAt(0)}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-pink-500"></span>
                  جۆری بەکارهێنەر (ڕۆڵ)
                </label>
                <select
                  id="edit-role-select"
                  defaultValue={editingUser.role}
                  className="w-full bg-white border-2 border-slate-200 rounded-xl p-3 outline-none focus:border-pink-500 font-bold text-slate-700 transition-colors"
                >
                  <option value="admin">بەڕێوەبەر (Admin)</option>
                  <option value="accountant">
                    ژمێریار / محاسب (Accountant)
                  </option>
                  <option value="user">کارمەند / مەندوب (User)</option>
                </select>
              </div>
              <div className="pt-4 border-t border-slate-100">
                <label className="block text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-pink-500"></span>
                  دەسەڵاتەکانی بینین (تەنیا بۆ کارمەند)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 max-h-[40vh] overflow-y-auto px-1 pb-2 custom-scrollbar">
                  {permissionsOptions.map((opt) => (
                    <label
                      key={opt.id}
                      className={`flex items-center gap-3 p-3.5 border-2 rounded-xl cursor-pointer transition-all text-sm font-bold select-none ${allowedPages.includes(opt.id) ? "border-pink-500 bg-pink-50 text-pink-700 shadow-sm" : "border-slate-100 bg-white text-slate-600 hover:border-slate-200"}`}
                    >
                      <input
                        type="checkbox"
                        checked={allowedPages.includes(opt.id)}
                        onChange={() => togglePermission(opt.id)}
                        className="w-4 h-4 text-pink-600 border-gray-300 rounded focus:ring-pink-500 focus:ring-offset-0"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 py-5 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-2.5 text-slate-600 bg-white border border-slate-200 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors"
              >
                پاشگەزبوونەوە
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-pink-600 text-white rounded-xl text-sm font-bold hover:bg-pink-700 transition-colors shadow-sm shadow-pink-200"
              >
                پاشەکەوتکردن
              </button>
            </div>
          </form>
        </div>
      )}

      {isAddUserModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleAddUser}
            className="bg-white rounded-[24px] shadow-2xl w-full max-w-md overflow-hidden flex flex-col"
          >
            <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-l from-slate-50 to-white flex justify-between items-center">
              <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                <PlusCircle className="text-pink-600" size={20} />
                زیادکردنی بەکارهێنەری نوێ
              </h2>
              <button
                type="button"
                onClick={() => setIsAddUserModalOpen(false)}
                className="text-slate-400 hover:bg-slate-100 p-2 rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  ناوی تەواو
                </label>
                <input
                  required
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-white border-2 border-slate-200 rounded-xl p-3 focus:outline-none focus:border-pink-500 transition-colors"
                  placeholder="ناوی بەکارهێنەر"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  ئیمەیڵ (بۆ چوونە ژوورەوە)
                </label>
                <input
                  required
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full bg-white border-2 border-slate-200 rounded-xl p-3 focus:outline-none focus:border-pink-500 transition-colors font-mono text-left"
                  dir="ltr"
                  placeholder="name@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  تێپەڕوشە (باسۆرد)
                </label>
                <input
                  required
                  type="password"
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-white border-2 border-slate-200 rounded-xl p-3 focus:outline-none focus:border-pink-500 transition-colors font-mono text-left"
                  dir="ltr"
                  placeholder="لانی کەم ٦ پیت/ژمارە"
                />
              </div>
            </div>
            <div className="px-6 py-5 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsAddUserModalOpen(false)}
                className="px-6 py-2.5 text-slate-600 bg-white border border-slate-200 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors"
              >
                پاشگەزبوونەوە
              </button>
              <button
                disabled={isCreating}
                type="submit"
                className="px-6 py-2.5 bg-pink-600 text-white rounded-xl text-sm font-bold hover:bg-pink-700 disabled:opacity-50 transition-colors shadow-sm shadow-pink-200"
              >
                {isCreating ? "دروست دەکرێت..." : "دروستکردن"}
              </button>
            </div>
          </form>
        </div>
      )}

      {isEditUserModalOpen && editUserObj && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleEditUser}
            className="bg-white rounded-[24px] shadow-2xl w-full max-w-xl overflow-hidden flex flex-col"
          >
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-gradient-to-l from-emerald-50/50 to-white">
              <h2 className="font-bold text-emerald-900 text-lg flex items-center gap-2">
                گۆڕینی زانیارییەکانی بەکارهێنەر
              </h2>
              <button
                type="button"
                onClick={() => setIsEditUserModalOpen(false)}
                className="text-slate-400 hover:bg-slate-100 p-2 rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  ناوی تەواو
                </label>
                <input
                  required
                  type="text"
                  value={editUserName}
                  onChange={(e) => setEditUserName(e.target.value)}
                  className="w-full bg-white border-2 border-slate-200 rounded-xl p-3 focus:outline-none focus:border-emerald-500 transition-colors"
                  placeholder="ناوی بەکارهێنەر"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  بەستەری وێنە (ئارەزوومەندانە)
                </label>
                <input
                  type="url"
                  value={editUserAvatar}
                  onChange={(e) => setEditUserAvatar(e.target.value)}
                  className="w-full bg-white border-2 border-slate-200 rounded-xl p-3 focus:outline-none focus:border-emerald-500 transition-colors"
                  placeholder="https://example.com/avatar.png"
                  dir="ltr"
                />
              </div>
              <div className="relative">
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  وشەی تێپەڕی نوێ
                </label>
                <input
                  type="password"
                  value={editUserPassword}
                  onChange={(e) => setEditUserPassword(e.target.value)}
                  className="w-full bg-white border-2 border-slate-200 rounded-xl p-3 focus:outline-none focus:border-emerald-500 transition-colors opacity-70 cursor-not-allowed"
                  placeholder="گۆڕینی وشەی تێپەڕ لێرەدا کارناکات"
                  disabled
                />
                <p className="text-xs text-orange-600 mt-2 font-medium">
                  • تێبینی: بۆ گۆڕینی وشەی نهێنی پێویستە بەکارهێنەر خۆی هەژمارەکەی بەکاربهێنێت یان دەتوانیت بیسڕیتەوە و هەژمارێکی نوێ دروست بکەیت.
                </p>
              </div>
            </div>
            <div className="px-6 py-5 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsEditUserModalOpen(false)}
                className="px-6 py-2.5 text-slate-600 bg-white border border-slate-200 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors"
              >
                پاشگەزبوونەوە
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors shadow-sm shadow-emerald-200"
              >
                گۆڕین
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export function SettingsPage() {
  const [settings, setSettings] = useState<any>({
    shopName: "Pink Elle",
    shopPhone: "0750 000 0000",
    shopAddress: "سۆران",
    receiptFooter: "بەخێربێن بۆ پینک ئێللێ",
    pinCode: "",
    telegramBotToken: "",
    telegramChatId: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [safes, setSafes] = useState<any[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "system", "settings"), (docSnap) => {
      if (docSnap.exists()) {
        setSettings(docSnap.data());
      }
    });
    
    const unsubSafes = onSnapshot(collection(db, "safes"), (snap) => {
      setSafes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    
    return () => {
       unsub();
       unsubSafes();
    };
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, "system", "settings"), settings, { merge: true });
      alert("ڕێکخستنەکان پاشەکەوت کران!");
    } catch (e) {
      console.error(e);
      alert("هەڵەیەک ڕوویدا لە کاتی پاشەکەوتکردندا.");
    }
    setIsSaving(false);
  };

  const handleClearAlert = async (colName: string, label: string) => {
    if (
      window.prompt(
        `بۆ سڕینەوەی سڕجەم داتاکانی "${label}" وشەی "سڕینەوە" لە خوارەوە بنووسە:`,
      ) === "سڕینەوە"
    ) {
      try {
        setIsSaving(true);
        let colsToDelete = [colName];

        if (colName === "ALL") {
          colsToDelete = [
            "receipts",
            "products",
            "debts",
            "debt_transactions",
            "return_transactions",
            "expenses",
            "customers",
            "visits",
            "companies",
            "safes",
            "safe_transactions"
          ];
        } else if (colName === "debts") {
          colsToDelete = ["debts", "debt_transactions"];
        } else if (colName === "customers") {
          colsToDelete = ["customers", "visits"];
        }

        for (const col of colsToDelete) {
          const qSnap = await getDocs(collection(db, col));
          const deletePromises = qSnap.docs.map((d) =>
            deleteDoc(doc(db, col, d.id)),
          );
          await Promise.all(deletePromises);
        }
        alert(`بەسەرکەوتوویی سڕایەوە: ${label}`);
      } catch (err: any) {
        console.error("Error clearing data:", err);
        alert("هەڵەیەک ڕوویدا لە کاتی سڕینەوەدا: " + err.message);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleBackup = async () => {
    try {
      const collectionsToBackup = [
        "products",
        "receipts",
        "companies",
        "expenses",
        "users",
        "system",
      ];
      const backupData: any = {};

      for (const colName of collectionsToBackup) {
        const querySnapshot = await getDocs(collection(db, colName));
        backupData[colName] = querySnapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
      }

      const jsonString = JSON.stringify(backupData);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `backup_pos_${new Date().toLocaleDateString("ku")}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("هەڵەیەک ڕوویدا لە کاتی وەرگرتنی باکئاپدا.");
    }
  };

  const handleRestore = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const contents = event.target?.result;
          if (typeof contents === "string") {
            const data = JSON.parse(contents);
            if (
              window.confirm(
                "دڵنیایت کە دەتەوێت داتاکانی ئەم فایلە بگەڕێنیتەوە؟ ئەمە ڕەنگە کار بکاتە سەر داتاکانی ئێستا. تکایە چاوەڕێ بکە تاوەکو تەواو دەبێت بۆ ئەوەی داتاکان بە دروستی بگەرێنەوە.",
              )
            ) {
              for (const colName of Object.keys(data)) {
                const docs = data[colName];
                for (const item of docs) {
                  const docRef = doc(db, colName, item.id);
                  const { id, ...docData } = item;
                  await setDoc(docRef, docData, { merge: true });
                }
              }
              alert("داتاکان بە سەرکەوتوویی گەڕێندرانەوە!");
            }
          }
        } catch (err) {
          console.error(err);
          alert("فایلەکە گونجاو نییە یان هەڵەیەک ڕوویدا لە کاتی گەڕاندنەوەدا.");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div className="bg-slate-50 rounded-2xl h-full overflow-y-auto w-full max-w-5xl mx-auto space-y-6 pb-12">
      <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm">
        <div className="border-b border-slate-100 pb-4 mb-6">
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Settings className="text-pink-600" /> ڕێکخستنی سیستەم
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            بەڕێوەبردنی زانیارییەکان، قفڵی شاشە، و پاشەکەوتی داتاکان
          </p>
        </div>

        <div className="space-y-8">
          {/* Shop Information */}
          <section className="space-y-4">
            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
              زانیاریەکانی دوکان
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              ئەم زانیاریانە لەسەر پسوڵە (ریسیپت) دەردەکەون.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="text-sm font-bold text-slate-600 mb-1.5 block">
                  ناوی دوکان / کۆمپانیا
                </label>
                <input
                  type="text"
                  value={settings.shopName || ""}
                  onChange={(e) =>
                    setSettings({ ...settings, shopName: e.target.value })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 focus:ring-2 focus:ring-pink-500 focus:outline-none transition-all font-medium text-slate-800"
                />
              </div>
              <div>
                <label className="text-sm font-bold text-slate-600 mb-1.5 block">
                  ژمارە مۆبایل
                </label>
                <input
                  type="text"
                  value={settings.shopPhone || ""}
                  onChange={(e) =>
                    setSettings({ ...settings, shopPhone: e.target.value })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 focus:ring-2 focus:ring-pink-500 focus:outline-none transition-all font-mono text-left"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="text-sm font-bold text-slate-600 mb-1.5 block">
                  ناونیشان بۆ سەر وەسڵ
                </label>
                <input
                  type="text"
                  value={settings.shopAddress || ""}
                  onChange={(e) =>
                    setSettings({ ...settings, shopAddress: e.target.value })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 focus:ring-2 focus:ring-pink-500 focus:outline-none transition-all font-medium text-slate-800"
                />
              </div>
              <div>
                <label className="text-sm font-bold text-slate-600 mb-1.5 block">
                  تێکستی خوارەوەی وەسڵ
                </label>
                <input
                  type="text"
                  value={settings.receiptFooter || ""}
                  onChange={(e) =>
                    setSettings({ ...settings, receiptFooter: e.target.value })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 focus:ring-2 focus:ring-pink-500 focus:outline-none transition-all font-medium text-slate-800"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-bold text-slate-600 mb-1.5 block">
                  نرخی گۆڕینەوەی دۆلار بەرامبەر بە دینار ($1 = ؟ دینار)
                </label>
                <div className="flex flex-col md:flex-row gap-4">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={settings.exchangeRate || 1500}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        exchangeRate: Number(e.target.value),
                      })
                    }
                    className="w-full md:w-1/2 bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 focus:ring-2 focus:ring-pink-500 focus:outline-none transition-all font-mono text-left text-lg"
                    dir="ltr"
                  />
                </div>

                <div className="mt-6 bg-slate-50 rounded-xl border border-slate-200 p-5">
                  <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                    حاسیبەی گۆڕینەوەی دراو
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100">
                  <label className="text-sm font-bold text-slate-600 mb-1.5 block">
                    قاسەی بنەڕەتی بۆ وەرگرتنەوەی قەرز
                  </label>
                  <select
                    value={settings.defaultSafeForDebt || ""}
                    onChange={(e) =>
                      setSettings({ ...settings, defaultSafeForDebt: e.target.value })
                    }
                    className="w-full md:w-1/2 bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 focus:ring-2 focus:ring-pink-500 focus:outline-none transition-all font-medium text-slate-800"
                  >
                    <option value="">-- هیچ قاسەیەک دیارینەکراوە --</option>
                    {safes.map(s => (
                       <option key={s.id} value={s.id}>{s.name} ({formatCurrency(s.balance || 0, "USD")})</option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-400 mt-2">
                    ئەم قاسەیە بەشێوەیەکی ئۆتۆماتیکی هەڵدەبژێردرێت کاتێک لە تابی 'وەرگرتنی قەرز' پارە وەردەگریت.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <hr className="border-slate-100" />

          {/* Security & Lock */}
          <section className="space-y-4">
            <h3 className="font-bold text-lg text-slate-800">
              پارێزگاری و قفڵکردن
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="text-sm font-bold text-slate-600 mb-1.5 block">
                  پین کۆدی قفڵکردنی شاشە (PIN)
                </label>
                <input
                  type="password"
                  placeholder="••••••"
                  value={settings.pinCode || ""}
                  onChange={(e) =>
                    setSettings({ ...settings, pinCode: e.target.value })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 focus:ring-2 focus:ring-pink-500 focus:outline-none transition-all font-mono text-left tracking-[0.5em]"
                  dir="ltr"
                />
                <p className="text-[11px] text-slate-500 mt-2">
                  توێژینەوەی ئەگەر بەتاڵ بێت، شاشە قفڵ ناکرێت.
                </p>
              </div>
            </div>
          </section>

          <hr className="border-slate-100" />

          {/* Backup & Restore */}
          <section className="space-y-4">
            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
              <Database className="text-pink-600" size={20} /> باکئاپ و
              گەڕاندنەوەی داتاکان
            </h3>
            <p className="text-xs text-slate-500 mb-2">
              پارێزگاری لە داتاکانت بکە بە وەرگرتنی باکئاپ و گەڕاندنەوەی لە کاتی
              پێویستدا.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={handleBackup}
                className="p-4 bg-white border border-slate-200 hover:border-pink-300 hover:bg-pink-50 rounded-xl transition-all shadow-sm flex flex-col items-center justify-center gap-3 group"
              >
                <div className="bg-pink-100 p-3 rounded-full text-pink-600 group-hover:scale-110 transition-transform">
                  <Download size={24} />
                </div>
                <div className="text-center">
                  <h4 className="font-bold text-sm text-slate-800">
                    وەرگرتنی باکئاپ (دابەزاندن)
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-1">
                    هەموو داتاکانت لەسەر ئامێرەکەت خەزن بکە
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={handleRestore}
                className="p-4 bg-white border border-slate-200 hover:border-pink-300 hover:bg-pink-50 rounded-xl transition-all shadow-sm flex flex-col items-center justify-center gap-3 group"
              >
                <div className="bg-pink-100 p-3 rounded-full text-pink-600 group-hover:scale-110 transition-transform">
                  <Upload size={24} />
                </div>
                <div className="text-center">
                  <h4 className="font-bold text-sm text-slate-800">
                    گەڕاندنەوەی داتاکان (هێنانە ناوەوە)
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-1">
                    باکئاپی پێشوو بخەرەوە ناو سیستەمەکە
                  </p>
                </div>
              </button>
            </div>
          </section>

          <hr className="border-slate-100" />

          {/* Telegram Settings */}
          <section className="space-y-4">
            <h3 className="font-bold text-lg border-l-4 border-pink-500 pl-2 text-slate-800">
              ڕێکخستنەکانی تێلیگرام (Telegram)
            </h3>
            <p className="text-xs text-slate-500 mb-2">
              ئەگەر ئەم دوو خانەیە پڕبکرێنەوە، سیستەمەکە دەتوانێت نامە بنێرێت بۆ
              تێلیگرام لە کاتی داخستنی ڕۆژ یان کارە گرنگەکان.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="text-sm font-bold text-slate-600 mb-1.5 block">
                  تۆکنی بۆت (Bot Token)
                </label>
                <input
                  type="text"
                  placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                  value={settings.telegramBotToken || ""}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      telegramBotToken: e.target.value,
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 focus:ring-2 focus:ring-pink-500 focus:outline-none transition-all font-mono text-sm text-left opacity-70 focus:opacity-100"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="text-sm font-bold text-slate-600 mb-1.5 block">
                  ئایدی چات (Chat ID)
                </label>
                <input
                  type="text"
                  placeholder="-1001234567890"
                  value={settings.telegramChatId || ""}
                  onChange={(e) =>
                    setSettings({ ...settings, telegramChatId: e.target.value })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 focus:ring-2 focus:ring-pink-500 focus:outline-none transition-all font-mono text-sm text-left opacity-70 focus:opacity-100"
                  dir="ltr"
                />
              </div>
            </div>
          </section>

          {/* Action Footer */}
          <div className="pt-6 mt-8 flex justify-end">
            <button
              disabled={isSaving}
              onClick={handleSave}
              className="px-8 py-3.5 bg-pink-600 text-white rounded-xl font-bold text-sm hover:bg-pink-700 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-pink-200 transition-all w-full md:w-auto"
            >
              <Save size={18} />
              {isSaving
                ? "لە پاشەکەوتکردندایە..."
                : "پاشەکەوتکردنی گۆڕانکارییەکان"}
            </button>
          </div>
        </div>
      </div>

            {/* Migration Section */}
      <div className="bg-pink-50 border border-pink-200 rounded-2xl p-6 md:p-8 shadow-sm space-y-6 mb-8">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-pink-100 rounded-xl flex items-center justify-center text-pink-600 shrink-0">
            <ArrowLeftRight size={24} />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-xl text-pink-900">گۆڕینی داتاکانی پێشوو (دینار بۆ دۆلار)</h3>
            <p className="text-sm text-pink-700 mt-1 font-medium">
              ئەگەر پێشتر کڕین و فرۆشتنت بە دینار زانیارییەکانت داخڵ کردووە، ئەوا بە یەک کلیک هەموو سیستەمەکە دۆکامێنتەکان کەنڤەرت دەکات بۆ دۆلار.
            </p>
            <p className="text-xs text-pink-500 font-bold mt-2">تێبینی: نرخی 100 دۆلار = {((settings.exchangeRate || 1500) * 100).toLocaleString()} دینار هەژمار دەکرێت بۆ کەنڤەرت کردن.</p>
          </div>
        </div>
        <div className="flex justify-end">
           <button
             onClick={async () => {
                if(!confirm('دڵنیایت لەم کارە؟ ئەمە هەموو نرخەکانی ناو (کالاکان، خەرجییەکان، قەرزەکان، قاسەکان) دابەشی نرخی دۆلار دەکات.')) return;
                try {
                  const rate = (settings.exchangeRate || 1500);
                  
                  // Products
                  const pSnap = await getDocs(collection(db, 'products'));
                  for(let d of pSnap.docs) {
                    const data = d.data();
                    let update: any = {};
                    if(data.unitCost && data.unitCost > 1000) update.unitCost = Number((data.unitCost / rate).toFixed(2));
                    if(data.unitPrice && data.unitPrice > 1000) update.unitPrice = Number((data.unitPrice / rate).toFixed(2));
                    if(data.wholesaleCost && data.wholesaleCost > 1000) update.wholesaleCost = Number((data.wholesaleCost / rate).toFixed(2));
                    if(data.wholesalePrice && data.wholesalePrice > 1000) update.wholesalePrice = Number((data.wholesalePrice / rate).toFixed(2));
                    if(Object.keys(update).length > 0) {
                      await updateDoc(doc(db, 'products', d.id), update);
                    }
                  }

                  // Expenses
                  const eSnap = await getDocs(collection(db, 'expenses'));
                  for(let d of eSnap.docs) {
                     if(d.data().amount > 1000) {
                        await updateDoc(doc(db, 'expenses', d.id), { amount: Number((d.data().amount / rate).toFixed(2)) });
                     }
                  }

                  // Debts
                  const debtSnap = await getDocs(collection(db, 'debts'));
                  for(let d of debtSnap.docs) {
                     const data = d.data();
                     let update: any = {};
                     if(data.amount && data.amount > 1000) update.amount = Number((data.amount / rate).toFixed(2));
                     if(data.remainingAmount && data.remainingAmount > 1000) update.remainingAmount = Number((data.remainingAmount / rate).toFixed(2));
                     if(Object.keys(update).length > 0) {
                        await updateDoc(doc(db, 'debts', d.id), update);
                     }
                  }

                  // Debt Transactions
                  const dtSnap = await getDocs(collection(db, 'debt_transactions'));
                  for(let d of dtSnap.docs) {
                     if(d.data().amount > 1000) {
                        await updateDoc(doc(db, 'debt_transactions', d.id), { amount: Number((d.data().amount / rate).toFixed(2)) });
                     }
                  }

                  // Safes
                  const safeSnap = await getDocs(collection(db, 'safes'));
                  for(let d of safeSnap.docs) {
                     if(d.data().balance > 1000) {
                        await updateDoc(doc(db, 'safes', d.id), { balance: Number((d.data().balance / rate).toFixed(2)) });
                     }
                  }

                  // Safe Transactions
                  const stSnap = await getDocs(collection(db, 'safe_transactions'));
                  for(let d of stSnap.docs) {
                     if(d.data().amount > 1000) {
                        await updateDoc(doc(db, 'safe_transactions', d.id), { amount: Number((d.data().amount / rate).toFixed(2)) });
                     }
                  }

                  alert('بە سەرکەوتوویی گۆڕدرا بۆ دۆلار!');
                } catch(e) {
                   console.error(e);
                   alert('هەڵەیەک ڕوویدا');
                }
             }}
             className="bg-pink-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-pink-700 transition-colors flex items-center gap-2 shadow-sm"
           >
              <ArrowLeftRight size={18} />
              گۆڕینی هەموو نرخەکان بۆ دۆلار
           </button>
        </div>
      </div>

      <div className="bg-yellow-50 p-6 md:p-8 rounded-2xl border border-yellow-200 shadow-sm space-y-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center text-yellow-600 shrink-0">
            <AlertTriangle size={24} />
          </div>
          <div>
            <h3 className="font-bold text-xl text-yellow-800">چاکسازی سیستەم (مایگرەیشنی قەرزەکان)</h3>
            <p className="text-sm text-yellow-600 mt-1 font-medium">
              گۆڕینی هەموو ئەو وەسڵانەی کە پێشتر بە نەقد (کاش) فرۆشراون بۆ قەرز، وە دروستکردنی مامەڵەی قەرز بۆیان. ئەگەر نیازی لابردنی نەقدت هەیە لە فرۆشتن، ئەمە بکە.
            </p>
          </div>
        </div>
        <div className="flex justify-start">
           <button
             onClick={async () => {
                if(!confirm('دڵنیایت؟ ئەمە هەموو وەسڵە نەقدەکان دەکات بە قەرز و دەیانخاتە سەر حیسابی کڕیارەکان.')) return;
                try {
                  const rSnap = await getDocs(collection(db, 'receipts'));
                  let count = 0;
                  for (let r of rSnap.docs) {
                    const data = r.data();
                    if (data.paymentType === 'cash') {
                       await updateDoc(doc(db, 'receipts', r.id), { paymentType: 'debt' });
                       
                       const debtAmount = data.finalTotal || data.total || 0;
                       if(debtAmount > 0) {
                         const customerName = data.customerName || "کڕیاری گشتی";
                         const debtsRef = collection(db, "debts");
                         const debtsSnap = await getDocs(debtsRef);
                         let existingDebt = null;
                         for (const d of debtsSnap.docs) {
                            if (d.data().customerName === customerName) {
                               existingDebt = d; break;
                            }
                         }
                         if (existingDebt) {
                           await updateDoc(doc(db, "debts", existingDebt.id), {
                             amount: (existingDebt.data().amount || 0) + debtAmount,
                             remainingAmount: (existingDebt.data().remainingAmount || 0) + debtAmount
                           });
                           await addDoc(collection(db, "debt_transactions"), {
                             debtId: existingDebt.id,
                             receiptId: r.id,
                             type: "add",
                             amount: debtAmount,
                             customerName: customerName,
                             sellerName: data.sellerName || "",
                             timestamp: data.timestamp || Timestamp.now(),
                             status: "completed",
                             notes: `گۆڕانکاری لە نەقد بۆ قەرز (وەسڵی ژمارە ${data.invoiceNo || ''})`
                           });
                         } else {
                           const newDebtRef = await addDoc(collection(db, "debts"), {
                             customerName: customerName,
                             phone: data.phone || "",
                             address: data.address || "",
                             amount: debtAmount,
                             remainingAmount: debtAmount,
                             status: "active",
                             timestamp: data.timestamp || Timestamp.now(),
                             sellerName: data.sellerName || ""
                           });
                           await addDoc(collection(db, "debt_transactions"), {
                             debtId: newDebtRef.id,
                             receiptId: r.id,
                             type: "add",
                             amount: debtAmount,
                             customerName: customerName,
                             sellerName: data.sellerName || "",
                             timestamp: data.timestamp || Timestamp.now(),
                             status: "completed",
                             notes: `گۆڕانکاری لە نەقد بۆ قەرز (وەسڵی ژمارە ${data.invoiceNo || ''})`
                           });
                         }
                       }
                       count++;
                    }
                  }
                  alert(`سەرکەوتوو بوو! ${count} وەسڵ گۆڕدران بۆ قەرز.`);
                } catch(e) {
                   console.error(e);
                   alert('هەڵەیەک ڕوویدا');
                }
             }}
             className="bg-yellow-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-yellow-600 transition-colors flex items-center gap-2 shadow-sm"
           >
              گۆڕینی وەسڵە نەقدەکان بۆ قەرز
           </button>
        </div>

        <div className="flex flex-col gap-4 border-t border-yellow-200 pt-6 mt-6">
           <h3 className="font-bold text-lg text-yellow-800">مایگرەیشنی قەرزە وەرگیراوەکان بۆ قاسە</h3>
           <p className="text-sm text-yellow-600 font-medium">ئەمە ئەو قەرزانەی پێشتر وەرگیراونەتەوە و نەچوونەتە ناو قاسە، دەیانخاتە ناو قاسەیەکی دیاریکراوەوە. تکایە قاسەیەک هەڵبژێرە و پاشان مایگرەیشنەکە بکە.</p>
           
           <div className="flex flex-col sm:flex-row items-center gap-3">
             <select
               id="migrationSafeSelector"
               className="w-full sm:w-1/2 bg-white border border-yellow-300 rounded-xl py-3 px-4 focus:ring-2 focus:ring-yellow-500 focus:outline-none transition-all font-medium text-slate-800"
             >
               <option value="">-- هەڵبژاردنی قاسە --</option>
               {safes.map((s) => (
                 <option key={s.id} value={s.id}>
                   {s.name} ({formatCurrency(s.balance || 0, "USD")})
                 </option>
               ))}
             </select>
             
             <button
               onClick={async () => {
                  const sel = document.getElementById("migrationSafeSelector") as HTMLSelectElement;
                  const safeId = sel?.value;
                  if (!safeId) {
                    alert("تکایە قاسەیەکی دیاری بکە");
                    return;
                  }
                  if(!confirm('دڵنیایت دەتەوێت قەرزە کۆنەکان بخەیتە ناو ئەم قاسەیە؟ ئەمە باڵانسی قاسەکە زیاد دەکات!')) return;
                  
                  try {
                    const [safeSnap, txSnap] = await Promise.all([
                       getDoc(doc(db, "safes", safeId)),
                       getDocs(collection(db, "debt_transactions"))
                    ]);
                    
                    if (!safeSnap.exists()) return;
                    
                    let totalAdded = 0;
                    let count = 0;
                    
                    // We need to look for transactions where type === "sub" and NOT type === "add" 
                    // AND where status === "completed" and it does NOT have safeId
                    
                    const batch = writeBatch(db);
                    let currentSafeBalance = safeSnap.data().balance || 0;
                    
                    // We must group them in batches of 500 if too many, but typically < 500.
                    for (let t of txSnap.docs) {
                       const tData = t.data();
                       if (tData.type === "sub" && tData.status === "completed" && !tData.safeId && !tData.syncedToSafe) {
                          const amt = tData.amount || 0;
                          if (amt > 0) {
                             totalAdded += amt;
                             count++;
                             
                             batch.update(doc(db, "debt_transactions", t.id), {
                                safeId: safeId,
                                syncedToSafe: true
                             });
                             
                             const stRef = doc(collection(db, "safe_transactions"));
                             batch.set(stRef, {
                                safeId: safeId,
                                amount: amt,
                                type: "in",
                                origin: "دەرەکی",
                                timestamp: tData.timestamp || Timestamp.now(),
                                notes: "مایگرەیشنی قەرزی وەرگیراو (کۆن) - " + (tData.customerName || tData.notes || ""),
                             });
                          }
                       }
                    }
                    
                    if (count > 0) {
                       batch.update(doc(db, "safes", safeId), {
                          balance: currentSafeBalance + totalAdded
                       });
                       await batch.commit();
                       alert(`سەرکەوتوو بوو! ${count} پارەدان (بە بڕی ${totalAdded}$) زیادکران بۆ قاسەکە.`);
                    } else {
                       alert('هیچ پارەدانێکی کۆن نەدۆزرایەوە کە نەچووبێتە قاسە.');
                    }
                    
                  } catch(e) {
                    console.error(e);
                    alert("هەڵەیەک ڕوویدا لە کاتی مایگرەیشن");
                  }
               }}
               className="bg-yellow-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-yellow-700 transition-colors shadow-sm w-full sm:w-auto"
             >
                مایگرەیشنی قەرز
             </button>
           </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50 p-6 md:p-8 rounded-2xl border border-red-200 shadow-sm space-y-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center text-red-600 shrink-0">
            <AlertTriangle size={24} />
          </div>
          <div>
            <h3 className="font-bold text-xl text-red-800">ناوچەی مەترسیدار</h3>
            <p className="text-sm text-red-600 mt-1 font-medium">
              ئاگاداربە، سڕینەوەی داتاکان پاشگەزبوونەوەی نییە. دڵنیابە لە
              هەبوونی باکئاپ پێش ئەم هەنگاوە.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-2">
          <button
            onClick={() => handleClearAlert("receipts", "وەسڵەکان")}
            className="py-3 px-4 bg-white border border-red-200 text-red-700 hover:bg-red-100 rounded-xl text-sm font-bold transition-colors shadow-sm flex flex-col items-center justify-center text-center gap-2"
          >
            <Trash2 size={20} /> سڕینەوەی وەسڵەکان
          </button>
          <button
            onClick={() => handleClearAlert("return_transactions", "چاوەڕێکراوی گەڕانەوەکان")}
            className="py-3 px-4 bg-white border border-red-200 text-red-700 hover:bg-red-100 rounded-xl text-sm font-bold transition-colors shadow-sm flex flex-col items-center justify-center text-center gap-2"
          >
            <Trash2 size={20} /> سڕینەوەی چاوەڕێکراوی گەڕانەوە
          </button>
          <button
            onClick={() => handleClearAlert("expenses", "خەرجییەکان")}
            className="py-3 px-4 bg-white border border-red-200 text-red-700 hover:bg-red-100 rounded-xl text-sm font-bold transition-colors shadow-sm flex flex-col items-center justify-center text-center gap-2"
          >
            <Trash2 size={20} /> سڕینەوەی خەرجییەکان
          </button>
          <button
            onClick={() => handleClearAlert("products", "کالاکان")}
            className="py-3 px-4 bg-white border border-red-200 text-red-700 hover:bg-red-100 rounded-xl text-sm font-bold transition-colors shadow-sm flex flex-col items-center justify-center text-center gap-2"
          >
            <Trash2 size={20} /> سڕینەوەی کالاکان
          </button>
          <button
            onClick={() => handleClearAlert("debts", "قەرزەکان")}
            className="py-3 px-4 bg-white border border-red-200 text-red-700 hover:bg-red-100 rounded-xl text-sm font-bold transition-colors shadow-sm flex flex-col items-center justify-center text-center gap-2"
          >
            <Trash2 size={20} /> سڕینەوەی قەرزەکان
          </button>
          <button
            onClick={() => handleClearAlert("customers", "کڕیارەکان و سەردانەکان")}
            className="py-3 px-4 bg-white border border-red-200 text-red-700 hover:bg-red-100 rounded-xl text-sm font-bold transition-colors shadow-sm flex flex-col items-center justify-center text-center gap-2"
          >
            <Trash2 size={20} /> سڕینەوەی کڕیار و سەردان
          </button>
          <button
            onClick={() => handleClearAlert("companies", "کۆمپانیا و مەندوبەکان")}
            className="py-3 px-4 bg-white border border-red-200 text-red-700 hover:bg-red-100 rounded-xl text-sm font-bold transition-colors shadow-sm flex flex-col items-center justify-center text-center gap-2"
          >
            <Trash2 size={20} /> سڕینەوەی مەندوبەکان
          </button>
          <button
            onClick={() => handleClearAlert("safe_transactions", "مێژووی مامەڵەکانی قاسە")}
            className="py-3 px-4 bg-white border border-red-200 text-red-700 hover:bg-red-100 rounded-xl text-sm font-bold transition-colors shadow-sm flex flex-col items-center justify-center text-center gap-2"
          >
            <Trash2 size={20} /> سڕینەوەی مامەڵەی قاسەکان
          </button>
          <button
            onClick={() => handleClearAlert("ALL", "هەموو داتاکان بە یەکجاری")}
            className="py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold transition-colors shadow-md shadow-red-200/50 flex flex-col items-center justify-center text-center gap-2 sm:col-span-1 md:col-span-1"
          >
            <AlertTriangle size={20} /> سڕینەوەی گشتی
          </button>
        </div>
      </div>
    </div>
  );
}
