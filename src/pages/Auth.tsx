import React, { useState } from 'react';
import { auth } from '../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { Mail, Lock, AlertCircle } from 'lucide-react';

export default function AuthPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'هەڵەیەک ڕوویدا');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8" dir="rtl">
      <div className="sm:mx-auto sm:w-full sm:max-w-md flex flex-col items-center">
        <img src="https://skilled-pink-cux52hz9.edgeone.app/Pink%20Elle%20logo%20new-1_page-0001.jpg" alt="Pink Elle Logo" className="w-24 h-24 object-contain rounded-2xl shadow-lg" />
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          چوونە ژوورەوە
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          سیستەمی فرۆشتن و بەڕێوەبردن
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {error && (
            <div className="mb-4 bg-red-50 border-r-4 border-red-500 p-4">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-500 ml-2" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                ئیمەیڵ
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="focus:ring-pink-500 focus:border-pink-500 block w-full pr-10 sm:text-sm border-gray-300 rounded-md h-10 border px-3 text-left"
                  placeholder="admin@example.com"
                  dir="ltr"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                وشەی نهێنی
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="focus:ring-pink-500 focus:border-pink-500 block w-full pr-10 sm:text-sm border-gray-300 rounded-md h-10 border px-3 text-left"
                  placeholder="******"
                  dir="ltr"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-pink-600 hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 disabled:opacity-50"
              >
                {loading ? 'چاوەڕێ بە...' : 'چوونە ژوورەوە'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
