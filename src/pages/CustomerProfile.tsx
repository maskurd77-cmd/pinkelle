import React, { useState } from 'react';
import { ArrowLeft, ShoppingCart, FileText, Book, User, ArrowRightLeft, Timer, HandCoins, Phone, MapPin } from 'lucide-react';
import POS from './POS';
import Receipts from './Receipts';
import DebtBook from './DebtBook';
import DebtPayments from './DebtPayments';
import VisitsPage from './Visits';
import { auth } from '../firebase';

export default function CustomerProfile({ customer, onBack }: { customer: any, onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<'pos' | 'receipts' | 'debt' | 'debt_payments' | 'visits'>('pos');

  const tabs = [
    { id: 'pos', label: 'فرۆشتن', icon: <ShoppingCart size={18} /> },
    { id: 'receipts', label: 'وەسڵەکان', icon: <FileText size={18} /> },
    { id: 'debt', label: 'دەفتەری قەرز', icon: <Book size={18} /> },
    { id: 'debt_payments', label: 'وەرگرتنی پێشینە', icon: <HandCoins size={18} /> },
    { id: 'visits', label: 'سەردانەکان', icon: <Timer size={18} /> }
  ] as const;

  return (
    <div className="flex flex-col h-full bg-slate-50 relative rounded-[24px] overflow-hidden" dir="rtl">
      <div className="print:hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4 sm:px-6 py-4 sm:py-8 shadow-md relative z-10 overflow-hidden shrink-0">
        <div className="absolute right-0 top-0 w-64 h-64 bg-pink-500/10 blur-[80px] rounded-full pointer-events-none"></div>
        <div className="absolute left-10 bottom-0 w-48 h-48 bg-sky-500/10 blur-[60px] rounded-full pointer-events-none"></div>
        
        <div className="flex flex-row items-center gap-3 sm:gap-6 relative z-10 w-full max-w-4xl mx-auto">
             <button onClick={onBack} className="p-2 sm:p-2.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors backdrop-blur-sm border border-white/10 shrink-0 self-start sm:self-auto mt-1 sm:mt-0">
                <ArrowLeft size={18} className="sm:w-5 sm:h-5" />
             </button>
             
             <div className="w-12 h-12 sm:w-24 sm:h-24 rounded-full bg-gradient-to-tr from-pink-500 to-pink-600 flex items-center justify-center text-white font-black text-xl sm:text-4xl shadow-xl shadow-pink-500/20 border-2 sm:border-4 border-white/10 shrink-0">
                {customer.name?.charAt(0) || <User className="w-6 h-6 sm:w-10 sm:h-10" />}
             </div>
             
             <div className="text-right flex-1 min-w-0">
                <h2 className="text-lg sm:text-3xl font-black text-white tracking-tight sm:mb-2 truncate">{customer.name}</h2>
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 mt-1.5 sm:mt-2 opacity-90">
                   <span className="flex items-center shrink-0 gap-1 sm:gap-1.5 text-[11px] sm:text-sm text-slate-300 font-mono bg-white/5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg border border-white/10">
                      <Phone size={12} className="text-pink-400 sm:w-3.5 sm:h-3.5" />
                      <span dir="ltr">{customer.phone || 'بێ ژمارە'}</span>
                   </span>
                   {customer.address && (
                       <span className="flex items-center shrink-0 gap-1 sm:gap-1.5 text-[11px] sm:text-sm text-slate-300 bg-white/5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg border border-white/10 max-w-[150px] sm:max-w-xs truncate">
                          <MapPin size={12} className="text-sky-400 sm:w-3.5 sm:h-3.5" />
                          <span className="truncate">{customer.address}</span>
                       </span>
                   )}
                </div>
             </div>
        </div>
      </div>

      <div className="print:hidden bg-white border-b border-slate-200 shadow-sm relative z-20">
        <div className="flex overflow-x-auto scrollbar-hide px-2 sm:px-6 max-w-5xl mx-auto">
           {tabs.map(tab => (
              <button
                 key={tab.id}
                 onClick={() => setActiveTab(tab.id as any)}
                 className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2.5 px-3 sm:px-6 py-2 sm:py-4 text-[11px] sm:text-sm font-bold transition-all whitespace-nowrap border-b-[3px] min-w-[75px] sm:min-w-0 ${
                    activeTab === tab.id 
                      ? 'border-pink-600 text-pink-700 bg-pink-50/50' 
                      : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                 }`}
              >
                 <span className={`${activeTab === tab.id ? 'text-pink-600' : 'text-slate-400'} transition-colors`}>
                    {tab.icon}
                 </span>
                 {tab.label}
              </button>
           ))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden bg-slate-50 relative">
         <div className="h-full w-full relative">
            {activeTab === 'pos' && <POS preselectedCustomer={customer} hideLayout={true} />}
            {activeTab === 'receipts' && <Receipts preselectedCustomer={customer} hideLayout={true} />}
            {activeTab === 'debt' && <DebtBook preselectedCustomer={customer} hideLayout={true} />}
            {activeTab === 'debt_payments' && <DebtPayments preselectedCustomer={customer} hideLayout={true} />}
            {activeTab === 'visits' && <VisitsPage preselectedCustomer={customer} hideLayout={true} />}
         </div>
      </div>
    </div>
  );
}
