import React from 'react';
import { Construction } from 'lucide-react';

export default function Placeholder({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center">
      <div className="w-20 h-20 bg-pink-50 rounded-full flex items-center justify-center mb-6">
        <Construction size={32} className="text-pink-400" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">بەشی {title} لە ژێر کاردایە</h2>
      <p className="text-gray-500 max-w-md">
        ئەم بەشە هێشتا دروست نەکراوە. تکایە بەشەکانی "کالا" یان "کۆگا" تاقی بکەرەوە.
      </p>
    </div>
  );
}
