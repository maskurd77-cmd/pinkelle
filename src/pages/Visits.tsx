import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { MapPin, Search, Calendar, Clock, Timer, CheckCircle2, Users, Receipt, ArrowLeft, Building2 } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { formatCurrency } from '../data';

interface Visit {
  id: string;
  customerId: string;
  customerName: string;
  mandubName: string;
  status: 'active' | 'completed';
  startTime: any;
  endTime: any;
  durationMinutes?: number;
}

interface Sale {
  id: string;
  mandubName: string;
  totalAmount: number;
  timestamp: any;
}

export default function VisitsPage() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [receipts, setReceipts] = useState<Sale[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMandub, setSelectedMandub] = useState<string | null>(null);

  useEffect(() => {
    const unsubVisits = onSnapshot(query(collection(db, 'visits'), orderBy('startTime', 'desc')), (snapshot) => {
      setVisits(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Visit)));
    });

    const unsubReceipts = onSnapshot(query(collection(db, 'receipts'), orderBy('timestamp', 'desc')), (snapshot) => {
      setReceipts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale)));
    });

    return () => {
       unsubVisits();
       unsubReceipts();
    };
  }, []);

  const mandubStats = useMemo(() => {
    const stats: Record<string, {
      totalVisits: number;
      activeVisits: number;
      totalDurationMinutes: number;
      uniqueCustomers: Set<string>;
      totalSales: number;
      visits: Visit[];
    }> = {};

    visits.forEach(v => {
      const name = v.mandubName || 'نەزانراو';
      if (!stats[name]) {
        stats[name] = { totalVisits: 0, activeVisits: 0, totalDurationMinutes: 0, uniqueCustomers: new Set(), totalSales: 0, visits: [] };
      }
      stats[name].totalVisits++;
      if (v.status === 'active') stats[name].activeVisits++;
      if (v.durationMinutes) stats[name].totalDurationMinutes += v.durationMinutes;
      if (v.customerName) stats[name].uniqueCustomers.add(v.customerName);
      stats[name].visits.push(v);
    });

    receipts.forEach(r => {
      if (r.mandubName && stats[r.mandubName]) {
        stats[r.mandubName].totalSales += (r.totalAmount || 0);
      } else if (r.mandubName) {
        // if they have sales but no visits today
        stats[r.mandubName] = { totalVisits: 0, activeVisits: 0, totalDurationMinutes: 0, uniqueCustomers: new Set(), totalSales: r.totalAmount || 0, visits: [] };
      }
    });

    return Object.entries(stats).map(([name, data]) => ({
      name,
      ...data,
      uniqueCustomers: Array.from(data.uniqueCustomers)
    }));
  }, [visits, receipts]);

  const formatDateTime = (ts: any) => {
    if (!ts) return '-';
    const date = ts instanceof Timestamp ? ts.toDate() : new Date(ts);
    return new Intl.DateTimeFormat('ar-IQ', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
  };

  const formatDuration = (minutes?: number) => {
    if (!minutes) return '٠ خولەک';
    if (minutes < 60) return `${minutes} خولەک`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h} کاتژمێر ${m > 0 ? `و ${m} خولەک` : ''}`;
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative rounded-[24px] lg:border border-slate-200 overflow-hidden" dir="rtl">
      {/* Header */}
      <div className="bg-white px-6 py-5 border-b border-slate-200/60 sticky top-0 z-10 shadow-sm flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 shadow-inner">
            <MapPin size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800">سەردانەکان</h1>
            <p className="text-sm font-medium text-slate-500">راپۆرتی سەردانی مەندوبەکان بۆ لای کڕیاران</p>
          </div>
        </div>
        
        <div className="relative w-full sm:w-auto">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="گەڕان بەدوای کڕیار یان مەندوب..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-72 bg-slate-50 hover:bg-slate-100/80 transition-colors border-none rounded-xl pr-10 pl-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-medium text-sm placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar bg-slate-50">
        {!selectedMandub ? (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {mandubStats.filter(m => m.name.includes(searchTerm)).map(stat => (
                 <div key={stat.name} onClick={() => setSelectedMandub(stat.name)} className="bg-white border flex flex-col border-slate-200 rounded-3xl p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer relative overflow-hidden group">
                    <div className="absolute -right-10 -top-10 w-32 h-32 bg-indigo-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="flex items-center gap-4 mb-6 z-10">
                       <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 to-indigo-600 flex items-center justify-center text-white font-extrabold text-2xl shadow-md">
                          {stat.name.charAt(0)}
                       </div>
                       <div>
                          <h3 className="font-extrabold text-slate-800 text-xl">{stat.name}</h3>
                          <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md font-bold mt-1 inline-block">مەندوب</span>
                       </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-6 z-10 text-center">
                       <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                           <div className="text-slate-400 mb-1 flex justify-center"><Building2 size={16} /></div>
                           <p className="text-xs text-slate-500 font-bold mb-0.5">سەردانەکان</p>
                           <p className="text-lg font-extrabold text-slate-800 font-mono">{stat.totalVisits}</p>
                       </div>
                       <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                           <div className="text-orange-400 mb-1 flex justify-center"><Clock size={16} /></div>
                           <p className="text-xs text-slate-500 font-bold mb-0.5">مانەوە</p>
                           <p className="text-lg font-extrabold text-slate-800 font-mono">{formatDuration(stat.totalDurationMinutes)}</p>
                       </div>
                    </div>

                    <div className="mt-auto pt-4 border-t border-slate-100 z-10">
                       <div className="flex items-center justify-between mb-2">
                           <span className="text-xs text-slate-500 font-bold flex items-center gap-1"><Receipt size={14} className="text-emerald-500" /> کۆی فرۆش</span>
                           <span className="text-emerald-600 font-extrabold text-sm font-mono">{formatCurrency(stat.totalSales)}</span>
                       </div>
                       {stat.activeVisits > 0 && (
                          <div className="mt-2 bg-rose-50 text-rose-600 border border-rose-100 px-3 py-2 rounded-xl text-xs font-bold flex justify-between items-center animate-pulse">
                              <span>سەردانی چالاک:</span>
                              <span className="font-mono">{stat.activeVisits}</span>
                          </div>
                       )}
                    </div>
                 </div>
              ))}
              
              {mandubStats.length === 0 && (
                 <div className="col-span-full bg-white rounded-3xl p-12 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 mt-4 max-w-lg mx-auto">
                   <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-300 mb-4">
                     <Users size={40} />
                   </div>
                   <p className="text-slate-500 font-bold text-lg">هیچ داتایەک نەدۆزرایەوە.</p>
                 </div>
              )}
           </div>
        ) : (
           <div className="space-y-6 max-w-5xl mx-auto">
              <div className="flex items-center gap-4 mb-2">
                  <button onClick={() => setSelectedMandub(null)} className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors shadow-sm">
                      <ArrowLeft size={18} className="rotate-180" />
                  </button>
                  <div>
                      <h2 className="text-xl font-extrabold text-slate-800">سەردانەکانی ({selectedMandub})</h2>
                      <p className="text-sm text-slate-500 font-medium">لیستی وردەکاری سەردانەکان</p>
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 {mandubStats.find(m => m.name === selectedMandub)?.visits.map(visit => (
                    <div key={visit.id} className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-lg transition-shadow relative">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="font-extrabold text-slate-800 text-lg mb-1">{visit.customerName}</h3>
                                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium font-mono" dir="ltr">
                                   <Calendar size={12} className="text-indigo-400" />
                                   {formatDateTime(visit.startTime)}
                                </div>
                            </div>
                            {visit.status === 'active' ? (
                                <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-sm border border-emerald-200/50">
                                   <Timer size={14} className="animate-pulse" />
                                   لەسەرداندایە
                                </span>
                            ) : (
                                <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1">
                                   <CheckCircle2 size={12} />
                                   تەواوبووە
                                </span>
                            )}
                        </div>

                        <div className="flex items-center justify-between bg-slate-50 px-4 py-3 rounded-xl border border-slate-100">
                             <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                 <Clock size={16} className="text-slate-400" /> مانەوە
                             </div>
                             <div className="text-sm font-extrabold text-slate-800 font-mono">
                                 {visit.status === 'active' ? (
                                     <span className="text-emerald-600 animate-pulse text-xs">چالاک...</span>
                                 ) : formatDuration(visit.durationMinutes)}
                             </div>
                        </div>
                    </div>
                 ))}
                 
                 {mandubStats.find(m => m.name === selectedMandub)?.visits.length === 0 && (
                    <div className="col-span-full text-center p-8 bg-white rounded-3xl border border-slate-200 shadow-sm text-slate-500 font-bold">
                       هیچ سەردانێکی تۆمارنەکردووە.
                    </div>
                 )}
              </div>
           </div>
        )}
      </div>
    </div>
  );
}
