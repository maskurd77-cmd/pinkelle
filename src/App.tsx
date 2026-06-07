import { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import MenuPage from './pages/Menu';
import Products from './pages/Products';
import Warehouse from './pages/Warehouse';
import POS from './pages/POS';
import Companies from './pages/Companies';
import Categories from './pages/Categories';
import Customers from './pages/Customers';
import DebtBook from './pages/DebtBook';
import DebtPayments from './pages/DebtPayments';
import Receipts from './pages/Receipts';
import Expenses from './pages/Expenses';
import Reports from './pages/Reports';
import { Returns, Exchanges, UsersPage, SettingsPage } from './pages/MiscPages';
import VisitsPage from './pages/Visits';
import SafesPage from './pages/Safes';
import Placeholder from './pages/Placeholder';
import AuthPage from './pages/Auth';

export default function App() {
  const [currentRoute, setCurrentRoute] = useState('pos');
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
         try {
            const docRef = doc(db, 'users', currentUser.uid);
            const docSnap = await getDoc(docRef);
            if(docSnap.exists()) {
               const data = docSnap.data();
               setUserData(data);
            } else {
               setUserData(null);
               // Removed the auto-admin creation block to prevent security flaw
            }
         } catch(e) { }
      } else {
         setUserData(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (userData && userData.role !== 'admin') {
      const perms = userData.permissions || [];
      if (!perms.includes(currentRoute) && perms.length > 0) {
        setCurrentRoute(perms[0]);
      }
    }
  }, [userData]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600"></div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  const hasAccess = (pageId: string) => {
     if (userData?.role === 'admin') return true;
     const perms = userData?.permissions || [];
     return perms.includes(pageId);
  };

  const renderPage = () => {
    if (!hasAccess(currentRoute)) {
        return <div className="text-center py-20 text-red-500 font-bold text-xl flex h-full items-center justify-center">ببورە، دەسەڵاتت نییە بۆ بینینی ئەم بەشە. تکایە پەیوەندی بە بەڕێوەبەر بکە.</div>;
    }

    switch (currentRoute) {
      case 'dashboard': return <Dashboard />;
      case 'menu': return <MenuPage />;
      case 'pos': return <POS />;
      case 'products': return <Products />;
      case 'warehouse': return <Warehouse />;
      case 'customers': return <Customers />;
      case 'companies': return <Companies />;
      case 'safes': return <SafesPage />;
      case 'categories': return <Categories />;
      case 'debt': return <DebtBook />;
      case 'debt_payments': return <DebtPayments userRole={userData?.role} userName={userData?.name} />;
      case 'receipts': return <Receipts />;
      case 'expenses': return <Expenses />;
      case 'reports': return <Reports />;
      case 'returns': return <Returns />;
      case 'exchanges': return <Exchanges />;
      case 'visits': return <VisitsPage />;
      case 'users': return <UsersPage />;
      case 'settings': return <SettingsPage />;
      default: return <Placeholder title={currentRoute} />;
    }
  };

  return (
    <Layout currentRoute={currentRoute} onNavigate={setCurrentRoute} userData={userData}>
      {renderPage()}
    </Layout>
  );
}
