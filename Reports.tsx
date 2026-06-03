import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, Timestamp, doc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { formatCurrency } from '../data';
import { Users, Search, Phone, MapPin, CreditCard, ShoppingBag, Plus, X, Edit2, Trash2, Map as MapIcon, ExternalLink, Timer, PlayCircle, StopCircle, User, List, LocateFixed, FileText } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import AccountStatementModal from '../components/AccountStatementModal';

const pinkElleIcon = L.divIcon({
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
             <button type="submit" disabled={isSearching} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors">
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
                     <div className="text-slate-400 group-hover:text-indigo-500 mt-0.5 shrink-0"><MapPin size={16} /></div>
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

  return (
    <div className="flex flex-col h-full bg-slate-50 relative rounded-[24px] lg:border border-slate-200 overflow-hidden" dir="rtl">
      {/* Header */}
      <div className="bg-white px-6 py-5 border-b border-slate-200/60 sticky top-0 z-10 shadow-sm flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-pink-100 rounded-2xl flex items-center justify-center text-pink-600 shadow-inner">
            <Users size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800">کڕیاران</h1>
            <p className="text-sm font-medium text-slate-500">بینین و بەڕێوەبردنی کڕیارەکانتان</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-1 bg-slate-100 p-1.5 rounded-xl border border-slate-200/60 w-full sm:w-auto">
             <button
                onClick={() => setViewMode('list')}
                className={`px-4 py-2 text-sm font-bold rounded-lg transition-all duration-200 flex-1 flex items-center justify-center gap-2 ${viewMode === 'list' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
             >
                <List size={16} /> لیستی کڕیاران
             </button>
             <button
                onClick={() => setViewMode('map')}
                className={`px-4 py-2 text-sm font-bold rounded-lg transition-all duration-200 flex-1 flex items-center justify-center gap-2 ${viewMode === 'map' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
             >
                <MapIcon size={16} /> نەخشە
             </button>
          </div>
          <div className="relative w-full sm:w-auto">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="گەڕان بۆ کڕیار..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-72 bg-slate-50 hover:bg-slate-100/80 transition-colors border-none rounded-xl pr-10 pl-4 py-3 focus:outline-none focus:ring-2 focus:ring-pink-500/50 font-medium text-sm placeholder:text-slate-400"
            />
          </div>
          <button 
             onClick={openAddModal}
             className="w-full sm:w-auto bg-pink-600 hover:bg-pink-700 text-white px-5 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm transition-colors text-sm"
          >
             <Plus size={18} />
             کڕیاری نوێ
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
        {viewMode === 'list' ? (
           <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
               {filteredCustomers.map(customer => {
                  const customerReceipts = receipts.filter(r => r.customerName === customer.name);
                  const totalPurchases = customerReceipts.reduce((sum, r) => sum + (r.totalAmount || 0), 0);
                  const purchaseCount = customerReceipts.length;

                  const customerDebts = debts.filter(d => d.customerName === customer.name);
                  const totalDebt = customerDebts.reduce((sum, d) => sum + (d.remainingAmount || 0), 0);

                  return (
                    <div key={customer.id} className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-lg transition-shadow relative group">
                      <div className="absolute top-4 left-4 flex gap-1 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onClick={() => openEditModal(customer)} className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-500 flex items-center justify-center transition-colors">
                            <Edit2 size={16} />
                         </button>
                         <button onClick={() => handleDeleteCustomer(customer.id, customer.name)} className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition-colors">
                            <Trash2 size={16} />
                         </button>
                      </div>

                      <div className="flex items-center gap-3 mb-4">
                         <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-pink-500 to-pink-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                            {customer.name.charAt(0)}
                         </div>
                         <div className="pl-16">
                            <h3 className="font-extrabold text-slate-800 text-lg truncate max-w-full">{customer.name}</h3>
                            <div className="flex items-center gap-1 mt-0.5 opacity-80">
                               <Phone size={12} className="text-slate-400" />
                               <span className="text-xs text-slate-500 font-mono" dir="ltr">{customer.phone || 'بێ ژمارە'}</span>
                            </div>
                         </div>
                      </div>

                      <div className="flex items-center gap-2 mb-4">
                         <MapPin size={14} className="text-slate-400 shrink-0" />
                         <span className="text-sm text-slate-500 truncate block w-full flex-1">{customer.address || 'ناونیشان دیارینەکراوە'}</span>
                         {customer.locationUrl && (
                             <a href={customer.locationUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 w-8 h-8 flex items-center justify-center bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors" title="کردنەوەی نەخشە">
                                <MapIcon size={16} />
                             </a>
                         )}
                      </div>

                      <div className={`bg-slate-50 rounded-xl p-3 grid gap-2 mb-2 border border-slate-100 ${isAdmin ? 'grid-cols-2' : 'grid-cols-1'}`}>
                         {isAdmin && (
                            <div>
                              <span className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                                 <ShoppingBag size={12} />
                                 کڕینەکان ({purchaseCount})
                              </span>
                              <span className="font-bold text-slate-800 text-sm font-mono">{formatCurrency(totalPurchases)}</span>
                            </div>
                         )}
                         <div>
                           <span className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                              <CreditCard size={12} />
                              قەرزی ماوە
                           </span>
                           <span className={`font-bold text-sm font-mono ${totalDebt > 0 ? 'text-red-600' : 'text-slate-800'}`}>
                              {formatCurrency(totalDebt)}
                           </span>
                         </div>
                      </div>

                      {isAdmin && (
                         <div className="mb-2">
                             <button
                               onClick={() => setShowAccountStatement(customer)}
                               className="w-full bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 border border-slate-200 hover:border-indigo-200 px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                             >
                                <FileText size={14} />
                                کەشفی حیساب
                             </button>
                         </div>
                      )}

                      {/* Visits Section */}
                      <div className="mt-4 pt-3 border-t border-slate-100">
                         {(() => {
                             const activeVisit = visits.find(v => v.customerId === customer.id && v.status === 'active');
                             if (activeVisit) {
                                 return (
                                     <div className="flex items-center justify-between w-full bg-emerald-50 p-2.5 rounded-xl border border-emerald-100 shadow-sm">
                                        <div className="flex items-center gap-2.5">
                                            <Timer className="text-emerald-600 animate-pulse" size={18} />
                                            <div>
                                                <span className="text-xs font-bold text-emerald-800 block">سەردانی چالاک</span>
                                                <span className="text-[10px] text-emerald-600 font-medium block">{activeVisit.mandubName}</span>
                                            </div>
                                        </div>
                                        <button onClick={() => endVisit(activeVisit.id, activeVisit.startTime)} className="bg-emerald-600 text-white hover:bg-emerald-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1">
                                            <StopCircle size={14} />
                                            کۆتایی
                                        </button>
                                     </div>
                                 );
                             } else {
                                 return (
                                     <button onClick={() => handleStartVisitClick(customer)} className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 p-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all">
                                         <PlayCircle size={16} className="text-indigo-500" />
                                         دەستپێکردنی سەردان
                                     </button>
                                 );
                             }
                         })()}
                      </div>
                    </div>
                  );
               })}
               
               {filteredCustomers.length === 0 && (
                  <div className="bg-white rounded-3xl p-12 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 mt-10 max-w-lg mx-auto col-span-full">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-4">
                      <Users size={40} />
                    </div>
                    <p className="text-slate-500 font-bold text-lg">هیچ کڕیارێک نەدۆزرایەوە.</p>
                  </div>
               )}
           </div>
        ) : (
           <div className="flex-1 w-full h-full relative p-4">
              <div className="w-full h-[600px] lg:h-full rounded-2xl overflow-hidden shadow-sm border border-slate-200 z-0 relative">
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
                           <Marker key={customer.id} position={[lat, lng]} icon={pinkElleIcon}>
                              <Popup>
                                 <div className="p-1 font-sans" dir="rtl">
                                    <h4 className="font-extrabold text-slate-800 text-sm mb-1">{customer.name}</h4>
                                    <p className="text-xs text-slate-500 mb-2 truncate max-w-[200px]">{customer.address}</p>
                                    <div className="flex items-center gap-1 text-xs font-mono text-slate-600 mb-2" dir="ltr">
                                       <Phone size={10} /> {customer.phone}
                                    </div>
                                    <div className="mt-2 text-center">
                                       {activeVisit ? (
                                           <span className="text-xs font-bold text-emerald-600">لەسەرداندایە ({activeVisit.mandubName})</span>
                                       ) : (
                                           <button onClick={() => handleStartVisitClick(customer)} className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors w-full">
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
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSaveCustomer} className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
             <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-pink-50 rounded-bl-full -z-10 opacity-50"></div>
               <div>
                  <h2 className="text-xl font-extrabold text-slate-800">{editingCustomer ? 'دەستکاریکردنی کڕیار' : 'کڕیاری نوێ'}</h2>
                  <p className="text-sm font-medium text-slate-500 mt-1">{editingCustomer ? 'گۆڕانکاری لە زانیاریەکانی کڕیار بکە' : 'زانیاری کڕیار تۆماربکە'}</p>
               </div>
               <button type="button" onClick={() => setIsModalOpen(false)} className="w-10 h-10 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors">
                  <X size={20} />
               </button>
             </div>
             <div className="p-6 space-y-4">
                <div>
                   <label className="block text-sm font-bold text-slate-700 mb-1.5">ناوی کڕیار</label>
                   <input required type="text" value={newName} onChange={e => setNewName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-pink-500/50 font-medium" />
                </div>
                <div>
                   <label className="block text-sm font-bold text-slate-700 mb-1.5">ژمارە مۆبایل</label>
                   <input type="text" value={newPhone} onChange={e => setNewPhone(e.target.value)} dir="ltr" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-pink-500/50 font-mono text-left" />
                               <label className="flex items-center justify-between text-sm font-bold text-slate-700 mb-1.5">
                      <span className="flex items-center gap-1">
                         <MapIcon size={14} className="text-blue-500" />
                         لینکی نەخشە (یان شوێن دیاریبکە)
                      </span>
                      <div className="flex gap-2">
                         <button 
                           type="button" 
                           onClick={() => setIsLocationPickerOpen(true)}
                           className="text-xs text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-md font-semibold transition-colors"
                         >
                            دیاریکردن لە نەخشە
                         </button>
                         <button 
                           type="button" 
                           onClick={handleGetCurrentLocation}
                           className="text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-md font-semibold transition-colors"
                         >
                            GPS شوێنی ئێستا
                         </button>
                      </div>
                   </label>
                   <input type="url" value={newLocationUrl} onChange={e => setNewLocationUrl(e.target.value)} dir="ltr" placeholder="https://maps.google.com/?q=..." className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-mono text-left text-sm" />
                </div>
             </div>
             <div className="px-6 py-5 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 rounded-b-3xl">
               <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 text-slate-600 hover:bg-slate-200 rounded-xl text-sm font-bold transition-colors">
                 پاشگەزبوونەوە
               </button>
               <button type="submit" className="px-6 py-2.5 bg-pink-600 text-white hover:bg-pink-700 rounded-xl text-sm font-bold shadow-sm transition-colors">
                 پاشەکەوتکردن
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
         <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
               <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full -z-10 opacity-50"></div>
                 <div>
                    <h2 className="text-xl font-extrabold text-slate-800">ناوی مەندوب</h2>
                    <p className="text-sm font-medium text-slate-500 mt-1">تکایە ناوی خۆت بنووسە</p>
                 </div>
                 <button onClick={() => setShowMandubModal(null)} className="w-10 h-10 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors">
                    <X size={20} />
                 </button>
               </div>
               <div className="p-6">
                  <label className="block text-sm font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                     <User size={16} className="text-indigo-500" />
                     ناو
                  </label>
                  <input 
                     type="text" 
                     autoFocus
                     value={tempMandubName} 
                     onChange={e => setTempMandubName(e.target.value)} 
                     className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-medium" 
                     placeholder="بۆ نموونە: ئەحمەد..."
                  />
               </div>
               <div className="px-6 py-5 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 rounded-b-3xl">
                 <button onClick={() => setShowMandubModal(null)} className="px-6 py-2.5 text-slate-600 hover:bg-slate-200 rounded-xl text-sm font-bold transition-colors">
                   پاشگەزبوونەوە
                 </button>
                 <button 
                  onClick={() => {
                     if(tempMandubName.trim()) {
                         startVisit(showMandubModal, tempMandubName.trim());
                     }
                  }} 
                  disabled={!tempMandubName.trim()}
                  className="px-6 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 rounded-xl text-sm font-bold shadow-sm transition-colors">
                   دەستپێکردن
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
