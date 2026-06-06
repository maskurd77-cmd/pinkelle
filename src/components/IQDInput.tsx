import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export function useExchangeRate() {
  const [rate, setRate] = useState(1500);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'system', 'settings'), (snap) => {
      if (snap.exists() && snap.data().exchangeRate) {
        setRate(Number(snap.data().exchangeRate));
      }
    });
    return unsub;
  }, []);

  return rate;
}

export function IQDInput({ usdValue, setUsdValue, label = 'نرخ بە دینار بنووسە' }: { usdValue: number|string, setUsdValue: (v: string|number) => void, label?: string }) {
  const rate = useExchangeRate();
  const [iqd, setIqd] = useState('');

  // This ensures if the user removes content, we empty IQD.
  useEffect(() => {
    if (usdValue === '' || isNaN(Number(usdValue))) {
      setIqd('');
    }
  }, [usdValue]);

  return (
    <div className="mt-1 flex items-center justify-between text-[11px] bg-slate-50 rounded border border-slate-200">
      <span className="text-slate-500 pr-2 font-bold whitespace-nowrap">{label} (IQD)</span>
      <input
        type="number"
        value={iqd}
        onChange={(e) => {
          setIqd(e.target.value);
          const val = Number(e.target.value);
          if (!isNaN(val) && val > 0) {
            setUsdValue(val / rate);
          } else {
            setUsdValue('');
          }
        }}
        className="w-1/2 min-w-[80px] bg-white border-l border-slate-200 py-1.5 px-2 focus:outline-none focus:bg-pink-50 transition-colors font-mono text-left"
        dir="ltr"
        placeholder="IQD"
      />
    </div>
  );
}
