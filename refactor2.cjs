const fs = require("fs");

let safes = fs.readFileSync("src/pages/Safes.tsx", "utf-8");

safes = safes.replace(/const calculateReceivedAmount = \(\) => {[\s\S]*?return amount;\n  };\n/g, "");
safes = safes.replace(/const receivedAmount = calculateReceivedAmount\(\);/g, "const receivedAmount = amount;");
safes = safes.replace(/\s*if \(transferFromCurrency === "IQD"\) {[\s\S]*?\} else {([\s\S]*?)\}/g, "$1");
safes = safes.replace(/\s*if \(transferToCurrency === "IQD"\) {[\s\S]*?\} else {([\s\S]*?)\}/g, "$1");

safes = safes.replace(/currency: transferFromCurrency,/g, "currency: 'USD',");
safes = safes.replace(/receivedCurrency: transferToCurrency,/g, "receivedCurrency: 'USD',");
safes = safes.replace(/exchangeRate:\s*transferFromCurrency[\s\S]*?ull,/g, "exchangeRate: 1,");
safes = safes.replace(/setTransferExchangeRate\(.*?\);/g, "");


safes = safes.replace(/\s*if \(adjustCurrency === "IQD"\) {[\s\S]*?\} else {([\s\S]*?)\}/g, "$1");
safes = safes.replace(/currency: adjustCurrency,/g, "currency: 'USD',");
safes = safes.replace(/currency: hawalaCurrency,/g, "currency: 'USD',");

safes = safes.replace(/\s*if \(hawalaCurrency === "IQD"\) {[\s\S]*?\} else {([\s\S]*?)\}/g, "$1");

safes = safes.replace(/<div[^>]*>\s*<label[^>]*>\s*بالانسی دینار \(IQD\)[\s\S]*?<\/div>/, "");
safes = safes.replace(/<div[^>]*>\s*<label[^>]*>\s*بە پارەی[\s\S]*?<\/select>\s*<\/div>/g, "");
safes = safes.replace(/<div className="flex gap-2">[\s\S]*?setHawalaCurrency[\s\S]*?<\/select>/g, `<div className="flex gap-2">`);
safes = safes.replace(/<div className="flex gap-2">[\s\S]*?setTransferFromCurrency[\s\S]*?<\/select>/g, `<div className="flex gap-2">`);
safes = safes.replace(/<div className="flex gap-2">[\s\S]*?setTransferToCurrency[\s\S]*?<\/select>/g, `<div className="flex gap-2">`);
safes = safes.replace(/<div className="flex gap-2">[\s\S]*?setAdjustCurrency[\s\S]*?<\/select>/g, `<div className="flex gap-2">`);

safes = safes.replace(/\{transferFromCurrency !== transferToCurrency && \([\s\S]*?\}\)/g, "");
safes = safes.replace(/<span className="text-xs text-slate-400 font-bold bg-slate-100 px-3 py-2 rounded-xl">\s*\{transferToCurrency\}\s*<\/span>/g, "");
safes = safes.replace(/<span className="text-xs text-slate-400 font-bold bg-slate-100 px-3 py-2 rounded-xl">\s*\{hawalaCurrency\}\s*<\/span>/g, "");


fs.writeFileSync("src/pages/Safes.tsx", safes);

let pos = fs.readFileSync("src/pages/POS.tsx", "utf-8");
let lines = pos.split("\n");
lines.splice(20, 1); // Remove the duplicate Trash2 (line 21 is index 20)
fs.writeFileSync("src/pages/POS.tsx", lines.join("\n"));
console.log("Safes and POS refactored");
