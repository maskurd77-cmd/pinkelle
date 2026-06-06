const fs = require('fs');

let dash = fs.readFileSync('src/pages/Dashboard.tsx', 'utf-8');

dash = dash.replace(/const \[exchangeRate, setExchangeRate\] = useState<number>.*?;\n/gs, '');
dash = dash.replace(/const \[isSavingEx, setIsSavingEx\] = useState.*?;\n/gs, '');

dash = dash.replace(/const handleUpdateExchangeRate[\s\S]*?setIsSavingEx\(false\);\n\s*};\n/gs, '');

dash = dash.replace(/const currency = r\.invoiceCurrency \|\| "IQD";\n\s*const amountUSD =\n\s*currency === "IQD"\n\s*\? \(r\.totalAmount \|\| 0\) \/ exchangeRate\n\s*: r\.totalAmount \|\| 0;/gs, 'const amountUSD = r.totalAmount || 0;');

dash = dash.replace(/const costUSD = currency === "IQD" \? cost \/ exchangeRate : cost;\n\s*const priceUSD = currency === "IQD" \? price \/ exchangeRate : price;/gs, 'const costUSD = cost;\n            const priceUSD = price;');

dash = dash.replace(/\{ \/\* Exchange Rate Setup \*\/ \}[\s\S]*?\{ \/\* Today's Overview \*\/ \}/g, '{ /* Today\'s Overview */ }');

dash = dash.replace(/, exchangeRate\]/g, ']');
dash = dash.replace(/\{ exchangeRate \}/g, '');
dash = dash.replace(/if \(docSnap\.exists\(\) && docSnap\.data\(\)\.exchangeRate\) \{[\s\S]*?\}/g, '');
dash = dash.replace(/const unsubSettings = onSnapshot\([\s\S]*?\}\n\s*\);\n/g, '');
dash = dash.replace(/unsubSettings\(\);/g, '');


fs.writeFileSync('src/pages/Dashboard.tsx', dash);

let misc = fs.readFileSync('src/pages/MiscPages.tsx', 'utf-8');

misc = misc.replace(/,\n\s*exchangeRate: 1500/g, '');
misc = misc.replace(/<div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">[\s\S]*?<\/div>/g, '');
// Misc has "val * (settings.exchangeRate || 1500)". Replate with "val"
misc = misc.replace(/val \* \(settings\.exchangeRate \|\| 1500\)/g, 'val');
misc = misc.replace(/val \/ \(settings\.exchangeRate \|\| 1500\)/g, 'val');
misc = misc.replace(/finalAmountToReduce = amountToReduce \* \(receipt\.exchangeRate \|\| 1500\);/g, 'finalAmountToReduce = amountToReduce;');


fs.writeFileSync('src/pages/MiscPages.tsx', misc);
console.log('Cleaned exchanged rate');
