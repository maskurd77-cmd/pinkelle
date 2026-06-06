const fs = require("fs");

let content = fs.readFileSync("src/pages/POS.tsx", "utf-8");
content = content.replace(/\{formatCurrency\(total, invoiceCurrency\)\}/g, "{formatCurrency(total)}");
content = content.replace(/\{formatCurrency\(subtotal, invoiceCurrency\)\}/g, "{formatCurrency(subtotal)}");
content = content.replace(/currency: itemCurrency,/g, 'currency: "USD",');
fs.writeFileSync("src/pages/POS.tsx", content);
console.log("Fixed POS.tsx");
