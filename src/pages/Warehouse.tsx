import React, { useMemo, useState, useEffect } from 'react';
import { PackagePlus, TrendingUp, Wallet, AlertCircle, Filter, X } from 'lucide-react';
import { formatCurrency } from '../data';
import { collection, onSnapshot, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

export default function Warehouse() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedCompany, setSelectedCompany] = useState('all');

  const [products, setProducts] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  // Add stock dialog
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [addQty, setAddQty] = useState('');

  const [exchangeRate, setExchangeRate] = useState<number>(1500);

  useEffect(() => {
    const unsubProds = onSnapshot(collection(db, 'products'), (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubComps = onSnapshot(collection(db, 'companies'), (snap) => {
      setCompanies(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubCats = onSnapshot(collection(db, 'categories'), (snap) => {
      setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubSettings = onSnapshot(doc(db, 'system', 'settings'), (docSnap) => {
      if (docSnap.exists() && docSnap.data().exchangeRate) {
        setExchangeRate(docSnap.data().exchangeRate);
      }
    });
    return () => {
      unsubProds();
      unsubComps();
      unsubCats();
      unsubSettings();
    };
  }, []);

  const availableCompanies = companies.map(c => c.name);
  const availableCategories = categories.map(c => c.name);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchCat = selectedCategory === 'all' || p.category === selectedCategory;
      const matchComp = selectedCompany === 'all' || p.company === selectedCompany;
      return matchCat && matchComp;
    });
  }, [selectedCategory, selectedCompany, products]);

  const metrics = useMemo(() => {
    let totalCost = 0;
    let totalPrice = 0;
    filteredProducts.forEach(p => {
      const costInIQD = p.currency === 'USD' ? (p.unitCost || 0) * exchangeRate : (p.unitCost || 0);
      const priceInIQD = p.currency === 'USD' ? (p.unitPrice || 0) * exchangeRate : (p.unitPrice || 0);
      totalCost += costInIQD * (p.stock || 0);
      totalPrice += priceInIQD * (p.stock || 0);
    });
    const expectedProfit = totalPrice - totalCost;
    return { totalCost, totalPrice, expectedProfit };
  }, [filteredProducts, exchangeRate]);

  const lowStockItems = useMemo(() => {
    return filteredProducts.filter(p => (p.stock || 0) <= 20).sort((a, b) => (a.stock || 0) - (b.stock || 0));
  }, [filteredProducts]);

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !addQty) return;
    const addedStock = parseInt(addQty, 10);
    if (addedStock <= 0) return;

    await updateDoc(doc(db, 'products', selectedProduct.id), {
       stock: (selectedProduct.stock || 0) + addedStock,
       updatedAt: Timestamp.now()
    });

    setIsModalOpen(false);
    setSelectedProduct(null);
    setAddQty('');
  };

  return (
    <div className="space-y-8">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <h2 className="text-2xl font-bold text-slate-900">بەشی کۆگا</h2>
        <div className="flex gap-3 w-full sm:w-auto">
          <button onClick={() => { setSelectedProduct(null); setIsModalOpen(true); }} className="flex-1 sm:flex-none bg-pink-50 hover:bg-pink-100 text-pink-700 px-6 py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 shadow-sm shadow-pink-100 border border-pink-200">
            <PackagePlus size={20} />
            <span>زیادکردنی ستۆک</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-center p-3 text-pink-600 bg-pink-50 rounded-xl">
          <Filter size={20} />
        </div>
        <select 
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 text-slate-700 font-medium"
        >
          <option value="all">هەموو کەتەگۆرییەکان (گشتی)</option>
          {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select 
          value={selectedCompany}
          onChange={(e) => setSelectedCompany(e.target.value)}
          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 text-slate-700 font-medium"
        >
          <option value="all">هەموو شەریکەکان</option>
          {availableCompanies.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-slate-500 text-xs font-medium mb-1">تێچووی گشتی کۆگا</p>
          <h3 className="text-xl font-bold font-mono text-slate-900">{formatCurrency(metrics.totalCost)}</h3>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-slate-500 text-xs font-medium mb-1">کۆی نرخی فرۆشتن</p>
          <h3 className="text-xl font-bold font-mono text-pink-600">{formatCurrency(metrics.totalPrice)}</h3>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-slate-500 text-xs font-medium mb-1">قازانجی پێشبینیکراو</p>
          <h3 className="text-xl font-bold font-mono text-green-700">{formatCurrency(metrics.expectedProfit)}</h3>
        </div>

        <div className="bg-red-50 p-4 rounded-2xl border border-red-100 shadow-sm ring-1 ring-red-200">
          <p className="text-red-600 text-xs font-bold mb-1 italic">⚠️ ئاگاداری ستۆک</p>
          <h3 className="text-xl font-bold font-mono text-red-900">{lowStockItems.length} کالا</h3>
          <p className="text-[10px] text-red-500 mt-1">کەمتر لە ٢٠ دانەیان ماوە</p>
        </div>
      </div>

      {/* Low Stock Items List */}
      <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden mt-6">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50">
          <AlertCircle className="text-red-500" size={20} />
          <h3 className="text-lg font-bold text-slate-900">ئەم کالایانە پێویستیان بە ستۆکە</h3>
        </div>
        <div className="flex-1 overflow-auto max-h-[400px]">
          {lowStockItems.length > 0 ? (
            <table className="w-full text-right border-collapse">
              <thead className="bg-white text-slate-500 text-[11px] uppercase tracking-wider sticky top-0 border-b border-slate-200 shadow-sm">
                <tr>
                  <th className="px-6 py-3 font-semibold">ناو</th>
                  <th className="px-6 py-3 font-semibold">شەریکە</th>
                  <th className="px-6 py-3 font-semibold">ستۆکی ماوە</th>
                  <th className="px-6 py-3 font-semibold text-center">کردار</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-100">
                {lowStockItems.map(item => (
                  <tr key={item.id} className="bg-red-50/20 hover:bg-red-50/80 transition-colors">
                     <td className="px-6 py-4 font-medium text-slate-900">{item.name}</td>
                    <td className="px-6 py-4 text-slate-600">{item.company}</td>
                    <td className="px-6 py-4">
                      <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-bold">
                        {item.stock || 0} دانە
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button onClick={() => { setSelectedProduct(item); setIsModalOpen(true); }} className="text-pink-600 text-xs font-bold px-4 py-2 bg-pink-50 hover:bg-pink-100 rounded-lg transition-colors border border-pink-200">
                        زیادکردنی ستۆک
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-10 text-slate-400">
              هیچ کالایەکی کەم لێرە نییە. هەموو ستۆکەکانت باشن.
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleAddStock} className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-800">
                زیادکردنی ستۆک
              </h2>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:bg-slate-200 p-1 rounded-lg">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                 <label className="block text-sm font-medium text-slate-700 mb-1">هەڵبژاردنی کالا</label>
                 <select required value={selectedProduct ? selectedProduct.id : ''} onChange={e => {
                    const prod = products.find(p => p.id === e.target.value);
                    setSelectedProduct(prod || null);
                 }} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-pink-500">
                    <option value="" disabled>کالایەک هەڵبژێرە...</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name} - (لە ئێستادا: {p.stock || 0})</option>)}
                 </select>
              </div>

              <div>
                 <label className="block text-sm font-medium text-slate-700 mb-1">بڕی هاتوو بە دانە (زیادکراو)</label>
                 <input required type="number" min="1" value={addQty} onChange={e=>setAddQty(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-pink-500 font-mono text-left" dir="ltr" placeholder="10" />
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors">
                پاشگەزبوونەوە
              </button>
              <button type="submit" className="px-4 py-2 bg-pink-600 text-white hover:bg-pink-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                <PackagePlus size={16} /> زیادکردن
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
