import React, { useState, useMemo, useEffect } from "react";
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Store,
  Phone,
  MapPin,
  Receipt,
  CheckCircle2,
  X,
  Box,
  FileText,
  CreditCard,
  Banknote,
  History,
  DollarSign,
  Calculator,
  ArrowDown,
  ArrowRightLeft,
  ArrowUpDown,
} from "lucide-react";
import { formatCurrency } from "../data";
import { Product } from "../types";
import {
  collection,
  onSnapshot,
  getDocs,
  doc,
  writeBatch,
  Timestamp,
  query,
  where,
  limit,
  getDoc,
  orderBy,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import LocationPickerModal from "../components/LocationPickerModal";
import { MapIcon } from "lucide-react";

interface CartItem extends Product {
  quantity: number;
  originalUnitPrice?: number;
  editedPrice?: number;
  unitType?: 'piece' | 'carton';
}

export default function POS() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isWholesale, setIsWholesale] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [customerDetails, setCustomerDetails] = useState({
    shopName: "",
    phone: "",
    address: "",
    locationUrl: "",
    lat: null as number | null,
    lng: null as number | null,
    notes: "",
    paymentType: "debt",
  });
  const [saleCompleted, setSaleCompleted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [currentReceiptId, setCurrentReceiptId] = useState<string | null>(null);

  const [customers, setCustomers] = useState<any[]>([]);
  const [safes, setSafes] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [debts, setDebts] = useState<any[]>([]);
  const [exchangeRate, setExchangeRate] = useState<number>(1500);
  const [mandubName, setMandubName] = useState("مەندوب");
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [userRole, setUserRole] = useState<string>("");

  useEffect(() => {
    if (auth.currentUser) {
      getDoc(doc(db, "users", auth.currentUser.uid)).then((snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.name) setMandubName(data.name);
          if (data.permissions) setUserPermissions(data.permissions);
          if (data.role) setUserRole(data.role);
        }
      });
    }
  }, []);

  const [discountType, setDiscountType] = useState<"amount" | "percentage">(
    "amount",
  );
  const [discountValue, setDiscountValue] = useState<number | "">("");

  const [editingReceiptId, setEditingReceiptId] = useState<string | null>(null);
  const [originalCart, setOriginalCart] = useState<CartItem[]>([]);
  const [editingOriginalTotal, setEditingOriginalTotal] = useState<number>(0);
  const [editingInvoiceNo, setEditingInvoiceNo] = useState<number>(0);
  const [editingOriginalPaymentType, setEditingOriginalPaymentType] = useState<string>("debt");
  const [editingDate, setEditingDate] = useState<string>("");

  useEffect(() => {
    const checkPendingEdit = () => {
      const pendingEdit = localStorage.getItem("pendingEditReceipt");
      if (pendingEdit) {
        try {
          const receipt = JSON.parse(pendingEdit);
          setEditingReceiptId(receipt.id);
          
          const mappedItems = (receipt.items || []).map((item: any) => ({
             ...item,
             id: item.productId || item.id,
             quantity: item.originalQuantity || item.quantity
          }));
          setOriginalCart(mappedItems);
          setCart(mappedItems);
          setIsWholesale(receipt.isWholesale || false);
          setDiscountType(receipt.discount?.type || "amount");
          setDiscountValue(receipt.discount?.value || "");
          if (receipt.timestamp) {
             try {
               let d;
               if (receipt.timestamp.seconds) {
                 d = new Date(receipt.timestamp.seconds * 1000);
               } else {
                 d = new Date(receipt.timestamp);
               }
               setEditingDate(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
             } catch(e) {}
          } else {
             setEditingDate("");
          }
          setEditingOriginalPaymentType(receipt.paymentType || "debt");
          setCustomerDetails({
            shopName: receipt.customerName || "",
            phone: receipt.phone || "",
            address: receipt.address || "",
            locationUrl: "",
            lat: null,
            lng: null,
            notes: receipt.notes || "",
            paymentType: receipt.paymentType || "debt",
          });
          setEditingOriginalTotal(receipt.finalTotal || receipt.total || 0);
          setEditingInvoiceNo(receipt.invoiceNo || 0);
          setCheckoutModalOpen(false);
          setSaleCompleted(false);
          setCurrentReceiptId(null);
          
          localStorage.removeItem("pendingEditReceipt");
        } catch(e) {
          console.error(e);
        }
      }
    };

    checkPendingEdit();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "products"), (snap) => {
      const data = snap.docs.map((t) => ({ id: t.id, ...t.data() }) as Product);
      setProducts(data);
      const uniqueCats = Array.from(
        new Set(data.map((p) => p.category).filter(Boolean)),
      ) as string[];
      setCategories(uniqueCats);
    });
    const unsubCus = onSnapshot(collection(db, "customers"), (snap) => {
      setCustomers(snap.docs.map((t) => ({ id: t.id, ...t.data() })));
    });
    const unsubSettings = onSnapshot(doc(db, "system", "settings"), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setSettings({ id: snap.id, ...data });
        if (data.exchangeRate) {
          setExchangeRate(data.exchangeRate);
        }
      }
    });
    const unsubSafes = onSnapshot(collection(db, "safes"), (snap) => {
      setSafes(snap.docs.map((t) => ({ id: t.id, ...t.data() })));
    });
    const unsubDebts = onSnapshot(collection(db, "debts"), (snap) => {
      setDebts(snap.docs.map((t) => ({ id: t.id, ...t.data() })));
    });
    return () => {
      unsub();
      unsubCus();
      unsubSettings();
      unsubSafes();
      unsubDebts();
    };
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (selectedCategory !== "all" && p.category !== selectedCategory)
        return false;
      if (searchTerm) {
        return (
          p.name.includes(searchTerm) ||
          (p.barcode && p.barcode.includes(searchTerm))
        );
      }
      return true;
    });
  }, [searchTerm, selectedCategory, products]);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }
      return [
        ...prev,
        { ...product, quantity: 1, originalUnitPrice: product.unitPrice },
      ];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const newQ = item.quantity + delta;
            // Let them go up to stock, but since we support fractions now, simplify the check
            if (newQ > 0) {
               return { ...item, quantity: newQ };
            }
          }
          return item;
        })
        .filter((item) => item.quantity > 0),
    );
  };

  const setQuantity = (id: string, qty: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return { ...item, quantity: qty };
        }
        return item;
      })
    );
  };

  const setUnitType = (id: string, type: "piece" | "carton") => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return { ...item, unitType: type };
        }
        return item;
      })
    );
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const updateItemPrice = (id: string, newPrice: number) => {
    setCart((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, editedPrice: newPrice } : item,
      ),
    );
  };

  const clearCart = () => setCart([]);

  const getActualPieceQuantity = (item: CartItem) => {
    return item.unitType === "carton" ? item.quantity * (item.cartonSize || 1) : item.quantity;
  };

  const subtotal = cart.reduce((sum, item) => {
    let applicablePrice;
    if (item.editedPrice !== undefined) {
      applicablePrice = item.editedPrice;
    } else {
      applicablePrice = isWholesale
        ? item.wholesalePrice || item.unitPrice
        : item.unitPrice;
    }
    const priceInCurrency = applicablePrice;
    return sum + priceInCurrency * getActualPieceQuantity(item);
  }, 0);

  const discountAmount =
    discountType === "amount"
      ? Number(discountValue) || 0
      : (subtotal * (Number(discountValue) || 0)) / 100;
  const total = Math.max(0, subtotal - discountAmount);
  const cartItemCount = cart.reduce((s, i) => s + getActualPieceQuantity(i), 0);

  const [clientTxId, setClientTxId] = useState(() => crypto.randomUUID());

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0 || isProcessing) return;

    setIsProcessing(true);
    try {
      const existingReceipt = await getDocs(query(collection(db, "receipts"), where("clientTxId", "==", clientTxId)));
      if (!existingReceipt.empty) {
         // Duplicate detected, just return success without saving
         setIsProcessing(false);
         setCart([]);
         setSaleCompleted(true);
         setClientTxId(crypto.randomUUID());
         return;
      }

      const batch = writeBatch(db);

      const isPending = userRole !== "admin" && userRole !== "accountant";
      const isEditing = !!editingReceiptId;

      let nextInvoiceNo = 1;
      if (isEditing) {
         nextInvoiceNo = editingInvoiceNo;
      } else {
        const receiptsSnap = await getDocs(
          query(collection(db, "receipts"), orderBy("invoiceNo", "desc"), limit(1))
        );
        if (!receiptsSnap.empty) {
          const lastRec = receiptsSnap.docs[0].data();
          if (lastRec && typeof lastRec.invoiceNo === "number") {
            nextInvoiceNo = lastRec.invoiceNo + 1;
          } else {
            const allRecs = await getDocs(collection(db, "receipts"));
            nextInvoiceNo = allRecs.size + 1;
          }
        } else {
          const allRecs = await getDocs(collection(db, "receipts"));
          nextInvoiceNo = allRecs.size + 1;
        }
      }

      const receiptRef = isEditing ? doc(db, "receipts", editingReceiptId) : doc(collection(db, "receipts"));
      const invoiceLabel = nextInvoiceNo.toString();

      if(isEditing) { batch.update(receiptRef, {
        customerName: customerDetails.shopName || "کڕیاری گشتی",
        phone: customerDetails.phone || "",
        address: customerDetails.address || "",
        notes: customerDetails.notes || "",
        paymentType: customerDetails.paymentType,
        sellerName: mandubName,
        exchangeRate,
        isWholesale,
        status: isPending && !isEditing ? "pending" : "completed",
        invoiceNo: nextInvoiceNo,
        items: cart.map((c) => {
          let applicablePrice;
          if (c.editedPrice !== undefined) {
            applicablePrice = c.editedPrice;
          } else {
            applicablePrice = isWholesale
              ? c.wholesalePrice || c.unitPrice
              : c.unitPrice;
          }
                    const priceInFinal = applicablePrice;

          // Always store base original price in final invoice currency too
          const originalBasePrice = isWholesale
            ? c.wholesalePrice || c.unitPrice
            : c.unitPrice;
          const originalPriceInFinal = originalBasePrice;

          const originalBaseCost = isWholesale ? (c.wholesaleCost || c.unitCost) : c.unitCost;
          const costInFinal = originalBaseCost || 0;
          const actualQty = getActualPieceQuantity(c);
          return {
            productId: c.id,
            name: c.name,
            quantity: actualQty,
            originalQuantity: c.quantity,
            unitType: c.unitType || 'piece',
            cartonSize: c.cartonSize || 1,
            currency: "USD",
            originalUnitPrice: originalPriceInFinal,
            originalUnitCost: originalBaseCost || 0,
            unitPrice: priceInFinal,
            isWholesale: isWholesale && Boolean(c.wholesalePrice),
            unitCost: costInFinal,
            category: c.category || "گشتی",
            stock: c.stock,
            total: priceInFinal * actualQty,
          };
        }),
        totalItems: cartItemCount,
        subtotal: subtotal,
        discountAmount: discountAmount,
        totalAmount: total, // In invoiceCurrency
        invoiceCurrency: "USD",
        clientTxId,
        updatedAt: Timestamp.now(),
        ...(isEditing && editingDate ? { timestamp: Timestamp.fromDate(new Date(editingDate)) } : isEditing ? {} : { timestamp: Timestamp.now() })
      });
      } else {
        batch.set(receiptRef, {
        customerName: customerDetails.shopName || "کڕیاری گشتی",
        phone: customerDetails.phone || "",
        address: customerDetails.address || "",
        notes: customerDetails.notes || "",
        paymentType: customerDetails.paymentType,
        sellerName: mandubName,
        exchangeRate,
        isWholesale,
        status: isPending && !isEditing ? "pending" : "completed",
        invoiceNo: nextInvoiceNo,
        clientTxId,
        items: cart.map((c) => {
          let applicablePrice;
          if (c.editedPrice !== undefined) {
            applicablePrice = c.editedPrice;
          } else {
            applicablePrice = isWholesale ? c.wholesalePrice || c.unitPrice : c.unitPrice;
          }
          const priceInFinal = applicablePrice;
          const originalBasePrice = isWholesale ? c.wholesalePrice || c.unitPrice : c.unitPrice;
          const originalPriceInFinal = originalBasePrice;
          const originalBaseCost = isWholesale ? (c.wholesaleCost || c.unitCost) : c.unitCost;
          const costInFinal = originalBaseCost || 0;
          const actualQty = c.unitType === "carton" ? c.quantity * (c.cartonSize || 1) : c.quantity;
          return {
            productId: c.id,
            name: c.name,
            quantity: actualQty,
            originalQuantity: c.quantity,
            unitType: c.unitType || 'piece',
            cartonSize: c.cartonSize || 1,
            currency: "USD",
            originalUnitPrice: originalPriceInFinal,
            originalUnitCost: originalBaseCost || 0,
            unitPrice: priceInFinal,
            isWholesale: isWholesale && Boolean(c.wholesalePrice),
            unitCost: costInFinal,
            category: c.category || "گشتی",
            stock: c.stock,
            total: priceInFinal * actualQty,
          };
        }),
        totalItems: cartItemCount,
        subtotal: subtotal,
        discountAmount: discountAmount,
        totalAmount: total,
        invoiceCurrency: "USD",
        timestamp: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      }

      if (!isPending || isEditing) {
        // Stock logic via diffs
        const stockDiffs: Record<string, number> = {};
        if (isEditing) {
           originalCart.forEach(item => {
              stockDiffs[item.productId || item.id] = (stockDiffs[item.productId || item.id] || 0) + getActualPieceQuantity(item);
           });
        }
        cart.forEach(item => {
           stockDiffs[item.id] = (stockDiffs[item.id] || 0) - getActualPieceQuantity(item);
        });

        Object.keys(stockDiffs).forEach(id => {
           if (stockDiffs[id] !== 0) {
              const prod = products.find(p => p.id === id);
              if (prod) {
                 batch.update(doc(db, "products", id), {
                    stock: (prod.stock || 0) + stockDiffs[id]
                 });
              }
           }
        });

        if (customerDetails.shopName) {
           const customerName = customerDetails.shopName;
           let debtDiff = 0;

           if (isEditing) {
              if (customerDetails.paymentType === "debt") {
                 if (editingOriginalPaymentType === "debt") {
                    debtDiff = total - editingOriginalTotal;
                 } else {
                    debtDiff = total;
                 }
              } else {
                 if (editingOriginalPaymentType === "debt") {
                    debtDiff = -editingOriginalTotal;
                 }
              }
           } else {
              if (customerDetails.paymentType === "debt") {
                 debtDiff = total;
              }
           }

           if (debtDiff !== 0) {
               const existingDebt = (() => {
                  const normalizeName = (name: string | null | undefined): string => {
                    if (!name) return "";
                    return name
                      .trim()
                      .replace(/\s+/g, " ")
                      .replace(/[ییێىي]/g, "ی")
                      .replace(/[ەەھة]/g, "ە")
                      .toLowerCase();
                  };
                  return debts.find((d) => normalizeName(d.customerName) === normalizeName(customerName) && d.status === "active") || debts.find((d) => normalizeName(d.customerName) === normalizeName(customerName));
                })();
               
               if (existingDebt) {
                  const newRemaining = (existingDebt.remainingAmount || 0) + debtDiff;
                  const finalRemaining = newRemaining < 0 ? 0 : newRemaining;
                  batch.update(doc(db, "debts", existingDebt.id), {
                     amount: (existingDebt.amount || 0) + debtDiff,
                     remainingAmount: finalRemaining,
                     status: finalRemaining === 0 ? "paid" : "active",
                     updatedAt: Timestamp.now()
                  });
                  batch.set(doc(collection(db, "debt_transactions")), {
                     debtId: existingDebt.id,
                     receiptId: receiptRef.id,
                     type: debtDiff > 0 ? "add" : "sub",
                     amount: Math.abs(debtDiff),
                     timestamp: Timestamp.now(),
                     notes: (isEditing ? "دەستکاری کردنی وەسڵ: " : "قەرزی نوێ لە وەسڵی ژمارە: ") + invoiceLabel
                  });
               } else if (debtDiff > 0) {
                  const newDebtRef = doc(collection(db, "debts"));
                  batch.set(newDebtRef, {
                    customerName: customerName,
                    phone: customerDetails.phone || "",
                    amount: debtDiff,
                    remainingAmount: debtDiff,
                    status: "active",
                    notes: "پاشماوەی وەسڵ: " + invoiceLabel,
                    timestamp: Timestamp.now(),
                  });
                  batch.set(doc(collection(db, "debt_transactions")), {
                    debtId: newDebtRef.id,
                    amount: debtDiff,
                    type: "add",
                    timestamp: Timestamp.now(),
                    notes: "قەرزی نوێ لە وەسڵی ژمارە: " + invoiceLabel,
                  });
               }
           }
        }
      }

      // Save customer if new
      if (customerDetails.shopName) {
        const existingCus = customers.find(
          (c) => c.name === customerDetails.shopName,
        );
        if (existingCus) {
          batch.update(doc(db, "customers", existingCus.id), {
            phone: customerDetails.phone || existingCus.phone || "",
            address: customerDetails.address || existingCus.address || "",
            locationUrl:
              customerDetails.locationUrl || existingCus.locationUrl || "",
            lat: customerDetails.lat || existingCus.lat || null,
            lng: customerDetails.lng || existingCus.lng || null,
            lastPurchase: Timestamp.now(),
          });
        } else {
          const cusRef = doc(collection(db, "customers"));
          batch.set(cusRef, {
            name: customerDetails.shopName,
            phone: customerDetails.phone || "",
            address: customerDetails.address || "",
            locationUrl: customerDetails.locationUrl || "",
            lat: customerDetails.lat || null,
            lng: customerDetails.lng || null,
            createdAt: Timestamp.now(),
            lastPurchase: Timestamp.now(),
          });
        }
      }

      let safeDiff = 0;
      if (isEditing) {
         if (customerDetails.paymentType === "cash" || customerDetails.paymentType === "نەقد") {
             if (editingOriginalPaymentType === "cash" || editingOriginalPaymentType === "نەقد") {
                 safeDiff = total - editingOriginalTotal;
             } else {
                 safeDiff = total;
             }
         } else {
             if (editingOriginalPaymentType === "cash" || editingOriginalPaymentType === "نەقد") {
                 safeDiff = -editingOriginalTotal;
             }
         }
      } else {
         if (customerDetails.paymentType === "cash" || customerDetails.paymentType === "نەقد") {
             safeDiff = total;
         }
      }

      if (safeDiff !== 0 && settings?.defaultSafeForDebt) {
         const targetSafe = settings.defaultSafeForDebt;
         const safeSnap = safes.find((s: any) => s.id === targetSafe);
         if (safeSnap) {
            batch.update(doc(db, "safes", targetSafe), {
               balance: (safeSnap.balance || 0) + safeDiff
            });
            batch.set(doc(collection(db, "safe_transactions")), {
               safeId: targetSafe,
               amount: Math.abs(safeDiff),
               type: safeDiff > 0 ? "in" : "out",
               origin: (isEditing ? "دەستکاری وەسڵ: " : "فرۆشتنی کاش ژمارە: ") + invoiceLabel,
               timestamp: Timestamp.now(),
               notes: isEditing ? "جیاوازی دەستکاری" : "",
               handlerName: auth.currentUser?.email || "pos"
            });
         }
      }

      await batch.commit();

      setCurrentReceiptId(receiptRef.id);
      setSaleCompleted(true);
    } catch (error) {
      console.error(error);
      alert("هەڵەیەک ڕوویدا لە کاتی فرۆشتن.");
    } finally {
      setIsProcessing(false);
    }
  };

  const resetPOS = () => {
    setCart([]);
    setCustomerDetails({
      shopName: "",
      phone: "",
      address: "",
      notes: "",
      paymentType: "debt",
    });
    setSaleCompleted(false);
    setCheckoutModalOpen(false);
    setMobileCartOpen(false);
    setCurrentReceiptId(null);
    setClientTxId(crypto.randomUUID());
  };

  return (
    <div className="flex flex-col lg:flex-row h-full gap-4 lg:gap-6 overflow-hidden relative">
      {/* LEFT / MAIN AREA: Products */}
      <div className="flex-1 flex flex-col bg-slate-50/50 lg:bg-white lg:rounded-[24px] lg:border border-slate-200 shadow-sm overflow-hidden h-full -mx-3 sm:mx-0">
        <div className="p-3 lg:p-5 border-b border-slate-200/60 bg-white flex flex-col gap-3 shrink-0 shadow-sm z-10 sticky top-0">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full">
            <div className="flex gap-2 w-full">
              <div className="relative flex-1">
                <Search
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />
                <input
                  type="text"
                  placeholder="گەڕان بۆ کالا یان بارکۆد..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pr-11 pl-4 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all font-medium text-slate-800 h-full"
                />
              </div>
            </div>
            {/* Mobile Wholesale Toggle */}
            <div className="lg:hidden flex items-center bg-slate-100 p-1.5 rounded-xl border border-slate-200/60 shadow-inner h-[46px]">
              <button
                onClick={() => setIsWholesale(false)}
                className={`px-4 py-1.5 text-sm font-extrabold rounded-lg transition-all duration-200 flex-1 text-center h-full flex items-center justify-center ${!isWholesale ? "bg-white shadow-sm text-slate-800 scale-100 ring-1 ring-slate-200/50" : "text-slate-500 hover:text-slate-700 scale-95 hover:bg-slate-200/50"}`}
              >
                تاک (Retail)
              </button>
              <button
                onClick={() => setIsWholesale(true)}
                className={`px-4 py-1.5 text-sm font-extrabold rounded-lg transition-all duration-200 flex-1 text-center h-full flex items-center justify-center ${isWholesale ? "bg-pink-600 text-white shadow-md shadow-pink-500/20 scale-100" : "text-slate-500 hover:text-slate-700 scale-95 hover:bg-slate-200/50"}`}
              >
                جوملە (Wholesale)
              </button>
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1 sm:pb-0 hide-scrollbar -mx-3 px-3 sm:mx-0 sm:px-0">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`px-5 py-2.5 shrink-0 rounded-xl text-sm font-bold transition-all ${selectedCategory === "all" ? "bg-pink-600 text-white shadow-md shadow-pink-500/20 transform scale-[1.02]" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 active:scale-95"}`}
            >
              هەمووی
            </button>
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setSelectedCategory(c)}
                className={`px-5 py-2.5 shrink-0 rounded-xl text-sm font-bold transition-all ${selectedCategory === c ? "bg-pink-600 text-white shadow-md shadow-pink-500/20 transform scale-[1.02]" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 active:scale-95"}`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 lg:p-5 custom-scrollbar bg-slate-50/50 pb-36 lg:pb-5">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 lg:gap-4">
            {filteredProducts.map((product) => {
              const inCart =
                cart.find((c) => c.id === product.id)?.quantity || 0;
              const isMaxQ = inCart >= product.stock;

              return (
                <div
                  key={product.id}
                  onClick={() => !isMaxQ && addToCart(product)}
                  className={`group bg-white rounded-2xl lg:rounded-[20px] border ${isMaxQ ? "border-orange-200/60 opacity-80" : "border-slate-200/80 hover:border-pink-300 hover:shadow-xl hover:shadow-pink-500/10 hover:-translate-y-1"} p-3 cursor-pointer transition-all duration-300 flex flex-col h-full relative overflow-hidden`}
                >
                  <div className="w-full aspect-square bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-xl mb-3.5 flex items-center justify-center text-slate-300 group-hover:bg-pink-50/50 group-hover:text-pink-400 transition-colors shrink-0 overflow-hidden relative border border-slate-100">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <Box size={36} strokeWidth={1.5} />
                    )}
                  </div>
                  <h3 className="text-[13px] sm:text-sm font-bold text-slate-800 leading-snug mb-1.5 line-clamp-2">
                    {product.name}
                  </h3>
                  <p className="text-[10px] text-slate-500 mb-2 truncate font-medium">
                    {product.company} • {product.category}
                  </p>

                  <div className="mt-auto flex items-end justify-between pt-2">
                    <div>
                      <p className="text-[10px] text-slate-400 mb-0.5 font-medium">
                        نرخ {isWholesale ? "(جوملە)" : "(تاک)"}
                      </p>
                      <p
                        className={`${isWholesale ? "text-pink-600" : "text-pink-600"} font-extrabold font-mono text-sm tracking-tight`}
                      >
                        {formatCurrency(
                          isWholesale
                            ? product.wholesalePrice || product.unitPrice
                            : product.unitPrice,
                          product.currency,
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Stock Indicator */}
                  <div
                    className={`absolute top-2.5 left-2.5 text-[10px] font-bold px-2 py-0.5 rounded-lg backdrop-blur-sm shadow-sm border flex items-center gap-1 ${isMaxQ ? "bg-orange-100/90 text-orange-700 border-orange-200" : "bg-white/90 text-slate-600 border-slate-200"}`}
                  >
                    {product.cartonSize &&
                    product.cartonSize > 1 &&
                    product.stock >= product.cartonSize ? (
                      <span dir="rtl">
                        {Math.floor(product.stock / product.cartonSize)} کارتن{" "}
                        {product.stock % product.cartonSize > 0
                          ? `و ${product.stock % product.cartonSize} دانە`
                          : ""}
                      </span>
                    ) : (
                      <span>{product.stock} دانە</span>
                    )}
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
      <div className="mobile-floating-cart lg:hidden fixed bottom-[calc(max(env(safe-area-inset-bottom),0.5rem)+5.5rem)] left-4 right-4 z-40 print:hidden transition-all">
        <button
          onClick={() => setMobileCartOpen(true)}
          className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold text-[15px] flex items-center justify-between px-6 shadow-xl shadow-slate-900/20 active:scale-[0.98] transition-all backdrop-blur-md bg-slate-900/95 border border-slate-700/50"
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <ShoppingCart size={22} className="text-pink-400" />
              <div className="absolute -top-2 -right-2 w-5 h-5 bg-pink-500 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm shadow-pink-500/50">
                {cartItemCount}
              </div>
            </div>
            <span>بینینی پسوولە</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="font-mono text-lg tracking-tight text-white">
              {formatCurrency(total)}
            </span>
            <span
              className={`text-[10px] font-bold tracking-widest ${isWholesale ? "text-pink-400" : "text-pink-400"}`}
            >
              {isWholesale ? "جوملە" : "تاک"}
            </span>
          </div>
        </button>
      </div>

      {/* RIGHT AREA: Cart Sidebar (Desktop & Mobile Slider) */}
      <div
        className={`fixed inset-y-0 right-0 h-[100dvh] lg:h-full z-[60] w-[calc(100vw-3rem)] max-w-[400px] bg-slate-50/50 shadow-2xl transition-transform duration-300 transform ${mobileCartOpen ? "translate-x-0" : "translate-x-full"} lg:relative lg:translate-x-0 lg:w-96 lg:shadow-sm lg:rounded-[24px] lg:border lg:border-slate-200 flex flex-col overflow-hidden lg:max-w-none`}
      >
        <div className="p-4 border-b border-slate-200/60 bg-white flex flex-col gap-3 shrink-0 shadow-sm z-10 w-full pt-[max(env(safe-area-inset-top),1rem)]">
          <div className="flex items-center justify-between w-full text-slate-900 font-bold text-lg">
            <div className="flex items-center gap-2 text-pink-600 bg-pink-50 px-3 py-1.5 rounded-xl font-bold">
              <ShoppingCart size={20} />
              <span className="text-base">کاشێر</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMobileCartOpen(false)}
                className="w-10 h-10 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl flex transition-all active:scale-95 lg:hidden justify-center items-center"
              >
                <X size={20} className="stroke-[2.5px]" />
              </button>
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-red-500 hover:bg-red-50 p-2 rounded-xl transition-colors shrink-0 flex items-center justify-center border border-transparent hover:border-red-100"
                  title="سڕینەوەی سەلە"
                >
                  <Trash2 size={20} />
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center p-1.5 bg-slate-100 rounded-xl border border-slate-200/60 shadow-inner w-full">
            <button
              onClick={() => setIsWholesale(false)}
              className={`py-2 text-xs font-extrabold rounded-lg transition-all duration-200 flex-1 text-center ${!isWholesale ? "bg-white shadow-sm text-slate-800 ring-1 ring-slate-200/50 scale-100" : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 scale-95"}`}
            >
              کڕیاری تاک
            </button>
            <button
              onClick={() => setIsWholesale(true)}
              className={`py-2 text-xs font-extrabold rounded-lg transition-all duration-200 flex-1 text-center ${isWholesale ? "bg-pink-600 text-white shadow-md shadow-pink-500/20 scale-100" : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 scale-95"}`}
            >
              کڕیاری جوملە
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 lg:p-4 custom-scrollbar bg-slate-50/50">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
              <div className="w-24 h-24 bg-white shadow-sm border border-slate-100 rounded-full flex items-center justify-center">
                <ShoppingCart
                  size={40}
                  className="text-slate-300"
                  strokeWidth={1.5}
                />
              </div>
              <p className="text-[15px] font-bold text-slate-500">
                پسوولەکەت بەتاڵە
              </p>
            </div>
          ) : (
            <div className="space-y-3 pb-24 lg:pb-0">
              {cart.map((item) => (
                <div
                  key={item.id}
                  className="p-3 bg-white rounded-[16px] flex gap-3.5 group relative border border-slate-200 shadow-sm hover:border-pink-200 transition-all"
                >
                  <div className="w-14 h-14 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl flex items-center justify-center text-slate-300 shrink-0 border border-slate-100/50 overflow-hidden relative">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <Box size={24} strokeWidth={1.5} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 py-0.5 relative">
                    <h4 className="text-[13px] font-bold text-slate-800 truncate mb-1.5">
                      {item.name}
                    </h4>
                    {userPermissions.includes("pos_allow_edit_price") ||
                    userRole === "admin" ? (
                      <div className="flex items-center gap-1">
                        <span
                          className={`text-[11px] font-bold ${isWholesale ? "text-pink-600" : "text-pink-600"}`}
                        >
                          {isWholesale ? "جوملە:" : "تاک:"}
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          className="w-20 text-[11px] font-mono font-bold border-b border-slate-300 focus:border-pink-500 outline-none max-w-full bg-transparent p-0 m-0"
                          value={
                            item.editedPrice !== undefined
                              ? item.editedPrice
                              : isWholesale
                                ? item.wholesalePrice || item.unitPrice
                                : item.unitPrice
                          }
                          onChange={(e) =>
                            updateItemPrice(item.id, Number(e.target.value))
                          }
                          dir="ltr"
                        />
                      </div>
                    ) : (
                      <p
                        className={`text-[11px] font-mono font-bold ${isWholesale ? "text-pink-600" : "text-pink-600"}`}
                      >
                        {isWholesale ? "جوملە: " : "تاک: "}
                        {formatCurrency(
                          item.editedPrice !== undefined
                            ? item.editedPrice
                            : isWholesale
                              ? item.wholesalePrice || item.unitPrice
                              : item.unitPrice,
                          item.currency,
                        )}
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
                    <div className="flex flex-col items-end gap-1 mt-2">
                      <div className="flex items-center gap-1.5 bg-slate-50 rounded-lg border border-slate-200/60 p-0.5">
                        <button
                          onClick={() => updateQuantity(item.id, 1)}
                          disabled={getActualPieceQuantity({ ...item, quantity: item.quantity + 1 }) > item.stock}
                          className="w-7 h-7 shrink-0 bg-white rounded-md shadow-sm border border-slate-200 flex items-center justify-center text-slate-600 hover:text-pink-600 outline-none disabled:opacity-50 transition-colors"
                        >
                          <Plus size={14} strokeWidth={2.5} />
                        </button>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={item.quantity}
                          onChange={(e) => setQuantity(item.id, Number(e.target.value))}
                          className="w-12 text-sm font-bold text-center font-mono bg-transparent outline-none p-0 m-0"
                          dir="ltr"
                        />
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          disabled={item.quantity <= 0}
                          className="w-7 h-7 shrink-0 bg-white rounded-md shadow-sm border border-slate-200 flex items-center justify-center text-slate-600 hover:text-red-500 outline-none disabled:opacity-50 transition-colors"
                        >
                          <Minus size={14} strokeWidth={2.5} />
                        </button>
                      </div>
                      {(item.cartonSize || 0) > 1 && (
                        <select
                          value={item.unitType || "piece"}
                          onChange={(e) => setUnitType(item.id, e.target.value as "piece" | "carton")}
                          className="text-[10px] font-bold bg-slate-100 border border-slate-200 rounded text-slate-600 px-1 py-0.5 outline-none"
                        >
                          <option value="piece">دانە</option>
                          <option value="carton">کارتۆن</option>
                        </select>
                      )}
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
              <span className="font-mono text-slate-700">
                {formatCurrency(subtotal)}
              </span>
            </div>

            {(userPermissions.includes("pos_allow_discount") ||
              userRole === "admin") && (
              <div className="flex justify-between items-center text-[13px] text-slate-500 font-bold border-t border-slate-100 pt-3">
                <span className="flex items-center gap-2">
                  داشکاندن
                  <select
                    value={discountType}
                    onChange={(e) =>
                      setDiscountType(e.target.value as "amount" | "percentage")
                    }
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
                  onChange={(e) =>
                    setDiscountValue(
                      e.target.value ? Number(e.target.value) : "",
                    )
                  }
                  className="w-24 text-sm font-mono font-bold border border-slate-200 rounded-lg py-1 px-2 focus:border-pink-500 outline-none focus:ring-1 focus:ring-pink-500 text-left bg-slate-50 transition-colors"
                  dir="ltr"
                />
              </div>
            )}

            <div className="pt-3 border-t text-pink-600 border-slate-100 flex justify-between items-end">
              <span className="text-[15px] font-extrabold text-slate-800 tracking-tight">
                کۆی گشتی
              </span>
              <span className="text-2xl font-black font-mono tracking-tight">
                {formatCurrency(total)}
              </span>
            </div>
          </div>

          <div className="flex gap-3 pb-[max(calc(env(safe-area-inset-bottom)+5rem),2rem)] lg:pb-0">
            <button
              disabled={cart.length === 0}
              onClick={() => setCheckoutModalOpen(true)}
              className="flex-1 bg-slate-900 focus-visible:ring-4 focus-visible:ring-pink-500/30 hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none text-white py-4 rounded-2xl font-bold text-[15px] transition-all flex items-center justify-center gap-2.5 shadow-xl shadow-slate-900/10 active:scale-[0.98]"
            >
              <CreditCard size={20} />
              تەواوکردنی فرۆشتن
            </button>
          </div>
        </div>
      </div>

      {/* Overlay for mobile cart */}
      {mobileCartOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[55] lg:hidden transition-opacity"
          onClick={() => setMobileCartOpen(false)}
        />
      )}

      {/* CHECKOUT MODAL */}
      {checkoutModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-6 backdrop-blur-md bg-slate-900/40 transition-opacity">
          <div className="bg-white rounded-t-[32px] sm:rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-full animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
            {saleCompleted ? (
              <div className="p-10 flex flex-col items-center justify-center text-center overflow-y-auto">
                <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-6 relative shrink-0">
                  <div className="absolute inset-0 bg-green-400/20 rounded-full animate-ping"></div>
                  <CheckCircle2 size={48} />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">
                  فرۆشتنەکە سەرکەوتوو بوو
                </h2>
                <p className="text-slate-500 mb-8 max-w-xs leading-relaxed">
                  پسوولەکە بە سەرکەوتوویی تۆمارکرا لە سیستەمەکەدا، دەتوانیت
                  ئێستا چاپی بکەیت.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 w-full">
                  <button
                    onClick={resetPOS}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl transition-colors"
                  >
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
                  <button
                    onClick={() => setCheckoutModalOpen(false)}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                  <form
                    id="checkout-form"
                    onSubmit={handleCheckoutSubmit}
                    className="space-y-4"
                  >
                    <div className="space-y-1.5 pb-2">
                      <label className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                        <Banknote size={16} className="text-pink-500" /> جۆری پێدان (جۆری وەسڵ) <span className="text-red-500">*</span>
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setCustomerDetails({ ...customerDetails, paymentType: "cash" })}
                          className={`py-3 px-4 rounded-xl border-2 font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 ${
                            customerDetails.paymentType === "cash" || customerDetails.paymentType === "نەقد"
                              ? "border-pink-600 bg-pink-50/80 text-pink-700 shadow-md shadow-pink-500/10 scale-[1.02]"
                              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                          }`}
                        >
                          <Banknote size={18} />
                          نەقد (کاش)
                        </button>
                        <button
                          type="button"
                          onClick={() => setCustomerDetails({ ...customerDetails, paymentType: "debt" })}
                          className={`py-3 px-4 rounded-xl border-2 font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 ${
                            customerDetails.paymentType === "debt" || customerDetails.paymentType === "قەرز"
                              ? "border-pink-600 bg-pink-50/80 text-pink-700 shadow-md shadow-pink-500/10 scale-[1.02]"
                              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                          }`}
                        >
                          <History size={18} />
                          قەرز (ماوە)
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                          <Store size={16} className="text-slate-400" /> ناوی
                          کڕیار <span className="text-red-500">*</span>
                        </label>
                        {customers.length > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              setCustomerDetails({
                                ...customerDetails,
                                shopName: "",
                                phone: "",
                                address: "",
                              })
                            }
                            className="text-xs font-bold text-pink-600 bg-pink-50 hover:bg-pink-100 px-2 py-1 rounded"
                          >
                            پاککردنەوە
                          </button>
                        )}
                      </div>

                      <div className="relative">
                        <select
                          required={!customerDetails.shopName}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all font-medium text-slate-800 appearance-none mb-2"
                          value={
                            customers.find(
                              (c) => c.name === customerDetails.shopName,
                            )
                              ? customerDetails.shopName
                              : "new_custom"
                          }
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "new_custom") {
                              setCustomerDetails({
                                ...customerDetails,
                                shopName: "",
                                phone: "",
                                address: "",
                              });
                            } else {
                              const found = customers.find(
                                (c) => c.name === val,
                              );
                              if (found) {
                                setCustomerDetails({
                                  ...customerDetails,
                                  shopName: val,
                                  phone: found.phone || "",
                                  address: found.address || "",
                                });
                              }
                            }
                          }}
                        >
                          <option value="new_custom">
                            -- کڕیاری نوێ (لێرە بنووسە) --
                          </option>
                          {customers.map((c) => (
                            <option key={c.id} value={c.name}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {!customers.find(
                        (c) => c.name === customerDetails.shopName,
                      ) && (
                        <input
                          type="text"
                          required
                          value={customerDetails.shopName || ""}
                          onChange={(e) =>
                            setCustomerDetails({
                              ...customerDetails,
                              shopName: e.target.value,
                            })
                          }
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all font-medium text-slate-800"
                          placeholder="ناوی کڕیاری نوێ بنووسە..."
                        />
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                        <Phone size={16} className="text-slate-400" /> ژمارە
                        مۆبایل
                      </label>
                      <input
                        type="tel"
                        value={customerDetails.phone || ""}
                        onChange={(e) =>
                          setCustomerDetails({
                            ...customerDetails,
                            phone: e.target.value,
                          })
                        }
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
                        value={customerDetails.address || ""}
                        onChange={(e) =>
                          setCustomerDetails({
                            ...customerDetails,
                            address: e.target.value,
                          })
                        }
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all font-medium text-slate-800"
                        placeholder="شار، گەڕەک، شەقام..."
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="flex items-center justify-between text-sm font-bold text-slate-700">
                        <span className="flex items-center gap-1.5">
                          <MapIcon size={16} className="text-pink-500" />
                          لینکی نەخشە (یان شوێن دیاریبکە)
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setIsLocationPickerOpen(true)}
                            className="text-xs text-pink-600 bg-pink-50 hover:bg-pink-100 px-2 py-1 rounded-md font-semibold transition-colors"
                          >
                            دیاریکردن لە نەخشە
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if ("geolocation" in navigator) {
                                navigator.geolocation.getCurrentPosition(
                                  (position) => {
                                    setCustomerDetails({
                                      ...customerDetails,
                                      locationUrl: `https://maps.google.com/?q=${position.coords.latitude},${position.coords.longitude}`,
                                    });
                                  },
                                  (error) => {
                                    console.error(
                                      "Error getting location:",
                                      error,
                                    );
                                  },
                                );
                              }
                            }}
                            className="text-xs text-pink-600 bg-pink-50 hover:bg-pink-100 px-2 py-1 rounded-md font-semibold transition-colors"
                          >
                            GPS
                          </button>
                        </div>
                      </label>
                      <input
                        type="url"
                        value={customerDetails.locationUrl || ""}
                        onChange={(e) =>
                          setCustomerDetails({
                            ...customerDetails,
                            locationUrl: e.target.value,
                          })
                        }
                        dir="ltr"
                        placeholder="https://maps.google.com/?q=..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-pink-500/50 font-mono text-left text-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                        <FileText size={16} className="text-slate-400" /> تێبینی
                      </label>
                      <textarea
                        rows={2}
                        value={customerDetails.notes || ""}
                        onChange={(e) =>
                          setCustomerDetails({
                            ...customerDetails,
                            notes: e.target.value,
                          })
                        }
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all font-medium text-slate-800 resize-none"
                        placeholder="هەر تێبینییەکی تایبەت بەم وەسڵە..."
                      ></textarea>
                    </div>

                    {!!editingReceiptId && (
                      <div className="space-y-1.5 border-t border-slate-100 pt-3">
                        <label className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                          <FileText size={16} className="text-slate-400" /> کاتی وەسڵ
                        </label>
                        <input
                          type="datetime-local"
                          value={editingDate}
                          onChange={(e) => setEditingDate(e.target.value)}
                          className="w-full bg-orange-50 border border-orange-200 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-orange-500/20 font-medium text-slate-800 text-left"
                          dir="ltr"
                        />
                      </div>
                    )}
                  </form>

                  {/* Summary Box */}
                  <div className="bg-pink-50 rounded-xl p-4 mt-6 border border-pink-100 flex justify-between items-center">
                    <div>
                      <p className="text-xs font-bold text-pink-600 mb-0.5">
                        بڕی پارەی پێویست
                      </p>
                      <p className="text-xs text-pink-500">
                        {cart.length} جۆر کالا دیاریکراوە
                      </p>
                    </div>
                    <div className="text-2xl font-bold font-mono text-pink-700">
                      {formatCurrency(total)}
                    </div>
                  </div>
                </div>

                <div className="p-4 sm:p-6 border-t border-slate-100 bg-white shrink-0 pb-[max(calc(env(safe-area-inset-bottom)+2rem),1.5rem)] sm:pb-6">
                  <button
                    disabled={isProcessing}
                    type="submit"
                    form="checkout-form"
                    className="w-full disabled:opacity-50 bg-pink-600 hover:bg-pink-700 text-white py-3.5 rounded-xl font-bold text-[15px] sm:text-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-pink-200 active:scale-95"
                  >
                    <CheckCircle2 size={20} />
                    {isProcessing
                      ? "چاوەڕێبە..."
                      : (editingReceiptId ? "نوێکردنەوەی وەسڵ" : `فرۆشتن (قەرز)`)}
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
            lng: lng,
          });
        }}
      />

    </div>
  );
}
