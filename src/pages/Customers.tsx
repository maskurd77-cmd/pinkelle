import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, Timestamp, doc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { formatCurrency } from '../data';
import { Users, Search, Phone, MapPin, CreditCard, ShoppingBag, Plus, X, Edit2, Trash2, Map as MapIcon, ExternalLink, Timer, PlayCircle, StopCircle, User, List, LocateFixed, FileText, CheckCircle2 } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import AccountStatementModal from '../components/AccountStatementModal';
import CustomerProfile from './CustomerProfile';

const skyElleIcon = L.divIcon({
  html: `<div class="flex flex-col items-center drop-shadow-xl">
           <div class="w-12 h-12 bg-gradient-to-br from-pink-500 to-pink-600 rounded-full border-[3px] border-white flex items-center justify-center shadow-inner relative z-10 overflow-hidden">
               <span class="text-white font-extrabold text-sm italic font-serif">Pink<br/>Elle</span>
           </div>
           <div class="w-3 h-3 bg-pink-600 rotate-45 -mt-1.5 z-0"></div>
         </div>`,
  className: 'bg-transparent border-none',
  iconSize: [48, 54],
  iconAnchor: [24, 54],
  popupAnchor: [0, -50],
});

function MapSearchBox() {
  const map = useMap();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    setIsSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ' iraq')}`);
      const data = await res.json();
      setResults(data);
    } catch(err) {
      console.error(err);
    }
    setIsSearching(false);
  };

  const handleSelect = (lat: string, lon: string) => {
    map.flyTo([parseFloat(lat), parseFloat(lon)], 14);
    setResults([]);
    setQuery('');
  };

  return (
    <div className="leaflet-top leaflet-left pointer-events-auto" style={{ marginTop: '10px', marginLeft: '50px', zIndex: 1000 }}>
       <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden w-[300px]">
          <form onSubmit={handleSearch} className="flex items-center p-1 bg-white">
             <input 
               type="text" 
               value={query} 
               onChange={e => setQuery(e.target.value)} 
               placeholder="گەڕان بۆ شوێنێک لە نەخشە..." 
               className="w-full text-sm outline-none px-3 py-2 bg-transparent text-slate-800 font-bold"
               dir="rtl"
             />
             <button type="submit" disabled={isSearching} className="p-2 text-pink-600 hover:bg-pink-50 rounded-xl transition-colors">
                <Search size={18} />
             </button>
          </form>
          
          {results.length > 0 && (
            <div className="max-h-[300px] overflow-y-auto border-t border-slate-100 bg-white">
               {results.map((r, i) => (
                  <div 
                    key={i} 
                    onClick={() => handleSelect(r.lat, r.lon)}
                    className="p-3 border-b border-slate-50 last:border-0 hover:bg-slate-50 cursor-pointer flex gap-3 text-right group transition-colors"
                  >
                     <div className="text-slate-400 group-hover:text-pink-500 mt-0.5 shrink-0"><MapPin size={16} /></div>
                     <div className="text-xs text-slate-600 font-bold leading-relaxed">{r.display_name}</div>
                  </div>
               ))}
            </div>
          )}
       </div>
    </div>
  );
}

function MapController() {
  const map = useMap();
  useEffect(() => {
     // Optional: fit bounds here if needed
  }, [map]);

  const goToCurrentLocation = () => {
      if ('geolocation' in navigator) {
         navigator.geolocation.getCurrentPosition((pos) => {
             map.flyTo([pos.coords.latitude, pos.coords.longitude], 15);
         });
      }
  };

  return (
    <div className="leaflet-top leaflet-right" style={{ pointerEvents: 'auto', marginTop: '80px', marginRight: '10px' }}>
       <button 
         onClick={goToCurrentLocation}
         className="bg-white p-2 rounded-xl border border-slate-200 shadow-md hover:bg-slate-50 text-slate-700 transition"
         title="GPS Current Location"
       >
          <LocateFixed size={24} className="text-pink-600" />
       </button>
    </div>
  );
}

import LocationPickerModal from '../components/LocationPickerModal';

interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  locationUrl?: string;
  createdAt: any;
  lastPurchase: any;
}

interface Debt {
  id: string;
  customerName: string;
  remainingAmount: number;
  totalAmount?: number;
  paidAmount?: number;
  dueDate?: string;
  timestamp?: any;
}

interface Receipt {
  id: string;
  customerName: string;
  totalAmount: number;
  timestamp?: any;
  paymentType?: string;
}

interface Visit {
  id: string;
  customerId: string;
  mandubName: string;
  status: 'active' | 'completed';
  startTime: any;
  endTime: any;
  durationMinutes?: number;
}

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newLocationUrl, setNewLocationUrl] = useState('');
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  
  // Visit state
  const [mandubName, setMandubName] = useState(() => localStorage.getItem('mandubName') || '');
  const [showMandubModal, setShowMandubModal] = useState<Customer | null>(null);
  const [tempMandubName, setTempMandubName] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAccountStatement, setShowAccountStatement] = useState<Customer | null>(null);
  const [selectedCustomerForProfile, setSelectedCustomerForProfile] = useState<Customer | null>(null);

  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  useEffect(() => {
    // Fetch logged in user's name automatically
    if (auth.currentUser) {
      getDoc(doc(db, 'users', auth.currentUser.uid)).then((snap) => {
        if (snap.exists()) {
           const data = snap.data();
           if (data.name) {
             setMandubName(data.name);
             localStorage.setItem('mandubName', data.name);
           }
           if (data.role === 'admin') {
             setIsAdmin(true);
           }
        }
      });
    }

    const unsubCus = onSnapshot(collection(db, 'customers'), (snap) => {
      setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Customer)));
    });

    const unsubDebts = onSnapshot(collection(db, 'debts'), (snap) => {
      setDebts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Debt)));
    });

    const unsubReceipts = onSnapshot(collection(db, 'receipts'), (snap) => {
      setReceipts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Receipt)));
    });

    const unsubVisits = onSnapshot(collection(db, 'visits'), (snap) => {
      setVisits(snap.docs.map(d => ({ id: d.id, ...d.data() } as Visit)));
    });

    return () => {
      unsubCus();
      unsubDebts();
      unsubReceipts();
      unsubVisits();
    };
  }, []);

  const filteredCustomers = customers.filter(c => 
    c.name?.includes(searchTerm) || 
    c.phone?.includes(searchTerm)
  );

  const totalCustomersCount = customers.length;
  const totalOutstandingOfAll = debts.reduce((sum, d) => sum + (d.remainingAmount || 0), 0);
  const activeVisitsCount = visits.filter(v => v.status === 'active').length;

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return;
    
    if (editingCustomer) {
       await updateDoc(doc(db, 'customers', editingCustomer.id), {
          name: newName,
          phone: newPhone,
          address: newAddress,
          locationUrl: newLocationUrl
       });
    } else {
       await addDoc(collection(db, 'customers'), {
         name: newName,
         phone: newPhone,
         address: newAddress,
         locationUrl: newLocationUrl,
         createdAt: Timestamp.now(),
         lastPurchase: Timestamp.now()
       });
    }

    setNewName('');
    setNewPhone('');
    setNewAddress('');
    setNewLocationUrl('');
    setEditingCustomer(null);
    setIsModalOpen(false);
  };

  const openAddModal = () => {
    setEditingCustomer(null);
    setNewName(''); setNewPhone(''); setNewAddress(''); setNewLocationUrl('');
    setIsModalOpen(true);
  };

  const openEditModal = (c: Customer) => {
    setEditingCustomer(c);
    setNewName(c.name);
    setNewPhone(c.phone || '');
    setNewAddress(c.address || '');
    setNewLocationUrl(c.locationUrl || '');
    setIsModalOpen(true);
  };

  const handleDeleteCustomer = async (id: string, name: string) => {
    if(confirm(`دڵنیایت لە سڕینەوەی کڕیار (${name})؟`)) {
       await deleteDoc(doc(db, 'customers', id));
    }
  };

  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
            const { latitude, longitude } = position.coords;
            setNewLocationUrl(`https://www.google.com/maps?q=${latitude},${longitude}`);
        }, (error) => {
            alert('هەڵەیەک ڕوویدا لە کاتی وەرگرتنی شوێنەکە. تکایە دڵنیابە لە کردنەوەی GPS.');
        });
    } else {
        alert('گەڕان بەدوای شوێن لەم ئامێرەدا کارناکات.');
    }
  };

  const handleStartVisitClick = (customer: Customer) => {
    if (mandubName) {
       startVisit(customer, mandubName);
    } else {
       setShowMandubModal(customer);
       setTempMandubName('');
    }
  };

  const startVisit = async (c: Customer, mName: string) => {
    localStorage.setItem('mandubName', mName);
    setMandubName(mName);
    await addDoc(collection(db, 'visits'), {
        customerId: c.id,
        customerName: c.name,
        mandubName: mName,
        startTime: Timestamp.now(),
        endTime: null,
        status: 'active'
    });
    setShowMandubModal(null);
  };

  const endVisit = async (visitId: string, startTime: any) => {
    const end = Timestamp.now();
    const durationMins = Math.round((end.toMillis() - startTime.toMillis()) / 60000);
    await updateDoc(doc(db, 'visits', visitId), {
        endTime: end,
        durationMinutes: durationMins,
        status: 'completed'
    });
  };

  if (selectedCustomerForProfile) {
    return (
       <CustomerProfile 
           customer={selectedCustomerForProfile} 
           onBack={() => setSelectedCustomerForProfile(null)} 
       />
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 relative rounded-[24px] lg:border border-slate-100 overflow-hidden text-slate-800" dir="rtl">
      {/* Header */}
      <div className="bg-white/95 backdrop-blur-xl px-3 py-2.5 sm:px-5 sm:py-3.5 lg:px-8 lg:py-4.5 border-b border-slate-150 sticky top-0 z-10 flex flex-col gap-2.5 sm:gap-3.5 shrink-0 transition-all">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 sm:w-11 sm:h-11 bg-gradient-to-tr from-pink-500 to-rose-650 rounded-xl sm:rounded-2xl flex items-center justify-center text-white shadow-md shadow-pink-500/5 shrink-0">
              <Users size={18} className="sm:size-5.5" />
            </div>
            <div>
              <h1 className="text-base sm:text-xl lg:text-2xl font-black text-slate-900 tracking-tight">کڕیاران</h1>
              <p className="hidden md:block text-[11px] font-bold text-slate-400 mt-0.5 animate-fade-in">بینین و بەڕێވެبردنی کڕیارەکانتان بەشێوەیەی مۆدێرن و ئاسان</p>
            </div>
          </div>
          
          <button 
             onClick={openAddModal}
             className="bg-pink-600 hover:bg-pink-500 text-white px-3 sm:px-4.5 py-1.5 sm:py-2.5 rounded-xl sm:rounded-2xl font-bold flex items-center justify-center gap-1.5 shadow-md shadow-pink-600/5 transition-all text-[11px] sm:text-xs active:scale-[0.97]"
          >
             <Plus size={14} className="sm:size-4" />
             کڕیاری نوێ
          </button>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full">
          <div className="relative flex-1 w-full">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-450" size={14} />
            <input 
              type="text" 
              placeholder="گەڕان بۆ کڕیار بە ناو یان ژمارە..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-100/50 border border-slate-200 rounded-xl pr-9 pl-3.5 py-1.5 sm:py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-500/10 focus:border-pink-500 font-bold text-xs sm:text-sm placeholder:text-slate-400 text-slate-800 transition-all h-8 sm:h-10"
            />
          </div>

          <div className="flex items-center gap-0.5 bg-slate-100/65 p-0.5 rounded-xl border border-slate-200 shrink-0 w-full sm:w-auto h-8 sm:h-10">
             <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`flex-1 sm:px-4.5 h-full text-[11px] sm:text-xs font-black rounded-lg transition-all duration-200 flex items-center justify-center gap-1 ${viewMode === 'list' ? 'bg-white shadow-xs border border-slate-250 text-slate-800' : 'text-slate-500 hover:text-slate-800 hover:bg-white/30'}`}
             >
                <List size={13} /> لیست
             </button>
             <button
                type="button"
                onClick={() => setViewMode('map')}
                className={`flex-1 sm:px-4.5 h-full text-[11px] sm:text-xs font-black rounded-lg transition-all duration-200 flex items-center justify-center gap-1 ${viewMode === 'map' ? 'bg-white shadow-xs border border-slate-250 text-slate-800' : 'text-slate-500 hover:text-slate-800 hover:bg-white/30'}`}
             >
                <MapIcon size={13} /> نەخشە
             </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col min-h-0 bg-slate-50/40 relative overflow-hidden">
        {viewMode === 'list' ? (
           <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col w-full">
              {/* Quick Summary Cards - Beautiful & Informative */}
              <div className="px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5 shrink-0">
                <div className="bg-white border border-slate-150/80 rounded-2xl p-4.5 flex items-center gap-3.5 shadow-xs">
                  <span className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-pink-50 text-pink-600 flex items-center justify-center font-bold">
                    <Users size={18} />
                  </span>
                  <div>
                    <span className="text-[10px] sm:text-[11px] font-black text-slate-400 block mb-0.5">کۆی کڕیاران</span>
                    <span className="text-xs sm:text-sm font-black text-slate-800 font-mono">{totalCustomersCount} کڕیار</span>
                  </div>
                </div>

                <div className="bg-white border border-slate-150/80 rounded-2xl p-4.5 flex items-center gap-3.5 shadow-xs">
                  <span className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center font-bold">
                    <CreditCard size={18} />
                  </span>
                  <div>
                    <span className="text-[10px] sm:text-[11px] font-black text-slate-400 block mb-0.5">کۆی قەرزەکان</span>
                    <span className="text-xs sm:text-sm font-black text-rose-500 font-mono">{formatCurrency(totalOutstandingOfAll)}</span>
                  </div>
                </div>

                <div className="bg-white border border-slate-150/80 rounded-2xl p-4.5 flex items-center gap-3.5 shadow-xs col-span-2 lg:col-span-1">
                  <span className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-emerald-50 text-emerald-650 flex items-center justify-center font-bold">
                    <Timer size={18} />
                  </span>
                  <div>
                    <span className="text-[10px] sm:text-[11px] font-black text-slate-400 block mb-0.5">مەندوبەکان لە کاردان</span>
                    <span className="text-xs sm:text-sm font-black text-emerald-650 font-mono">{activeVisitsCount} سەردانی چالاک</span>
                  </div>
                </div>
              </div>

              <div className="p-4 sm:p-6 lg:p-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 sm:gap-6">
               {filteredCustomers.map(customer => {
                  const normalizeName = (name: string | null | undefined): string => {
                     if (!name) return "";
                     return name
                       .trim()
                       .replace(/\s+/g, " ")
                       .replace(/[ییێىي]/g, "ی")
                       .replace(/[ەەھة]/g, "ە")
                       .toLowerCase();
                  };

                  const customerReceipts = receipts.filter(r => normalizeName(r.customerName) === normalizeName(customer.name));
                  const totalPurchases = customerReceipts.reduce((sum, r) => sum + (r.totalAmount || 0), 0);
                  const purchaseCount = customerReceipts.length;

                   const customerDebts = debts.filter(d => normalizeName(d.customerName) === normalizeName(customer.name));
                   const totalDebt = customerDebts.reduce((sum, d) => sum + (d.remainingAmount || 0), 0);

                   return (
                    <div key={customer.id} className="bg-white border border-slate-150 rounded-[28px] overflow-hidden hover:border-pink-450 hover:shadow-xl hover:shadow-slate-200/45 transition-all duration-300 relative group flex flex-col shadow-xs">
                      <div className="absolute top-4 left-4 flex gap-1.5 bg-white/95 backdrop-blur-md p-1.5 rounded-xl opacity-100 lg:opacity-0 group-hover:opacity-100 transition-all z-10 shadow-md border border-slate-100">
                         <button onClick={() => openEditModal(customer)} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-pink-600 text-slate-600 hover:text-white flex items-center justify-center transition-all">
                            <Edit2 size={13} />
                         </button>
                         <button onClick={() => handleDeleteCustomer(customer.id, customer.name)} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-rose-600 text-slate-600 hover:text-white flex items-center justify-center transition-all">
                            <Trash2 size={13} />
                         </button>
                      </div>

                      <div className="p-5 sm:p-6 flex flex-col h-full">
                        <div className="flex items-center gap-4 mb-6">
                           <div 
                             onClick={() => setSelectedCustomerForProfile(customer)}
                             className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-pink-50 to-rose-50 border border-pink-100/40 flex items-center justify-center text-pink-600 font-black text-2xl shadow-sm cursor-pointer hover:scale-105 transition-transform shrink-0"
                             title="کردنەوەی پڕۆفایل"
                           >
                              {customer.name.charAt(0)}
                           </div>
                           <div className="flex-1 pr-1 truncate">
                              <h3 
                                onClick={() => setSelectedCustomerForProfile(customer)}
                                className="font-extrabold text-slate-900 text-lg sm:text-xl truncate mb-1 cursor-pointer hover:text-pink-600 transition-colors"
                                title="کردنەوەی پڕۆفایل"
                              >
                                 {customer.name}
                              </h3>
                              <div className="flex items-center gap-1.5 opacity-90">
                                 <Phone size={13} className="text-pink-600/80" />
                                 <span className="text-xs font-bold text-slate-500 font-mono tracking-wide" dir="ltr">{customer.phone || 'بێ ژمارە'}</span>
                              </div>
                           </div>
                        </div>

                        <div className="flex items-center gap-2 mb-6 bg-slate-50 p-3 rounded-xl border border-slate-100">
                           <MapPin size={15} className="text-sky-500 shrink-0" />
                           <span className="text-[12px] font-bold text-slate-600 truncate block w-full flex-1">{customer.address || 'ناونیشان دیارینەکراوە'}</span>
                           {customer.locationUrl && (
                               <a href={customer.locationUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 w-8 h-8 flex items-center justify-center bg-white border border-slate-200 hover:bg-pink-600 hover:text-white hover:border-transparent text-pink-600 rounded-lg transition-all" title="کردنەوەی نەخشە">
                                  <MapIcon size={14} />
                               </a>
                           )}
                        </div>

                        <div className={`grid gap-3 mb-5 ${isAdmin ? 'grid-cols-2' : 'grid-cols-1'}`}>
                           {isAdmin && (
                              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                                 <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 mb-1.5">
                                    <ShoppingBag size={13} className="text-slate-400" />
                                    کڕینەکان ({purchaseCount})
                                 </span>
                                 <span className="font-extrabold text-pink-600 text-sm font-mono tracking-tight">{formatCurrency(totalPurchases)}</span>
                              </div>
                           )}
                           <div className={`${totalDebt > 0 ? 'bg-rose-50 border-rose-100/65' : 'bg-slate-50 border-slate-100'} border rounded-xl p-3`}>
                             <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 mb-1.5">
                                <CreditCard size={13} className={totalDebt > 0 ? 'text-rose-600' : 'text-slate-400'} />
                                قەرزی ماوە
                             </span>
                             <span className={`font-extrabold text-sm font-mono tracking-tight ${totalDebt > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                                {formatCurrency(totalDebt)}
                             </span>
                           </div>
                        </div>

                        <div className="mt-auto space-y-4">
                          {isAdmin && (
                             <button
                               onClick={() => setShowAccountStatement(customer)}
                               className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm"
                             >
                                <FileText size={14} />
                                کەشفی حیساب
                             </button>
                          )}
                          
                          {/* Visits Section */}
                          <div className="pt-4 border-t border-slate-100">
                             {(() => {
                                 const activeVisit = visits.find(v => v.customerId === customer.id && v.status === 'active');
                                 if (activeVisit) {
                                     return (
                                         <div className="flex items-center justify-between w-full bg-emerald-50 p-3 rounded-xl border border-emerald-100 shadow-sm">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0 border border-emerald-100">
                                                  <Timer className="text-emerald-550 animate-pulse" size={16} />
                                                </div>
                                                <div>
                                                    <span className="text-xs font-bold text-emerald-800 block mb-0.5">سەردانی چالاک</span>
                                                    <span className="text-[11px] text-emerald-600 font-semibold block bg-emerald-100/60 px-2 py-0.5 rounded-md inline-block">{activeVisit.mandubName}</span>
                                                </div>
                                            </div>
                                            <button onClick={() => endVisit(activeVisit.id, activeVisit.startTime)} className="bg-emerald-600 text-white hover:bg-emerald-500 px-3.5 py-2 rounded-lg text-[11px] font-black transition-all shadow-lg shadow-emerald-600/10 flex items-center gap-1.5 active:scale-95">
                                                <StopCircle size={14} />
                                                کۆتایی
                                            </button>
                                         </div>
                                     );
                                 } else {
                                     return (
                                         <button onClick={() => handleStartVisitClick(customer)} className="w-full bg-pink-50 hover:bg-pink-100 hover:border-pink-200 border border-pink-100 text-pink-600 py-3 rounded-xl text-[12px] font-black flex items-center justify-center gap-2 transition-all shadow-sm">
                                             <PlayCircle size={16} className="text-pink-550" />
                                             دەستپێکردنی سەردان
                                         </button>
                                     );
                                 }
                             })()}
                          </div>
                        </div>
                      </div>
                    </div>
                   );
                })}
                
                {filteredCustomers.length === 0 && (
                   <div className="bg-white rounded-[32px] p-12 flex flex-col items-center justify-center border border-slate-150 mt-10 w-full col-span-full shadow-sm max-w-2xl mx-auto py-24">
                     <div className="w-24 h-24 bg-slate-50 border border-slate-150 rounded-3xl flex items-center justify-center text-slate-400 mb-6 shadow-inner transform -rotate-6">
                       <Users size={48} />
                     </div>
                     <h3 className="text-slate-800 font-black text-xl mb-2">هیچ کڕیارێک نەدۆزرایەوە</h3>
                     <p className="text-slate-500 font-medium text-sm max-w-sm text-center leading-relaxed">دەتوانیت کڕیارێکی نوێ زیاد بکەیت لە ڕێگەی دوگمەی "کڕیاری نوێ" لە سەرەوەی پەڕەکە.</p>
                   </div>
                )}
             </div>
           </div>
        ) : (
           <div className="flex-1 w-full h-full relative p-4 min-h-0 flex flex-col">
              <div className="w-full h-full flex-1 rounded-[24px] overflow-hidden shadow-xs border border-slate-205 z-0 relative bg-white">
                 <MapContainer 
                    center={[36.1901, 44.0094]} // Default center (Erbil)
                    zoom={12} 
                    style={{ height: '100%', width: '100%' }}
                 >
                    <MapController />
                    <MapSearchBox />
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />
                    {filteredCustomers.map(customer => {
                        if (!customer.locationUrl) return null;
                        
                        // Extract lat,lng from google maps link
                        // Various formats: ?q=lat,lng or @lat,lng
                        let lat = 0, lng = 0;
                        try {
                           const qMatch = customer.locationUrl.match(/q=([\d.-]+),([\d.-]+)/);
                           const atMatch = customer.locationUrl.match(/@([\d.-]+),([\d.-]+)/);
                           if (qMatch) {
                               lat = parseFloat(qMatch[1]);
                               lng = parseFloat(qMatch[2]);
                           } else if (atMatch) {
                               lat = parseFloat(atMatch[1]);
                               lng = parseFloat(atMatch[2]);
                           }
                        } catch (e) {
                           return null;
                        }

                        if (lat === 0 && lng === 0) return null;

                        const activeVisit = visits.find(v => v.customerId === customer.id && v.status === 'active');

                        return (
                           <Marker key={customer.id} position={[lat, lng]} icon={skyElleIcon}>
                              <Popup>
                                 <div className="p-1 font-sans" dir="rtl">
                                    <h4 className="font-extrabold text-slate-800 text-sm mb-1">{customer.name}</h4>
                                    <p className="text-xs text-slate-500 mb-2 truncate max-w-[200px]">{customer.address}</p>
                                    <div className="flex items-center gap-1 text-xs font-mono text-slate-600 mb-2" dir="ltr">
                                       <Phone size={10} /> {customer.phone}
                                    </div>
                                    <div className="mt-2 text-center flex flex-col gap-1.5 border-t border-slate-100 pt-2">
                                       <button onClick={() => setSelectedCustomerForProfile(customer)} className="bg-pink-100 text-pink-700 hover:bg-pink-200 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors w-full">
                                          کردنەوەی پڕۆفایل
                                       </button>
                                       {activeVisit ? (
                                           <span className="text-xs font-bold text-emerald-600">لەسەرداندایە ({activeVisit.mandubName})</span>
                                       ) : (
                                           <button onClick={() => handleStartVisitClick(customer)} className="bg-pink-50 text-pink-600 hover:bg-pink-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors w-full">
                                              سەردانی کڕیار
                                           </button>
                                       )}
                                    </div>
                                 </div>
                              </Popup>
                           </Marker>
                        );
                    })}
                 </MapContainer>
              </div>
           </div>
        )}
      </div>
      {/* Add Customer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSaveCustomer} className="bg-white border border-slate-150 rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden flex flex-col transform transition-all animate-in zoom-in-95 duration-200 text-slate-800">
             <div className="px-8 py-6 border-b border-slate-150 flex justify-between items-center relative overflow-hidden bg-slate-50/50">
               <div className="absolute -top-10 -right-10 w-32 h-32 bg-pink-500/5 rounded-full blur-2xl"></div>
               <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-sky-500/5 rounded-full blur-2xl"></div>
               
               <div className="relative z-10 flex items-center gap-4">
                  <div className="w-12 h-12 bg-pink-50 border border-pink-100/40 text-pink-600 rounded-2xl flex items-center justify-center">
                     <Users size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900">{editingCustomer ? 'دەستکاریکردنی کڕیار' : 'کڕیاری نوێ'}</h2>
                    <p className="text-xs font-bold text-slate-400 mt-1">{editingCustomer ? 'کڕیارەکە ڕێکبخە لە سیستەم' : 'زانیاری نوێ کڕیار تۆماربکە'}</p>
                  </div>
               </div>
               <button type="button" onClick={() => setIsModalOpen(false)} className="w-10 h-10 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-sm absolute top-6 left-6 z-10">
                  <X size={18} />
               </button>
             </div>
             
             <div className="p-8 space-y-5 bg-white">
                <div className="space-y-1.5">
                   <label className="text-sm font-extrabold text-slate-700 flex items-center gap-1.5">
                      <User size={16} className="text-slate-400" />
                      ناوی کڕیار <span className="text-pink-550">*</span>
                   </label>
                   <input required type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="بۆ نموونە: کۆمپانیای ئەلفا..." className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 focus:outline-none focus:ring-2 focus:ring-pink-500/10 focus:border-pink-500 font-bold transition-all text-slate-800 placeholder:text-slate-400" />
                </div>
                
                <div className="space-y-1.5">
                    <label className="text-sm font-extrabold text-slate-700 flex items-center gap-1.5">
                       <Phone size={16} className="text-slate-405" />
                       ژمارە مۆبایل
                    </label>
                    <input type="tel" value={newPhone} onChange={e => setNewPhone(e.target.value)} dir="ltr" placeholder="0750 000 0000" className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 focus:outline-none focus:ring-2 focus:ring-pink-500/10 focus:border-pink-500 font-mono font-bold text-left transition-all text-slate-800 placeholder:text-slate-405 tracking-wide" />
                 </div>
                 
                 <div className="space-y-1.5">
                    <div className="flex items-center justify-between mb-1.5 relative z-10">
                       <label className="text-sm font-extrabold text-slate-705 flex items-center gap-1.5">
                          <MapPin size={16} className="text-slate-400" />
                          لینکی نەخشە یان شوێن
                       </label>
                       <div className="flex gap-2">
                          <button 
                            type="button" 
                            onClick={handleGetCurrentLocation}
                            className="text-[10px] sm:text-[11px] text-pink-600 bg-pink-50 border border-pink-100/50 hover:bg-pink-100 px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1 shadow-sm"
                          >
                             <LocateFixed size={12} />
                             GPS-ی ئێستا
                          </button>
                          <button 
                            type="button" 
                            onClick={() => setIsLocationPickerOpen(true)}
                            className="text-[10px] sm:text-[11px] text-sky-600 bg-sky-50 border border-sky-100/50 hover:bg-sky-100 px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1 shadow-sm"
                          >
                             <MapIcon size={12} />
                             دیاریکردن
                          </button>
                       </div>
                    </div>
                    <input type="url" value={newLocationUrl} onChange={e => setNewLocationUrl(e.target.value)} dir="ltr" placeholder="https://maps.google.com/?q=..." className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 focus:outline-none focus:ring-2 focus:ring-pink-500/10 focus:border-pink-500 font-mono font-bold text-left text-sm transition-all text-slate-800 placeholder:text-slate-400" />
                 </div>
             </div>
             
             <div className="px-8 py-5 bg-slate-50 border-t border-slate-150 flex justify-end gap-3 rounded-b-[32px]">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 rounded-2xl text-sm font-bold transition-all">
                  پاشگەزبوونەوە
                </button>
                <button type="submit" className="px-8 py-3 bg-pink-600 hover:bg-pink-500 text-white rounded-2xl text-sm font-bold shadow-lg shadow-pink-600/10 transition-all flex items-center gap-2">
                  پاشەکەوتکردن <CheckCircle2 size={16} />
                </button>
             </div>
          </form>
        </div>
      )}

      {/* Location Picker Modal */}
      <LocationPickerModal 
        isOpen={isLocationPickerOpen} 
        onClose={() => setIsLocationPickerOpen(false)}
        onSelectLocation={(lat, lng) => {
           setNewLocationUrl(`https://maps.google.com/?q=${lat},${lng}`);
        }}
      />

      {/* Mandub Name Modal */}
      {showMandubModal && (
         <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-slate-150 rounded-[32px] shadow-2xl w-full max-w-sm overflow-hidden flex flex-col transform transition-all animate-in zoom-in-95 duration-200 text-slate-800">
               <div className="px-8 py-6 border-b border-slate-150 flex justify-between items-center relative overflow-hidden bg-slate-50/50">
                 <div className="absolute -top-10 -right-10 w-32 h-32 bg-pink-500/5 rounded-full blur-2xl"></div>
                 <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-sky-500/5 rounded-full blur-2xl"></div>
                 
                 <div className="relative z-10 flex items-center gap-4">
                    <div className="w-12 h-12 bg-pink-50 border border-pink-100/40 text-pink-600 rounded-2xl flex items-center justify-center">
                       <User size={24} />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-slate-900">ناوی مەندوب</h2>
                      <p className="text-xs font-bold text-slate-400 mt-1">تکایە ناوی خۆت بنووسە</p>
                    </div>
                 </div>
                 <button onClick={() => setShowMandubModal(null)} className="w-10 h-10 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-xs absolute top-6 left-6 z-10">
                    <X size={18} />
                 </button>
               </div>
               <div className="p-8 bg-white">
                  <label className="text-sm font-extrabold text-slate-705 mb-2 flex items-center gap-1.5">
                     <User size={16} className="text-slate-400" />
                     ناو <span className="text-pink-500">*</span>
                  </label>
                  <input 
                     type="text" 
                     autoFocus
                     value={tempMandubName} 
                     onChange={e => setTempMandubName(e.target.value)} 
                     className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 focus:outline-none focus:ring-2 focus:ring-pink-500/10 focus:border-pink-500 font-bold transition-all text-slate-800 placeholder:text-slate-400" 
                     placeholder="بۆ نموونە: ئەحمەد..."
                  />
               </div>
               <div className="px-8 py-5 bg-slate-50 border-t border-slate-150 flex justify-end gap-3 rounded-b-[32px]">
                 <button onClick={() => setShowMandubModal(null)} className="px-6 py-3 text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 rounded-2xl text-sm font-bold transition-all">
                   پاشگەزبوونەوە
                 </button>
                 <button 
                  onClick={() => {
                     if(tempMandubName.trim()) {
                         startVisit(showMandubModal, tempMandubName.trim());
                     }
                  }} 
                  disabled={!tempMandubName.trim()}
                  className="px-8 py-3 bg-pink-600 hover:bg-pink-500 disabled:opacity-50 disabled:bg-slate-100 rounded-2xl text-sm font-bold shadow-lg shadow-pink-600/10 transition-all active:scale-95 flex items-center gap-2 text-white">
                   دەستپێکردن
                   <PlayCircle size={16} />
                 </button>
               </div>
            </div>
         </div>
      )}

      {/* Account Statement Modal */}
      {showAccountStatement && (
         <AccountStatementModal 
            customer={showAccountStatement} 
            receipts={receipts} 
            debts={debts} 
            onClose={() => setShowAccountStatement(null)} 
         />
      )}
    </div>
  );
}
