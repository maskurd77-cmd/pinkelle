const fs = require('fs');

let stmt = fs.readFileSync('src/components/AccountStatementModal.tsx', 'utf-8');
stmt = stmt.replace(/\(r\.invoiceCurrency === "IQD"\s*\?\s*r\.totalAmount \/ \(r\.exchangeRate \|\| 1500\)\s*:\s*r\.totalAmount\)/g, "r.totalAmount");
stmt = stmt.replace(/tx\.originalCurrency === "IQD"\s*\?\s*\(tx\.originalAmount \|\| tx\.amount\) \/ \(tx\.exchangeRate \|\| 1500\)\s*:\s*\(tx\.originalAmount \|\| tx\.amount\)/g, "(tx.originalAmount || tx.amount)");
stmt = stmt.replace(/tx\.originalCurrency === "IQD"\s*\?\s*\(tx\.amount \|\| tx\.paidAmount \|\| 0\) \/ \(tx\.exchangeRate \|\| 1500\)\s*:\s*\(tx\.amount \|\| tx\.paidAmount \|\| 0\)/g, "(tx.amount || tx.paidAmount || 0)");
fs.writeFileSync('src/components/AccountStatementModal.tsx', stmt);

let debt = fs.readFileSync('src/components/DebtReceiptModal.tsx', 'utf-8');
debt = debt.replace(/transaction\.originalCurrency === "IQD"[\s\S]*?\(transaction\.exchangeRate \|\| 1500\)\s*:\s*transaction\.originalAmount \|\| transaction\.amount/g, "transaction.originalAmount || transaction.amount");

fs.writeFileSync('src/components/DebtReceiptModal.tsx', debt);
console.log('Fixed components');
