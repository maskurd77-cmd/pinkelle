import React, { useState, useEffect, useRef } from 'react';
import { Search, ReceiptText, Printer, Eye, X } from 'lucide-react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { formatCurrency } from '../data';

export default function Receipts() {
  const [receipts, setReceipts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'receipts'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setReceipts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const filtered = receipts.filter(r => {
    if (!r) return false;
    const matchSearch = (r.customerName || '').includes(search) || r.id.includes(search);
    return matchSearch;
  });

  const formatDate = (ts: any) => {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-GB') + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Normal View (Hidden when printing) */}
      <div className="print:hidden flex-1 bg-white rounded-[24px] border border-slate-200 shadow-sm flex flex-col overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
              <ReceiptText size={20} />
            </div>
            <h2 className="text-xl font-extrabold text-slate-800">
              وەسڵەکان و پسوولەکان
            </h2>
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-72 sm:flex-none">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                value={search}
                onChange={e => setSearch(e.target.value)}
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
                <th className="px-6 py-4 font-bold border-b border-slate-200">ژمارەی وەسڵ</th>
                <th className="px-6 py-4 font-bold border-b border-slate-200">کڕیار</th>
                <th className="px-6 py-4 font-bold border-b border-slate-200">بەروار و کات</th>
                <th className="px-6 py-4 font-bold border-b border-slate-200">بڕی کالاکان</th>
                <th className="px-6 py-4 font-bold border-b border-slate-200 text-slate-800">کۆی گشتی پــارە</th>
                <th className="px-6 py-4 font-bold border-b border-slate-200">جۆری پێدان</th>
                <th className="px-6 py-4 font-bold border-b border-slate-200 text-center">کردارەکان</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-100">
              {filtered.map((rec) => (
                <tr key={rec.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                     <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 font-mono text-xs font-bold shadow-sm">
                        #{rec.id.slice(-6)}
                     </span>
                  </td>
                  <td className="px-6 py-4 font-extrabold text-slate-800">{rec.customerName}</td>
                  <td className="px-6 py-4 text-slate-500 font-medium text-xs whitespace-nowrap" dir="ltr">{formatDate(rec.timestamp)}</td>
                  <td className="px-6 py-4 text-slate-600 font-bold font-mono">{rec.totalItems} دانە</td>
                  <td className="px-6 py-4 font-extrabold text-slate-900 font-mono whitespace-nowrap">{formatCurrency(rec.totalAmount)}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-3 py-1 rounded-lg text-xs font-bold shadow-sm ${rec.paymentType === 'نەقد' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {rec.paymentType}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center gap-2">
                       <button onClick={() => setSelectedReceipt(rec)} className="text-indigo-600 bg-indigo-50 hover:bg-indigo-100 hover:text-indigo-700 font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm text-xs">
                          <Eye size={14} /> بینین و چاپ
                       </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                   <td colSpan={7} className="px-6 py-16 text-center text-slate-500 text-sm">
                      <div className="flex flex-col items-center justify-center">
                         <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                            <ReceiptText size={40} className="text-slate-300" />
                         </div>
                         <p className="text-base font-bold text-slate-600">هیچ وەسڵێک نەدۆزرایەوە</p>
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
        <div className="print:hidden fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
           <div className="bg-white rounded-[24px] shadow-2xl max-w-4xl w-full max-h-full overflow-hidden flex flex-col">
              <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-white">
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                       <Printer size={20} />
                    </div>
                    <h2 className="font-extrabold text-slate-800 text-lg">پێشبینینی چاپ (Print Preview)</h2>
                 </div>
                 <div className="flex gap-2">
                    <button onClick={handlePrint} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl flex items-center gap-2 hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-500/20 font-bold text-sm transition-all">
                       <Printer size={16} /> چاپکردن
                    </button>
                    <button onClick={() => setSelectedReceipt(null)} className="w-10 h-10 flex items-center justify-center text-slate-400 bg-slate-100 hover:bg-slate-200 hover:text-slate-600 rounded-xl transition-all">
                       <X size={20} />
                    </button>
                 </div>
              </div>
              <div className="flex-1 overflow-auto bg-slate-100/50 p-4 sm:p-8 flex items-start justify-center custom-scrollbar">
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

function ReceiptPrintLayout({ receipt }: { receipt: any }) {
  const ts = receipt.timestamp?.toDate ? receipt.timestamp.toDate() : new Date();
  
  return (
    <div className="w-[210mm] min-h-[297mm] bg-white text-black p-[10mm] mx-auto box-border flex flex-col" dir="rtl" style={{ fontFamily: 'Arial, sans-serif' }}>
      
      {/* Header border frame */}
      <div className="border-4 border-black rounded-xl p-4 flex flex-col gap-2 relative">
         <div className="flex justify-between items-start">
            {/* Logo Left */}
            <div className="w-40 flex flex-col items-center">
              <img src="https://skilled-indigo-cux52hz9.edgeone.app/Pink%20Elle%20logo%20new-1_page-0001.jpg" alt="Logo" className="w-32 h-32 object-contain mix-blend-multiply" />
            </div>
            
            {/* Center Info */}
            <div className="flex-1 text-center pt-2">
              <h1 className="text-5xl font-extrabold text-pink-600 mb-4 tracking-wider" style={{ fontFamily: 'Impact, sans-serif' }}>گروپی PINK ELLE</h1>
              <p className="font-bold text-lg mb-1">تاکە بریکاری <span className="text-pink-600 uppercase font-extrabold">PINK ELLE</span></p>
              <p className="font-bold text-lg mb-2">بۆ دابین کردنی کەل و پەلی پاکەرەوە</p>
              <p className="font-bold text-xl">ناونیشان : سۆران</p>
            </div>
            
            {/* QR Right (Mock or empty for now) */}
            <div className="w-40 flex justify-end">
               {/* Using placeholder for QR */}
               <div className="w-32 h-32 border-4 border-black p-1 flex relative items-center justify-center">
                  <div className="absolute inset-0 flex items-center justify-center opacity-20">
                     <svg viewBox="0 0 100 100" className="w-full h-full fill-current"><path d="M0 0h30v30H0zM10 10h10v10H10zM70 0h30v30H70zM80 10h10v10H80zM0 70h30v30H0zM10 80h10v10H10zM40 0h20v20H40zM30 40h40v40H30zM40 50h20v20H40z" /></svg>
                  </div>
               </div>
            </div>
         </div>
         
         {/* Social Links Banner */}
         <div className="bg-pink-100 font-bold border-2 border-black rounded-lg py-2 px-4 flex justify-between items-center text-sm">
            <div className="flex items-center gap-1">
              <span className="bg-gradient-to-tr from-yellow-400 to-pink-600 text-white rounded p-1">@</span> 
              <span>pink__ellii</span>
            </div>
            <div className="flex items-center gap-1 text-blue-600">
              <span className="bg-blue-600 text-white rounded p-1">f</span> 
              <span>Pink Elle</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-yellow-500">👻</span> 
              <span>pink-elle</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="bg-black text-white rounded p-1 text-xs px-1.5">ل</span> 
              <span>pink__elle2</span>
            </div>
         </div>
         
         {/* Footer Phone Banner */}
         <div className="text-center font-bold text-sm bg-pink-100 border-2 border-black rounded-lg py-1">
            بریکاری کۆمپانیا (٠٧٥١٢٠١٨٣٧٢ - ٠٧٧٣٤٣٦٧٢٧٨) - وکیلی سۆران (٠٧٥٠٤٢٥١٣٣٨ - ٠٧٥١٢٠١٨٣٧٠)
         </div>
      </div>

      {/* Customer Info Section */}
      <div className="mt-6 flex flex-col gap-4 font-bold text-lg px-2">
         <div className="flex w-full items-end gap-2">
            <span className="w-16">بەڕێز :</span>
            <span className="border-b-2 border-dotted border-black flex-1 pb-1 inline-block text-center">{receipt.customerName}</span>
            <span className="w-24 border-b-2 border-dotted border-black pb-1">ناونیشان:</span>
            <span className="border-b-2 border-dotted border-black flex-1 pb-1 text-center">{receipt.address || ''}</span>
         </div>
         <div className="flex w-full items-end gap-2">
            <span className="w-16">ڕێکەوت:</span>
            <div className="border-b-2 border-dotted border-black px-4 pb-1 flex-1 text-center font-mono">
               {ts.getFullYear()} / {(ts.getMonth()+1).toString().padStart(2, '0')} / {ts.getDate().toString().padStart(2, '0')}
            </div>
            <span className="w-16 text-center border-b-2 border-dotted border-black pb-1">مۆبایل:</span>
            <span className="border-b-2 border-dotted border-black w-64 pb-1 text-center font-mono" dir="ltr">{receipt.phone || ''}</span>
         </div>
      </div>

      {/* Items Table */}
      <div className="mt-8 flex-1 border-4 border-black rounded-md overflow-hidden relative">
         {/* Watermark in background */}
         <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] text-pink-600 font-extrabold text-[150px] pointer-events-none select-none tracking-widest leading-none z-0" style={{ fontFamily: 'Impact' }}>
            PINK<br/>ELLE
         </div>
         
         <table className="w-full border-collapse relative z-10 text-center font-bold text-sm h-full">
            <thead>
               <tr className="bg-pink-100 border-b-4 border-black">
                  <th className="border-l-4 border-black py-4 w-40">بڕی پارە<br/>دینار / دۆلار</th>
                  <th className="border-l-4 border-black py-4 w-2/4">نـاوەڕۆک/التفــاصیل<br/><span className="text-xs">Contents</span></th>
                  <th className="border-l-4 border-black py-4 w-24">ژمارە - عدد</th>
                  <th className="py-4 w-40 text-center font-bold">نـرخ<br/>دینار / دۆلار</th>
               </tr>
            </thead>
            <tbody>
               {/* Render real rows */}
               {receipt.items?.map((item: any, i: number) => {
                  const originalTotal = (item.originalUnitPrice || item.unitPrice) * item.quantity;
                  const itemCurrency = item.currency || 'IQD';
                  return (
                  <tr key={i} className="border-b-2 border-black">
                     <td className="border-l-4 border-black py-3 font-mono text-sm">{formatCurrency(originalTotal, itemCurrency)}</td>
                     <td className="border-l-4 border-black py-3 text-right pr-4">{item.name}</td>
                     <td className="border-l-4 border-black py-3 font-mono text-sm">{item.quantity}</td>
                     <td className="py-3 font-mono text-sm">{formatCurrency(item.originalUnitPrice || item.unitPrice, itemCurrency)}</td>
                  </tr>
                  );
               })}
               {/* Fill empty rows to make it look standard A4 block */}
               {Array.from({ length: Math.max(0, 15 - (receipt.items?.length || 0)) }).map((_, i) => (
                  <tr key={`empty-${i}`} className="border-b-2 border-black text-transparent opacity-0">
                     <td className="border-l-4 border-black py-4">.</td>
                     <td className="border-l-4 border-black py-4">.</td>
                     <td className="border-l-4 border-black py-4">.</td>
                     <td className="py-4">.</td>
                  </tr>
               ))}
            </tbody>
            {/* Total Row */}
            <tfoot className="border-t-4 border-black bg-pink-100 h-16">
               <tr>
                  <td className="border-l-4 border-black font-extrabold text-lg py-4 font-mono">{formatCurrency(receipt.totalAmount || receipt.total || 0, 'IQD')}</td>
                  <td colSpan={3} className="text-right pr-8 font-extrabold text-xl">
                     کۆی گشتی:
                  </td>
               </tr>
            </tfoot>
         </table>
         
         <div className="absolute right-0 top-1/2 translate-x-full translate-y-[-50%] -rotate-90 origin-left text-[10px] font-mono text-gray-500 hidden whitespace-nowrap">
            Ala Printing 0750 470 99 88
         </div>
      </div>

      {/* Footer Signatures */}
      <div className="mt-6 flex justify-between font-bold text-sm px-4">
         <div className="text-center">
            واژوو
         </div>
         <div className="text-center font-mono text-[11px] mt-4">
            هەبوونی هەڵە لەم پسوولەیەدا بۆ هەردوو لا دەگەڕێتەوە
         </div>
         <div className="text-center invisible">
            واژوو
         </div>
      </div>
      
    </div>
  );
}
