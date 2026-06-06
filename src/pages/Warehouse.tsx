import React, { useMemo, useState, useEffect } from "react";
import {
  PackagePlus,
  AlertCircle,
  Filter,
  X,
  PackageSearch,
  Search,
  Boxes,
  MapPin,
  TrendingUp,
} from "lucide-react";
import { formatCurrency } from "../data";
import {
  collection,
  onSnapshot,
  updateDoc,
  doc,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";

export default function Warehouse() {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedCompany, setSelectedCompany] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"lowStock" | "all">("lowStock");

  const [products, setProducts] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  // Add stock dialog
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [addQty, setAddQty] = useState("");
  const [addCartonQty, setAddCartonQty] = useState("");

  useEffect(() => {
    const unsubProds = onSnapshot(collection(db, "products"), (snap) => {
      setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const unsubComps = onSnapshot(collection(db, "companies"), (snap) => {
      setCompanies(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const unsubCats = onSnapshot(collection(db, "categories"), (snap) => {
      setCategories(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => {
      unsubProds();
      unsubComps();
      unsubCats();
    };
  }, []);

  const availableCompanies = companies.map((c) => c.name);
  const availableCategories = categories.map((c) => c.name);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch = (p.name || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (p.barcode || "").includes(searchTerm);
      const matchCat = selectedCategory === "all" || p.category === selectedCategory;
      const matchComp = selectedCompany === "all" || p.company === selectedCompany;
      return matchSearch && matchCat && matchComp;
    });
  }, [searchTerm, selectedCategory, selectedCompany, products]);

  const metrics = useMemo(() => {
    let totalCost = 0;
    let totalPrice = 0;
    let totalWholesaleCost = 0;
    let totalWholesalePrice = 0;

    filteredProducts.forEach((p) => {
      const costInUSD = p.unitCost || 0;
      const priceInUSD = p.unitPrice || 0;
          
      const wCostInUSD = p.wholesaleCost || p.unitCost || 0;
      const wPriceInUSD = p.wholesalePrice || p.unitPrice || 0;

      totalCost += costInUSD * (p.stock || 0);
      totalPrice += priceInUSD * (p.stock || 0);
      totalWholesaleCost += wCostInUSD * (p.stock || 0);
      totalWholesalePrice += wPriceInUSD * (p.stock || 0);
    });
    const expectedProfit = totalPrice - totalCost;
    const expectedWholesaleProfit = totalWholesalePrice - totalWholesaleCost;
    
    return { totalCost, totalPrice, expectedProfit, totalWholesaleCost, expectedWholesaleProfit };
  }, [filteredProducts]);

  const lowStockItems = useMemo(() => {
    return filteredProducts
      .filter((p) => (p.stock || 0) <= (p.minStockAlert || 10) && (p.stock || 0) >= 0)
      .sort((a, b) => (a.stock || 0) - (b.stock || 0));
  }, [filteredProducts]);

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    const addedStockPcs = parseInt(addQty || "0", 10) || 0;
    const addedStockCartons = parseInt(addCartonQty || "0", 10) || 0;
    const cartonSize = selectedProduct.cartonSize || 1;
    const totalAddedStock = addedStockPcs + addedStockCartons * cartonSize;
    if (totalAddedStock <= 0) return;

    await updateDoc(doc(db, "products", selectedProduct.id), {
      stock: (selectedProduct.stock || 0) + totalAddedStock,
      updatedAt: Timestamp.now(),
    });

    setIsModalOpen(false);
    setSelectedProduct(null);
    setAddQty("");
    setAddCartonQty("");
  };

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
           <Boxes className="text-pink-600" /> کۆگا (بنکەی سەرەکی)
        </h2>
        <div className="flex gap-3 w-full sm:w-auto">
          <button
            onClick={() => {
              setSelectedProduct(null);
              setIsModalOpen(true);
            }}
            className="flex-1 sm:flex-none bg-pink-600 hover:bg-pink-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md shadow-pink-200 flex items-center justify-center gap-2 active:scale-95"
          >
            <PackagePlus size={18} />
            <span>زیادکردنی ستۆک بەپەلە</span>
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Cost */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-slate-50 rounded-bl-full -z-10"></div>
          <p className="text-slate-500 text-[11px] sm:text-xs font-bold mb-1">
            سەرمایە (تێچووی کۆگا)
          </p>
          <h3 className="text-lg sm:text-xl font-black font-mono text-slate-900 tracking-tight">
            {formatCurrency(metrics.totalCost)}
          </h3>
        </div>

        {/* Expected Value */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-16 h-16 bg-pink-50/50 rounded-br-full -z-10"></div>
          <p className="text-slate-500 text-[11px] sm:text-xs font-bold mb-1">
            بڕی پێشبینیکراو بۆ فرۆشتن
          </p>
          <h3 className="text-lg sm:text-xl font-black font-mono text-pink-700 tracking-tight">
            {formatCurrency(metrics.totalPrice)}
          </h3>
        </div>

        {/* Estimated Profit */}
        <div className="bg-emerald-50 p-4 sm:p-5 rounded-2xl border border-emerald-200 shadow-sm relative overflow-hidden">
          <div className="absolute bottom-0 right-0 w-24 h-24 bg-white/40 rounded-tl-full -z-10 blur-xl"></div>
          <div className="flex items-center gap-1.5 mb-1 text-emerald-800">
             <TrendingUp size={14} />
             <p className="text-[11px] sm:text-xs font-bold">
               قازانجی کڕین (بۆ فرۆشتن)
             </p>
          </div>
          <h3 className="text-lg sm:text-xl font-black font-mono text-emerald-700 tracking-tight">
            {formatCurrency(metrics.expectedProfit)}
          </h3>
        </div>

        {/* Low Stock Watch */}
        <div className="bg-amber-50 p-4 sm:p-5 rounded-2xl border border-amber-200 shadow-sm flex flex-col justify-between">
          <p className="text-amber-800 text-[11px] sm:text-xs font-bold flex items-center gap-1.5 leading-none">
            <AlertCircle size={14} className="text-amber-600" /> پێویستی بە سەرنجە
          </p>
          <h3 className="text-xl sm:text-2xl font-black font-mono text-amber-600 tracking-tight mt-1">
            {lowStockItems.length} <span className="text-xs font-bold text-amber-700 ml-1">کالا</span>
          </h3>
          <p className="text-[10px] text-amber-700/80 mt-1 font-medium">کەمتر لە رێژەی ئاگادارکردنەوە</p>
        </div>
      </div>

      {/* Filters & Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-2 sm:p-3">
         <div className="flex flex-col lg:flex-row gap-3">
           <div className="flex gap-2 p-1 bg-slate-100 rounded-xl max-w-fit shrink-0">
             <button onClick={() => setActiveTab("lowStock")} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "lowStock" ? "bg-white text-amber-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
               کاڵا کەمەکان <span className={`ml-1.5 px-2 py-0.5 rounded-full text-[10px] ${activeTab === "lowStock" ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-500"}`}>{lowStockItems.length}</span>
             </button>
             <button onClick={() => setActiveTab("all")} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "all" ? "bg-white text-pink-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
               هەموو کاڵاکان
             </button>
           </div>
           
           <div className="flex flex-wrap lg:flex-nowrap gap-2 w-full">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="گەڕان بۆ کاڵا..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pr-10 pl-3 focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 outline-none text-sm font-medium"
                />
              </div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="flex-1 sm:w-auto bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 text-sm text-slate-700 font-bold"
              >
                <option value="all">کەتەگۆری (گشتی)</option>
                {availableCategories.map((c) => (<option key={c} value={c}>{c}</option>))}
              </select>
              <select
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
                className="flex-1 sm:w-auto bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 text-sm text-slate-700 font-bold"
              >
                <option value="all">شەریکە (گشتی)</option>
                {availableCompanies.map((c) => (<option key={c} value={c}>{c}</option>))}
              </select>
           </div>
         </div>
      </div>

      {/* Main Table / List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-right border-collapse">
            <thead className="bg-slate-50 text-slate-500 tracking-wider sticky top-0 border-b border-slate-200 z-10">
              <tr>
                <th className="px-5 py-3 font-bold text-xs">ناوی کالا</th>
                <th className="px-5 py-3 font-bold text-xs">کەتەگۆری/شەریکە</th>
                <th className="px-5 py-3 font-bold text-xs">ستۆک (ماوە)</th>
                <th className="px-5 py-3 font-bold text-xs text-left">بەهای ئەم ستۆکە (تێچوو)</th>
                <th className="px-5 py-3 font-bold text-xs text-center w-32">کردار</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(activeTab === "lowStock" ? lowStockItems : filteredProducts).length > 0 ? (
                (activeTab === "lowStock" ? lowStockItems : filteredProducts).map((item) => {
                  const pStock = item.stock || 0;
                  const isOutOfStock = pStock === 0;
                  const alertLvl = item.minStockAlert || 10;
                  const isLowStock = pStock <= alertLvl && pStock > 0;
                  
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-900">{item.name}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-slate-400 font-mono" dir="ltr">{item.barcode || "بێ بارکۆد"}</span>
                          {item.location && (
                            <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                              <MapPin size={10} /> {item.location}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-xs font-bold text-slate-700">{item.company}</div>
                        <div className="text-[10px] text-slate-500 mt-1">{item.category}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className={`inline-flex flex-col px-3 py-1.5 rounded-lg border ${isOutOfStock ? 'bg-red-50 border-red-200 text-red-700' : isLowStock ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                          <div className="font-bold whitespace-nowrap">
                            {item.cartonSize && item.cartonSize > 1 ? (
                              <div className="flex items-center gap-1.5">
                                <span>{Math.floor(pStock / item.cartonSize)} کارتۆن</span>
                                {pStock % item.cartonSize !== 0 && <span>و {pStock % item.cartonSize} دانە</span>}
                              </div>
                            ) : (
                              <span>{pStock} دانە</span>
                            )}
                          </div>
                          {item.cartonSize && item.cartonSize > 1 && (
                            <div className={`text-[10px] mt-0.5 pt-0.5 border-t ${isOutOfStock ? 'border-red-200/50' : 'border-slate-200/50'}`}>
                              {pStock} دانەیی
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-left font-mono">
                         <div className="font-black text-slate-800">{formatCurrency((item.unitCost || 0) * pStock)}</div>
                         <div className="text-[10px] text-slate-400 mt-0.5 line-through decoration-slate-300">
                           {formatCurrency((item.unitPrice || 0) * pStock)} فرۆشتن
                         </div>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <button
                          onClick={() => {
                            setSelectedProduct(item);
                            setIsModalOpen(true);
                          }}
                          className="text-pink-600 text-xs font-bold px-3 py-1.5 bg-pink-50 hover:bg-pink-100 rounded-lg transition-colors border border-pink-200 flex items-center gap-1.5 mx-auto"
                        >
                          <PackagePlus size={14} /> زیادکردن
                        </button>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                   <td colSpan={5} className="py-16">
                      <div className="flex flex-col items-center justify-center text-slate-400">
                         <PackageSearch size={48} className="text-slate-200 mb-3" />
                         <p className="font-bold text-sm">هیچ کالایەک نەدۆزرایەوە.</p>
                      </div>
                   </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <form
            onSubmit={handleAddStock}
            className="bg-white rounded-t-[32px] sm:rounded-[24px] shadow-2xl w-full max-w-md overflow-hidden flex flex-col transform transition-all animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:zoom-in-95"
          >
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
                <PackagePlus className="text-pink-600" size={20} />
                زیادکردنی ستۆک بەپەلە
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:bg-slate-200 hover:text-slate-700 w-8 h-8 flex justify-center items-center rounded-xl transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  هەڵبژاردنی کالا
                </label>
                <select
                  required
                  value={selectedProduct ? selectedProduct.id : ""}
                  onChange={(e) => {
                    const prod = products.find((p) => p.id === e.target.value);
                    setSelectedProduct(prod || null);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 hover:border-pink-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-pink-100 focus:bg-white text-sm font-bold text-slate-700 transition-colors"
                >
                  <option value="" disabled>کالایەک هەڵبژێرە...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} - (لە ئێستادا: {p.stock || 0})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    زیادکردن بە کارتۆن
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={addCartonQty}
                    onChange={(e) => setAddCartonQty(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-pink-400 focus:bg-white font-mono text-center font-bold text-lg transition-colors"
                    dir="ltr"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    زیادکردن بە دانە
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={addQty}
                    onChange={(e) => setAddQty(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-pink-400 focus:bg-white font-mono text-center font-bold text-lg transition-colors"
                    dir="ltr"
                    placeholder="0"
                  />
                </div>
              </div>

              {selectedProduct && (
                <div className="bg-pink-50 border border-pink-100 p-4 rounded-xl flex flex-col gap-2">
                  <div className="text-[11px] text-pink-800 font-bold flex items-center justify-between">
                    <span>یەک کارتۆن =</span>
                    <span className="font-mono">{selectedProduct.cartonSize || 1} دانە</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-pink-200/60 pt-2 mt-1">
                    <span className="text-sm font-bold text-pink-900">
                      کۆی بڕی زیادکراو بۆ کۆگا:
                    </span>
                    <span className="font-black font-mono text-xl bg-white px-3 py-1 rounded-lg border border-pink-200 text-pink-700 shadow-sm">
                      {(parseInt(addCartonQty) || 0) * (selectedProduct.cartonSize || 1) + (parseInt(addQty) || 0)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 pb-[max(calc(env(safe-area-inset-bottom)+1rem),1rem)] sm:pb-4">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2.5 text-slate-600 bg-white border border-slate-200 rounded-xl text-sm font-bold hover:bg-slate-100 transition-colors"
              >
                پاشگەزبوونەوە
              </button>
              <button
                type="submit"
                disabled={!selectedProduct || ((parseInt(addCartonQty) || 0) * (selectedProduct?.cartonSize || 1) + (parseInt(addQty) || 0)) <= 0}
                className="px-6 py-2.5 bg-pink-600 text-white hover:bg-pink-700 rounded-xl text-sm font-bold transition-all flex items-center gap-2 shadow-sm disabled:opacity-50 active:scale-95"
              >
                <PackagePlus size={16} /> خەزنکردن
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
