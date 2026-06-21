import React, { useState, useEffect } from 'react';
import { GoogleOAuthProvider, GoogleLogin, googleLogout } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';

import logo from './assets/logo.png';

// --- Environment Variables ---
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const API_BASE = "https://israeli-production.up.railway.app";

// --- Settings Modal ---
function ApiKeyModal({ isOpen, onClose, onSave, currentKey }) {
  const [inputKey, setInputKey] = useState(currentKey || '');
  const [validating, setValidating] = useState(false);
  const [status, setStatus] = useState(null); // null | 'success' | 'error'
  const [statusMsg, setStatusMsg] = useState('');

  // Sync input if modal is reopened with an updated key
  useEffect(() => {
    if (isOpen) {
      setInputKey(currentKey || '');
      setStatus(null);
      setStatusMsg('');
    }
  }, [isOpen, currentKey]);

  if (!isOpen) return null;

  const handleValidateAndSave = async () => {
    const trimmed = inputKey.trim();
    if (!trimmed) {
      setStatus('error');
      setStatusMsg('יש להזין מפתח API.');
      return;
    }
    setValidating(true);
    setStatus(null);
    try {
      const res = await fetch(`${API_BASE}/validate-key?user_api_key=${encodeURIComponent(trimmed)}`);
      if (res.ok) {
        setStatus('success');
        setStatusMsg('✅ המפתח תקין ונשמר!');
        onSave(trimmed);
      } else {
        const err = await res.json().catch(() => ({ detail: 'שגיאה לא ידועה' }));
        setStatus('error');
        const detail = typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail);
        if (res.status === 401) setStatusMsg('❌ מפתח לא תקין. בדוק שהעתקת נכון.');
        else if (res.status === 429) setStatusMsg('⚠️ המפתח תקין אך חרג ממכסה.');
        else setStatusMsg(`❌ ${detail}`);
      }
    } catch {
      setStatus('error');
      setStatusMsg('❌ לא הצלחנו לאמת את המפתח. בדוק את החיבור.');
    } finally {
      setValidating(false);
    }
  };

  const handleRemove = () => {
    setInputKey('');
    setStatus(null);
    setStatusMsg('');
    onSave('');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 text-right" dir="rtl">
        <h2 className="text-xl font-bold text-gray-800 mb-1">הגדרות מפתח API</h2>
        <p className="text-sm text-gray-500 mb-4">
          הכנס את מפתח ה-OpenAI שלך לשימוש אישי. המפתח נשמר אצלך בדפדפן בלבד.
        </p>

        <label className="block text-sm font-medium text-gray-700 mb-1">OpenAI API Key</label>
        <input
          type="password"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 mb-3 font-mono"
          placeholder="sk-..."
          value={inputKey}
          onChange={e => { setInputKey(e.target.value); setStatus(null); }}
          dir="ltr"
        />

        {status && (
          <p className={`text-sm mb-3 font-semibold ${status === 'success' ? 'text-green-600' : 'text-red-600'}`}>
            {statusMsg}
          </p>
        )}

        <div className="flex gap-2 justify-end">
          {currentKey && (
            <button
              onClick={handleRemove}
              className="px-4 py-2 text-sm rounded-lg border border-red-300 text-red-600 hover:bg-red-50 transition-colors"
            >
              הסר מפתח
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            ביטול
          </button>
          <button
            onClick={handleValidateAndSave}
            disabled={validating}
            className="px-5 py-2 text-sm rounded-lg bg-blue-500 text-white font-semibold hover:bg-blue-600 disabled:opacity-50 transition-colors"
          >
            {validating ? 'בודק...' : 'אמת ושמור'}
          </button>
        </div>

        <p className="text-xs text-gray-400 mt-4">
          אין לך מפתח?{' '}
          <a
            href="https://platform.openai.com/api-keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            קבל אחד חינם מ-OpenAI
          </a>
        </p>
      </div>
    </div>
  );
}

// --- Main App Component ---
function App() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [searchCredits, setSearchCredits] = useState(0);
  const [apiKey, setApiKey] = useState('');
  const [showApiModal, setShowApiModal] = useState(false);

  const loadUserData = (userId) => {
    const savedCredits = localStorage.getItem(`searchCredits_${userId}`);
    if (savedCredits === null) {
      setSearchCredits(1);
      localStorage.setItem(`searchCredits_${userId}`, '1');
    } else {
      setSearchCredits(parseInt(savedCredits, 10));
    }
    const savedKey = localStorage.getItem(`apiKey_${userId}`) || '';
    setApiKey(savedKey);
  };

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const userData = JSON.parse(storedUser);
      setUser(userData);
      loadUserData(userData.sub);
    }
  }, []);

  const handleSearch = async () => {
    // Allow search if user has their own API key, regardless of credits
    const hasOwnKey = !!apiKey;
    if (!query.trim() || !user) return;
    if (!hasOwnKey && searchCredits <= 0) return;

    setLoading(true);
    setError(null);
    try {
      let url = `${API_BASE}/search?q=${encodeURIComponent(query)}`;
      if (hasOwnKey) {
        url += `&user_api_key=${encodeURIComponent(apiKey)}`;
      }

      const res = await fetch(url);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: res.statusText }));
        const detail = typeof errData.detail === 'string' ? errData.detail : JSON.stringify(errData.detail);
        if (res.status === 401) throw new Error('מפתח ה-API שלך לא תקין. עדכן אותו בהגדרות.');
        if (res.status === 429) throw new Error('חרגת ממכסת ה-API שלך ב-OpenAI.');
        throw new Error(detail);
      }

      const data = await res.json();
      setResults(data.results);

      // Only deduct credits when using server key
      if (!hasOwnKey) {
        const newCredits = searchCredits - 1;
        setSearchCredits(newCredits);
        localStorage.setItem(`searchCredits_${user.sub}`, newCredits.toString());
      }
    } catch (e) {
      console.error(e);
      setError(e.message);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSuccess = (credentialResponse) => {
    const decodedToken = jwtDecode(credentialResponse.credential);
    setUser(decodedToken);
    localStorage.setItem('user', JSON.stringify(decodedToken));
    loadUserData(decodedToken.sub);
  };

  const handleLoginError = () => {
    setError('כניסה עם גוגל נכשלה. נסה שוב.');
  };

  const handleLogout = () => {
    googleLogout();
    setUser(null);
    setSearchCredits(0);
    setApiKey('');
    setResults([]);
    localStorage.removeItem('user');
  };

  const handleSaveApiKey = (key) => {
    setApiKey(key);
    if (user) {
      if (key) {
        localStorage.setItem(`apiKey_${user.sub}`, key);
      } else {
        localStorage.removeItem(`apiKey_${user.sub}`);
      }
    }
  };

  const handleBuyCredits = () => {
    alert('חלון תשלום היה נפתח כאן. בינתיים, הוספנו לך 5 קרדיטים במתנה!');
    const newCredits = searchCredits + 5;
    setSearchCredits(newCredits);
    localStorage.setItem(`searchCredits_${user.sub}`, newCredits.toString());
  };

  const hasOwnKey = !!apiKey;
  const canSearch = hasOwnKey || searchCredits > 0;

  return (
    <div className="min-h-screen bg-[#149fa8] flex flex-col items-center p-4 sm:p-6 font-sans">
      <ApiKeyModal
        isOpen={showApiModal}
        onClose={() => setShowApiModal(false)}
        onSave={handleSaveApiKey}
        currentKey={apiKey}
      />

      <header className="w-full flex justify-start mb-10">
        {user ? (
          <div className="flex items-center gap-3 flex-wrap">
            <img src={user.picture} alt={user.name} className="w-11 h-11 rounded-full border-2 border-white shadow" />

            {/* API Key indicator + settings button */}
            <button
              onClick={() => setShowApiModal(true)}
              title="הגדרות מפתח API"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg shadow-sm text-sm font-semibold transition-colors ${
                hasOwnKey
                  ? 'bg-green-100 text-green-800 hover:bg-green-200'
                  : 'bg-white/90 text-gray-700 hover:bg-white'
              }`}
            >
              <span>{hasOwnKey ? '🔑 מפתח API פעיל' : '⚙️ הוסף מפתח API'}</span>
            </button>

            {/* Credits — only relevant if no own key */}
            {!hasOwnKey && (
              <div className="flex items-center gap-2 bg-white/90 px-3 py-2 rounded-lg shadow-sm">
                <span className="text-sm font-medium text-gray-600">חיפושים שנותרו:</span>
                <span className={`text-lg font-bold ${searchCredits === 0 ? 'text-red-500' : 'text-green-500'}`}>
                  {searchCredits}
                </span>
              </div>
            )}

            <button
              onClick={handleLogout}
              className="bg-white/90 text-gray-800 px-4 py-2 rounded-lg hover:bg-white transition-colors text-sm font-semibold shadow"
            >
              התנתק
            </button>
          </div>
        ) : (
          <GoogleLogin onSuccess={handleLoginSuccess} onError={handleLoginError} useOneTap />
        )}
      </header>

      <main className="w-full max-w-md flex flex-col items-center">
        <img src={logo} alt="ישראלi לוגו" className="h-32 w-auto mb-8" />

        {user ? (
          <>
            <div className="flex w-full mb-6 shadow-lg">
              <input
                type="text"
                className="flex-grow p-4 rounded-l-xl border-2 border-gray-300 focus:outline-none focus:border-blue-500 disabled:bg-gray-200 text-lg"
                placeholder={!canSearch ? 'נגמרו לך החיפושים...' : 'מה אתה מחפש? דירה 3 חדרים...'}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                disabled={loading || !canSearch}
                style={{ direction: 'rtl' }}
              />
              <button
                className="bg-blue-500 text-white font-bold px-6 rounded-r-xl hover:bg-blue-600 transition-colors disabled:bg-blue-300 disabled:cursor-not-allowed text-lg"
                onClick={handleSearch}
                disabled={loading || !canSearch}
              >
                {loading ? 'מחפש...' : 'חפש'}
              </button>
            </div>

            {/* Prompt to add API key or buy credits when out of searches */}
            {!canSearch && !loading && (
              <div className="text-center my-4 p-4 bg-white/20 rounded-lg w-full">
                <p className="text-white font-semibold mb-3">נגמרו לך החיפושים.</p>
                <div className="flex flex-col sm:flex-row gap-2 justify-center">
                  <button
                    onClick={() => setShowApiModal(true)}
                    className="bg-white text-[#149fa8] font-bold px-5 py-2 rounded-lg shadow hover:bg-gray-100 transition-colors"
                  >
                    🔑 הוסף מפתח API משלך
                  </button>
                  <button
                    onClick={handleBuyCredits}
                    className="bg-yellow-400 text-yellow-900 font-bold px-6 py-2 rounded-lg shadow-lg hover:bg-yellow-300 transition-transform hover:scale-105"
                  >
                    קנה חיפושים נוספים
                  </button>
                </div>
              </div>
            )}

            {error && (
              <p className="bg-red-100 text-red-700 p-3 rounded-lg text-center mb-4 w-full">{error}</p>
            )}

            <div className="w-full grid grid-cols-1 gap-4">
              {results.map((item, idx) => (
                <div key={idx} className="bg-white p-4 rounded-lg shadow-md border border-gray-200 text-right">
                  <h2 className="text-xl font-semibold text-gray-900">{item.title}</h2>
                  <p className="text-gray-700 my-2">{item.description}</p>
                  <p className="text-sm text-gray-500">{item.location} • {item.price}</p>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline font-semibold"
                  >
                    לצפייה במודעה
                  </a>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center mt-4">
            <p className="text-xl text-white font-semibold">כדי להשתמש בחיפוש, יש להתחבר עם חשבון גוגל.</p>
          </div>
        )}
      </main>
    </div>
  );
}

// Wrapper component
function AppWrapper() {
  if (!GOOGLE_CLIENT_ID) {
    return (
      <div className="min-h-screen bg-red-100 flex items-center justify-center p-4">
        <p className="text-red-700 font-bold text-2xl text-center">
          Error: VITE_GOOGLE_CLIENT_ID is not set in your environment file.
        </p>
      </div>
    );
  }

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <App />
    </GoogleOAuthProvider>
  );
}

export default AppWrapper;
