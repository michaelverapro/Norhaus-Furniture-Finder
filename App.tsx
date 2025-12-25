import React, { useState, useRef, useEffect } from 'react';
import { FurnitureItem } from './types';
import { searchFurniture } from './geminiService';

// --- Icons ---
const SearchIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
);
const PaperclipIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
);
const XCircleIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
);

const ItemCard: React.FC<{ item: FurnitureItem }> = ({ item }) => {
  return (
    <div className="luxury-card rounded-sm overflow-hidden flex flex-col h-full group animate-fade-up">
      <div className="h-80 relative overflow-hidden bg-[#f0ede6] flex items-center justify-center p-12">
        <div className="absolute top-6 left-6 z-10 text-[10px] font-bold uppercase tracking-[0.2em] text-[#434738]/40">
          Source: {item.catalogName}
        </div>
        <div className="text-center opacity-40 group-hover:opacity-60 transition-opacity">
            <svg className="w-16 h-16 text-[#434738] mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
        </div>
        <div className="absolute bottom-6 right-6 text-[10px] font-bold text-[#434738]/60 uppercase tracking-widest border border-[#434738]/20 px-3 py-1.5">
          Page {item.pageNumber || 'N/A'}
        </div>
      </div>

      <div className="p-8 flex flex-col flex-1 text-center">
        <p className="text-[10px] font-bold text-[#b0a99f] uppercase tracking-[0.3em] mb-3">{item.category}</p>
        <h3 className="text-2xl font-normal text-[#3a3d31] mb-4 leading-tight">{item.name}</h3>
        <p className="text-sm text-[#7c766d] leading-relaxed mb-8 flex-1 line-clamp-2 italic serif">"{item.description}"</p>

        <button 
          onClick={() => alert("Cloud Intelligence: Detailed PDF view is being generated...")}
          className="w-full py-4 luxury-button rounded-sm text-[10px] active:scale-[0.98]"
        >
          View Details
        </button>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [results, setResults] = useState<FurnitureItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [thinkingLog, setThinkingLog] = useState('');
  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSearch = async () => {
    if (!query && !referenceImage) return;
    setIsSearching(true);
    setResults([]);
    try {
      const res = await searchFurniture(query, referenceImage || undefined);
      setResults(res.items || []);
      setThinkingLog(res.thinkingProcess || '');
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#faf9f6]">
      {/* Updated Header: Removed Tabs, Kept Luxury Branding */}
      <nav className="glass-nav sticky top-0 z-50 px-12 py-6 border-b border-[#e8e4dc]">
        <div className="max-w-[1800px] mx-auto flex justify-between items-center">
          <div className="flex items-center gap-16">
             <div className="text-3xl font-normal tracking-tight serif uppercase text-[#3a3d31]">Norhaus</div>
             <div className="flex items-center gap-12 text-[11px] font-bold uppercase tracking-[0.3em] text-[#3a3d31]">
               <span className="pb-1 border-b-2 border-[#434738]">Cloud Intelligence</span>
             </div>
          </div>
          
          <div className="flex items-center gap-6">
             <div className="text-[10px] font-bold uppercase tracking-widest text-[#b0a99f]">
                Engine Status: Live Cloud Connection
             </div>
             <div className="w-2 h-2 rounded-full bg-[#434738] shadow-[0_0_8px_rgba(67,71,56,0.5)]"></div>
          </div>
        </div>
      </nav>

      <main className="flex-1 flex flex-col">
        <div className="px-12 py-24 max-w-5xl mx-auto w-full text-center">
          <h1 className="text-6xl font-normal serif text-[#3a3d31] mb-8 animate-fade-up">Find your inspiration.</h1>
          <p className="text-[#7c766d] text-xl serif italic mb-16 animate-fade-up" style={{animationDelay: '0.1s'}}>Query your high-resolution cloud archives instantly.</p>
          
          <div className="relative group animate-fade-up" style={{animationDelay: '0.2s'}}>
            <div className="flex items-center bg-white border border-[#e8e4dc] rounded-sm p-2 shadow-sm focus-within:border-[#434738] transition-all">
              <div className="pl-8 text-[#b0a99f]">
                <SearchIcon />
              </div>
              <input 
                type="text" 
                placeholder="Describe what you are looking for..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1 bg-transparent py-7 px-8 text-xl outline-none serif"
              />
              <div className="flex items-center gap-4 pr-6">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 text-[#b0a99f] hover:text-[#434738] transition-colors rounded-full"
                  title="Upload Visual Context"
                >
                  <PaperclipIcon />
                </button>
                <button 
                  onClick={handleSearch}
                  disabled={isSearching}
                  className="luxury-button px-12 py-6 rounded-sm text-xs disabled:opacity-20 shadow-lg"
                >
                  {isSearching ? 'Processing Cloud...' : 'Begin Inquiry'}
                </button>
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                      setReferenceImage(file);
                      setPreviewUrl(URL.createObjectURL(file));
                  }
                }}
              />
            </div>

            {previewUrl && (
              <div className="absolute -bottom-24 left-0 flex items-center gap-5 bg-white border border-[#e8e4dc] p-3 pr-8 rounded-sm shadow-2xl animate-fade-up">
                  <img src={previewUrl} className="w-14 h-14 object-cover rounded-sm border border-[#e8e4dc]" />
                  <div className="text-left">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#434738] block">Visual Reference</span>
                    <span className="text-[9px] text-[#b0a99f] italic">Context locking enabled</span>
                  </div>
                  <button onClick={() => { setReferenceImage(null); setPreviewUrl(null); }} className="ml-4 text-[#b0a99f] hover:text-red-400">
                      <XCircleIcon />
                  </button>
              </div>
            )}
          </div>
        </div>

        <div className="px-12 pb-32 flex-1">
          {isSearching ? (
             <div className="flex flex-col items-center justify-center py-40">
                <div className="w-12 h-12 border-b-2 border-[#434738] rounded-full animate-spin mb-10" />
                <h3 className="text-2xl font-normal serif text-[#3a3d31]">Analyzing Cloud Assets...</h3>
                <p className="text-xs uppercase tracking-[0.2em] text-[#b0a99f] mt-4">Cross-referencing high-resolution PDF catalogues</p>
             </div>
          ) : results.length > 0 ? (
            <div className="max-w-[1600px] mx-auto">
                <div className="flex items-center justify-between mb-16">
                    <h2 className="text-xs font-bold text-[#b0a99f] uppercase tracking-[0.45em]">Discovered Matches</h2>
                    <div className="h-px bg-[#e8e4dc] flex-1 ml-12 opacity-50"></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-16">
                  {results.map((item, idx) => (
                      <ItemCard key={idx} item={item} />
                  ))}
                </div>
                {thinkingLog && (
                  <div className="mt-20 p-8 border border-[#e8e4dc] rounded-sm bg-white/50 text-left">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#b0a99f] mb-4">Search Intelligence Log</p>
                    <pre className="text-[11px] text-[#7c766d] whitespace-pre-wrap serif italic opacity-70">{thinkingLog}</pre>
                  </div>
                )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-48 opacity-20">
              <div className="w-24 h-24 mb-10 border border-[#3a3d31] rounded-full flex items-center justify-center">
                  <SearchIcon />
              </div>
              <p className="text-sm font-bold uppercase tracking-[0.7em]">Neural Engine Standby</p>
              <p className="text-xs serif italic mt-4">Cloud archives ready for extraction</p>
            </div>
          )}
        </div>
        
        <footer className="px-12 py-20 border-t border-[#e8e4dc] text-center bg-white/40 mt-auto">
            <div className="text-3xl serif mb-6 opacity-40 uppercase tracking-[0.2em] font-light">Norhaus</div>
            <div className="flex justify-center gap-12 text-[10px] font-bold text-[#b0a99f] uppercase tracking-[0.4em] mb-8">
              <span>Sacramento / Global Archives</span>
            </div>
            <p className="text-[9px] font-bold text-[#b0a99f] uppercase tracking-[0.6em]">High-End Asset Intelligence &bull; Server-Side Extraction Active</p>
        </footer>
      </main>
    </div>
  );
};

export default App;
