import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Filter, Edit, Trash2, X, Image as ImageIcon, Link as LinkIcon, Camera } from 'lucide-react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { formatCurrency } from '../data';

export default function Products() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedCompany, setSelectedCompany] = useState('all');
  const [stockStatus, setStockStatus] = useState('all');

  const [products, setProducts] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);

  // Form states
  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [category, setCategory] = useState('');
  const [company, setCompany] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [wholesaleCost, setWholesaleCost] = useState('');
  const [wholesalePrice, setWholesalePrice] = useState('');
  const [stock, setStock] = useState('');
  const [currency, setCurrency] = useState<'IQD'|'USD'>('IQD');
  const [imageUrl, setImageUrl] = useState('');
  const [inputType, setInputType] = useState<'url' | 'file'>('url');

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
    return () => {
      unsubProds();
      unsubComps();
      unsubCats();
    };
  }, []);

  const availableCompanies = companies.map(c => c.name);
  const availableCategories = categories.map(c => c.name);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch = (product.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (product.barcode || '').includes(searchTerm);
      const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
      const matchesCompany = selectedCompany === 'all' || product.company === selectedCompany;
      const stockVal = product.stock || 0;
      const matchesStock = 
        stockStatus === 'all' ? true : 
        stockStatus === 'low' ? (stockVal > 0 && stockVal <= 10) : 
        stockStatus === 'out' ? stockVal === 0 : true;

      return matchesSearch && matchesCategory && matchesCompany && matchesStock;
    });
  }, [searchTerm, selectedCategory, selectedCompany, stockStatus, products]);

  const openAddModal = () => {
    setEditingProduct(null);
    setName(''); setBarcode(''); setCategory(availableCategories[0] || ''); setCompany(availableCompanies[0] || '');
    setUnitCost(''); setUnitPrice(''); setWholesalePrice(''); setStock(''); setCurrency('IQD'); setImageUrl(''); setInputType('url');
    setIsModalOpen(true);
  };

  const openEditModal = (p: any) => {
    setEditingProduct(p);
    setName(p.name || ''); setBarcode(p.barcode || ''); setCategory(p.category || ''); setCompany(p.company || '');
    setUnitCost(p.unitCost ?? ''); setUnitPrice(p.unitPrice ?? ''); setWholesaleCost(p.wholesaleCost ?? ''); setWholesalePrice(p.wholesalePrice ?? ''); setStock(p.stock ?? ''); setCurrency(p.currency || 'IQD');
    setImageUrl(p.imageUrl || ''); setInputType('url');
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if(confirm('تڵنیایت لە سڕینەوەی ئەم کالایە؟')) {
      await deleteDoc(doc(db, 'products', id));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const prodData = {
      name,
      barcode,
      category,
      company,
      unitCost: parseFloat(unitCost) || 0,
      unitPrice: parseFloat(unitPrice) || 0,
      wholesaleCost: wholesaleCost ? parseFloat(wholesaleCost) : 0,
      wholesalePrice: wholesalePrice ? parseFloat(wholesalePrice) : 0,
      stock: parseInt(stock, 10) || 0,
      currency,
      imageUrl,
      updatedAt: Timestamp.now()
    };

    if (editingProduct) {
      await updateDoc(doc(db, 'products', editingProduct.id), prodData);
    } else {
      await addDoc(collection(db, 'products'), {
         ...prodData,
         createdAt: Timestamp.now()
      });
    }
    setIsModalOpen(false);
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
     if (!file) return;

     const reader = new FileReader();
     reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
           const canvas = document.createElement('canvas');
           const MAX_WIDTH = 400;
           const MAX_HEIGHT = 400;
           let width = img.width;
           let height = img.height;

           if (width > height) {
              if (width > MAX_WIDTH) {
                 height *= MAX_WIDTH / width;
                 width = MAX_WIDTH;
              }
           } else {
              if (height > MAX_HEIGHT) {
                 width *= MAX_HEIGHT / height;
                 height = MAX_HEIGHT;
              }
           }
           canvas.width = width;
           canvas.height = height;
           const ctx = canvas.getContext('2d');
           ctx?.drawImage(img, 0, 0, width, height);
           const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
           setImageUrl(dataUrl);
        };
        img.src = event.target?.result as string;
     };
     reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
        
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            <h2 className="text-lg font-bold text-slate-900">بەڕێوەبردنی کالاکان</h2>
            <div className="flex gap-2">
              <select 
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50 text-slate-600 focus:outline-none focus:ring-1 focus:ring-pink-500"
              >
                <option value="all">هەموو کەتەگۆرییەکان</option>
                {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select 
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50 text-slate-600 focus:outline-none focus:ring-1 focus:ring-pink-500"
              >
                <option value="all">هەموو کڕیاران (شەریکەکان)</option>
                {availableCompanies.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-48 sm:flex-none">
              <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input 
                type="text" 
                placeholder="گەڕان بۆ ناو یان بارکۆد..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 pr-8 pl-3 text-xs focus:outline-none focus:ring-1 focus:ring-pink-500 transition-all text-slate-700"
              />
            </div>
            <button onClick={openAddModal} className="px-3 py-1.5 bg-pink-600 text-white rounded-lg text-sm font-medium hover:bg-pink-700 whitespace-nowrap flex items-center gap-1.5 shadow-md shadow-pink-200">
              <Plus size={16} /> کالای نوێ
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="w-full text-right border-collapse min-w-[1000px]">
            <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider sticky top-0 z-10">
              <tr className="border-b border-slate-200">
                <th className="px-6 py-3 font-semibold text-center w-16">وێنە</th>
                <th className="px-6 py-3 font-semibold">ناوی کالا</th>
                <th className="px-6 py-3 font-semibold">کەتەگۆری</th>
                <th className="px-6 py-3 font-semibold">شەریکە</th>
                <th className="px-6 py-3 font-semibold text-right">تێچوو (دانە/جوملە)</th>
                <th className="px-6 py-3 font-semibold text-right">نرخ (دانە)</th>
                <th className="px-6 py-3 font-semibold text-right">نرخ (جوملە)</th>
                <th className="px-6 py-3 font-semibold text-right">قازانج (دانە/جوملە)</th>
                <th className="px-6 py-3 font-semibold">ستۆک</th>
                <th className="px-6 py-3 font-semibold text-center">کردار</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-100">
              {filteredProducts.map((product) => {
                const pCost = product.unitCost || 0;
                const pPrice = product.unitPrice || 0;
                const profitPerUnit = pPrice - pCost;
                const profitPerWholesale = product.wholesalePrice ? (product.wholesalePrice - (product.wholesaleCost || pCost)) : null;
                const pStock = product.stock || 0;
                const isLowStock = pStock <= 10 && pStock > 0;
                const isOutOfStock = pStock === 0;
                
                return (
                  <tr key={product.id} className={`${isLowStock || isOutOfStock ? 'bg-red-50/30 hover:bg-red-50' : 'hover:bg-slate-50'} transition-colors`}>
                    <td className="px-6 py-4">
                       {product.imageUrl ? (
                          <img src={product.imageUrl} alt={product.name} className="w-10 h-10 object-cover rounded-lg border border-slate-200" referrerPolicy="no-referrer" />
                       ) : (
                          <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
                             <ImageIcon size={20} />
                          </div>
                       )}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-900">
                      <div>{product.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5" dir="ltr">{product.barcode}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{product.category}</td>
                    <td className="px-6 py-4 text-slate-600">{product.company}</td>
                    <td className="px-6 py-4 font-mono">
                      <div className="text-slate-600">{formatCurrency(pCost, product.currency)}</div>
                      {product.wholesaleCost && <div className="text-xs text-slate-400 mt-1">{formatCurrency(product.wholesaleCost, product.currency)}</div>}
                    </td>
                    <td className="px-6 py-4 font-mono">
                      <div className="text-slate-900">{formatCurrency(pPrice, product.currency)}</div>
                    </td>
                    <td className="px-6 py-4 font-mono text-indigo-600 font-bold">{product.wholesalePrice ? formatCurrency(product.wholesalePrice, product.currency) : '-'}</td>
                    <td className="px-6 py-4 font-mono">
                      <div className="text-green-600 font-bold">+{formatCurrency(profitPerUnit, product.currency)}</div>
                      {profitPerWholesale !== null && <div className="text-xs text-green-500 font-bold mt-1">+{formatCurrency(profitPerWholesale, product.currency)}</div>}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs ${
                        isOutOfStock ? 'bg-red-100 text-red-800 font-bold' :
                        isLowStock ? 'bg-red-50 text-red-700 font-bold border border-red-200' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {pStock} دانە
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => openEditModal(product)} className="text-blue-500 hover:bg-blue-50 p-1.5 rounded transition-colors"><Edit size={16} /></button>
                        <button onClick={() => handleDelete(product.id)} className="text-red-400 hover:bg-red-50 p-1.5 rounded transition-colors"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                    هیچ کالایەک نەدۆزرایەوە بەم فلتەرانە.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-800">
                {editingProduct ? 'دەستکاریکردنی کالا' : 'زیادکردنی کالای نوێ'}
              </h2>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:bg-slate-200 p-1 rounded-lg">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                 <div className="col-span-2 space-y-2">
                    <div className="flex justify-between items-center">
                       <label className="block text-sm font-medium text-slate-700">وێنەی کالا</label>
                       <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
                          <button type="button" onClick={() => setInputType('url')} className={`px-3 py-1 text-xs font-bold rounded-md flex items-center gap-1 ${inputType === 'url' ? 'bg-white shadow-sm text-pink-600' : 'text-slate-500'}`}>
                             <LinkIcon size={14} /> هەواڵە / بەستەر
                          </button>
                          <button type="button" onClick={() => setInputType('file')} className={`px-3 py-1 text-xs font-bold rounded-md flex items-center gap-1 ${inputType === 'file' ? 'bg-white shadow-sm text-pink-600' : 'text-slate-500'}`}>
                             <Camera size={14} /> فایلی وێنە
                          </button>
                       </div>
                    </div>
                    {inputType === 'url' ? (
                       <input type="text" value={imageUrl} onChange={e=>setImageUrl(e.target.value)} dir="ltr" className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-pink-500 font-mono text-left text-sm" placeholder="https://example.com/image.png" />
                    ) : (
                       <input type="file" accept="image/*" onChange={handleImageFileChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm" />
                    )}
                    {imageUrl && (
                       <div className="mt-2 text-center">
                          <img src={imageUrl} alt="بەرچاوینەی وێنە" className="max-h-32 rounded-lg border border-slate-200 mx-auto object-contain" referrerPolicy="no-referrer" />
                       </div>
                    )}
                 </div>
                 
                 <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">ناوی کالا</label>
                    <input required type="text" value={name} onChange={e=>setName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-pink-500" />
                 </div>
                 <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">بارکۆد</label>
                    <input type="text" value={barcode} onChange={e=>setBarcode(e.target.value)} dir="ltr" className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-pink-500 font-mono text-left" placeholder="بۆ نموونە: 620000000000" />
                 </div>
                 
                 <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">جۆری دراو</label>
                    <div className="flex gap-4">
                       <label className="flex items-center gap-2 cursor-pointer bg-slate-50 border border-slate-200 px-4 py-2 rounded-lg flex-1">
                          <input type="radio" name="currency" value="IQD" checked={currency === 'IQD'} onChange={() => setCurrency('IQD')} className="text-pink-600 focus:ring-pink-500" />
                          <span className="font-bold text-sm">دیناری عێراقی (IQD)</span>
                       </label>
                       <label className="flex items-center gap-2 cursor-pointer bg-slate-50 border border-slate-200 px-4 py-2 rounded-lg flex-1">
                          <input type="radio" name="currency" value="USD" checked={currency === 'USD'} onChange={() => setCurrency('USD')} className="text-pink-600 focus:ring-pink-500" />
                          <span className="font-bold text-sm">دۆلاری ئەمریکی (USD)</span>
                       </label>
                    </div>
                 </div>

                 <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">کەتەگۆری</label>
                    <select required value={category} onChange={e=>setCategory(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-pink-500">
                       {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">کۆمپانیا (بریکار)</label>
                    <input required type="text" list="companies-list" value={company} onChange={e=>setCompany(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-pink-500" />
                    <datalist id="companies-list">
                       {availableCompanies.map(c => <option key={c} value={c} />)}
                    </datalist>
                 </div>

                 <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">تێچوو (دانە)</label>
                    <input required type="number" min="0" step="any" value={unitCost} onChange={e=>setUnitCost(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-pink-500 font-mono text-left" dir="ltr" />
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">نرخی فرۆشتن (دانە)</label>
                    <input required type="number" min="0" step="any" value={unitPrice} onChange={e=>setUnitPrice(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-pink-500 font-mono text-left" dir="ltr" />
                 </div>
                 
                 <div className="col-span-2 sm:col-span-1">
                    <label className="block text-sm font-medium text-slate-700 mb-1">تێچوو (جوملە)</label>
                    <input type="number" min="0" step="any" value={wholesaleCost} onChange={e=>setWholesaleCost(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-pink-500 font-mono text-left" dir="ltr" placeholder="ئارەزوومەندانە" />
                 </div>
                 <div className="col-span-2 sm:col-span-1">
                    <label className="block text-sm font-medium text-slate-700 mb-1">نرخی فرۆشتن (جوملە)</label>
                    <input type="number" min="0" step="any" value={wholesalePrice} onChange={e=>setWholesalePrice(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-pink-500 font-mono text-left" dir="ltr" placeholder="ئارەزوومەندانە" />
                 </div>
                 <div className="col-span-2 sm:col-span-1">
                    <label className="block text-sm font-medium text-slate-700 mb-1">بڕی بەردەست (ستۆک)</label>
                    <input required type="number" min="0" value={stock} onChange={e=>setStock(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-pink-500 font-mono text-left" dir="ltr" />
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
