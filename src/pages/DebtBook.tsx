import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, FileText, UserPlus, FileClock, DollarSign, Printer, MessageCircle, PlusCircle, Edit } from 'lucide-react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, Timestamp, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { formatCurrency } from '../data';

interface Debt {
  id: string;
  customerName: string;
  phone: string;
  amount: number;
  remainingAmount: number;
  status: string;
  timestamp: any;
  lastPaymentDate?: any;
}

export default function DebtBook() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  
  // Modals
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [debtHistory, setDebtHistory] = useState<any[]>([]);
  const [actionType, setActionType] = useState<'pay' | 'add'>('pay');
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');

  const [newDebtModalOpen, setNewDebtModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAmount, setNewAmount] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'debts'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setDebts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Debt)));
    });
    
    const unsubCus = onSnapshot(collection(db, 'customers'), (snap) => {
      setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
       unsub();
       unsubCus();
    };
  }, []);

  const filtered = debts.filter(d => 
    d.customerName?.includes(search) || d.phone?.includes(search)
  );

  const totalRemaining = useMemo(() => {
    return debts.reduce((sum, d) => sum + (d.remainingAmount || 0), 0);
  }, [debts]);

  const [editDebtModalOpen, setEditDebtModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  const handleEditDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDebt || !editName) return;
    
    await updateDoc(doc(db, 'debts', selectedDebt.id), {
       customerName: editName,
       phone: editPhone
    });
    
    // update customer phone if exists
    const existingCus = customers.find(c => c.name === editName);
    if (existingCus && editPhone) {
       await updateDoc(doc(db, 'customers', existingCus.id), { phone: editPhone });
    }

    setEditDebtModalOpen(false);
    setSelectedDebt(null);
  };

  const handleDebtAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDebt || !paymentAmount) return;
    
    const amountInput = parseFloat(paymentAmount);
    if (amountInput <= 0) return;

    let newRemaining = selectedDebt.remainingAmount;
    let newTotalAmount = selectedDebt.amount;

    if (actionType === 'pay') {
       newRemaining -= amountInput;
    } else {
       newRemaining += amountInput;
       newTotalAmount += amountInput;
    }

    const finalRemaining = newRemaining < 0 ? 0 : newRemaining;
    const newStatus = finalRemaining === 0 ? 'paid' : 'active';

    await updateDoc(doc(db, 'debts', selectedDebt.id), {
      amount: newTotalAmount,
      remainingAmount: finalRemaining,
      status: newStatus,
      lastPaymentDate: Timestamp.now()
    });

    await addDoc(collection(db, 'debt_transactions'), {
      debtId: selectedDebt.id,
      amount: amountInput,
      type: actionType,
      timestamp: Timestamp.now()
    });

    setPaymentModalOpen(false);
    setSelectedDebt(null);
    setPaymentAmount('');
  };

  const handleCreateDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newAmount) return;

    await addDoc(collection(db, 'debts'), {
      customerName: newName,
      phone: newPhone,
      amount: parseFloat(newAmount),
      remainingAmount: parseFloat(newAmount),
      status: 'active',
      timestamp: Timestamp.now()
    });

    const existingCus = customers.find(c => c.name === newName);
    if (!existingCus) {
       await addDoc(collection(db, 'customers'), {
          name: newName,
          phone: newPhone,
          address: '',
          createdAt: Timestamp.now(),
          lastPurchase: Timestamp.now()
       });
    } else if (newPhone && !existingCus.phone) {
       await updateDoc(doc(db, 'customers', existingCus.id), { phone: newPhone });
    }

    setNewDebtModalOpen(false);
    setNewName('');
    setNewPhone('');
    setNewAmount('');
  };

  const handleViewHistory = async (debt: Debt) => {
    setSelectedDebt(debt);
    setHistoryModalOpen(true);
    setDebtHistory([]);
    
    const q = query(
      collection(db, 'debt_transactions'), 
      orderBy('timestamp', 'desc')
    );
    // Since we don't have a compound index by default for debtId + timestamp in descending order, 
    // it's easier to fetch all descending and filter by debtId, or fetch by debtId and sort on client.
    // Let's fetch by debtId, we don't need orderBy if we sort client-side, but let's try.
    // Actually, on firestore, without index, debt_transactions with where and orderBy requires composite index.
    // So we just fetch where('debtId', '==', debt.id) and sort locally:
  };

  useEffect(() => {
     if (!selectedDebt || !historyModalOpen) return;
     const unsubHistory = onSnapshot(collection(db, 'debt_transactions'), (snap) => {
        const hist = snap.docs
           .map(d => ({ id: d.id, ...d.data() }))
           .filter((h: any) => h.debtId === selectedDebt.id)
           .sort((a: any, b: any) => b.timestamp - a.timestamp);
        setDebtHistory(hist);
     });
     return () => unsubHistory();
  }, [selectedDebt, historyModalOpen]);

  const formatDate = (ts: any) => {
    if (!ts) return 'هیچ';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-GB');
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-red-50 to-red-100 p-6 rounded-[24px] border border-red-200 shadow-sm flex items-center justify-between relative overflow-hidden">
          <div className="absolute -right-6 -top-6 text-red-500/10">
             <FileClock size={120} />
          </div>
          <div className="relative z-10">
            <p className="text-red-600 text-sm font-bold mb-2">کۆی گشتی قەرزەکان (نەدراوە)</p>
            <h3 className="text-2xl font-black font-mono text-red-700 tracking-tight">{formatCurrency(totalRemaining)}</h3>
          </div>
          <div className="w-14 h-14 bg-white/60 backdrop-blur-sm rounded-2xl flex items-center justify-center text-red-600 shadow-sm relative z-10">
            <FileClock size={28} />
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="flex-1 bg-white rounded-[24px] border border-slate-200 shadow-sm flex flex-col overflow-hidden">
        
        {/* Table Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-pink-50 text-pink-600 rounded-xl flex items-center justify-center">
              <FileText size={20} />
            </div>
            <h2 className="text-xl font-extrabold text-slate-800">دەفتەری قەرز</h2>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64 sm:flex-none">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                value={search}
                onChange={e => setSearch(e.target.value)}
                type="text" 
                placeholder="گەڕان بۆ ناوی قەرزار..." 
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pr-10 pl-4 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all font-medium text-slate-800 shadow-sm"
              />
            </div>
            <button onClick={() => window.print()} className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors whitespace-nowrap flex items-center gap-2 shadow-sm print:hidden">
              <Printer size={16} /> چاپکردن
            </button>
            <button onClick={() => setNewDebtModalOpen(true)} className="px-4 py-2.5 bg-pink-600 text-white rounded-xl text-sm font-bold hover:bg-pink-700 transition-all transform active:scale-95 whitespace-nowrap flex items-center gap-2 shadow-md shadow-pink-500/20 print:hidden">
              <UserPlus size={16} /> قەرزارڕێک زیاد بکە
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="w-full text-right border-collapse min-w-[1000px]">
            <thead className="bg-slate-50/80 backdrop-blur-sm text-slate-500 text-[11px] uppercase tracking-wider sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 font-bold border-b border-slate-200">ناوی کڕیار / دوکان</th>
                <th className="px-6 py-4 font-bold border-b border-slate-200">مۆبایل</th>
                <th className="px-6 py-4 font-bold border-b border-slate-200">بەرواری قەرز</th>
                <th className="px-6 py-4 font-bold border-b border-slate-200">کۆی قەرز</th>
                <th className="px-6 py-4 font-bold border-b border-slate-200 text-red-600">ماوە بۆ دانەوە</th>
                <th className="px-6 py-4 font-bold border-b border-slate-200">دواین دانەوە</th>
                <th className="px-6 py-4 font-bold border-b border-slate-200 print:hidden text-center">کردارەکان</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-100">
              {filtered.map((debt) => (
                <tr key={debt.id} className={`hover:bg-slate-50/50 transition-colors ${debt.status === 'paid' ? 'bg-slate-50/50 opacity-60' : ''}`}>
                  <td className="px-6 py-4 font-bold text-slate-800">{debt.customerName}</td>
                  <td className="px-6 py-4">
                     {debt.phone ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 font-mono text-xs" dir="ltr">
                           {debt.phone}
                        </span>
                     ) : (
                        <span className="text-slate-400 text-xs">-</span>
                     )}
                  </td>
                  <td className="px-6 py-4 text-slate-500 text-xs font-medium whitespace-nowrap">{formatDate(debt.timestamp)}</td>
                  <td className="px-6 py-4 text-slate-700 font-bold font-mono whitespace-nowrap">{formatCurrency(debt.amount)}</td>
                  <td className="px-6 py-4">
                     {debt.status === 'paid' ? (
                        <span className="inline-flex px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700 font-bold text-xs">قەرزی نەماوە</span>
                     ) : (
                        <span className="inline-flex px-3 py-1 rounded-lg bg-red-100 text-red-700 font-bold font-mono whitespace-nowrap">
                           {formatCurrency(debt.remainingAmount)}
                        </span>
                     )}
                  </td>
                  <td className="px-6 py-4 text-slate-500 text-xs font-medium whitespace-nowrap">{formatDate(debt.lastPaymentDate)}</td>
                  <td className="px-6 py-4 print:hidden">
                     <div className="flex items-center justify-center gap-2 flex-wrap min-w-[280px]">
                        {debt.status !== 'paid' && (
                          <button 
                            onClick={() => {
                               setActionType('pay');
                               setSelectedDebt(debt);
                               setPaymentAmount(debt.remainingAmount.toString());
                               setPaymentModalOpen(true);
                            }}
                            className="text-emerald-700 text-xs font-bold px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-200 flex items-center gap-1.5 shadow-sm">
                            <DollarSign size={14} /> پارە وەرگرتن
                          </button>
                        )}
                        <button 
                           onClick={() => {
                              setActionType('add');
                              setSelectedDebt(debt);
                              setPaymentAmount('');
                              setPaymentModalOpen(true);
                           }}
                           className="text-red-700 text-xs font-bold px-2.5 py-1.5 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-200 flex items-center gap-1.5 shadow-sm">
                           <PlusCircle size={14} /> قەرزی نوێ
                        </button>
                        <button 
                           onClick={() => handleViewHistory(debt)}
                           className="text-indigo-700 text-xs font-bold px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-200 flex items-center gap-1.5 shadow-sm">
                           <FileClock size={14} /> مێژوو
                        </button>
                        <button 
                           onClick={() => {
                              setSelectedDebt(debt);
                              setEditName(debt.customerName || '');
                              setEditPhone(debt.phone || '');
                              setEditDebtModalOpen(true);
                           }}
                           className="text-orange-700 text-xs font-bold px-2.5 py-1.5 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors border border-orange-200 shadow-sm" title="دەستکاری ناوی قەرزار">
                           <Edit size={14} />
                        </button>
                        {debt.phone && (
                           <button
                              onClick={() => {
                                 const msg = encodeURIComponent(`سڵاو بەڕێز ${debt.customerName}،\nقەرزی ماوەتان لای (پینک ئێللێ) بریتییە لە: ${formatCurrency(debt.remainingAmount)}.\nتکایە لە کاتی گونجاودا سەردانمان بکەنەوە.`);
                                 window.open(`https://wa.me/${debt.phone.replace(/[^0-9]/g, '')}?text=${msg}`, '_blank');
                              }}
                              className="text-emerald-600 text-xs font-bold px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-200 shadow-sm" title="ناردنی نامەی واتسئاپ">
                              <MessageCircle size={14} />
                           </button>
                        )}
                     </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                 <tr>
                    <td colSpan={7} className="px-6 py-16 text-center text-slate-500">
                       <div className="flex flex-col items-center justify-center">
                          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                             <FileText size={40} className="text-slate-300" />
                          </div>
                          <p className="text-base font-bold text-slate-600">هیچ قەرزێک بوونی نییە</p>
                          <p className="text-sm font-medium text-slate-400 mt-1">ئێستا هیچ کڕیارێک قەرزدار نییە</p>
                       </div>
                    </td>
                 </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Modal */}
      {paymentModalOpen && selectedDebt && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleDebtAction} className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
             <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
               <h2 className="text-lg font-bold text-slate-800">
                  {actionType === 'pay' ? 'وەرگرتنی پارەی قەرز' : 'زیادکردنی قەرز'}
               </h2>
             </div>
             <div className="p-6 space-y-4">
                <div>
                   <p className="text-sm font-bold text-slate-600 mb-1">کڕیار: {selectedDebt.customerName}</p>
                   <p className="text-sm font-bold text-red-600">ماوە: {formatCurrency(selectedDebt.remainingAmount)}</p>
                </div>
                <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1">
                      {actionType === 'pay' ? 'بڕی وەرگیراو' : 'بڕی زیادکراو'}
                   </label>
                   <input required type="number" min="0" max={actionType === 'pay' ? selectedDebt.remainingAmount : undefined} value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-pink-500 font-mono" />
                </div>
             </div>
             <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
               <button type="button" onClick={() => setPaymentModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors">
                 پاشگەزبوونەوە
               </button>
               <button type="submit" className={`px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors ${actionType === 'pay' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
                 {actionType === 'pay' ? 'وەرگرتن' : 'زیادکردن'}
               </button>
             </div>
          </form>
        </div>
      )}

      {/* New Debt Modal */}
      {newDebtModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateDebt} className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
             <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
               <h2 className="text-lg font-bold text-slate-800">زیادکردنی قەرزی نوێ</h2>
             </div>
             <div className="p-6 space-y-4">
                <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1">ناوی کڕیار</label>
                   <input required type="text" list="debt-customers-list" value={newName} onChange={e => {
                      const val = e.target.value;
                      setNewName(val);
                      const found = customers.find(c => c.name === val);
                      if (found && !newPhone) {
                         setNewPhone(found.phone || '');
                      }
                   }} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-pink-500" />
                   <datalist id="debt-customers-list">
                      {customers.map(c => <option key={c.id} value={c.name} />)}
                   </datalist>
                </div>
                <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1">ژمارە مۆبایل</label>
                   <input type="text" value={newPhone} onChange={e => setNewPhone(e.target.value)} dir="ltr" className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-pink-500 font-mono" />
                </div>
                <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1">بڕی قەرز (دینار)</label>
                   <input required type="number" min="0" value={newAmount} onChange={e => setNewAmount(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-pink-500 font-mono" />
                </div>
             </div>
             <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
               <button type="button" onClick={() => setNewDebtModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors">
                 پاشگەزبوونەوە
               </button>
               <button type="submit" className="px-4 py-2 bg-pink-600 text-white hover:bg-pink-700 rounded-lg text-sm font-medium transition-colors">
                 پاشەکەوتکردن
               </button>
             </div>
          </form>
        </div>
      )}
      {/* History Modal */}
      {historyModalOpen && selectedDebt && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
             <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
               <h2 className="text-lg font-bold text-slate-800">
                  مێژووی مامەڵەکانی ({selectedDebt.customerName})
               </h2>
               <button onClick={() => setHistoryModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  ×
               </button>
             </div>
             <div className="p-0 overflow-auto flex-1 custom-scrollbar">
                {debtHistory.length > 0 ? (
                   <table className="w-full text-right">
                      <thead className="bg-slate-50 sticky top-0 border-b border-slate-100">
                         <tr>
                            <th className="px-4 py-2 text-xs font-semibold text-slate-500">بەروار</th>
                            <th className="px-4 py-2 text-xs font-semibold text-slate-500">بڕی پارە</th>
                            <th className="px-4 py-2 text-xs font-semibold text-slate-500">جۆر</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                         {debtHistory.map(h => (
                            <tr key={h.id} className="hover:bg-slate-50">
                               <td className="px-4 py-3 text-sm text-slate-600 font-mono">{formatDate(h.timestamp)}</td>
                               <td className="px-4 py-3 text-sm text-slate-900 font-bold font-mono">{formatCurrency(h.amount)}</td>
                               <td className="px-4 py-3 text-sm font-bold">
                                  {h.type === 'pay' ? (
                                     <span className="text-green-600 bg-green-50 px-2 py-1 rounded">دانەوە (کەمکردن)</span>
                                  ) : (
                                     <span className="text-red-600 bg-red-50 px-2 py-1 rounded">زیادکردن (قەرزی نوێ)</span>
                                  )}
                               </td>
                            </tr>
                         ))}
                      </tbody>
                   </table>
                ) : (
                   <div className="p-8 text-center text-slate-500 text-sm">هیچ مێژوویەک نەدۆزرایەوە بۆ ئەم قەرزە.</div>
                )}
             </div>
             <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
               <button type="button" onClick={() => setHistoryModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors">
                 داخستن
               </button>
             </div>
          </div>
        </div>
      )}

      {/* Edit Debt Modal */}
      {editDebtModalOpen && selectedDebt && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleEditDebt} className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
             <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
               <h2 className="text-lg font-bold text-slate-800">دەستکاری قەرز</h2>
             </div>
             <div className="p-6 space-y-4">
                <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1">ناوی کڕیار</label>
                   <input required type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-pink-500" />
                </div>
                <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1">ژمارە مۆبایل</label>
                   <input type="text" value={editPhone} onChange={e => setEditPhone(e.target.value)} dir="ltr" className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-pink-500 font-mono" />
                </div>
             </div>
             <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
               <button type="button" onClick={() => setEditDebtModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors">
                 پاشگەزبوونەوە
               </button>
               <button type="submit" className="px-4 py-2 bg-orange-500 text-white hover:bg-orange-600 rounded-lg text-sm font-medium transition-colors">
                 گۆڕین
               </button>
             </div>
          </form>
        </div>
      )}
    </div>
  );
}
