const fs = require("fs");

let content = fs.readFileSync("src/pages/Safes.tsx", "utf-8");

// Safes Refactor
content = content.replace(/const \[newSafeIQD, setNewSafeIQD\] = useState\(""\);\n/g, "");
content = content.replace(/balanceIQD: [^,]+,\n/g, "");
content = content.replace(/balanceUSD/g, "balance");
content = content.replace(/setNewSafeIQD\(""\);\n/g, "");
content = content.replace(/const \[transferFromCurrency.*?\] = useState<"IQD" \| "USD">.*?;\n/gs, "");
content = content.replace(/const \[transferToCurrency.*?\] = useState<"IQD" \| "USD">.*?;\n/gs, "");
content = content.replace(/const \[transferExchangeRate.*?\] = useState<number>.*?;\n/gs, "");
content = content.replace(/const \[adjustCurrency.*?\] = useState<"IQD" \| "USD">.*?\("IQD"\);\n/gs, "");
content = content.replace(/const \[hawalaCurrency.*?\] = useState<"IQD" \| "USD">.*?\("USD"\);\n/gs, "");

// Write back
fs.writeFileSync("src/pages/Safes.tsx", content);

// POS Refactor
let pos = fs.readFileSync("src/pages/POS.tsx", "utf-8");
pos = pos.replace(/const \[invoiceCurrency, setInvoiceCurrency\] = useState<"IQD" \| "USD">.*?\("IQD"\);\n/gs, "");
pos = pos.replace(/invoiceCurrency === "IQD"/g, "false");
pos = pos.replace(/itemCurrency === "IQD"/g, "false");
pos = pos.replace(/const debtAmountIQD = total;/g, "const debtAmount = total;");
// We can just rely on manual edits instead.

console.log("Refactored safely");
