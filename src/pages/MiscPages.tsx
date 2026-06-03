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

const reduceCustomerDebt = async (receipt: any, amountToReduce: number, reason: string) => {
   if (!receipt || !receipt.customerName || (receipt.paymentType !== 'debt' && receipt.paymentType !== 'قەرز')) return;
   
   try {
     const debtsQ = query(collection(db, "debts"), where("customerName", "==", receipt.customerName));
     const debtSnap = await getDocs(debtsQ);
     if (!debtSnap.empty) {
        const debtDoc = debtSnap.docs[0];
        const currentData = debtDoc.data();
        
        const newAmount = Math.max(0, (currentData.amount || 0) - amountToReduce);
        const newRemaining = Math.max(0, (currentData.remainingAmount || 0) - amountToReduce);
        
        await updateDoc(doc(db, "debts", debtDoc.id), {
           amount: newAmount,
           remainingAmount: newRemaining,
           status: newRemaining <= 0 ? 'paid' : 'active'
        });

        await addDoc(collection(db, "debt_transactions"), {
           debtId: debtDoc.id,
           amount: amountToReduce,
           type: 'pay',
           timestamp: Timestamp.now(),
           notes: `${reason} - وەسڵی ژمارە: ${receipt.id.slice(-6).toUpperCase()}`
        });
     }
   } catch(e) {
     console.error("Error reducing debt:", e);
   }
};

