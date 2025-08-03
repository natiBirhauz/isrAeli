import React, { useState } from 'react';

function App() {
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `http://127.0.0.1:8000/search?q=${encodeURIComponent(query)}`
      );
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setResults(data.results);
    } catch (e) {
      console.error(e);
      setError(e.message);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

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

export default App;
