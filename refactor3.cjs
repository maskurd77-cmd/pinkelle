const fs = require('fs');

let content = fs.readFileSync('src/pages/Receipts.tsx', 'utf-8');

// The file calls `formatCurrency(value, receipt.invoiceCurrency || "IQD").replace(...)`
// We will replace all formatCurrency(..., receipt.invoiceCurrency || "IQD") with formatCurrency(...)
content = content.replace(/,\s*receipt\.invoiceCurrency \|\| "IQD"/g, "");
content = content.replace(/\.replace\(receipt\.invoiceCurrency \|\| "IQD", ""\)/g, "");
content = content.replace(/const itemCurrency = receipt\.invoiceCurrency \|\| "IQD";/g, 'const itemCurrency = "USD";');
content = content.replace(/formatCurrency\(\(receipt\.totalAmount \|\| receipt\.total \|\| 0\) \* receipt\.exchangeRate, "IQD"\)/g, 'formatCurrency((receipt.totalAmount || receipt.total || 0) * (receipt.exchangeRate || 1))');

fs.writeFileSync('src/pages/Receipts.tsx', content);
console.log('Receipts fixed');