export function Returns() {
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
        "دڵنیایت لە گەڕاندنەوەی تەواوی ئەم وەسڵە؟ سەردانی کۆگا دەکاتەوە و داتای فرۆشتنەکە دەسڕێتەوە.",
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
      // 3. reduce debt if applicable
      await reduceCustomerDebt(returningReceipt, returningReceipt.totalAmount || 0, "گەڕانەوەی تەواوی کاڵاکان");
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
        await reduceCustomerDebt(returningReceipt, reductionAmount, "گەڕانەوەی کاڵا");
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
        await reduceCustomerDebt(returningReceipt, reductionAmount, "گەڕانەوەی کاڵا");
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
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Undo2 className="text-pink-600" /> گەڕانەوەی کالا (مرتجعات)
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
                <th className="px-4 py-3 font-semibold">کۆی گشتی (دینار)</th>
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
                    {formatCurrency(r.totalAmount || r.total || 0, "IQD")}
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
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-4">
              <h3 className="text-lg font-bold">
                زانیاری وەسڵی #{returningReceipt.id.slice(0, 6).toUpperCase()}
              </h3>
              <button
                onClick={() => setReturningReceipt(null)}
                className="text-slate-400 hover:text-red-500 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 overflow-auto mb-4 border border-slate-100 rounded-lg">
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
                        {formatCurrency(item.unitPrice, item.currency || "IQD")}
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
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                onClick={handleReturnWholeReceipt}
                className="px-4 py-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg font-bold transition-colors flex items-center gap-2"
              >
                <Trash2 size={16} /> گەڕاندنەوەت تەواوی وەسڵەکە
              </button>
              <div className="font-mono font-bold text-lg text-slate-800">
                کۆی گشتی:{" "}
                {formatCurrency(
                  returningReceipt.totalAmount || returningReceipt.total || 0,
                  "IQD",
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
      await reduceCustomerDebt(returningReceipt, returningReceipt.totalAmount || 0, "گۆڕینەوەی کوێربووی تەواوی کاڵاکان");
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
        await reduceCustomerDebt(returningReceipt, reductionAmount, "گۆڕینەوەی کاڵا");
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
        await reduceCustomerDebt(returningReceipt, reductionAmount, "گۆڕینەوەی کاڵا");
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
                <th className="px-4 py-3 font-semibold">کۆی گشتی (دینار)</th>
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
                    {formatCurrency(r.totalAmount || r.total || 0, "IQD")}
                  </td>
                  <td className="px-4 py-4 flex justify-center">
                    <button
                      onClick={() => setReturningReceipt(r)}
                      className="text-indigo-600 hover:bg-indigo-50 p-2 rounded-lg transition-colors flex items-center gap-2 font-bold text-xs border border-indigo-100"
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
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-4">
              <h3 className="text-lg font-bold">
                زانیاری وەسڵی #{returningReceipt.id.slice(0, 6).toUpperCase()}{" "}
                بۆ گۆڕینەوە
              </h3>
              <button
                onClick={() => setReturningReceipt(null)}
                className="text-slate-400 hover:text-red-500 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 overflow-auto mb-4 border border-slate-100 rounded-lg">
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
                      <td className="px-4 py-3 font-mono text-indigo-600">
                        {formatCurrency(item.unitPrice, item.currency || "IQD")}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleReturnSingleItem(i)}
                          className="px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 text-xs font-bold transition-colors"
                        >
                          گۆڕینەوە
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                onClick={handleReturnWholeReceipt}
                className="px-4 py-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg font-bold transition-colors flex items-center gap-2"
              >
                <Trash2 size={16} /> هەڵوەشاندنەوەی تەواوی وەسڵەکە
              </button>
              <div className="font-mono font-bold text-lg text-slate-800">
                کۆی گشتی:{" "}
                {formatCurrency(
                  returningReceipt.totalAmount || returningReceipt.total || 0,
                  "IQD",
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
    await updateDoc(doc(db, "users", editingUser.id), {
      permissions: allowedPages,
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4 overflow-y-auto">
        {users.map((u) => (
          <div
            key={u.id}
            className="p-4 border border-slate-200 rounded-xl flex flex-col justify-between hover:border-pink-300 transition-colors bg-slate-50 relative"
          >
            {u.role === "admin" && (
              <span className="absolute top-2 left-2 text-[10px] font-bold bg-pink-100 text-pink-700 px-2 py-0.5 rounded">
                بەڕێوەبەر
              </span>
            )}
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 font-bold uppercase shadow-sm">
                {u.name?.charAt(0) || u.email?.charAt(0)}
              </div>
              <div>
                <h3 className="font-bold text-slate-800">
                  {u.name || (u.email && u.email.split("@")[0])}
                </h3>
                <p
                  className="text-[11px] text-slate-500 mt-0.5 font-mono bg-white inline-block px-1 rounded shadow-sm"
                  dir="ltr"
                >
                  {u.email}
                </p>
              </div>
            </div>

            <div className="mt-2 pt-3 border-t border-slate-200 flex justify-between items-center">
              <div className="text-[10px] text-slate-500">
                {u.role === "admin"
                  ? "هەموو دەسەڵاتەکانی هەیە"
                  : (u.permissions?.length || 0) + " بەش کراوەیە"}
              </div>
              <div className="flex gap-2">
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
                    className="text-xs font-bold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    سڕینەوە
                  </button>
                )}
                {u.role !== "admin" && (
                  <button
                    onClick={() => {
                      setEditingUser(u);
                      setAllowedPages(u.permissions || []);
                      setIsModalOpen(true);
                    }}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    دیاریکردنی دەسەڵات
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && editingUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleUpdateRole}
            className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col"
          >
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-gradient-to-l from-indigo-50 to-white">
              <h2 className="font-bold text-indigo-900 text-lg flex items-center gap-2">دیاریکردنی دەسەڵاتەکان</h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:bg-slate-100 p-1.5 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm font-bold text-slate-700">
                دەسەڵاتەکان بۆ:{" "}
                <span className="text-indigo-600">{editingUser.email}</span>
              </p>
              <div className="grid grid-cols-2 gap-3 mt-4">
                {permissionsOptions.map((opt) => (
                  <label
                    key={opt.id}
                    className={`flex items-center gap-2 p-3 border rounded-xl cursor-pointer transition-all text-sm font-medium select-none ${allowedPages.includes(opt.id) ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-600"}`}
                  >
                    <input
                      type="checkbox"
                      checked={allowedPages.includes(opt.id)}
                      onChange={() => togglePermission(opt.id)}
                      className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-slate-600 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                پاشگەزبوونەوە
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                پاشەکەوتکردن
              </button>
            </div>
          </form>
        </div>
      )}

      {isAddUserModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleAddUser}
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col"
          >
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h2 className="font-bold text-slate-800">
                زیادکردنی بەکارهێنەری نوێ
              </h2>
              <button
                type="button"
                onClick={() => setIsAddUserModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  ناوی تەواو
                </label>
                <input
                  required
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  ئیمەیڵ
                </label>
                <input
                  required
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-pink-500 font-mono text-left"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  تێپەڕوشە (باسۆرد)
                </label>
                <input
                  required
                  type="password"
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-pink-500 font-mono text-left"
                  dir="ltr"
                />
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAddUserModalOpen(false)}
                className="px-4 py-2 text-slate-600 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                پاشگەزبوونەوە
              </button>
              <button
                disabled={isCreating}
                type="submit"
                className="px-4 py-2 bg-pink-600 text-white rounded-lg text-sm font-medium hover:bg-pink-700 transition-colors disabled:opacity-50"
              >
                {isCreating ? "دروست دەکرێت..." : "دروستکردن"}
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

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "system", "settings"), (docSnap) => {
      if (docSnap.exists()) {
        setSettings(docSnap.data());
      }
    });
    return () => unsub();
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
            "expenses",
            "customers",
            "companies",
          ];
        } else if (colName === "debts") {
          colsToDelete = ["debts", "debt_transactions"];
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
                  تێکستی خوارەوەی پسوڵە
                </label>
                <input
                  type="text"
                  value={settings.receiptFooter || ""}
                  onChange={(e) =>
                    setSettings({ ...settings, receiptFooter: e.target.value })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 focus:ring-2 focus:ring-pink-500 focus:outline-none transition-all text-slate-600"
                />
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
                className="p-4 bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50 rounded-xl transition-all shadow-sm flex flex-col items-center justify-center gap-3 group"
              >
                <div className="bg-blue-100 p-3 rounded-full text-blue-600 group-hover:scale-110 transition-transform">
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
            <h3 className="font-bold text-lg border-l-4 border-blue-500 pl-2 text-slate-800">
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
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all font-mono text-sm text-left opacity-70 focus:opacity-100"
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
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all font-mono text-sm text-left opacity-70 focus:opacity-100"
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
            className="py-3 px-4 bg-white border border-red-200 text-red-700 hover:bg-red-100 rounded-xl text-sm font-bold transition-colors shadow-sm flex flex-col items-center gap-2"
          >
            <Trash2 size={20} /> سڕینەوەی وەسڵەکان
          </button>
          <button
            onClick={() => handleClearAlert("products", "کالاکان")}
            className="py-3 px-4 bg-white border border-red-200 text-red-700 hover:bg-red-100 rounded-xl text-sm font-bold transition-colors shadow-sm flex flex-col items-center gap-2"
          >
            <Trash2 size={20} /> سڕینەوەی کالاکان
          </button>
          <button
            onClick={() => handleClearAlert("debts", "قەرزەکان")}
            className="py-3 px-4 bg-white border border-red-200 text-red-700 hover:bg-red-100 rounded-xl text-sm font-bold transition-colors shadow-sm flex flex-col items-center gap-2"
          >
            <Trash2 size={20} /> سڕینەوەی قەرزەکان
          </button>
          <button
            onClick={() => handleClearAlert("ALL", "هەموو داتاکان بە یەکجاری")}
            className="py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold transition-colors shadow-md shadow-red-200/50 flex flex-col items-center gap-2"
          >
            <AlertTriangle size={20} /> سڕینەوەی گشتی
          </button>
        </div>
      </div>
    </div>
  );
}
