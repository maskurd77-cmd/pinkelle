import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Product } from '../types';
import { Search, PackageOpen, LayoutGrid, Tag, X } from 'lucide-react';
import { formatCurrency } from '../data';

export default function MenuPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    const unsubProducts = onSnapshot(collection(db, 'products'), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[];
      setProducts(data);
    });

    const unsubCats = onSnapshot(collection(db, 'categories'), (snap) => {
      setCategories(snap.docs.map(doc => doc.data().name));
    });

    return () => {
      unsubProducts();
      unsubCats();
    };
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            p.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (p.barcode && p.barcode.includes(searchTerm));
      const matchesCat = selectedCategory === 'all' || p.category === selectedCategory;
      return matchesSearch && matchesCat && p.stock > 0;
    });
  }, [products, searchTerm, selectedCategory]);

  return (
    <div className="h-full flex flex-col bg-[#fcfdff] overflow-y-auto custom-scrollbar">
      {/* Hero Header */}
      <div className="relative bg-gradient-to-br from-pink-600 via-pink-500 to-rose-500 text-white overflow-hidden shrink-0 shadow-lg">
         {/* Decorative Background Elements */}
         <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-white/10 blur-3xl"></div>
         <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-white/10 blur-3xl"></div>
         
         <div className="max-w-7xl mx-auto px-6 py-12 relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-6">
                <div className="bg-white p-2 rounded-2xl shadow-xl w-32 h-32 flex items-center justify-center shrink-0 shrink-0 transform transition-transform hover:scale-105 duration-300">
                    <img src="https://skilled-indigo-cux52hz9.edgeone.app/Pink%20Elle%20logo%20new-1_page-0001.jpg" alt="Pink Elle Logo" className="w-full h-full object-contain rounded-xl" />
                </div>
                <div>
                   <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-2 text-white drop-shadow-md">PINK ELLE CATALOGUE</h1>
                   <p className="text-pink-100 text-lg md:text-xl font-medium tracking-wide">نایابترین و باشترین براندەکان لە یەک شوێن</p>
                </div>
            </div>
            
            <div className="w-full md:w-96 relative group">
               <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-pink-600 group-focus-within:text-pink-700 transition-colors" size={20} />
               <input
                 type="text"
                 placeholder="گەڕان بەدوای کالا، مارکە، یان باڕکۆد..."
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 className="w-full pl-4 pr-12 py-3.5 rounded-2xl border-none shadow-xl focus:ring-4 focus:ring-white/30 text-slate-800 text-base placeholder:text-slate-400 outline-none transition-shadow"
               />
            </div>
         </div>
      </div>

      <div className="flex-1 max-w-7xl mx-auto w-full px-4 md:px-8 py-8 space-y-8">
         {/* Categories Scroll */}
         <div className="flex items-center gap-3 overflow-x-auto pb-4 hide-scrollbar scroll-smooth">
             <button
               onClick={() => setSelectedCategory('all')}
               className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold whitespace-nowrap transition-all duration-300 ${
                 selectedCategory === 'all' 
                   ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20 scale-100' 
                   : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 scale-95 hover:scale-100'
               }`}
             >
               <LayoutGrid size={18} /> هەمووی
             </button>
             {categories.map(c => (
               <button
                 key={c}
                 onClick={() => setSelectedCategory(c)}
                 className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold whitespace-nowrap transition-all duration-300 ${
                   selectedCategory === c 
                     ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20 scale-100' 
                     : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 scale-95 hover:scale-100'
                 }`}
               >
                 <Tag size={18} /> {c}
               </button>
             ))}
         </div>

         {filteredProducts.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-32 text-slate-400 bg-white rounded-3xl border border-slate-100 shadow-sm">
                <PackageOpen size={80} className="mb-6 opacity-30 text-pink-500" />
                <p className="text-2xl font-black text-slate-600 mb-2">هیچ کاڵایەک نەدۆزرایەوە</p>
                <p className="text-sm font-medium">پشکنینەکانت بگۆڕە یان وشەی تر بەکار بهێنە.</p>
             </div>
         ) : (
             <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6 pb-20">
                {filteredProducts.map(product => (
                    <div 
                        key={product.id} 
                        className="bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 border border-slate-100 group flex flex-col cursor-pointer"
                        onClick={() => setSelectedProduct(product)}
                    >
                        <div className="aspect-square bg-slate-50 relative p-6 flex items-center justify-center overflow-hidden">
                           {product.imageUrl ? (
                              <img src={product.imageUrl} alt={product.name} className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500 ease-out drop-shadow-sm" />
                           ) : (
                              <PackageOpen size={48} className="text-slate-300 group-hover:scale-110 shadow-sm transition-transform duration-500 ease-out" />
                           )}
                           <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl text-xs font-black text-slate-800 shadow-sm border border-slate-100/50">
                              {product.company}
                           </div>
                        </div>
                        <div className="p-5 flex flex-col flex-1">
                            <p className="text-xs text-pink-600 font-extrabold mb-1.5 uppercase tracking-wide">{product.category}</p>
                            <h3 className="font-bold text-slate-800 text-[15px] leading-snug mb-4 line-clamp-2">{product.name}</h3>
                            
                            <div className="mt-auto space-y-2">
                               <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                                   <span className="text-xs font-extrabold text-slate-400">تاک</span>
                                   <span className="font-mono font-extrabold text-slate-900 text-lg tracking-tight">{formatCurrency(product.unitPrice, product.currency)}</span>
                               </div>
                               {product.wholesalePrice ? (
                                  <div className="flex items-center justify-between pt-1">
                                      <span className="text-xs font-extrabold text-slate-400">جوملە</span>
                                      <span className="font-mono font-bold text-indigo-600 text-sm tracking-tight">{formatCurrency(product.wholesalePrice, product.currency)}</span>
                                  </div>
                               ) : null}
                            </div>
                        </div>
                    </div>
                ))}
             </div>
         )}
      </div>

      {/* Product Image Expansion Modal */}
      {selectedProduct && (
         <div className="fixed inset-0 z-[9999] bg-slate-900/80 backdrop-blur-xl flex items-center justify-center p-4 md:p-8 outline-none" onClick={() => setSelectedProduct(null)}>
            <div className="bg-white rounded-3xl overflow-hidden w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col md:flex-row relative animate-in fade-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
               <button 
                  onClick={() => setSelectedProduct(null)} 
                  className="absolute top-4 right-4 z-10 w-12 h-12 bg-white/50 hover:bg-white backdrop-blur-md border border-slate-200 text-slate-600 rounded-full flex items-center justify-center transition-all"
               >
                  <X size={24} />
               </button>
               
               <div className="w-full md:w-3/5 bg-slate-50 flex items-center justify-center p-8 relative min-h-[300px]">
                  {selectedProduct.imageUrl ? (
                     <img src={selectedProduct.imageUrl} alt={selectedProduct.name} className="w-full h-full object-contain drop-shadow-xl max-h-[60vh] md:max-h-[80vh]" />
                  ) : (
                     <PackageOpen size={120} className="text-slate-300" />
                  )}
               </div>
               
               <div className="w-full md:w-2/5 p-8 flex flex-col">
                  <div className="flex-1">
                     <div className="mb-6">
                        <span className="inline-block bg-pink-100 text-pink-700 px-3 py-1 rounded-full text-xs font-black tracking-widest uppercase mb-4 shadow-sm border border-pink-200">
                           {selectedProduct.category}
                        </span>
                        <h2 className="text-2xl md:text-3xl font-black text-slate-800 leading-snug mb-2">{selectedProduct.name}</h2>
                        <p className="text-lg font-bold text-slate-500">{selectedProduct.company}</p>
                     </div>
                     
                     <div className="space-y-4 pt-6 border-t border-slate-100">
                        <div className="flex flex-col gap-1">
                           <span className="text-sm font-bold text-slate-400">نرخی تاک</span>
                           <span className="font-mono font-black text-3xl text-pink-600">{formatCurrency(selectedProduct.unitPrice, selectedProduct.currency)}</span>
                        </div>
                        
                        {selectedProduct.wholesalePrice ? (
                           <div className="flex flex-col gap-1 mt-4">
                              <span className="text-sm font-bold text-slate-400">نرخی جوملە</span>
                              <span className="font-mono font-bold text-2xl text-indigo-600">{formatCurrency(selectedProduct.wholesalePrice, selectedProduct.currency)}</span>
                           </div>
                        ) : null}
                        
                        <div className="mt-8 pt-6 border-t border-slate-100">
                           <span className="text-sm font-bold text-slate-400 block mb-2">باڕکۆد</span>
                           <span className="font-mono bg-slate-100 px-3 py-1.5 rounded-lg text-slate-700 font-bold block w-fit" dir="ltr">
                              {selectedProduct.barcode || 'دیارینەکراوە'}
                           </span>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
         </div>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-12 shrink-0">
         <div className="max-w-4xl mx-auto px-6 text-center space-y-6">
            <h2 className="text-3xl font-black text-slate-800 tracking-wider">گرووپی PINK ELLE</h2>
            
            <div className="space-y-1">
               <p className="text-xl font-extrabold text-pink-600">تاکە بریکاری PINK ELLE</p>
               <p className="text-lg font-bold text-slate-600">بۆ دابینکردنی کەلوپەلی پاککەرەوە</p>
               <p className="text-base font-bold text-slate-500">بۆ بازرگانی گشتی - سنووردار</p>
            </div>

            <div className="pt-6 border-t border-slate-100 flex flex-col items-center justify-center">
               <div className="text-center">
                  <p className="text-sm font-bold text-slate-400 mb-2">ژمارەی کۆمپانیا</p>
                  <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 justify-center">
                     <p className="font-mono font-bold text-lg text-slate-800" dir="ltr">0751 201 8372</p>
                     <p className="font-mono font-bold text-lg text-slate-800" dir="ltr">0750 425 1338</p>
                  </div>
               </div>
            </div>
         </div>
      </footer>
    </div>
  );
}
