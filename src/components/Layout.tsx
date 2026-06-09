import React, { useState } from "react";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Archive,
  Users,
  FileText,
  ReceiptText,
  Banknote,
  LineChart,
  Undo2,
  Replace,
  Settings,
  Menu,
  X,
  Box,
  Search,
  LogOut,
  Tags,
  MapPin,
  Store,
  ScrollText,
} from "lucide-react";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";

interface LayoutProps {
  children: React.ReactNode;
  currentRoute: string;
  onNavigate: (route: string) => void;
  userData?: any;
}

const navItems = [
  { id: "dashboard", label: "داشبۆرد", icon: LayoutDashboard },
  { id: "menu", label: "مێنیو (Menu)", icon: Store },
  { id: "pos", label: "کاشێر (POS)", icon: ShoppingCart },
  { id: "customers", label: "کڕیاران", icon: Users },
  { id: "products", label: "کالا", icon: Package },
  { id: "warehouse", label: "کۆگا", icon: Archive },
  { id: "categories", label: "کەتەگۆرییەکان", icon: Tags },
  { id: "visits", label: "سەردانەکان", icon: MapPin },
  { id: "companies", label: "شەریکەکان", icon: Users },
  { id: "safes", label: "قاسەکان", icon: Banknote },
  { id: "debt", label: "دەفتەری قەرز", icon: FileText },
  { id: "debt_payments", label: "کەشف حساب", icon: ScrollText },
  { id: "receipts", label: "وەسڵەکان", icon: ReceiptText },
  { id: "expenses", label: "خەرجییەکان", icon: Banknote },
  { id: "reports", label: "راپۆرتەکان", icon: LineChart },
  { id: "returns", label: "گەڕانەوە", icon: Undo2 },
  { id: "exchanges", label: "گۆڕینەوە", icon: Replace },
  { id: "users", label: "بەکارهێنەران", icon: Users },
];

