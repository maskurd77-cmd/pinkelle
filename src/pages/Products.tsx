import { IQDInput } from '../components/IQDInput';
import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  Plus,
  Filter,
  Edit,
  Trash2,
  X,
  Image as ImageIcon,
  Link as LinkIcon,
  Camera,
  Package,
  MapPin,
  AlertTriangle,
  Box,
} from "lucide-react";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { formatCurrency } from "../data";

export default function Products() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedCompany, setSelectedCompany] = useState("all");
  const [stockStatus, setStockStatus] = useState("all");

  const [products, setProducts] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);

  // Form states
  const [name, setName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [category, setCategory] = useState("");
  const [company, setCompany] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [wholesaleCost, setWholesaleCost] = useState("");
  const [wholesalePrice, setWholesalePrice] = useState("");
  const [cartonSize, setCartonSize] = useState("");
  const [stock, setStock] = useState("");
  const [minStockAlert, setMinStockAlert] = useState("");
  const [location, setLocation] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [inputType, setInputType] = useState<"url" | "file">("url");

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
    return products.filter((product) => {
      const matchesSearch =
        (product.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (product.barcode || "").includes(searchTerm);
      const matchesCategory =
        selectedCategory === "all" || product.category === selectedCategory;
      const matchesCompany =
        selectedCompany === "all" || product.company === selectedCompany;
      const stockVal = product.stock || 0;
      const matchesStock =
        stockStatus === "all"
          ? true
          : stockStatus === "low"
            ? stockVal > 0 && stockVal <= 10
            : stockStatus === "out"
              ? stockVal === 0
              : true;

      return matchesSearch && matchesCategory && matchesCompany && matchesStock;
    });
  }, [searchTerm, selectedCategory, selectedCompany, stockStatus, products]);

  const openAddModal = () => {
    setEditingProduct(null);
    setName("");
    setBarcode("");
    setCategory(availableCategories[0] || "");
    setCompany(availableCompanies[0] || "");
    setUnitCost("");
    setUnitPrice("");
    setWholesaleCost("");
    setWholesalePrice("");
    setCartonSize("1");
    setStock("");
    setMinStockAlert("");
    setLocation("");
    setImageUrl("");
    setInputType("url");
    setIsModalOpen(true);
  };

  const openEditModal = (p: any) => {
    setEditingProduct(p);
    setName(p.name || "");
    setBarcode(p.barcode || "");
    setCategory(p.category || "");
    setCompany(p.company || "");
    setUnitCost(p.unitCost ?? "");
    setUnitPrice(p.unitPrice ?? "");
    setWholesaleCost(p.wholesaleCost ?? "");
    setWholesalePrice(p.wholesalePrice ?? "");
    setCartonSize(p.cartonSize ?? "1");
    setStock(p.stock ?? "");
    setMinStockAlert(p.minStockAlert ?? "");
    setLocation(p.location ?? "");
    setImageUrl(p.imageUrl || "");
    setInputType("url");
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("تڵنیایت لە سڕینەوەی ئەم کالایە؟")) {
      await deleteDoc(doc(db, "products", id));
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
      cartonSize: parseInt(cartonSize, 10) || 1,
      stock: parseInt(stock, 10) || 0,
      minStockAlert: minStockAlert ? parseInt(minStockAlert, 10) : 0,
      location,
      imageUrl,
      updatedAt: Timestamp.now(),
    };

    if (editingProduct) {
      await updateDoc(doc(db, "products", editingProduct.id), prodData);
    } else {
      await addDoc(collection(db, "products"), {
        ...prodData,
        createdAt: Timestamp.now(),
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
        const canvas = document.createElement("canvas");
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
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
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
            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2"><Package className='text-pink-600' size={24}/> بەڕێوەبردنی کالاکان
            </h2>
            <div className="flex gap-2">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50 text-slate-600 focus:outline-none focus:ring-1 focus:ring-pink-500"
              >
                <option value="all">هەموو کەتەگۆرییەکان</option>
                {availableCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50 text-slate-600 focus:outline-none focus:ring-1 focus:ring-pink-500"
              >
                <option value="all">هەموو کڕیاران (شەریکەکان)</option>
                {availableCompanies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-48 sm:flex-none">
              <Search
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                size={14}
              />
              <input
                type="text"
                placeholder="گەڕان بۆ ناو یان بارکۆد..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 pr-8 pl-3 text-xs focus:outline-none focus:ring-1 focus:ring-pink-500 transition-all text-slate-700"
              />
            </div>
            <button
              onClick={openAddModal}
              className="px-3 py-1.5 bg-pink-600 text-white rounded-lg text-sm font-medium hover:bg-pink-700 whitespace-nowrap flex items-center gap-1.5 shadow-md shadow-pink-200"
            >
              <Plus size={16} /> کالای نوێ
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar bg-slate-50/50">
          {/* Desktop Table View */}
          <table className="hidden md:table w-full text-right border-collapse min-w-[1000px] bg-white">
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
                const profitPerWholesale = product.wholesalePrice
                  ? product.wholesalePrice - (product.wholesaleCost || pCost)
                  : null;
                const pStock = product.stock || 0;
                const alertLvl = product.minStockAlert || 10;
                const isLowStock = pStock <= alertLvl && pStock > 0;
                const isOutOfStock = pStock === 0;

                return (
                  <tr
                    key={product.id}
                    className={`${isLowStock || isOutOfStock ? "bg-red-50/30 hover:bg-red-50" : "hover:bg-slate-50"} transition-colors`}
                  >
                    <td className="px-6 py-4">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-10 h-10 object-cover rounded-lg border border-slate-200"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
                          <ImageIcon size={20} />
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-900">
                      <div>{product.name}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="text-[10px] text-slate-400 font-mono" dir="ltr">
                          {product.barcode}
                        </div>
                        {product.location && (
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded flex items-center gap-0.5 whitespace-nowrap">
                            <MapPin size={10} /> {product.location}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{product.category}</td>
                    <td className="px-6 py-4 text-slate-600">{product.company}</td>
                    <td className="px-6 py-4 font-mono">
                      <div className="text-slate-600">{formatCurrency(pCost)}</div>
                      {product.wholesaleCost && (
                        <div className="text-xs text-slate-400 mt-1">
                          {formatCurrency(product.wholesaleCost)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono">
                      <div className="text-slate-900">{formatCurrency(pPrice)}</div>
                    </td>
                    <td className="px-6 py-4 font-mono text-pink-600 font-bold">
                      {product.wholesalePrice ? formatCurrency(product.wholesalePrice) : "-"}
                    </td>
                    <td className="px-6 py-4 font-mono">
                      <div className="text-green-600 font-bold">
                        +{formatCurrency(profitPerUnit)}
                      </div>
                      {profitPerWholesale !== null && (
                        <div className="text-xs text-green-500 font-bold mt-1">
                          +{formatCurrency(profitPerWholesale)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          isOutOfStock
                            ? "bg-red-100 text-red-800 font-bold"
                            : isLowStock
                              ? "bg-red-50 text-red-700 font-bold border border-red-200"
                              : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {product.cartonSize && product.cartonSize > 1 ? (
                          <>
                            {Math.floor(pStock / product.cartonSize)} کارتۆن
                            {pStock % product.cartonSize !== 0 && ` و ${pStock % product.cartonSize} دانە`}
                            <span className="text-[10px] text-slate-400 block mt-0.5 border-t border-slate-200 pt-0.5">
                              {pStock} دانە
                            </span>
                          </>
                        ) : (
                          <>{pStock} دانە</>
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => openEditModal(product)}
                          className="text-pink-500 hover:bg-pink-50 p-1.5 rounded transition-colors"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(product.id)}
                          className="text-red-400 hover:bg-red-50 p-1.5 rounded transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-slate-400 bg-white">
                    هیچ کالایەک نەدۆزرایەوە بەم فلتەرانە.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Mobile Card View */}
          <div className="md:hidden flex flex-col gap-3 p-3">
            {filteredProducts.map((product) => {
              const pCost = product.unitCost || 0;
              const pPrice = product.unitPrice || 0;
              const profitPerUnit = pPrice - pCost;
              const pStock = product.stock || 0;
              const alertLvl = product.minStockAlert || 10;
              const isLowStock = pStock <= alertLvl && pStock > 0;
              const isOutOfStock = pStock === 0;

              return (
                <div key={product.id} className={`bg-white rounded-[24px] border border-slate-100 p-4 shadow-sm relative overflow-hidden group hover:shadow-md transition-all`}>
                  <div className="flex gap-4 items-start">
                    {product.imageUrl ? (
                      <div className="w-[85px] h-[85px] rounded-[20px] shadow-sm border border-slate-100/50 flex-shrink-0 overflow-hidden relative bg-slate-50">
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                         {(isOutOfStock || isLowStock) && (
                            <div className={`absolute top-0 right-0 w-full h-full border-[3px] rounded-[20px] pointer-events-none ${isOutOfStock ? 'border-rose-500/80 shadow-inner shadow-rose-500/20' : 'border-orange-400/80'}`}></div>
                         )}
                      </div>
                    ) : (
                      <div className={`w-[85px] h-[85px] rounded-[20px] bg-slate-50 border border-slate-100 flex flex-col items-center justify-center text-slate-300 shrink-0 relative overflow-hidden ${(isOutOfStock || isLowStock) ? 'border-[3px]' : ''} ${isOutOfStock ? 'border-rose-500/80 bg-rose-50/30' : isLowStock ? 'border-orange-400/80 bg-orange-50/30' : ''}`}>
                        <ImageIcon size={26} strokeWidth={1.5} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0 flex flex-col pt-1">
                      <div className="flex justify-between items-start mb-1.5">
                        <h3 className="font-extrabold text-slate-800 text-sm truncate pr-1 leading-tight">{product.name}</h3>
                        <div className="flex gap-1.5 shrink-0">
                          <button onClick={() => openEditModal(product)} className="w-7 h-7 flex items-center justify-center text-pink-500 bg-pink-50 hover:bg-pink-100 rounded-xl transition-colors"><Edit size={14}/></button>
                          <button onClick={() => handleDelete(product.id)} className="w-7 h-7 flex items-center justify-center text-rose-500 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors"><Trash2 size={14}/></button>
                        </div>
                      </div>
                      <div className="text-[10px] font-bold text-slate-400 font-mono mb-2 track-wider bg-slate-50 inline-flex self-start px-2 py-0.5 rounded-lg border border-slate-100" dir="ltr">{product.barcode || "---"}</div>
                      <div className="flex flex-wrap gap-1.5 mt-auto">
                        <span className="text-[10px] font-bold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg truncate max-w-[100px]">{product.category}</span>
                        <span className="text-[10px] font-bold px-2.5 py-1 bg-pink-50 text-pink-600 rounded-lg truncate max-w-[100px]">{product.company}</span>
                        {product.location && <span className="text-[10px] font-bold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg truncate max-w-[100px] flex items-center gap-1"><MapPin size={10} className="text-slate-400" />{product.location}</span>}
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-slate-100">
                    <div className="bg-slate-50 rounded-[16px] p-2.5 border border-slate-100 flex flex-col justify-center">
                      <p className="text-[10px] font-bold text-slate-400 mb-1">فرۆشتن / قازانج</p>
                      <div className="flex items-center gap-2">
                         <p className="font-black text-slate-800 text-[13px]">{formatCurrency(pPrice)}</p>
                         <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-100">+{formatCurrency(profitPerUnit)}</span>
                      </div>
                    </div>

                    <div className={`${isOutOfStock ? 'bg-rose-50 border-rose-100' : isLowStock ? 'bg-orange-50 border-orange-100' : 'bg-slate-50 border-slate-100'} rounded-[16px] p-2.5 border flex flex-col justify-center items-center`}>
                      <span className="text-[10px] font-bold text-slate-400 mb-1">لە کۆگا ماوە</span>
                      <span className={`text-[13px] font-black ${isOutOfStock ? 'text-rose-700' : isLowStock ? 'text-orange-700' : 'text-slate-800'}`}>
                         {product.cartonSize && product.cartonSize > 1 ? (
                            <div className="flex flex-col items-center leading-tight">
                              <div className="flex gap-1 items-baseline">
                                <span>{Math.floor(pStock / product.cartonSize)} <span className="text-[10px] font-bold text-slate-500 opacity-80">کارتۆن</span></span>
                                {pStock % product.cartonSize !== 0 && <span>{pStock % product.cartonSize} <span className="text-[10px] font-bold text-slate-500 opacity-80">دانە</span></span>}
                              </div>
                              <span className="text-[9px] text-slate-400 font-bold opacity-80 border-t border-black/10 pt-0.5 mt-0.5 min-w-[30px] text-center">{pStock}</span>
                            </div>
                         ) : (
                            <>{pStock} دانە</>
                         )}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            {filteredProducts.length === 0 && (
              <div className="text-center py-12 flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-3xl border border-dashed border-slate-200 col-span-2">
                 <Package size={40} className="text-slate-305 mb-3" strokeWidth={1.5} />
                 <p className="text-sm font-bold text-slate-500">هیچ کالایەک نەدۆزرایەوە بەم فلتەرانە</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 transition-all duration-300">
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-t-[32px] sm:rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[90vh] animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300 text-slate-800 border border-slate-100"
            dir="rtl"
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/70 flex justify-between items-center shrink-0 relative overflow-hidden">
              <div className="absolute top-0 right-1/4 w-40 h-40 bg-pink-500/5 rounded-full blur-xl pointer-events-none"></div>
              <div className="absolute bottom-0 left-1/4 w-32 h-32 bg-sky-500/5 rounded-full blur-xl pointer-events-none"></div>
              
              <div className="flex items-center gap-3.5 z-10">
                <div className="w-11 h-11 bg-gradient-to-tr from-pink-500 to-pink-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-pink-500/20">
                  <Package size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 leading-none">
                    {editingProduct ? "دەستکاریکردنی زانیاری کالا" : "تۆمارکردنی نوێی کالا"}
                  </h2>
                  <p className="text-[11px] text-slate-400 font-bold mt-1.5">
                    {editingProduct ? "ڕێکخستن و دەستکاریکردنی نرخ و کۆگای کاڵا" : "زیادکردنی کاڵای نوێ بۆ کۆگا بە زانیاری تەواوەوە"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 bg-white hover:bg-slate-100 hover:text-slate-700 w-9 h-9 flex items-center justify-center rounded-xl transition-all border border-slate-200 shadow-xs active:scale-90"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <div className="p-6 sm:p-8 space-y-7 overflow-y-auto custom-scrollbar pb-[max(calc(env(safe-area-inset-bottom)+1.5rem),1.5rem)] sm:pb-8 bg-white/50">
              
              {/* SECTION A: General Details */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <span className="w-1.5 h-4 bg-pink-500 rounded-full"></span>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">کورتەی کاڵا و وێنە</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                  
                  {/* Photo Section */}
                  <div className="md:col-span-1 flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
                    <label className="block text-xs font-black text-slate-600 mb-2.5 text-center">
                      وێنەی کاڵا
                    </label>
                    
                    {imageUrl ? (
                      <div className="relative group w-28 h-28 rounded-2xl overflow-hidden border border-slate-200 bg-white mb-3 shadow-inner">
                        <img
                          src={imageUrl}
                          alt="بەرچاوینەی کاڵا"
                          className="w-full h-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                        <button
                          type="button"
                          onClick={() => setImageUrl("")}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-all duration-200"
                        >
                          سڕینەوەی وێنە
                        </button>
                      </div>
                    ) : (
                      <div className="w-28 h-28 rounded-2xl border border-dashed border-slate-350 bg-white flex flex-col items-center justify-center text-slate-400 mb-3">
                        <ImageIcon size={28} className="opacity-70 text-slate-400 mb-1" />
                        <span className="text-[10px] font-bold">بێ وێنە</span>
                      </div>
                    )}

                    <div className="flex bg-slate-200/70 rounded-xl p-1 gap-1 w-full">
                      <button
                        type="button"
                        onClick={() => setInputType("url")}
                        className={`flex-1 py-1.5 text-[10px] font-black rounded-lg flex items-center justify-center gap-1 transition-all ${inputType === "url" ? "bg-white shadow-xs text-pink-600 font-extrabold" : "text-slate-500 hover:text-slate-800"}`}
                      >
                        <LinkIcon size={12} /> لینکی وێنە
                      </button>
                      <button
                        type="button"
                        onClick={() => setInputType("file")}
                        className={`flex-1 py-1.5 text-[10px] font-black rounded-lg flex items-center justify-center gap-1 transition-all ${inputType === "file" ? "bg-white shadow-xs text-pink-600 font-extrabold" : "text-slate-500 hover:text-slate-800"}`}
                      >
                        <Camera size={12} /> فایل
                      </button>
                    </div>

                    <div className="w-full mt-2.5">
                      {inputType === "url" ? (
                        <input
                          type="text"
                          value={imageUrl}
                          onChange={(e) => setImageUrl(e.target.value)}
                          dir="ltr"
                          className="w-full bg-white border border-slate-200 rounded-lg py-1 px-2 focus:ring-1 focus:ring-pink-500 outline-none font-mono text-[11px] text-center"
                          placeholder="https://example.com/img.png"
                        />
                      ) : (
                        <label className="relative block w-full py-1 text-center bg-white border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                          <span className="text-[11px] font-bold text-slate-600">هەڵبژاردنی فایل</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageFileChange}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                  </div>

                  {/* General details fields */}
                  <div className="md:col-span-2 space-y-4">
                    <div>
                      <label className="block text-[12px] font-black text-slate-750 mb-1.5">
                        ناوی کالا <span className="text-pink-500">*</span>
                      </label>
                      <input
                        required
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="بۆ نموونە: شامپۆی ئۆلیڤ..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:bg-white focus:ring-2 focus:ring-pink-500/10 focus:border-pink-500 outline-none font-bold text-sm transition-all text-slate-850"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[12px] font-black text-slate-750 mb-1.5">
                          کەتەگۆری <span className="text-pink-500">*</span>
                        </label>
                        <select
                          required
                          value={category}
                          onChange={(e) => setCategory(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:bg-white focus:ring-2 focus:ring-pink-500/10 focus:border-pink-500 outline-none font-bold text-sm transition-all"
                        >
                          {availableCategories.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[12px] font-black text-slate-750 mb-1.5">
                          کۆمپانیا (بریکار) <span className="text-pink-500">*</span>
                        </label>
                        <input
                          required
                          type="text"
                          list="companies-list"
                          value={company}
                          onChange={(e) => setCompany(e.target.value)}
                          placeholder="کۆمپانیای فڵان..."
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:bg-white focus:ring-2 focus:ring-pink-500/10 focus:border-pink-500 outline-none font-bold text-sm transition-all"
                        />
                        <datalist id="companies-list">
                          {availableCompanies.map((c) => (
                            <option key={c} value={c} />
                          ))}
                        </datalist>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[12px] font-black text-slate-755 mb-1.5">
                        بارکۆدی کاڵا (ئارەزوومەندانە)
                      </label>
                      <input
                        type="text"
                        value={barcode}
                        onChange={(e) => setBarcode(e.target.value)}
                        dir="ltr"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:bg-white focus:ring-2 focus:ring-pink-500/10 focus:border-pink-500 outline-none font-mono text-left text-sm font-bold opacity-90 transition-all placeholder:text-slate-350"
                        placeholder="ئەگەر بارکۆدی نییە بە تەنیا ڕێیبدە"
                      />
                    </div>
                  </div>

                </div>
              </div>

              {/* SECTION B: Pricing */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <span className="w-1.5 h-4 bg-emerald-500 rounded-full"></span>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">سیاسەتی نرخ و گۆڕینەوە</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  
                  {/* Unit Sale segment */}
                  <div className="p-4 rounded-2xl border border-slate-150 bg-slate-50/20 space-y-3.5">
                    <span className="text-[11px] font-extrabold text-slate-400 block bg-slate-100 px-2 py-0.5 rounded max-w-fit">فرۆشتنی بە تاڵ (دانە)</span>
                    
                    <div className="space-y-1">
                      <label className="block text-[11px] font-black text-slate-700">تێچووی دانە (USD) <span className="text-pink-500">*</span></label>
                      <input
                        required
                        type="number"
                        min="0"
                        step="any"
                        value={unitCost}
                        onChange={(e) => setUnitCost(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-pink-500 font-mono text-left"
                        dir="ltr"
                      />
                      <IQDInput usdValue={unitCost} setUsdValue={(val) => setUnitCost(val.toString())} label="کۆی گشتی بە دینار" />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-black text-slate-700">نرخی فرۆشتنی دانە (USD) <span className="text-pink-500">*</span></label>
                      <input
                        required
                        type="number"
                        min="0"
                        step="any"
                        value={unitPrice}
                        onChange={(e) => setUnitPrice(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-pink-500 font-mono text-left"
                        dir="ltr"
                      />
                      <IQDInput usdValue={unitPrice} setUsdValue={(val) => setUnitPrice(val.toString())} label="کۆی گشتی بە دینار" />
                    </div>
                  </div>

                  {/* Wholesale segment */}
                  <div className="p-4 rounded-2xl border border-slate-150 bg-slate-50/20 space-y-3.5">
                    <span className="text-[11px] font-extrabold text-slate-400 block bg-slate-100 px-2 py-0.5 rounded max-w-fit">فرۆشتنی بە جوملە</span>
                    
                    <div className="space-y-1">
                      <label className="block text-[11px] font-black text-slate-700">تێچووی جوملە (USD)</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={wholesaleCost}
                        onChange={(e) => setWholesaleCost(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-pink-500 font-mono text-left"
                        dir="ltr"
                        placeholder="ئارەزوومەندانە"
                      />
                      <IQDInput usdValue={wholesaleCost} setUsdValue={(val) => setWholesaleCost(val.toString())} label="کۆی گشتی بە دینار" />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-black text-slate-700">نرخی فرۆشتنی جوملە (USD)</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={wholesalePrice}
                        onChange={(e) => setWholesalePrice(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-pink-500 font-mono text-left"
                        dir="ltr"
                        placeholder="ئارەزوومەندانە"
                      />
                      <IQDInput usdValue={wholesalePrice} setUsdValue={(val) => setWholesalePrice(val.toString())} label="کۆی گشتی بە دینار" />
                    </div>
                  </div>

                </div>
              </div>

              {/* SECTION C: Inventory Configurations */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <span className="w-1.5 h-4 bg-amber-500 rounded-full"></span>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">کۆگا و شوێنی کالا</h3>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden flex flex-col">
                  <div className="bg-slate-50/80 border-b border-slate-200/80 px-5 py-3">
                    <h4 className="text-xs font-black text-slate-750 flex items-center gap-2">
                      <Package className="text-pink-600" size={16} />
                      ڕێکخستنی ستۆک و بەردەستبوون
                    </h4>
                  </div>
                  
                  <div className="p-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-5">
                      {/* Shelf / Alert level */}
                      <div className="space-y-4">
                        <div>
                          <label className="block text-[11px] font-black text-slate-700 mb-1.5 flex items-center gap-1.5">
                            <MapPin size={14} className="text-slate-400" /> شوێن یان ژمارەی ڕەفە
                          </label>
                          <input
                            type="text"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            className="w-full bg-slate-50 hover:bg-slate-100/50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:bg-white focus:ring-1 focus:ring-pink-550 outline-none text-xs sm:text-sm transition-all"
                            placeholder="بۆ نموونە: کۆگای سەرەکی - ڕەفەی ۳"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-black text-slate-705 mb-1.5 flex items-center gap-1.5">
                            <AlertTriangle size={14} className="text-amber-500" /> کەمترین ڕێژەی ئاگادارکردنەوەی ستۆک
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={minStockAlert}
                            onChange={(e) => setMinStockAlert(e.target.value)}
                            className="w-full bg-slate-50 hover:bg-slate-100/50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:bg-white focus:ring-1 focus:ring-amber-500 outline-none font-mono text-left font-bold transition-all text-xs sm:text-sm"
                            dir="ltr"
                            placeholder="مەسالەن: 10"
                          />
                        </div>
                      </div>

                      {/* Box config and dynamic calc */}
                      <div className="space-y-4 bg-slate-50/70 p-4.5 rounded-2xl border border-slate-200">
                        <div>
                          <label className="block text-[11px] font-black text-slate-700 mb-1.5 flex items-center gap-1.5">
                            <Box size={14} className="text-pink-500" /> یەک کارتۆن چەند دانەیە؟
                          </label>
                          <div className="relative">
                            <input
                              required
                              type="number"
                              min="1"
                              value={cartonSize}
                              onChange={(e) => setCartonSize(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-3 outline-none focus:border-pink-400 focus:ring-1 focus:ring-pink-400 font-mono font-black text-pink-700 text-left"
                              dir="ltr"
                            />
                            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">دانەی کارتۆنی</span>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-200/60">
                          <div>
                            <label className="block text-[10px] font-black text-slate-450 mb-1.5 text-center">بۆکس / کارتۆن</label>
                            <input
                              type="number"
                              min="0"
                              value={cartonSize ? Math.floor((parseInt(stock, 10) || 0) / (parseInt(cartonSize, 10) || 1)) : 0}
                              onChange={(e) => {
                                const cVal = parseInt(e.target.value, 10) || 0;
                                const cSize = parseInt(cartonSize, 10) || 1;
                                const pVal = (parseInt(stock, 10) || 0) % cSize;
                                setStock((cVal * cSize + pVal).toString());
                              }}
                              className="w-full bg-white border border-slate-200 hover:border-pink-300 rounded-xl px-2 py-2 outline-none focus:ring-1 focus:ring-pink-400 font-mono text-center font-black text-slate-800 text-base"
                              dir="ltr"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-black text-slate-450 mb-1.5 text-center">دانەی ماوە (زیادە)</label>
                            <input
                              type="number"
                              min="0"
                              value={cartonSize ? (parseInt(stock, 10) || 0) % (parseInt(cartonSize, 10) || 1) : parseInt(stock, 10) || 0}
                              onChange={(e) => {
                                const pVal = parseInt(e.target.value, 10) || 0;
                                const cSize = parseInt(cartonSize, 10) || 1;
                                const cVal = Math.floor((parseInt(stock, 10) || 0) / cSize);
                                setStock((cVal * cSize + pVal).toString());
                              }}
                              className="w-full bg-white border border-slate-200 hover:border-pink-300 rounded-xl px-2 py-2 outline-none focus:ring-1 focus:ring-pink-400 font-mono text-center font-black text-slate-800 text-base"
                              dir="ltr"
                            />
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* Overall feedback strip */}
                    <div className="bg-pink-50 border border-pink-100 rounded-xl p-3 flex items-center justify-between shadow-xs">
                      <span className="text-xs font-black text-pink-805">کۆی گشتی ستۆکی هەژمارکراو:</span>
                      <div className="text-lg font-black font-mono text-pink-700 bg-white px-3.5 py-1 rounded-lg border border-pink-200 shadow-xs flex items-baseline gap-1 animate-pulse">
                        {stock || 0} <span className="text-[10px] font-bold text-pink-400 font-sans">دانە</span>
                      </div>
                    </div>

                  </div>
                </div>
              </div>

            </div>

            {/* Footer Form Actions */}
            <div className="px-6 py-4.5 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 shrink-0 pb-[max(calc(env(safe-area-inset-bottom)+1rem),1rem)]">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2.5 text-slate-500 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs sm:text-sm font-black transition-all hover:scale-102 active:scale-95"
              >
                پاشگەزبوونەوە
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-pink-600 hover:bg-pink-500 text-white rounded-xl text-xs sm:text-sm font-black shadow-md shadow-pink-600/10 transition-all hover:scale-102 active:scale-95 flex items-center gap-1.5 justify-center"
              >
                <Plus size={16} /> پاشەکەوتکردن
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
