import React, { useState, useMemo, useEffect } from 'react';
import { Search, ShoppingCart, Plus, Minus, Trash2, Store, Phone, MapPin, Receipt, CheckCircle2, X, Box, FileText, CreditCard, Banknote, History } from 'lucide-react';
import { formatCurrency } from '../data';
import { Product } from '../types';
import { collection, onSnapshot, getDocs, doc, writeBatch, Timestamp, query, where, limit, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import LocationPickerModal from '../components/LocationPickerModal';
import { MapIcon } from 'lucide-react';

interface CartItem extends Product {
  quantity: number;
  originalUnitPrice?: number;
  editedPrice?: number;
}

export default function POS() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isWholesale, setIsWholesale] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [customerDetails, setCustomerDetails] = useState({
    shopName: '',
    phone: '',
    address: '',
    locationUrl: '',
    lat: null as number | null,
    lng: null as number | null,
    notes: '',
    paymentType: 'cash'
  });
  const [saleCompleted, setSaleCompleted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [currentReceiptId, setCurrentReceiptId] = useState<string | null>(null);

  const [customers, setCustomers] = useState<any[]>([]);
  const [exchangeRate, setExchangeRate] = useState<number>(1500);
  const [mandubName, setMandubName] = useState('مەندوب');
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [userRole, setUserRole] = useState<string>('');

  useEffect(() => {
    if (auth.currentUser) {
      getDoc(doc(db, 'users', auth.currentUser.uid)).then((snap) => {
         if (snap.exists()) {
            const data = snap.data();
            if (data.name) setMandubName(data.name);
            if (data.permissions) setUserPermissions(data.permissions);
            if (data.role) setUserRole(data.role);
         }
      });
    }
  }, []);

  const [debts, setDebts] = useState<any[]>([]);
  const [discountType, setDiscountType] = useState<'amount'|'percentage'>('amount');
  const [discountValue, setDiscountValue] = useState<number|''>('');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'products'), (snap) => {
      const data = snap.docs.map(t => ({ id: t.id, ...t.data() } as Product));
      setProducts(data);
      const uniqueCats = Array.from(new Set(data.map(p => p.category).filter(Boolean))) as string[];
      setCategories(uniqueCats);
    });
    const unsubCus = onSnapshot(collection(db, 'customers'), (snap) => {
      setCustomers(snap.docs.map(t => ({ id: t.id, ...t.data() })));
    });
    const unsubSettings = onSnapshot(doc(db, 'system', 'settings'), (snap) => {
      if (snap.exists() && snap.data().exchangeRate) {
         setExchangeRate(snap.data().exchangeRate);
      }
    });
    const unsubDebts = onSnapshot(collection(db, 'debts'), (snap) => {
      setDebts(snap.docs.map(t => ({ id: t.id, ...t.data() })));
    });
    return () => { unsub(); unsubCus(); unsubSettings(); unsubDebts(); };
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
      if (searchTerm) {
        return p.name.includes(searchTerm) || (p.barcode && p.barcode.includes(searchTerm));
      }
      return true;
    });
  }, [searchTerm, selectedCategory, products]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1} : item);
      }
      return [...prev, { ...product, quantity: 1, originalUnitPrice: product.unitPrice }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQ = item.quantity + delta;
        if (newQ > 0 && newQ <= item.stock) {
          return { ...item, quantity: newQ };
        }
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };
  
  const updateItemPrice = (id: string, newPrice: number) => {
    setCart(prev => prev.map(item => item.id === id ? { ...item, editedPrice: newPrice } : item));
  };

  const clearCart = () => setCart([]);

  const subtotal = cart.reduce((sum, item) => {
     let applicablePrice;
     if (item.editedPrice !== undefined) {
         applicablePrice = item.editedPrice;
     } else {
         applicablePrice = isWholesale ? (item.wholesalePrice || item.unitPrice) : item.unitPrice;
     }
     const priceInIQD = item.currency === 'USD' ? applicablePrice * exchangeRate : applicablePrice;
     return sum + (priceInIQD * item.quantity);
  }, 0);
  
  const discountAmount = discountType === 'amount' ? (Number(discountValue) || 0) : (subtotal * (Number(discountValue) || 0) / 100);
  const total = Math.max(0, subtotal - discountAmount);
  const cartItemCount = cart.reduce((s, i) => s + i.quantity, 0);

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;
    
    setIsProcessing(true);
    try {
      const batch = writeBatch(db);
      
      const isPending = userRole !== 'admin' && userRole !== 'accountant';
      
      const receiptRef = doc(collection(db, 'receipts'));
      batch.set(receiptRef, {
        customerName: customerDetails.shopName || 'کڕیاری گشتی',
        phone: customerDetails.phone || '',
        address: customerDetails.address || '',
        notes: customerDetails.notes || '',
        paymentType: customerDetails.paymentType,
        sellerName: mandubName,
        exchangeRate,
        isWholesale,
        status: isPending ? 'pending' : 'completed',
        items: cart.map(c => {
           let applicablePrice;
           if (c.editedPrice !== undefined) {
               applicablePrice = c.editedPrice;
           } else {
               applicablePrice = isWholesale ? (c.wholesalePrice || c.unitPrice) : c.unitPrice;
           }
           const priceInIQD = c.currency === 'USD' ? applicablePrice * exchangeRate : applicablePrice;
           const originalBasePrice = isWholesale ? (c.wholesalePrice || c.unitPrice) : c.unitPrice;
           const originalPriceInIQD = c.currency === 'USD' ? originalBasePrice * exchangeRate : originalBasePrice;
           const costInIQD = c.currency === 'USD' ? (c.unitCost || 0) * exchangeRate : (c.unitCost || 0);
           return {
             productId: c.id,
             name: c.name,
             quantity: c.quantity,
             currency: c.currency || 'IQD',
             originalUnitPrice: originalPriceInIQD,
             originalUnitCost: c.unitCost || 0,
             unitPrice: priceInIQD,
             isWholesale: isWholesale && Boolean(c.wholesalePrice),
             unitCost: costInIQD,
             category: c.category || 'گشتی',
             stock: c.stock,
             total: priceInIQD * c.quantity
           }
        }),
        totalItems: cartItemCount,
        subtotal: subtotal,
        discountAmount: discountAmount,
        totalAmount: total, // IQD
        timestamp: Timestamp.now()
      });

      if (!isPending) {
        // Update stocks
        cart.forEach(item => {
          const ref = doc(db, 'products', item.id);
          batch.update(ref, { stock: item.stock - item.quantity });
        });

        // Handle Debt if paymentType is 'debt' (قەرز)
        if (customerDetails.paymentType === 'debt' && total > 0 && customerDetails.shopName) {
             const existingDebt = debts.find(d => d.customerName === customerDetails.shopName && d.status === 'active');
             if (existingDebt) {
               const debtRef = doc(db, 'debts', existingDebt.id);
               batch.update(debtRef, {
                 amount: (existingDebt.amount || 0) + total,
                 remainingAmount: (existingDebt.remainingAmount || 0) + total,
                 updatedAt: Timestamp.now()
               });
               
               const debtTxRef = doc(collection(db, 'debt_transactions'));
               batch.set(debtTxRef, {
                 debtId: existingDebt.id,
                 amount: total,
                 type: 'add',
                 timestamp: Timestamp.now(),
                 notes: 'زیادبوونی قەرز لە وەسڵی ژمارە: ' + receiptRef.id.slice(-8).toUpperCase()
               });
             } else {
               const debtRef = doc(collection(db, 'debts'));
               batch.set(debtRef, {
                 customerName: customerDetails.shopName,
                 phone: customerDetails.phone,
                 amount: total,
                 remainingAmount: total,
                 status: 'active',
                 notes: 'پاشماوەی وەسڵ: ' + receiptRef.id.slice(-8).toUpperCase(),
                 timestamp: Timestamp.now()
               });
               
               const debtTxRef = doc(collection(db, 'debt_transactions'));
               batch.set(debtTxRef, {
                 debtId: debtRef.id,
                 amount: total,
                 type: 'add',
                 timestamp: Timestamp.now(),
                 notes: 'قەرزی نوێ لە وەسڵی ژمارە: ' + receiptRef.id.slice(-8).toUpperCase()
               });
             }
        }
      }

      // Save customer if new
      if (customerDetails.shopName) {
         const existingCus = customers.find(c => c.name === customerDetails.shopName);
         if (existingCus) {
            batch.update(doc(db, 'customers', existingCus.id), {
               phone: customerDetails.phone || existingCus.phone || '',
               address: customerDetails.address || existingCus.address || '',
               locationUrl: customerDetails.locationUrl || existingCus.locationUrl || '',
               lat: customerDetails.lat || existingCus.lat || null,
               lng: customerDetails.lng || existingCus.lng || null,
               lastPurchase: Timestamp.now()
            });
         } else {
            const cusRef = doc(collection(db, 'customers'));
            batch.set(cusRef, {
               name: customerDetails.shopName,
               phone: customerDetails.phone || '',
               address: customerDetails.address || '',
               locationUrl: customerDetails.locationUrl || '',
               lat: customerDetails.lat || null,
               lng: customerDetails.lng || null,
               createdAt: Timestamp.now(),
               lastPurchase: Timestamp.now()
            });
         }
      }

      await batch.commit();
      
      setCurrentReceiptId(receiptRef.id);
      setSaleCompleted(true);
      
    } catch (error) {
      console.error(error);
      alert('هەڵەیەک ڕوویدا لە کاتی فرۆشتن.');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetPOS = () => {
    setCart([]);
    setCustomerDetails({ shopName: '', phone: '', address: '', notes: '', paymentType: 'cash' });
    setSaleCompleted(false);
    setCheckoutModalOpen(false);
    setMobileCartOpen(false);
    setCurrentReceiptId(null);
  };

  return (
    <div className="flex flex-col lg:flex-row h-full gap-4 lg:gap-6 overflow-hidden relative">
      
      {/* LEFT / MAIN AREA: Products */}
      <div className="flex-1 flex flex-col bg-slate-50/50 lg:bg-white lg:rounded-[24px] lg:border border-slate-200 shadow-sm overflow-hidden h-full -mx-3 sm:mx-0">
        <div className="p-3 lg:p-5 border-b border-slate-200/60 bg-white flex flex-col gap-3 shrink-0 shadow-sm z-10 sticky top-0">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full">
            <div className="relative flex-1">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="گەڕان بۆ کالا یان بارکۆد..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pr-11 pl-4 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all font-medium text-slate-800"
              />
            </div>
            {/* Mobile Wholesale Toggle */}
            <div className="lg:hidden flex items-center bg-slate-100 p-1.5 rounded-xl border border-slate-200/60 shadow-inner h-[46px]">
               <button 
                  onClick={() => setIsWholesale(false)} 
                  className={`px-4 py-1.5 text-sm font-extrabold rounded-lg transition-all duration-200 flex-1 text-center h-full flex items-center justify-center ${!isWholesale ? 'bg-white shadow-sm text-slate-800 scale-100 ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-700 scale-95 hover:bg-slate-200/50'}`}>تاک (Retail)</button>
               <button 
                  onClick={() => setIsWholesale(true)} 
                  className={`px-4 py-1.5 text-sm font-extrabold rounded-lg transition-all duration-200 flex-1 text-center h-full flex items-center justify-center ${isWholesale ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20 scale-100' : 'text-slate-500 hover:text-slate-700 scale-95 hover:bg-slate-200/50'}`}>جوملە (Wholesale)</button>
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1 sm:pb-0 hide-scrollbar -mx-3 px-3 sm:mx-0 sm:px-0">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-5 py-2.5 shrink-0 rounded-xl text-sm font-bold transition-all ${selectedCategory === 'all' ? 'bg-pink-600 text-white shadow-md shadow-pink-500/20 transform scale-[1.02]' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 active:scale-95'}`}
            >
              هەمووی
            </button>
            {categories.map(c => (
              <button
                key={c}
                onClick={() => setSelectedCategory(c)}
                className={`px-5 py-2.5 shrink-0 rounded-xl text-sm font-bold transition-all ${selectedCategory === c ? 'bg-pink-600 text-white shadow-md shadow-pink-500/20 transform scale-[1.02]' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 active:scale-95'}`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 lg:p-5 custom-scrollbar bg-slate-50/50 pb-28 lg:pb-5">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 lg:gap-4">
            {filteredProducts.map(product => {
              const inCart = cart.find(c => c.id === product.id)?.quantity || 0;
              const isMaxQ = inCart >= product.stock;
              
              return (
                <div 
                  key={product.id}
                  onClick={() => !isMaxQ && addToCart(product)}
                  className={`group bg-white rounded-2xl lg:rounded-[20px] border ${isMaxQ ? 'border-orange-200/60 opacity-80' : 'border-slate-200/80 hover:border-pink-300 hover:shadow-xl hover:shadow-pink-500/10 hover:-translate-y-1'} p-3 cursor-pointer transition-all duration-300 flex flex-col h-full relative overflow-hidden`}
                >
                  <div className="w-full aspect-square bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-xl mb-3.5 flex items-center justify-center text-slate-300 group-hover:bg-pink-50/50 group-hover:text-pink-400 transition-colors shrink-0 overflow-hidden relative border border-slate-100">
                    {product.imageUrl ? (
                       <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" referrerPolicy="no-referrer" />
                    ) : (
                       <Box size={36} strokeWidth={1.5} />
                    )}
                  </div>
                  <h3 className="text-[13px] sm:text-sm font-bold text-slate-800 leading-snug mb-1.5 line-clamp-2">{product.name}</h3>
                  <p className="text-[10px] text-slate-500 mb-2 truncate font-medium">{product.company} • {product.category}</p>
                  
                  <div className="mt-auto flex items-end justify-between pt-2">
                    <div>
                      <p className="text-[10px] text-slate-400 mb-0.5 font-medium">نرخ {isWholesale ? '(جوملە)' : '(تاک)'}</p>
                      <p className={`${isWholesale ? 'text-indigo-600' : 'text-pink-600'} font-extrabold font-mono text-sm tracking-tight`}>{formatCurrency(isWholesale ? (product.wholesalePrice || product.unitPrice) : product.unitPrice, product.currency)}</p>
                    </div>
                  </div>
                  
                  {/* Stock Indicator */}
                  <div className={`absolute top-2.5 left-2.5 text-[10px] font-bold px-2 py-0.5 rounded-lg backdrop-blur-sm shadow-sm border ${isMaxQ ? 'bg-orange-100/90 text-orange-700 border-orange-200' : 'bg-white/90 text-slate-600 border-slate-200'}`}>
                    {product.stock} دانە
                  </div>
                  
                  {inCart > 0 && (
                    <div className="absolute top-2.5 right-2.5 w-6 h-6 bg-pink-600 text-white rounded-lg flex items-center justify-center text-xs font-bold shadow-md shadow-pink-500/30 transform scale-in-center">
                      {inCart}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {filteredProducts.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
              <Box size={48} strokeWidth={1} />
              <p>هیچ کالایەک نەدۆزرایەوە.</p>
            </div>
          )}
        </div>
      </div>

      {/* MOBILE CART BUTTON (Floating) */}
      <div className="lg:hidden fixed bottom-[90px] left-4 right-4 z-40 print:hidden">
        <button 
          onClick={() => setMobileCartOpen(true)}
          className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold text-[15px] flex items-center justify-between px-6 shadow-xl shadow-slate-900/20 active:scale-[0.98] transition-transform backdrop-blur-md bg-opacity-95"
        >
          <div className="flex items-center gap-3">
            <div className="relative">
               <ShoppingCart size={22} />
               <div className="absolute -top-2 -right-2 w-5 h-5 bg-pink-600 rounded-full flex items-center justify-center text-[10px] font-bold">
                 {cartItemCount}
               </div>
            </div>
            <span>بینینی پسوولە</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="font-mono text-lg tracking-tight">{formatCurrency(total)}</span>
            <span className={`text-[10px] font-bold tracking-widest ${isWholesale ? 'text-indigo-400' : 'text-pink-400'}`}>
               {isWholesale ? 'جوملە (WHOLESALE)' : 'تاک (RETAIL)'}
            </span>
          </div>
        </button>
      </div>

      {/* RIGHT AREA: Cart Sidebar (Desktop & Mobile Slider) */}
      <div className={`fixed inset-y-0 right-0 z-[60] w-full max-w-[400px] bg-slate-50/50 shadow-2xl transition-transform duration-300 transform ${mobileCartOpen ? 'translate-x-0' : 'translate-x-full'} lg:relative lg:translate-x-0 lg:w-96 lg:shadow-sm lg:rounded-[24px] lg:border lg:border-slate-200 flex flex-col overflow-hidden lg:h-full lg:max-w-none`}>
        <div className="p-4 lg:p-5 border-b border-slate-200/60 bg-white flex items-center justify-between shrink-0 shadow-sm z-10">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-lg">
            <button onClick={() => setMobileCartOpen(false)} className="lg:hidden p-1 mr-[-8px] text-slate-500 hover:bg-slate-200 rounded-lg">
              <X size={24} />
            </button>
            <div className="hidden lg:flex items-center gap-2 text-pink-600 bg-pink-50 px-2.5 py-1 rounded-lg">
               <ShoppingCart size={18} />
               <span className="text-sm">کاشێر</span>
            </div>
            
            <div className="flex items-center gap-1 mr-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200/60 shadow-inner">
               <button 
                  onClick={() => setIsWholesale(false)} 
                  className={`px-4 py-1.5 text-xs sm:text-sm font-extrabold rounded-lg transition-all duration-200 flex-1 text-center min-w-[70px] ${!isWholesale ? 'bg-white shadow-sm text-slate-800 scale-100 ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-700 scale-95 hover:bg-slate-200/50'}`}>تاک</button>
               <button 
                  onClick={() => setIsWholesale(true)} 
                  className={`px-4 py-1.5 text-xs sm:text-sm font-extrabold rounded-lg transition-all duration-200 flex-1 text-center min-w-[70px] ${isWholesale ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20 scale-100' : 'text-slate-500 hover:text-slate-700 scale-95 hover:bg-slate-200/50'}`}>جوملە</button>
            </div>
          </div>
          {cart.length > 0 && (
            <button onClick={clearCart} className="text-xs text-red-500 hover:bg-red-50 px-2 py-1 rounded transition-colors font-semibold">
              بەتاڵکردن
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3 lg:p-4 custom-scrollbar bg-slate-50/50">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
              <div className="w-24 h-24 bg-white shadow-sm border border-slate-100 rounded-full flex items-center justify-center">
                <ShoppingCart size={40} className="text-slate-300" strokeWidth={1.5} />
              </div>
              <p className="text-[15px] font-bold text-slate-500">پسوولەکەت بەتاڵە</p>
            </div>
          ) : (
            <div className="space-y-3 pb-24 lg:pb-0">
              {cart.map(item => (
                <div key={item.id} className="p-3 bg-white rounded-[16px] flex gap-3.5 group relative border border-slate-200 shadow-sm hover:border-pink-200 transition-all">
                  <div className="w-14 h-14 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl flex items-center justify-center text-slate-300 shrink-0 border border-slate-100/50 overflow-hidden relative">
                    {item.imageUrl ? (
                       <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                       <Box size={24} strokeWidth={1.5} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 py-0.5 relative">
                    <h4 className="text-[13px] font-bold text-slate-800 truncate mb-1.5">{item.name}</h4>
                    {(userPermissions.includes('pos_allow_edit_price') || userRole === 'admin') ? (
                       <div className="flex items-center gap-1">
                          <span className={`text-[11px] font-bold ${isWholesale ? 'text-indigo-600' : 'text-pink-600'}`}>
                             {isWholesale ? 'جوملە:' : 'تاک:'}
                          </span>
                          <input 
                             type="number" 
                             min="0"
                             step="any"
                             className="w-20 text-[11px] font-mono font-bold border-b border-slate-300 focus:border-pink-500 outline-none max-w-full bg-transparent p-0 m-0"
                             value={item.editedPrice !== undefined ? item.editedPrice : (isWholesale ? (item.wholesalePrice || item.unitPrice) : item.unitPrice)}
                             onChange={(e) => updateItemPrice(item.id, Number(e.target.value))}
                             dir="ltr"
                          />
                       </div>
                    ) : (
                       <p className={`text-[11px] font-mono font-bold ${isWholesale ? 'text-indigo-600' : 'text-pink-600'}`}>
                         {isWholesale ? 'جوملە: ' : 'تاک: '}
                         {formatCurrency(item.editedPrice !== undefined ? item.editedPrice : (isWholesale ? (item.wholesalePrice || item.unitPrice) : item.unitPrice), item.currency)}
                       </p>
                    )}
                  </div>
                  
                  <div className="flex flex-col items-end justify-between">
                    <button 
                      onClick={() => removeFromCart(item.id)}
                      className="text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors p-1.5 -mr-1.5 -mt-1"
                    >
                      <Trash2 size={16} />
                    </button>
                    <div className="flex items-center gap-2 bg-slate-50 rounded-lg border border-slate-200/60 p-0.5 mt-2">
                       {/* Qty Controls */}
                      <button 
                        onClick={() => updateQuantity(item.id, 1)}
                        disabled={item.quantity >= item.stock}
                        className="w-7 h-7 bg-white rounded-md shadow-sm border border-slate-200 flex items-center justify-center text-slate-600 hover:text-pink-600 disabled:opacity-50 disabled:shadow-none transition-colors"
                      >
                        <Plus size={14} strokeWidth={2.5} />
                      </button>
                      <span className="text-sm font-bold w-5 text-center font-mono">{item.quantity}</span>
                      <button 
                        onClick={() => updateQuantity(item.id, -1)}
                        className="w-7 h-7 bg-white rounded-md shadow-sm border border-slate-200 flex items-center justify-center text-slate-600 hover:text-red-500 transition-colors"
                      >
                        <Minus size={14} strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-5 lg:p-6 border-t border-slate-200/60 bg-white shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.02)] z-10 pb-8 lg:pb-6">
          <div className="space-y-3 mb-5">
            <div className="flex justify-between items-center text-[13px] text-slate-500 font-bold">
              <span>گشتی کالا ({cartItemCount})</span>
              <span className="font-mono text-slate-700">{formatCurrency(subtotal)}</span>
            </div>
            
            {(userPermissions.includes('pos_allow_discount') || userRole === 'admin') && (
               <div className="flex justify-between items-center text-[13px] text-slate-500 font-bold border-t border-slate-100 pt-3">
                  <span className="flex items-center gap-2">
                     داشکاندن
                     <select 
                        value={discountType} 
                        onChange={(e) => setDiscountType(e.target.value as 'amount'|'percentage')}
                        className="text-xs bg-slate-50 border border-slate-200 rounded p-1 outline-none focus:border-pink-500 font-bold"
                     >
                        <option value="amount">بڕ</option>
                        <option value="percentage">%</option>
                     </select>
                  </span>
                  <input 
                     type="number" 
                     min="0"
                     step="any"
                     placeholder="0"
                     value={discountValue}
                     onChange={(e) => setDiscountValue(e.target.value ? Number(e.target.value) : '')}
                     className="w-24 text-sm font-mono font-bold border border-slate-200 rounded-lg py-1 px-2 focus:border-pink-500 outline-none focus:ring-1 focus:ring-pink-500 text-left bg-slate-50 transition-colors"
                     dir="ltr"
                  />
               </div>
            )}

            <div className="pt-3 border-t text-pink-600 border-slate-100 flex justify-between items-end">
              <span className="text-[15px] font-extrabold text-slate-800 tracking-tight">کۆی گشتی</span>
              <span className="text-2xl font-black font-mono tracking-tight">{formatCurrency(total)}</span>
            </div>
          </div>
          
          <button 
            disabled={cart.length === 0}
            onClick={() => setCheckoutModalOpen(true)}
            className="w-full bg-slate-900 focus-visible:ring-4 focus-visible:ring-pink-500/30 hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none text-white py-4 rounded-2xl font-bold text-[15px] transition-all flex items-center justify-center gap-2.5 shadow-xl shadow-slate-900/10 active:scale-[0.98]"
          >
            <CreditCard size={20} />
            تەواوکردنی فرۆشتن
          </button>
        </div>
      </div>
      
      {/* Overlay for mobile cart */}
      {mobileCartOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[55] lg:hidden transition-opacity" onClick={() => setMobileCartOpen(false)} />
      )}

      {/* CHECKOUT MODAL */}
      {checkoutModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6 backdrop-blur-md bg-slate-900/40 transition-opacity">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-full">
            
            {saleCompleted ? (
              <div className="p-10 flex flex-col items-center justify-center text-center overflow-y-auto">
                <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-6 relative shrink-0">
                  <div className="absolute inset-0 bg-green-400/20 rounded-full animate-ping"></div>
                  <CheckCircle2 size={48} />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">فرۆشتنەکە سەرکەوتوو بوو</h2>
                <p className="text-slate-500 mb-8 max-w-xs leading-relaxed">پسوولەکە بە سەرکەوتوویی تۆمارکرا لە سیستەمەکەدا، دەتوانیت ئێستا چاپی بکەیت.</p>
                <div className="flex flex-col sm:flex-row gap-3 w-full">
                  <button onClick={resetPOS} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl transition-colors">
                    فرۆشتنی نوێ
                  </button>
                  {/* Ideally, we navigate to the print receipt page or open a print screen here. For now, it stays. The user can view from Receipts tab. */}
                </div>
              </div>
            ) : (
              <>
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Receipt className="text-pink-600" size={20} />
                    زانیاری کڕیار / دوکان
                  </h2>
                  <button onClick={() => setCheckoutModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
                    <X size={20} />
                  </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                  <form id="checkout-form" onSubmit={handleCheckoutSubmit} className="space-y-4">
                    
                    <div className="grid grid-cols-2 gap-3 mb-6">
                      <label className={`cursor-pointer flex flex-col items-center justify-center gap-2 py-4 rounded-xl border-2 transition-all ${customerDetails.paymentType === 'cash' ? 'border-pink-500 bg-pink-50 text-pink-700' : 'border-slate-200 bg-white text-slate-500 hover:border-pink-200'}`}>
                        <input 
                          type="radio" 
                          name="paymentType" 
                          value="cash"
                          checked={customerDetails.paymentType === 'cash'}
                          onChange={(e) => setCustomerDetails({...customerDetails, paymentType: e.target.value})}
                          className="sr-only" 
                        />
                        <Banknote size={24} />
                        <span className="font-bold text-sm">نەقد (کاش)</span>
                      </label>
                      <label className={`cursor-pointer flex flex-col items-center justify-center gap-2 py-4 rounded-xl border-2 transition-all ${customerDetails.paymentType === 'debt' ? 'border-pink-500 bg-pink-50 text-pink-700' : 'border-slate-200 bg-white text-slate-500 hover:border-pink-200'}`}>
                        <input 
                          type="radio" 
                          name="paymentType" 
                          value="debt"
                          checked={customerDetails.paymentType === 'debt'}
                          onChange={(e) => setCustomerDetails({...customerDetails, paymentType: e.target.value})}
                          className="sr-only" 
                        />
                        <History size={24} />
                        <span className="font-bold text-sm">قەرز (ماوە)</span>
                      </label>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                         <label className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                           <Store size={16} className="text-slate-400" /> ناوی کڕیار <span className="text-red-500">*</span>
                         </label>
                         {customers.length > 0 && (
                            <button 
                               type="button" 
                               onClick={() => setCustomerDetails({...customerDetails, shopName: '', phone: '', address: ''})}
                               className="text-xs font-bold text-pink-600 bg-pink-50 hover:bg-pink-100 px-2 py-1 rounded">
                               پاککردنەوە
                            </button>
                         )}
                      </div>
                      
                      <div className="relative">
                         <select 
                            required={!customerDetails.shopName}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all font-medium text-slate-800 appearance-none mb-2"
                            value={customers.find(c => c.name === customerDetails.shopName) ? customerDetails.shopName : 'new_custom'}
                            onChange={e => {
                               const val = e.target.value;
                               if (val === 'new_custom') {
                                  setCustomerDetails({...customerDetails, shopName: '', phone: '', address: ''});
                               } else {
                                  const found = customers.find(c => c.name === val);
                                  if (found) {
                                     setCustomerDetails({
                                        ...customerDetails,
                                        shopName: val,
                                        phone: found.phone || '',
                                        address: found.address || ''
                                     });
                                  }
                               }
                            }}
                         >
                            <option value="new_custom">-- کڕیاری نوێ (لێرە بنووسە) --</option>
                            {customers.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                         </select>
                      </div>

                      {!customers.find(c => c.name === customerDetails.shopName) && (
                         <input 
                           type="text" 
                           required
                           value={customerDetails.shopName || ''}
                           onChange={e => setCustomerDetails({...customerDetails, shopName: e.target.value})}
                           className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all font-medium text-slate-800"
                           placeholder="ناوی کڕیاری نوێ بنووسە..."
                         />
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                        <Phone size={16} className="text-slate-400" /> ژمارە مۆبایل
                      </label>
                      <input 
                        type="tel" 
                        value={customerDetails.phone || ''}
                        onChange={e => setCustomerDetails({...customerDetails, phone: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all font-medium text-slate-800"
                        placeholder="0750 000 0000"
                        dir="ltr"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                        <MapPin size={16} className="text-slate-400" /> ناونیشان
                      </label>
                      <input 
                        type="text" 
                        value={customerDetails.address || ''}
                        onChange={e => setCustomerDetails({...customerDetails, address: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all font-medium text-slate-800"
                        placeholder="شار، گەڕەک، شەقام..."
                      />
                    </div>

                    <div className="space-y-1.5">
                       <label className="flex items-center justify-between text-sm font-bold text-slate-700">
                          <span className="flex items-center gap-1.5">
                             <MapIcon size={16} className="text-blue-500" />
                             لینکی نەخشە (یان شوێن دیاریبکە)
                          </span>
                          <div className="flex gap-2">
                             <button 
                               type="button" 
                               onClick={() => setIsLocationPickerOpen(true)}
                               className="text-xs text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-md font-semibold transition-colors"
                             >
                                دیاریکردن لە نەخشە
                             </button>
                             <button 
                               type="button" 
                               onClick={() => {
                                  if ('geolocation' in navigator) {
                                     navigator.geolocation.getCurrentPosition((position) => {
                                         setCustomerDetails({
                                            ...customerDetails, 
                                            locationUrl: `https://maps.google.com/?q=${position.coords.latitude},${position.coords.longitude}`
                                         });
                                     }, (error) => {
                                         console.error("Error getting location:", error);
                                     });
                                  }
                               }}
                               className="text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-md font-semibold transition-colors"
                             >
                                GPS 
                             </button>
                          </div>
                       </label>
                       <input 
                         type="url" 
                         value={customerDetails.locationUrl || ''} 
                         onChange={e => setCustomerDetails({...customerDetails, locationUrl: e.target.value})} 
                         dir="ltr" 
                         placeholder="https://maps.google.com/?q=..." 
                         className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-mono text-left text-sm" 
                       />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                        <FileText size={16} className="text-slate-400" /> تێبینی 
                      </label>
                      <textarea 
                        rows={2}
                        value={customerDetails.notes || ''}
                        onChange={e => setCustomerDetails({...customerDetails, notes: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all font-medium text-slate-800 resize-none"
                        placeholder="هەر تێبینییەکی تایبەت بەم وەسڵە..."
                      ></textarea>
                    </div>

                  </form>
                  
                  {/* Summary Box */}
                  <div className="bg-pink-50 rounded-xl p-4 mt-6 border border-pink-100 flex justify-between items-center">
                    <div>
                      <p className="text-xs font-bold text-pink-600 mb-0.5">بڕی پارەی پێویست</p>
                      <p className="text-xs text-pink-500">{cart.length} جۆر کالا دیاریکراوە</p>
                    </div>
                    <div className="text-2xl font-bold font-mono text-pink-700">
                      {formatCurrency(total)}
                    </div>
                  </div>
                </div>

                <div className="p-6 border-t border-slate-100 bg-white shrink-0">
                  <button 
                    disabled={isProcessing}
                    type="submit"
                    form="checkout-form"
                    className="w-full disabled:opacity-50 bg-pink-600 hover:bg-pink-700 text-white py-3.5 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-pink-200"
                  >
                    <CheckCircle2 size={20} />
                    {isProcessing ? 'چاوەڕێبە...' : `فرۆشتن (${customerDetails.paymentType === 'cash' ? 'نەقد' : 'قەرز'})`}
                  </button>
                </div>
              </>
            )}
            
          </div>
        </div>
      )}

      <LocationPickerModal 
        isOpen={isLocationPickerOpen} 
        onClose={() => setIsLocationPickerOpen(false)}
        onSelectLocation={(lat, lng) => {
           setCustomerDetails({
               ...customerDetails,
               locationUrl: `https://maps.google.com/?q=${lat},${lng}`,
               lat: lat,
               lng: lng
           });
        }}
      />
    </div>
  );
}
