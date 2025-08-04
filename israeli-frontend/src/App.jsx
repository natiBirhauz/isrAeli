import React, { useState, useEffect } from 'react';
import { GoogleOAuthProvider, GoogleLogin, googleLogout } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';

import logo from './assets/logo.png';

// --- Environment Variables ---
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const API_BASE = "https://israeli-production.up.railway.app";

// --- Main App Component ---
function App() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  // STEP 1: Replace hasSearchedToday with a numeric searchCredits state
  const [searchCredits, setSearchCredits] = useState(0);

  // This function now loads (or initializes) the user's search credits
  const loadUserCredits = (userId) => {
    const savedCredits = localStorage.getItem(`searchCredits_${userId}`);
    if (savedCredits === null) {
      // If user is new or has no credits saved, grant them 1 free credit
      setSearchCredits(1);
      localStorage.setItem(`searchCredits_${userId}`, '1');
    } else {
      setSearchCredits(parseInt(savedCredits, 10));
    }
  };

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const userData = JSON.parse(storedUser);
      setUser(userData);
      loadUserCredits(userData.sub); // Load credits for the stored user
    }
  }, []);

  const handleSearch = async () => {
    // Block search if no credits are left
    if (!query.trim() || !user || searchCredits <= 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setResults(data.results);
      
      // On successful search, decrement credits and save to localStorage
      const newCredits = searchCredits - 1;
      setSearchCredits(newCredits);
      localStorage.setItem(`searchCredits_${user.sub}`, newCredits.toString());

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
    loadUserCredits(decodedToken.sub); // Load credits for the new user
  };

  const handleLoginError = () => {
    console.error('Login Failed');
    setError('Google login failed. Please try again.');
  };

  const handleLogout = () => {
    googleLogout();
    setUser(null);
    setSearchCredits(0); // Reset credits in state on logout
    localStorage.removeItem('user');
  };

  // STEP 3: Function to simulate buying more credits
  const handleBuyCredits = () => {
    alert("חלון תשלום היה נפתח כאן. בינתיים, הוספנו לך 5 קרדיטים במתנה!");
    const newCredits = searchCredits + 5;
    setSearchCredits(newCredits);
    localStorage.setItem(`searchCredits_${user.sub}`, newCredits.toString());
  };

  return (
    <div className="min-h-screen bg-[#149fa8] flex flex-col items-center p-4 sm:p-6 font-sans">
      <header className="w-full flex justify-start mb-10">
        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-4">
              <img src={user.picture} alt={user.name} className="w-11 h-11 rounded-full border-2 border-white shadow" />
              <button
                onClick={handleLogout}
                className="bg-white/90 text-gray-800 px-4 py-2 rounded-lg hover:bg-white transition-colors text-sm font-semibold shadow"
              >
                התנתק
              </button>
              <div className="flex items-center gap-2 bg-white/90 px-3 py-2 rounded-lg shadow-sm">
                <span className="text-sm font-medium text-gray-600">חיפושים שנותרו:</span>
                {/* Display the actual number of credits */}
                <span className={`text-lg font-bold ${searchCredits === 0 ? 'text-red-500' : 'text-green-500'}`}>
                  {searchCredits}
                </span>
              </div>
            </div>
          ) : (
            <GoogleLogin onSuccess={handleLoginSuccess} onError={handleLoginError} useOneTap />
          )}
        </div>
      </header>

      <main className="w-full max-w-md flex flex-col items-center">
        <img src={logo} alt="ישראלi לוגו" className="h-32 w-auto mb-8" />
        {user ? (
          <>
            <div className="flex w-full mb-6 shadow-lg">
              <input
                type="text"
                className="flex-grow p-4 rounded-l-xl border-2 border-gray-300 focus:outline-none focus:border-blue-500 disabled:bg-gray-200 text-lg"
                // The placeholder now changes based on credits
                placeholder={searchCredits <= 0 ? "נגמרו לך החיפושים..." : "מה אתה מחפש? דירה 3 חדרים..."}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                // Disable based on credits, not the old boolean
                disabled={loading || searchCredits <= 0}
                style={{ direction: 'rtl' }}
              />
              <button
                className="bg-blue-500 text-white font-bold px-6 rounded-r-xl hover:bg-blue-600 transition-colors disabled:bg-blue-300 disabled:cursor-not-allowed text-lg"
                onClick={handleSearch}
                disabled={loading || searchCredits <= 0}
              >
                {loading ? 'מחפש...' : 'חפש'}
              </button>
            </div>

            {/* "Buy More" button appears only when out of credits */}
            {searchCredits <= 0 && !loading && (
              <div className="text-center my-4 p-4 bg-white/20 rounded-lg">
                  <p className="text-white font-semibold mb-3">נגמרו לך החיפושים.</p>
                  <button
                      onClick={handleBuyCredits}
                      className="bg-yellow-400 text-yellow-900 font-bold px-6 py-2 rounded-lg shadow-lg hover:bg-yellow-300 transition-transform hover:scale-105"
                  >
                      קנה חיפושים נוספים
                  </button>
              </div>
            )}
            
            {error && <p className="bg-red-100 text-red-700 p-3 rounded-lg text-center mb-4">{error}</p>}
            
            <div className="w-full grid grid-cols-1 gap-4">
              {results.map((item, idx) => (
                <div key={idx} className="bg-white p-4 rounded-lg shadow-md border border-gray-200 text-right">
                  <h2 className="text-xl font-semibold text-gray-900">{item.title}</h2>
                  <p className="text-gray-700 my-2">{item.description}</p>
                  <p className="text-sm text-gray-500">{item.location} • {item.price}</p>
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline font-semibold">
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

// Wrapper component remains the same
function AppWrapper() {
  if (!GOOGLE_CLIENT_ID) {
    return (
      <div className="min-h-screen bg-red-100 flex items-center justify-center p-4">
        <p className="text-red-700 font-bold text-2xl text-center">Error: VITE_GOOGLE_CLIENT_ID is not set in your environment file.</p>
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