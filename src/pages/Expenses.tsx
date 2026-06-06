import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Banknote, Coffee, Truck, Lightbulb, Box } from 'lucide-react';
import { collection, onSnapshot, addDoc, Timestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { formatCurrency } from '../data';
import { IQDInput } from '../components/IQDInput';

interface Expense {
  id: string;
  title: string;
  category: string;
  amount: number;
  userEmail: string;
  timestamp: any;
}

export default function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('ڕۆژانە');
  const [amount, setAmount] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'expenses'), (snap) => {
      setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Expense)).sort((a,b) => b.timestamp - a.timestamp));
    });
    return () => unsub();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !amount) return;

    await addDoc(collection(db, 'expenses'), {
      title,
      category,
      amount: parseFloat(amount),
      userEmail: auth.currentUser?.email || 'Unknown',
      timestamp: Timestamp.now()
    });

    setIsModalOpen(false);
    setTitle('');
    setAmount('');
  };

  const getIcon = (cat: string) => {
    if (cat === 'خزمەتگوزاری') return Lightbulb;
    if (cat === 'گواستنەوە') return Truck;
    if (cat === 'ڕۆژانە') return Coffee;
    return Box;
  };

  const todayStr = new Date().toDateString();
  const summary = useMemo(() => {
    return expenses.reduce((acc, curr) => {
      acc.total += curr.amount;
      const d = curr.timestamp?.toDate ? curr.timestamp.toDate() : new Date(curr.timestamp);
      if (d.toDateString() === todayStr) {
        acc.today += curr.amount;
      }
      return acc;
    }, { today: 0, total: 0 });
  }, [expenses]);

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-orange-600 text-xs font-medium mb-1">خەرجی ئەمڕۆ</p>
            <h3 className="text-xl font-bold font-mono text-orange-800">{formatCurrency(summary.today)}</h3>
          </div>
        </div>
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-slate-600 text-xs font-medium mb-1">کۆی خەرجییەکان</p>
            <h3 className="text-xl font-bold font-mono text-slate-800">{formatCurrency(summary.total)}</h3>
          </div>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
        
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white gap-4">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Banknote size={24} className="text-pink-600" />
              خەرجییەکان
            </h2>
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button onClick={() => setIsModalOpen(true)} className="px-4 py-2 bg-pink-600 text-white rounded-xl text-sm font-medium hover:bg-pink-700 whitespace-nowrap flex items-center gap-1.5 shadow-md shadow-pink-200">
              <Plus size={16} /> تۆمارکردنی خەرجی
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar p-4 sm:p-6 grid gap-3 content-start">
            {expenses.map((exp) => {
              const Icon = getIcon(exp.category);
              const dateObj = exp.timestamp?.toDate ? exp.timestamp.toDate() : new Date(exp.timestamp);
              
              return (
                <div key={exp.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:border-pink-300 transition-colors gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500">
                      <Icon size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">{exp.title}</h3>
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                        <span>{exp.category}</span>
                        <span>•</span>
                        <span className="font-mono">{dateObj.toLocaleDateString('en-GB')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-left w-full sm:w-auto flex sm:flex-col justify-between sm:justify-center items-center sm:items-end border-t sm:border-t-0 border-slate-100 pt-3 sm:pt-0">
                    <span className="font-bold font-mono text-orange-600 text-lg">-{formatCurrency(exp.amount)}</span>
                    <span className="text-[10px] text-slate-400 mt-1" dir="ltr">{exp.userEmail}</span>
                  </div>
                </div>
              );
            })}
            {expenses.length === 0 && (
              <div className="py-12 text-center text-slate-500">
                 هیچ خەرجییەک نەدۆزرایەوە.
              </div>
            )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800">تۆمارکردنی خەرجی نوێ</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">ناوی خەرجی</label>
                <input required type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500" placeholder="بۆ نموونە: کڕینی ئاو و چا" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">بڕی پارە</label>
                    <input required type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500" />
                    <IQDInput usdValue={amount} setUsdValue={(v) => setAmount(v.toString())} />
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">جۆر</label>
                    <select required value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500">
                       <option>ڕۆژانە</option>
                       <option>گواستنەوە</option>
                       <option>خزمەتگوزاری</option>
                       <option>دیکە</option>
                    </select>
                 </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors">
                پاشگەزبوونەوە
              </button>
              <button type="submit" className="px-4 py-2 bg-pink-600 text-white hover:bg-pink-700 rounded-lg text-sm font-medium transition-colors">
                پاشەکەوتکردن
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
