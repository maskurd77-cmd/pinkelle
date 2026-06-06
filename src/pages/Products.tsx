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
          <div className="md:hidden flex flex-col gap-3 p-4">
            {filteredProducts.map((product) => {
              const pCost = product.unitCost || 0;
              const pPrice = product.unitPrice || 0;
              const profitPerUnit = pPrice - pCost;
              const pStock = product.stock || 0;
              const alertLvl = product.minStockAlert || 10;
              const isLowStock = pStock <= alertLvl && pStock > 0;
              const isOutOfStock = pStock === 0;

              return (
                <div key={product.id} className={`bg-white rounded-2xl border ${isOutOfStock ? 'border-red-200' : isLowStock ? 'border-orange-200' : 'border-slate-200'} p-4 shadow-sm relative overflow-hidden`}>
                  {(isOutOfStock || isLowStock) && (
                    <div className={`absolute top-0 right-0 w-2 h-full ${isOutOfStock ? 'bg-red-500' : 'bg-orange-400'}`}></div>
                  )}
                  <div className="flex gap-4 items-start">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-16 h-16 object-cover rounded-xl border border-slate-100 shrink-0"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300 shrink-0">
                        <ImageIcon size={24} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <h3 className="font-bold text-slate-900 truncate pr-2">{product.name}</h3>
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => openEditModal(product)} className="p-1.5 text-pink-500 bg-pink-50 rounded-lg"><Edit size={14}/></button>
                          <button onClick={() => handleDelete(product.id)} className="p-1.5 text-red-500 bg-red-50 rounded-lg"><Trash2 size={14}/></button>
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mb-2" dir="ltr">{product.barcode || "بێ بارکۆد"}</div>
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md truncate max-w-[100px]">{product.category}</span>
                        <span className="text-[10px] px-2 py-0.5 bg-pink-50 text-pink-600 rounded-md truncate max-w-[100px]">{product.company}</span>
                        {product.location && <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md truncate max-w-[100px] flex items-center gap-0.5"><MapPin size={10} />{product.location}</span>}
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 mt-2 pt-3 border-t border-slate-100">
                    <div>
                      <p className="text-[10px] text-slate-400 mb-0.5">بەهای فرۆشتن</p>
                      <p className="font-bold font-mono text-slate-800">{formatCurrency(pPrice)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 mb-0.5">قازانج</p>
                      <p className="font-bold font-mono text-green-600">+{formatCurrency(profitPerUnit)}</p>
                    </div>
                    <div className="col-span-2 flex items-center justify-between bg-slate-50 rounded-lg p-2 mt-1">
                      <span className="text-xs font-medium text-slate-600">لە کۆگا ماوە:</span>
                      <span className={`text-sm font-bold font-mono px-2 py-0.5 rounded ${isOutOfStock ? 'bg-red-100 text-red-700' : isLowStock ? 'bg-orange-100 text-orange-700' : 'text-slate-700'}`}>
                        {pStock} دانە
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            {filteredProducts.length === 0 && (
              <div className="text-center py-10 text-slate-400 bg-white rounded-2xl border border-slate-200">
                هیچ کالایەک نەدۆزرایەوە بەم فلتەرانە.
              </div>
            )}
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-t-[32px] sm:rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[90vh] animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200"
          >
            <div className="px-5 sm:px-8 py-5 border-b border-slate-100 bg-white flex justify-between items-center shrink-0">
              <h2 className="text-xl font-extrabold text-slate-800">
                {editingProduct ? "دەستکاریکردنی کالا" : "زیادکردنی کالای نوێ"}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 bg-slate-50 hover:bg-slate-200 hover:text-slate-700 w-10 h-10 flex items-center justify-center rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 sm:p-8 space-y-6 overflow-y-auto custom-scrollbar pb-[max(calc(env(safe-area-inset-bottom)+1rem),1rem)] sm:pb-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
                <div className="col-span-1 sm:col-span-2">
                  <div className="flex justify-between items-center">
                    <label className="block text-sm font-medium text-slate-700">
                      وێنەی کالا
                    </label>
                    <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
                      <button
                        type="button"
                        onClick={() => setInputType("url")}
                        className={`px-3 py-1 text-xs font-bold rounded-md flex items-center gap-1 ${inputType === "url" ? "bg-white shadow-sm text-pink-600" : "text-slate-500"}`}
                      >
                        <LinkIcon size={14} /> هەواڵە / بەستەر
                      </button>
                      <button
                        type="button"
                        onClick={() => setInputType("file")}
                        className={`px-3 py-1 text-xs font-bold rounded-md flex items-center gap-1 ${inputType === "file" ? "bg-white shadow-sm text-pink-600" : "text-slate-500"}`}
                      >
                        <Camera size={14} /> فایلی وێنە
                      </button>
                    </div>
                  </div>
                  {inputType === "url" ? (
                    <input
                      type="text"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      dir="ltr"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-pink-500 font-mono text-left text-sm"
                      placeholder="https://example.com/image.png"
                    />
                  ) : (
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageFileChange}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
                    />
                  )}
                  {imageUrl && (
                    <div className="mt-2 text-center">
                      <img
                        src={imageUrl}
                        alt="بەرچاوینەی وێنە"
                        className="max-h-32 rounded-lg border border-slate-200 mx-auto object-contain"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}
                </div>

                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    ناوی کالا
                  </label>
                  <input
                    required
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-pink-500"
                  />
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    بارکۆد
                  </label>
                  <input
                    type="text"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    dir="ltr"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-pink-500 font-mono text-left text-sm"
                    placeholder="بۆ نموونە: 620000000000"
                  />
                </div>

                <div className="col-span-1 sm:col-span-1">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    کەتەگۆری
                  </label>
                  <select
                    required
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-pink-500"
                  >
                    {availableCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-1 sm:col-span-1">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    کۆمپانیا (بریکار)
                  </label>
                  <input
                    required
                    type="text"
                    list="companies-list"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-pink-500"
                  />
                  <datalist id="companies-list">
                    {availableCompanies.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    تێچوو (دانە)
                  </label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="any"
                    value={unitCost}
                    onChange={(e) => setUnitCost(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-pink-500 font-mono text-left"
                    dir="ltr"
                  /> 
                  <IQDInput usdValue={unitCost} setUsdValue={(val) => setUnitCost(val.toString())} />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    نرخی فرۆشتن (دانە)
                  </label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="any"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-pink-500 font-mono text-left"
                    dir="ltr"
                  /> 
                  <IQDInput usdValue={unitPrice} setUsdValue={(val) => setUnitPrice(val.toString())} />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    تێچوو (جوملە)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={wholesaleCost}
                    onChange={(e) => setWholesaleCost(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-pink-500 font-mono text-left"
                    dir="ltr"
                    placeholder="ئارەزوومەندانە"
                  /> 
                  <IQDInput usdValue={wholesaleCost} setUsdValue={(val) => setWholesaleCost(val.toString())} />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    نرخی فرۆشتن (جوملە)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={wholesalePrice}
                    onChange={(e) => setWholesalePrice(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-pink-500 font-mono text-left"
                    dir="ltr"
                    placeholder="ئارەزوومەندانە"
                  /> 
                  <IQDInput usdValue={wholesalePrice} setUsdValue={(val) => setWholesalePrice(val.toString())} />
                </div>
                                <div className="col-span-2">
                  <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
                    <div className="bg-slate-50 border-b border-slate-200 px-4 py-3">
                      <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <Package className="text-pink-500" size={18} />
                        ڕێکخستنی ستۆک و بەردەستبوون
                      </h4>
                    </div>
                    
                    <div className="p-4 sm:p-5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
                        {/* Shelf / Alert */}
                        <div className="space-y-4">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                              <MapPin size={14} className="text-slate-400"/> شوێن / ڕەفە
                            </label>
                            <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} className="w-full bg-slate-50 hover:bg-white border border-slate-200 rounded-lg px-3 py-2.5 focus:ring-1 focus:ring-pink-500 outline-none text-sm transition-colors" placeholder="کۆگای A - ڕەفەی 2" />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                              <AlertTriangle size={14} className="text-amber-500"/> کەمترین ڕێژەی ستۆک بۆ ئاگادارکردنەوە
                            </label>
                            <div className="relative">
                              <input type="number" min="0" value={minStockAlert} onChange={(e) => setMinStockAlert(e.target.value)} className="w-full bg-slate-50 hover:bg-white border border-slate-200 rounded-lg px-3 py-2.5 focus:ring-1 focus:ring-amber-500 outline-none font-mono text-left transition-colors" dir="ltr" placeholder="10" />
                            </div>
                          </div>
                        </div>

                        {/* Inventory */}
                        <div className="space-y-4 bg-slate-50/50 p-4 rounded-xl border border-slate-200">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                              <Box size={14} className="text-pink-500"/> یەک کارتۆن چەند دانەیە؟
                            </label>
                            <div className="relative">
                              <input required type="number" min="1" value={cartonSize} onChange={(e) => setCartonSize(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 outline-none focus:border-pink-400 focus:ring-1 focus:ring-pink-400 font-mono font-bold text-pink-700 text-left" dir="ltr" />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">دانە</span>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-200/60">
                             <div>
                               <label className="block text-[10px] font-bold text-slate-500 mb-1 text-center">کارتۆن</label>
                               <input type="number" min="0" value={cartonSize ? Math.floor((parseInt(stock, 10) || 0) / (parseInt(cartonSize, 10) || 1)) : 0} onChange={(e) => { const cVal = parseInt(e.target.value, 10) || 0; const cSize = parseInt(cartonSize, 10) || 1; const pVal = (parseInt(stock, 10) || 0) % cSize; setStock((cVal * cSize + pVal).toString()); }} className="w-full bg-white border border-slate-200 hover:border-pink-300 rounded-lg px-2 py-2 outline-none focus:ring-1 focus:ring-pink-400 font-mono text-center font-bold text-slate-800 text-lg" dir="ltr" />
                            </div>
                            <div>
                               <label className="block text-[10px] font-bold text-slate-500 mb-1 text-center">دانە (بەتاڵ)</label>
                               <input type="number" min="0" value={cartonSize ? (parseInt(stock, 10) || 0) % (parseInt(cartonSize, 10) || 1) : parseInt(stock, 10) || 0} onChange={(e) => { const pVal = parseInt(e.target.value, 10) || 0; const cSize = parseInt(cartonSize, 10) || 1; const cVal = Math.floor((parseInt(stock, 10) || 0) / cSize); setStock((cVal * cSize + pVal).toString()); }} className="w-full bg-white border border-slate-200 hover:border-pink-300 rounded-lg px-2 py-2 outline-none focus:ring-1 focus:ring-pink-400 font-mono text-center font-bold text-slate-800 text-lg" dir="ltr" />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-pink-50 border border-pink-100 rounded-xl p-3 flex items-center justify-between">
                         <span className="text-xs font-bold text-pink-800">کۆی گشتی ستۆک لە کۆگا:</span>
                         <div className="text-xl font-black font-mono text-pink-700 bg-white px-3 py-1 rounded-lg border border-pink-200 shadow-sm flex items-baseline gap-1">
                           {stock || 0} <span className="text-[10px] font-bold text-pink-400 font-sans">دانە</span>
                         </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-5 sm:px-8 py-4 sm:py-5 bg-white border-t border-slate-100 flex justify-end gap-3 shrink-0 pb-[max(calc(env(safe-area-inset-bottom)+1rem),1rem)] sm:pb-5">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2.5 sm:py-3 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-bold transition-colors w-full sm:w-auto"
              >
                پاشگەزبوونەوە
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 sm:py-3 bg-pink-600 text-white hover:bg-pink-700 rounded-xl text-sm font-bold transition-all w-full sm:w-auto shadow-md shadow-pink-200 shadow-b active:scale-95 flex items-center justify-center gap-2"
              >
                <Plus size={18} /> پاشەکەوتکردن
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