export default function Layout({
  children,
  currentRoute,
  onNavigate,
  userData,
}: LayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    signOut(auth);
  };

  const NavContent = () => (
    <div className="h-full flex flex-col">
      <div className="p-6 border-b border-slate-100 flex items-center gap-3">
        <img
          src="https://cheerful-pink-qakkchpr.edgeone.app/Pink%20Elle%20logo%20new-1_page-0001.jpg"
          alt="Pink Elle Logo"
          className="w-12 h-12 object-contain rounded-xl"
        />
        <div>
          <h1 className="font-bold text-lg leading-tight text-slate-900">
            Pink Elle
          </h1>
          <p className="text-[10px] text-pink-500 font-semibold tracking-wider uppercase">
            سیستەمی ژمێریاری
          </p>
        </div>
      </div>
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto custom-scrollbar">
        {navItems
          .filter((item) => {
            if (userData?.role === "admin") return true;
            // Return true only if their permissions array includes this item
            return (userData?.permissions || []).includes(item.id);
          })
          .map((item) => {
            const Icon = item.icon;
            const isActive = currentRoute === item.id;
            return (
              <button
                key={item.id}
                data-id={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors ${
                  isActive
                    ? "bg-pink-50 text-pink-700 font-medium"
                    : "text-slate-500 hover:bg-slate-50"
                }`}
              >
                <Icon
                  size={20}
                  className={isActive ? "text-pink-700" : "text-slate-400"}
                />
                <span className="text-sm">{item.label}</span>
              </button>
            );
          })}
      </nav>
      <div className="p-4 border-t border-slate-100 flex gap-2">
        {(userData?.role === "admin" ||
          (userData?.permissions || []).includes("settings")) && (
          <button
            onClick={() => onNavigate("settings")}
            className="flex-1 flex items-center justify-center gap-2 px-2 py-2 bg-slate-100 text-slate-800 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
          >
            <Settings size={16} /> ڕێکخستن
          </button>
        )}
        <button
          onClick={handleLogout}
          className="flex-1 flex items-center justify-center gap-2 px-2 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
        >
          <LogOut size={16} /> دەرچوون
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-[100dvh] bg-slate-50 flex text-slate-800 overflow-hidden print:h-auto print:overflow-visible print:bg-white">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 h-full border-l border-slate-200 bg-white flex-col shadow-sm shrink-0 print:hidden">
        <NavContent />
      </aside>

      {/* Mobile Drawer */}
      <div
        className={`fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 transition-opacity lg:hidden print:hidden ${isMobileMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={() => setIsMobileMenuOpen(false)}
      />
      <aside
        className={`fixed top-0 right-0 h-screen w-64 bg-white z-50 transform transition-transform duration-300 ease-in-out lg:hidden shadow-2xl print:hidden ${isMobileMenuOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        <button
          onClick={() => setIsMobileMenuOpen(false)}
          className="absolute top-[max(env(safe-area-inset-top),1rem)] left-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors z-10"
        >
          <X size={20} />
        </button>
        <NavContent />
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-[100dvh] lg:h-screen overflow-hidden relative print:overflow-visible print:h-auto print:block bg-slate-50 lg:bg-transparent">
        <div className="flex-1 pt-[max(env(safe-area-inset-top),0.5rem)] p-2 sm:p-4 lg:p-8 overflow-hidden flex flex-col relative z-auto print:overflow-visible print:h-auto print:block print:p-0">
          <div className="max-w-7xl mx-auto w-full h-full flex flex-col overflow-hidden print:overflow-visible print:h-auto print:block lg:bg-transparent">
            {children}
          </div>
        </div>

        {/* Mobile Bottom Tab Bar */}
        {currentRoute !== "pos" && (
          <nav className="mobile-bottom-tabs lg:hidden shrink-0 bg-white/95 backdrop-blur-2xl border-t border-pink-100/30 shadow-[0_-10px_40px_rgba(219,39,119,0.05)] z-[35] print:hidden relative pb-[env(safe-area-inset-bottom)]">
            <div className="flex items-center justify-around pb-2 pt-2 px-1">
              {(() => {
                const adminDefaultTabs = [
                  { id: "dashboard", label: "داشبۆرد", icon: LayoutDashboard },
                  { id: "receipts", label: "وەسڵەکان", icon: ReceiptText },
                  { id: "customers", label: "کڕیاران", icon: Users },
                  { id: "products", label: "کالا", icon: Package },
                ];
                if (userData?.role === "admin") return adminDefaultTabs;

                const allowed = navItems.filter((item) =>
                  (userData?.permissions || []).includes(item.id),
                );
                return allowed.slice(0, 4);
              })().map((item) => {
                const isActive = currentRoute === item.id;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    data-id={`mobile-${item.id}`}
                    onClick={() => onNavigate(item.id)}
                    className="flex flex-col items-center justify-center p-1.5 flex-1 relative group w-full h-full"
                  >
                    <div
                      className={`flex flex-col items-center justify-center gap-1.5 p-2 w-14 sm:w-16 rounded-2xl transition-all duration-300 ${isActive ? "bg-pink-50 text-pink-600 shadow-sm shadow-pink-500/10" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"}`}
                    >
                      <Icon
                        size={20}
                        className={isActive ? "stroke-[2.5px]" : "stroke-[2px]"}
                      />
                      <span
                        className={`text-[9px] sm:text-[10px] transition-colors whitespace-nowrap ${isActive ? "font-black text-pink-700" : "font-semibold text-slate-500"}`}
                      >
                        {item.label}
                      </span>
                    </div>
                  </button>
                );
              })}
              {/* زیاتر (More) Button */}
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="flex flex-col items-center justify-center p-1.5 flex-1 relative group w-full h-full"
              >
                <div className="flex flex-col items-center justify-center gap-1.5 p-2 w-14 sm:w-16 rounded-2xl text-slate-400 group-hover:text-slate-600 group-hover:bg-slate-50 transition-all duration-300">
                  <Menu size={20} className="stroke-[2px]" />
                  <span className="text-[9px] sm:text-[10px] font-semibold text-slate-500 whitespace-nowrap transition-colors">
                    زیاتر
                  </span>
                </div>
              </button>
            </div>
          </nav>
        )}
      </main>
    </div>
  );
}
