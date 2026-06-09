import React, { useState } from 'react';
import { ArrowLeft, ShoppingCart, FileText, Book, User, Timer, HandCoins, Phone, MapPin } from 'lucide-react';
import POS from './POS';
import Receipts from './Receipts';
import DebtBook from './DebtBook';
import DebtPayments from './DebtPayments';
import VisitsPage from './Visits';

interface CustomerProfileProps {
  customer: {
    id: string;
    name: string;
    phone?: string;
    address?: string;
    locationUrl?: string;
  };
  onBack: () => void;
}

export default function CustomerProfile({ customer, onBack }: CustomerProfileProps) {
  const [activeTab, setActiveTab] = useState<'pos' | 'receipts' | 'debt' | 'debt_payments' | 'visits'>('pos');

  const tabs = [
    { id: 'pos', label: 'فرۆشتن (POS)', icon: (size: number) => <ShoppingCart size={size} /> },
    { id: 'receipts', label: 'وەسڵەکان', icon: (size: number) => <FileText size={size} /> },
    { id: 'debt', label: 'دەفتەری قەرز', icon: (size: number) => <Book size={size} /> },
    { id: 'debt_payments', label: 'وەرگرتنی پێشینە', icon: (size: number) => <HandCoins size={size} /> },
    { id: 'visits', label: 'سەردانەکان', icon: (size: number) => <Timer size={size} /> },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50 relative rounded-[24px] overflow-hidden text-slate-800" dir="rtl">
      {/* Dynamic Ambient Background decoration */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-pink-500/5 blur-[120px] rounded-full pointer-events-none z-0"></div>
      <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-sky-500/5 blur-[100px] rounded-full pointer-events-none z-0"></div>

      {/* Header Profile Section */}
      <div className={`print:hidden bg-white border-b border-slate-150/90 shadow-xs sticky top-0 z-30 shrink-0 transition-all duration-200 ${
        activeTab === 'pos' 
          ? 'px-3 py-2 sm:px-5 sm:py-2.5' 
          : 'px-4 py-3 sm:px-6 sm:py-4.5'
      }`}>
        <div className="w-full max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 w-full">
            
            {/* Back Button, User Avatar, and Name Details */}
            <div className="flex items-center gap-3 w-full md:w-auto">
              <button 
                onClick={onBack} 
                className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900 transition-all hover:scale-105 active:scale-95 duration-200 shadow-xs text-slate-600 shrink-0"
                title="گەڕانەوە بۆ کڕیاران"
              >
                <ArrowLeft size={16} className="transform rotate-180 md:rotate-0" />
              </button>
              
              <div className={`rounded-xl bg-gradient-to-tr from-pink-500 to-rose-600 border border-transparent flex items-center justify-center text-white font-black shrink-0 transition-all duration-300 ${
                activeTab === 'pos'
                  ? 'w-9 h-9 sm:w-12 sm:h-12 text-sm sm:text-lg'
                  : 'w-11 h-11 sm:w-14 sm:h-14 text-base sm:text-xl'
              }`}>
                {customer.name?.charAt(0) || <User size={activeTab === 'pos' ? 16 : 20} />}
              </div>
              
              <div className="flex-1 min-w-0 pr-0.5">
                <h2 className={`font-black text-slate-900 hover:text-pink-600 transition-colors tracking-tight leading-tight mb-0.5 truncate ${
                  activeTab === 'pos'
                    ? 'text-sm sm:text-lg'
                    : 'text-base sm:text-xl'
                }`}>
                  {customer.name}
                </h2>
                {activeTab !== 'pos' && (
                  <p className="text-[10px] sm:text-xs font-bold text-slate-400 mt-0.5 truncate">
                    بەڕێوەبردنی فرۆشتن، لیست، وەسڵ و دەفتەری قەرزی کڕیار بە شێوازێکی یەکگرتوو
                  </p>
                )}
              </div>
            </div>

            {/* Badges and Contacts */}
            <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto md:mr-auto pl-1">
              {customer.phone && (
                <a 
                  href={`tel:${customer.phone}`}
                  className={`flex items-center gap-1 text-slate-600 bg-slate-55 border border-slate-200 hover:border-pink-300 hover:text-pink-600 rounded-lg sm:rounded-xl transition-all shadow-xs font-mono font-black ${
                    activeTab === 'pos'
                      ? 'text-[10px] sm:text-xs px-2 py-1'
                      : 'text-[11px] sm:text-xs px-2.5 py-1.5'
                  }`}
                >
                  <Phone size={activeTab === 'pos' ? 10 : 12} className="text-pink-600" />
                  <span dir="ltr">{customer.phone}</span>
                </a>
              )}
              {customer.address && (
                <div className={`flex items-center gap-1 text-slate-600 bg-slate-55 border border-slate-200 rounded-lg sm:rounded-xl shadow-xs max-w-full font-bold ${
                  activeTab === 'pos'
                    ? 'text-[10px] sm:text-xs px-2 py-1'
                    : 'text-[11px] sm:text-xs px-2.5 py-1.5'
                }`}>
                  <MapPin size={activeTab === 'pos' ? 10 : 12} className="text-sky-505 shrink-0" />
                  <span className="truncate max-w-[120px] sm:max-w-xs">{customer.address}</span>
                  {customer.locationUrl && (
                    <a 
                      href={customer.locationUrl} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-[9px] text-sky-600 hover:text-sky-700 bg-sky-100/65 hover:bg-sky-100 border border-sky-100 px-1.5 py-0.5 rounded-md transition-all mr-1 font-black shrink-0"
                    >
                      نەخشە
                    </a>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Tabs Menu Section */}
      <div className={`print:hidden bg-white border-b border-slate-150/85 shadow-sm relative z-20 backdrop-blur-md transition-all duration-200 ${
        activeTab === 'pos' ? 'py-1.5' : 'py-2.5'
      }`}>
        <div className="w-full max-w-6xl mx-auto px-3 sm:px-4">
          <div className={`flex items-center gap-1.5 overflow-x-auto whitespace-nowrap scrollbar-none bg-slate-100/70 rounded-xl sm:rounded-2xl border border-slate-200 w-full md:max-w-fit transition-all duration-200 ${
            activeTab === 'pos' ? 'p-1' : 'p-1.5'
          }`}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center justify-center transition-all duration-200 group shrink-0 font-black ${
                  activeTab === 'pos'
                    ? 'gap-1.5 px-3 py-1.5 rounded-lg text-[11px] sm:text-xs'
                    : 'gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm'
                } ${
                  activeTab === tab.id 
                    ? 'bg-white shadow-sm border border-slate-200/80 text-pink-600 scale-100' 
                    : 'text-slate-500 hover:text-slate-800 hover:bg-white/40'
                }`}
              >
                <span className={`${activeTab === tab.id ? 'text-pink-600' : 'text-slate-400 group-hover:text-pink-500'} transition-all`}>
                  {tab.icon(activeTab === 'pos' ? 14 : 16)}
                </span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Dynamic Core Modules Container */}
      <div className="flex-1 w-full bg-slate-50/45 relative overflow-hidden flex flex-col">
        {activeTab === 'pos' ? (
          <div className="flex-1 w-full h-full relative overflow-hidden">
            <POS preselectedCustomer={customer} hideLayout={true} />
          </div>
        ) : (
          <div className="flex-1 w-full h-full relative overflow-y-auto custom-scrollbar">
            <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
              {activeTab === 'receipts' && <Receipts preselectedCustomer={customer} hideLayout={true} />}
              {activeTab === 'debt' && <DebtBook preselectedCustomer={customer} hideLayout={true} />}
              {activeTab === 'debt_payments' && <DebtPayments preselectedCustomer={customer} hideLayout={true} />}
              {activeTab === 'visits' && <VisitsPage preselectedCustomer={customer} hideLayout={true} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
