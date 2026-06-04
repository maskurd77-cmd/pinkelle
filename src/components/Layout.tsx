import React, { useState } from 'react';
import { LayoutDashboard, ShoppingCart, Package, Archive, Users, FileText, ReceiptText, Banknote, LineChart, Undo2, Replace, Settings, Menu, X, Box, Search, LogOut, Tags, MapPin, Store } from 'lucide-react';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';

interface LayoutProps {
  children: React.ReactNode;
  currentRoute: string;
  onNavigate: (route: string) => void;
  userData?: any;
}

const navItems = [
  { id: 'dashboard', label: 'داشبۆرد', icon: LayoutDashboard },
  { id: 'menu', label: 'مێنیو (Menu)', icon: Store },
  { id: 'pos', label: 'کاشێر (POS)', icon: ShoppingCart },
  { id: 'products', label: 'کالا', icon: Package },
  { id: 'warehouse', label: 'کۆگا', icon: Archive },
  { id: 'categories', label: 'کەتەگۆرییەکان', icon: Tags },
  { id: 'customers', label: 'کڕیاران', icon: Users },
  { id: 'visits', label: 'سەردانەکان', icon: MapPin },
  { id: 'companies', label: 'شەریکەکان', icon: Users },
  { id: 'safes', label: 'قاسەکان', icon: Banknote },
  { id: 'debt', label: 'دەفتەری قەرز', icon: FileText },
  { id: 'receipts', label: 'وەسڵەکان', icon: ReceiptText },
  { id: 'expenses', label: 'خەرجییەکان', icon: Banknote },
  { id: 'reports', label: 'راپۆرتەکان', icon: LineChart },
  { id: 'returns', label: 'گەڕانەوە', icon: Undo2 },
  { id: 'exchanges', label: 'گۆڕینەوە', icon: Replace },
  { id: 'users', label: 'بەکارهێنەران', icon: Users },
];

export default function Layout({ children, currentRoute, onNavigate, userData }: LayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    signOut(auth);
  };

  const NavContent = () => (
    <div className="h-full flex flex-col">
      <div className="p-6 border-b border-slate-100 flex items-center gap-3">
        <img src="https://skilled-indigo-cux52hz9.edgeone.app/Pink%20Elle%20logo%20new-1_page-0001.jpg" alt="Pink Elle Logo" className="w-12 h-12 object-contain rounded-xl" />
        <div>
          <h1 className="font-bold text-lg leading-tight text-slate-900">Pink Elle</h1>
          <p className="text-[10px] text-pink-500 font-semibold tracking-wider uppercase">سیستەمی ژمێریاری</p>
        </div>
      </div>
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto custom-scrollbar">
        {navItems.filter(item => {
           if (userData?.role === 'admin') return true;
           // Return true only if their permissions array includes this item
           return (userData?.permissions || []).includes(item.id);
        }).map((item) => {
          const Icon = item.icon;
          const isActive = currentRoute === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                onNavigate(item.id);
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors ${
                isActive 
                  ? 'bg-pink-50 text-pink-700 font-medium' 
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <Icon size={20} className={isActive ? 'text-pink-700' : 'text-slate-400'} />
              <span className="text-sm">{item.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="p-4 border-t border-slate-100 flex gap-2">
        {(userData?.role === 'admin' || (userData?.permissions || []).includes('settings')) && (
          <button onClick={() => onNavigate('settings')} className="flex-1 flex items-center justify-center gap-2 px-2 py-2 bg-slate-100 text-slate-800 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors">
            <Settings size={16} /> ڕێکخستن
          </button>
        )}
        <button onClick={handleLogout} className="flex-1 flex items-center justify-center gap-2 px-2 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors">
          <LogOut size={16} /> دەرچوون
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-screen bg-slate-50 flex text-slate-800 overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 h-full border-l border-slate-200 bg-white flex-col shadow-sm shrink-0 print:hidden">
        <NavContent />
      </aside>

      {/* Mobile Drawer */}
      <div className={`fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 transition-opacity lg:hidden print:hidden ${isMobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setIsMobileMenuOpen(false)} />
      <aside className={`fixed top-0 right-0 h-screen w-64 bg-white z-50 transform transition-transform duration-300 ease-in-out lg:hidden shadow-2xl print:hidden ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <button 
          onClick={() => setIsMobileMenuOpen(false)}
          className="absolute top-4 left-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors z-10"
        >
          <X size={20} />
        </button>
        <NavContent />
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-[100dvh] lg:h-screen overflow-hidden relative print:overflow-visible">
        
        {/* Mobile Top Header */}
        <div className="lg:hidden shrink-0 bg-white border-b border-slate-200 flex justify-between items-center px-4 py-3 z-20 print:hidden relative shadow-sm">
           <div className="flex items-center gap-2">
              <img src="https://skilled-indigo-cux52hz9.edgeone.app/Pink%20Elle%20logo%20new-1_page-0001.jpg" alt="Pink Elle Logo" className="w-8 h-8 object-contain rounded-lg" />
              <h1 className="font-extrabold tracking-tight text-slate-800 text-lg">Pink Elle</h1>
           </div>
           <button 
             onClick={() => setIsMobileMenuOpen(true)}
             className="p-1.5 text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
           >
             <Menu size={20} />
           </button>
        </div>

        <div className="flex-1 p-3 sm:p-4 lg:p-8 overflow-hidden flex flex-col relative z-0 print:overflow-visible print:p-0">
          <div className="max-w-7xl mx-auto w-full h-full flex flex-col overflow-hidden print:overflow-visible lg:bg-transparent">
            {children}
          </div>
        </div>

        {/* Mobile Bottom Tab Bar (Flex item, not floating, prevents overlap) */}
        <div className="lg:hidden shrink-0 bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] z-20 print:hidden relative">
           <div className="flex items-center justify-between pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1 px-1">
             {(() => {
                const adminDefaultTabs = [
                  { id: 'dashboard', label: 'داشبۆرد', icon: LayoutDashboard },
                  { id: 'pos', label: 'کاشێر', icon: ShoppingCart },
                  { id: 'products', label: 'کالا', icon: Package },
                  { id: 'receipts', label: 'وەسڵ', icon: ReceiptText },
                ];
                if (userData?.role === 'admin') return adminDefaultTabs;
                
                const allowed = navItems.filter(item => (userData?.permissions || []).includes(item.id));
                return allowed.slice(0, 4);
             })().map(item => {
               const isActive = currentRoute === item.id;
               const Icon = item.icon;
               return (
                 <button 
                   key={item.id}
                   onClick={() => onNavigate(item.id)}
                   className={`flex flex-col items-center justify-center py-2 flex-1 gap-1 relative transition-colors ${isActive ? 'text-pink-600' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-xl'}`}
                 >
                   {isActive && (
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-pink-600 rounded-b-full shadow-sm"></div>
                   )}
                   <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                   <span className={`text-[10px] ${isActive ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
                 </button>
               );
             })}
             {/* زیاتر (More) Button */}
             <button 
               onClick={() => setIsMobileMenuOpen(true)}
               className="flex flex-col items-center justify-center py-2 flex-1 gap-1 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-xl transition-colors"
             >
               <Menu size={20} strokeWidth={2} />
               <span className="text-[10px] font-medium">زیاتر</span>
             </button>
           </div>
        </div>
      </main>
    </div>
  );
}
