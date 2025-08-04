import React, { useState, useEffect } from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import Cookies from 'js-cookie';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [searchUsed, setSearchUsed] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = Cookies.get('token');
    const lastSearch = Cookies.get('lastSearch');
    setIsLoggedIn(!!token);

    if (lastSearch === new Date().toDateString()) {
      setSearchUsed(true);
    }
  }, []);

  const handleSearch = async () => {
    if (!isLoggedIn) {
      alert('אנא התחבר כדי לחפש');
      return;
    }
    if (searchUsed) {
      alert('ניתן לבצע חיפוש פעם אחת ביום');
      return;
    }
    if (!query.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const API_BASE = "https://israeli-production.up.railway.app";
      const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`);

      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setResults(data.results);

      Cookies.set('lastSearch', new Date().toDateString(), { expires: 1 });
      setSearchUsed(true);
    } catch (e) {
      console.error(e);
      setError(e.message);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  if (!isLoggedIn) {
    if (!GOOGLE_CLIENT_ID) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen text-red-500">
          שגיאה: מזהה לקוח של Google חסר. אנא בדוק את משתני הסביבה.
        </div>
      );
    }
    return (
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <Login onLogin={() => setIsLoggedIn(true)} />
      </GoogleOAuthProvider>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-start p-6">
      <h1 className="text-3xl font-bold mb-4">ישראלi – בוט חיפוש חכם</h1>
      <div className="flex w-full max-w-md mb-6">
        <input
          type="text"
          className="flex-grow p-3 rounded-l-xl border border-gray-300 focus:outline-none"
          placeholder="מה אתה מחפש? דירה 3 חדרים..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
        />
        <button
          className="bg-blue-500 text-white px-6 rounded-r-xl hover:bg-blue-600"
          onClick={handleSearch}
          disabled={loading}
        >
          {loading ? 'מחפש...' : 'חפש'}
        </button>
      </div>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      <div className="w-full max-w-2xl grid grid-cols-1 gap-4">
        {results.map((item, idx) => (
          <div key={idx} className="bg-white p-4 rounded shadow">
            <h2 className="text-xl font-semibold">{item.title}</h2>
            <p className="text-gray-700">{item.description}</p>
            <p className="text-sm text-gray-500">{item.location} • {item.price}</p>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 underline"
            >
              לצפייה
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

function Login({ onLogin }) {
  const handleGoogleSuccess = (credentialResponse) => {
    Cookies.set('token', credentialResponse.credential, { expires: 1 });
    onLogin();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-2xl font-bold mb-4">התחבר לישראלi</h1>
      <GoogleLogin
        onSuccess={handleGoogleSuccess}
        onError={() => console.error('Google login failed')}
        text="signin_with"
        locale="he"
      />
    </div>
  );
}

export default App;