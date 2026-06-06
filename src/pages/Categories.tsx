import React, { useState, useEffect } from 'react';
import { Search, Plus, Edit, Trash2, Tags } from 'lucide-react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface Category {
  id: string;
  name: string;
}

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [name, setName] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'categories'), (snap) => {
      setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as Category)));
    });
    return () => unsub();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      await updateDoc(doc(db, 'categories', editingId), { name });
    } else {
      await addDoc(collection(db, 'categories'), { name });
    }
    closeModal();
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('دڵنیایت لە سڕینەوەی ئەم کەتەگۆرییە؟')) {
      await deleteDoc(doc(db, 'categories', id));
    }
  };

  const openModalForEdit = (c: Category) => {
    setEditingId(c.id);
    setName(c.name);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setName('');
  };

  const filtered = categories.filter(c => c.name.includes(search));

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
        
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white gap-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Tags className="text-pink-600" size={24} />
            کەتەگۆرییەکان
          </h2>
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-48 sm:flex-none">
              <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input 
                value={search}
                onChange={e => setSearch(e.target.value)}
                type="text" 
                placeholder="گەڕان..." 
                className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 pr-8 pl-3 text-xs focus:outline-none focus:ring-1 focus:ring-pink-500 transition-all text-slate-700"
              />
            </div>
            <button onClick={() => setIsModalOpen(true)} className="px-3 py-1.5 bg-pink-600 text-white rounded-lg text-sm font-medium hover:bg-pink-700 whitespace-nowrap flex items-center gap-1.5">
              <Plus size={16} /> کەتەگۆری نوێ
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filtered.map((category, i) => (
            <div key={category.id} className="bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-xl hover:shadow-pink-500/5 hover:-translate-y-1 transition-all duration-300 relative group flex flex-col items-center text-center">
               <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-50 to-pink-100 flex items-center justify-center text-pink-500 mb-5 shadow-inner border border-pink-100 group-hover:scale-110 transition-transform duration-300">
                  <Tags size={28} />
               </div>
               <h3 className="font-extrabold text-slate-800 text-lg mb-2 group-hover:text-pink-600 transition-colors">{category.name}</h3>
               
               <div className="w-8 h-1 bg-slate-100 rounded-full mb-6 group-hover:bg-pink-200 transition-colors"></div>
               
               <div className="flex items-center justify-center gap-3 w-full mt-auto">
                <button onClick={() => openModalForEdit(category)} className="flex-1 text-slate-500 hover:text-pink-600 hover:bg-pink-50 py-2 px-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm font-bold border border-transparent hover:border-pink-100">
                  <Edit size={16} /> دەستکاری
                </button>
                <div className="w-px h-6 bg-slate-200"></div>
                <button onClick={() => handleDelete(category.id)} className="flex-1 text-slate-500 hover:text-red-600 hover:bg-red-50 py-2 px-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm font-bold border border-transparent hover:border-red-100">
                  <Trash2 size={16} /> سڕینەوە
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full py-16 flex flex-col items-center justify-center text-slate-400">
              <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                 <Tags size={48} className="text-slate-300" strokeWidth={1.5} />
              </div>
              <p className="text-lg font-medium text-slate-500">هیچ کەتەگۆرییەک نەدۆزرایەوە.</p>
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-opacity">
          <form onSubmit={handleSubmit} className="bg-white rounded-[24px] shadow-2xl w-full max-w-md overflow-hidden transform transition-all">
             <div className="px-8 py-6 border-b border-slate-100 bg-white flex items-center gap-4">
               <div className="w-12 h-12 bg-pink-50 text-pink-600 rounded-2xl flex items-center justify-center shrink-0">
                 <Tags size={24} />
               </div>
               <div>
                  <h2 className="text-xl font-extrabold text-slate-800">
                    {editingId ? 'دەستکاری کەتەگۆری' : 'زیادکردنی کەتەگۆری نوێ'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-1 font-medium">زانیارییەکانی کەتەگۆرییەکە پڕبکەرەوە</p>
               </div>
            </div>
            <div className="p-8">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">ناوی کەتەگۆری</label>
                <input required type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all font-medium text-slate-800" placeholder="بۆ نموونە: شیرەمەنییەکان" />
              </div>
            </div>
            <div className="px-8 py-5 bg-slate-50/50 border-t border-slate-100 flex justify-end gap-3 custom-modal-footer">
              <button type="button" onClick={closeModal} className="px-5 py-2.5 text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-xl text-sm font-bold transition-colors">
                پاشگەزبوونەوە
              </button>
              <button type="submit" className="px-5 py-2.5 bg-pink-600 text-white hover:bg-pink-700 hover:shadow-lg hover:shadow-pink-500/30 rounded-xl text-sm font-bold transition-all transform active:scale-95">
                {editingId ? 'گۆڕانکارییەکان' : 'زیادکردن'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
