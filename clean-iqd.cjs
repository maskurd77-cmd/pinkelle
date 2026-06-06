const fs = require("fs");

// Clean POS.tsx
let pos = fs.readFileSync("src/pages/POS.tsx", "utf-8");
pos = pos.replace(/const \[convIQD, setConvIQD\] = useState\(""\);\n/g, "");
pos = pos.replace(/setConvIQD\(\(num \* exchangeRate\)\.toString\(\)\);\n/g, "");
pos = pos.replace(/setConvIQD\(""\);\n/g, "");
pos = pos.replace(/const handleConvIQDChange = \(val: string\) => \{\n\s*setConvIQD\(val\);\n\s*if \(val === ""\) \{\n\s*setPayment\(""\);\n\s*return;\n\s*\}\n\s*const num = parseFloat\(val\);\n\s*if \(\!isNaN\(num\)\) \{\n\s*const usdVal = num \/ exchangeRate;\n\s*setPayment\(usdVal\.toString\(\)\);\n\s*\}\n\s*\};\n/g, "");

// Remove exchange rate mapping mostly handled in earlier passes, but checking again
pos = pos.replace(/const itemCurrency = item\.currency \|\| "IQD";\n/g, "");
pos = pos.replace(/const itemCurrency = c\.currency \|\| "IQD";\n/g, "");
pos = pos.replace(/invoiceCurrency === "IQD"\n\s*\? applicablePrice \/ exchangeRate\n\s*: itemCurrency === "IQD"\n\s*\? applicablePrice \* exchangeRate\n\s*: applicablePrice/g, "applicablePrice");
pos = pos.replace(/invoiceCurrency === "IQD"\n\s*\? originalBasePrice \/ exchangeRate\n\s*: itemCurrency === "IQD"\n\s*\? originalBasePrice \* exchangeRate\n\s*: originalBasePrice/g, "originalBasePrice");
pos = pos.replace(/invoiceCurrency === "IQD"\n\s*\? \(originalBaseCost \|\| 0\) \/ exchangeRate\n\s*: itemCurrency === "IQD"\n\s*\? \(originalBaseCost \|\| 0\) \* exchangeRate\n\s*: originalBaseCost \|\| 0/g, "originalBaseCost || 0");

pos = pos.replace(/<div className="flex gap-4">[\s\S]*?دیناری عێراقی \(IQD\)[\s\S]*?<\/div>\n\s*<\/div>/g, "");
pos = pos.replace(/<div className="flex justify-between text-xs text-slate-500 font-bold mb-2">[\s\S]*?100\$ = \{exchangeRate \* 100\} IQD[\s\S]*?<\/div>/g, "");
// We also need to get rid of `const [invoiceCurrency, setInvoiceCurrency] = useState<"IQD" | "USD">("USD");` if it's there
pos = pos.replace(/const \[invoiceCurrency, setInvoiceCurrency\] = useState<"IQD" \| "USD">\("USD"\);\n/g, "");
pos = pos.replace(/<div className="grid grid-cols-2 gap-4">[\s\S]*?<label className="block text-sm font-bold text-slate-600 mb-1">\n\s*دراوی وەسڵ\n\s*<\/label>[\s\S]*?<\/select>\n\s*<\/div>/, '<div className="grid grid-cols-2 gap-4">');

// also clean debt amount IQD
pos = pos.replace(/const debtAmountIQD = total;/g, "const debtAmount = total;");
pos = pos.replace(/debtAmountIQD/g, "debtAmount");

fs.writeFileSync("src/pages/POS.tsx", pos);

// Reports
let reports = fs.readFileSync("src/pages/Reports.tsx", "utf-8");
reports = reports.replace(/const currency = r\.invoiceCurrency \|\| "IQD";\n/g, "");
reports = reports.replace(/if \(currency === "IQD"\) cAmount = cAmount \/ 1500;\n/g, "");
reports = reports.replace(/if \(currency === "IQD"\) \{\n\s*itemTotal = itemTotal \/ 1500;\n\s*itemProfit = itemProfit \/ 1500;\n\s*\}/g, "");
fs.writeFileSync("src/pages/Reports.tsx", reports);

// MiscPages
let misc = fs.readFileSync("src/pages/MiscPages.tsx", "utf-8");
misc = misc.replace(/returningReceipt\.invoiceCurrency \|\| "IQD"/g, '"USD"');
misc = misc.replace(/r\.invoiceCurrency \|\| "IQD"/g, '"USD"');
misc = misc.replace(/,\s*"USD"/g, ''); // Since default is USD anyway for format currency we dont need to pass USD everywhere
misc = misc.replace(/<div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">[\s\S]*?<label className="block text-sm font-bold text-slate-600 mb-2">\n\s*USD to IQD\n\s*<\/label>[\s\S]*?<\/div>/, "");
misc = misc.replace(/<div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">[\s\S]*?<label className="block text-sm font-bold text-slate-600 mb-2">\n\s*IQD to USD\n\s*<\/label>[\s\S]*?<\/div>/, "");
fs.writeFileSync("src/pages/MiscPages.tsx", misc);

console.log("Cleaned IQD in POS, Reports, MiscPages");
