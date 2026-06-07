const fs = require('fs');

const file = 'src/pages/POS.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Target the start of handleCheckoutSubmit
const checkoutStartIndicator = 'const handleCheckoutSubmit = async (e: React.FormEvent) => {';
if(code.includes(checkoutStartIndicator)) {
    // we want to add editing states just before the checkout handler if we haven't already. (Wait, I successfully applied chunk 1 which added editingReceiptId to the top of POS.tsx, let's verify.)
}

const isPendingLine = 'const isPending = userRole !== "admin" && userRole !== "accountant";';
if(code.includes(isPendingLine)) {
    code = code.replace(isPendingLine, `const isPending = userRole !== "admin" && userRole !== "accountant";
      const isEditing = !!editingReceiptId;`);
}

const invoiceNoLogic = `      let nextInvoiceNo = 1;
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
      }`;

const newInvoiceNoLogic = `      let nextInvoiceNo = 1;
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
      }`;

code = code.replace(invoiceNoLogic, newInvoiceNoLogic);

const refAndLabel = `      const receiptRef = doc(collection(db, "receipts"));
      const invoiceLabel = nextInvoiceNo.toString();`;

code = code.replace(refAndLabel, `      const receiptRef = isEditing ? doc(db, "receipts", editingReceiptId) : doc(collection(db, "receipts"));
      const invoiceLabel = nextInvoiceNo.toString();`);

const statusLine = `status: isPending ? "pending" : "completed",`;
code = code.replace(statusLine, `status: isPending && !isEditing ? "pending" : "completed",`);

const timeStampSet = `        invoiceCurrency: "USD",
        timestamp: Timestamp.now(),
      });`;

const updatedTimeStampSet = `        invoiceCurrency: "USD",
        updatedAt: Timestamp.now(),
        ...(isEditing ? {} : { timestamp: Timestamp.now() })
      });`;
code = code.replace(timeStampSet, updatedTimeStampSet);

const batchSetReceipt = `batch.set(receiptRef, {`;
code = code.replace(batchSetReceipt, `if(isEditing) { batch.update(receiptRef, {`);

const closeBatchSet = `        ...(isEditing ? {} : { timestamp: Timestamp.now() })
      });`;
code = code.replace(closeBatchSet, `        ...(isEditing ? {} : { timestamp: Timestamp.now() })
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
      }`);


const oldStockAndDebtLogic = `      if (!isPending) {
        // Update stocks
        cart.forEach((item) => {
          const ref = doc(db, "products", item.id);
          batch.update(ref, { stock: item.stock - getActualPieceQuantity(item) });
        });

        // Handle Debt if paymentType is 'debt' (قەرز)
        if (
          customerDetails.paymentType === "debt" &&
          total > 0 &&
          customerDetails.shopName
        ) {
          const debtAmount = total;

          const existingDebt = debts.find(
            (d) =>
              d.customerName === customerDetails.shopName &&
              d.status === "active",
          );
          if (existingDebt) {
            const debtRef = doc(db, "debts", existingDebt.id);
            batch.update(debtRef, {
              amount: (existingDebt.amount || 0) + debtAmount,
              remainingAmount:
                (existingDebt.remainingAmount || 0) + debtAmount,
              updatedAt: Timestamp.now(),
            });

            const debtTxRef = doc(collection(db, "debt_transactions"));
            batch.set(debtTxRef, {
              debtId: existingDebt.id,
              amount: debtAmount,
              type: "add",
              timestamp: Timestamp.now(),
              notes:
                "زیادبوونی قەرز لە وەسڵی ژمارە: " +
                invoiceLabel,
            });
          } else {
            const debtRef = doc(collection(db, "debts"));
            batch.set(debtRef, {
              customerName: customerDetails.shopName,
              phone: customerDetails.phone,
              amount: debtAmount,
              remainingAmount: debtAmount,
              status: "active",
              notes: "پاشماوەی وەسڵ: " + invoiceLabel,
              timestamp: Timestamp.now(),
            });

            const debtTxRef = doc(collection(db, "debt_transactions"));
            batch.set(debtTxRef, {
              debtId: debtRef.id,
              amount: debtAmount,
              type: "add",
              timestamp: Timestamp.now(),
              notes:
                "قەرزی نوێ لە وەسڵی ژمارە: " +
                invoiceLabel,
            });
          }
        }
      }`;

const newStockAndDebtLogic = `      if (!isPending || isEditing) {
        // Stock logic via diffs
        const stockDiffs: Record<string, number> = {};
        if (isEditing) {
           originalCart.forEach(item => {
              stockDiffs[item.productId || item.id] = (stockDiffs[item.productId || item.id] || 0) + (item.quantity || 0);
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

        if (customerDetails.paymentType === "debt" && customerDetails.shopName) {
           const customerName = customerDetails.shopName;
           const debtDiff = isEditing ? (total - editingOriginalTotal) : total;

           if (debtDiff !== 0) {
               const existingDebt = debts.find(
                 (d) => d.customerName === customerName && d.status === "active"
               );
               
               if (existingDebt) {
                  batch.update(doc(db, "debts", existingDebt.id), {
                     amount: (existingDebt.amount || 0) + debtDiff,
                     remainingAmount: (existingDebt.remainingAmount || 0) + debtDiff,
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
               } else if (!isEditing && debtDiff > 0) {
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
      }`;

code = code.replace(oldStockAndDebtLogic, newStockAndDebtLogic);


// For the UI stuff
code = code.replace(`disabled={!!editingReceiptId}`, ``); // fix if exists
code = code.replace(`value={customerDetails.shopName}
                              onChange={(e) => {`, `value={customerDetails.shopName}
                              disabled={!!editingReceiptId}
                              onChange={(e) => {`);

code = code.replace(`{isProcessing
                      ? "چاوەڕێبە..."
                      : \`فرۆشتن (قەرز)\`}`, `{isProcessing
                      ? "چاوەڕێبە..."
                      : (editingReceiptId ? "نوێکردنەوەی وەسڵ" : \`فرۆشتن (قەرز)\`)}`);

code = code.replace(`<h2 className="text-xl font-bold text-slate-800">
                          سەرکەوتوو بوو!
                        </h2>
                        <p className="text-slate-500 text-sm mt-0.5">
                          پسوڵەکە بە سەرکەوتوویی تۆمارکرا
                        </p>`, `<h2 className="text-xl font-bold text-slate-800">
                          {editingReceiptId ? "نوێکرایەوە!" : "سەرکەوتوو بوو!"}
                        </h2>
                        <p className="text-slate-500 text-sm mt-0.5">
                          {editingReceiptId ? "وەسڵەکە بە سەرکەوتوویی نوێکرایەوە" : "پسوڵەکە بە سەرکەوتوویی تۆمارکرا"}
                        </p>`);

const originalCloseButtonText = `{editingReceiptId ? "داخستن" : "فرۆشتنێکی نوێ"}`; // if already there?
if(!code.includes(originalCloseButtonText)) {
  code = code.replace(`{
                          setSaleCompleted(false);
                          setCheckoutModalOpen(false);
                          setCart([]);
                          setMobileCartOpen(false);`, `{
                          setSaleCompleted(false);
                          setCheckoutModalOpen(false);
                          setCart([]);
                          setEditingReceiptId(null);
                          setMobileCartOpen(false);`);
  code = code.replace(`className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl font-bold transition-colors"
                      >
                        فرۆشتنێکی نوێ`, `className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl font-bold transition-colors"
                      >
                        {editingReceiptId ? "داخستن" : "فرۆشتنێکی نوێ"}`);
}


fs.writeFileSync(file, code);
