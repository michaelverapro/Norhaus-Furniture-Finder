
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Catalog, FurnitureItem, SearchMode, SyncStatus } from './types';
import { searchFurniture, syncAndCacheLibrary } from './services/geminiService';
import * as pdfjs from 'pdfjs-dist';

pdfjs.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.mjs`;

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

const findCatalogMatch = (item: FurnitureItem, catalogs: Catalog[]) => {
  let match = catalogs.find(c => c.id === item.catalogId);
  if (match) return match;
  const target = normalize(item.catalogName);
  return catalogs.find(c => normalize(c.name).includes(target) || target.includes(normalize(c.name))) || null;
};

// --- Icons ---
const SearchIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
);
const DriveIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" d="M15.43 14.91L10.5 6.37l-1.35 2.32L14.08 17.3l1.35-2.39zm-6.41-1.03L5.14 7.37 3.79 9.7l3.88 6.51 1.35-2.33zm-.12-1.03L12 3l1.35 2.33-3.12 5.37-1.35-2.33z"/></svg>
);
const PaperclipIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
);
const XCircleIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
);

const ItemCard: React.FC<{ item: FurnitureItem; catalogs: Catalog[] }> = ({ item, catalogs }) => {
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
          Page {item.pageNumber}
        </div>
      </div>

      <div className="p-8 flex flex-col flex-1 text-center">
        <p className="text-[10px] font-bold text-[#b0a99f] uppercase tracking-[0.3em] mb-3">{item.category}</p>
        <h3 className="text-2xl font-normal text-[#3a3d31] mb-4 leading-tight">{item.name}</h3>
        <p className="text-sm text-[#7c766d] leading-relaxed mb-8 flex-1 line-clamp-2 italic serif">"{item.description}"</p>

        <button 
          onClick={() => alert("Deep-linking to catalog...")}
          className="w-full py-4 luxury-button rounded-sm text-[10px] active:scale-[0.98]"
        >
          View Details
        </button>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'search' | 'sync'>('search');
  const [driveFolderId, setDriveFolderId] = useState('');
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ state: 'idle' });
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [results, setResults] = useState<FurnitureItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const cached = localStorage.getItem('norhaus_cache_token');
    if (cached) {
      const data = JSON.parse(cached);
      setSyncStatus({ state: 'ready', cacheName: data.name, lastSync: new Date(data.timestamp) });
      setCatalogs(data.catalogMetadata);
      setDriveFolderId(data.folderId);
    }
  }, []);

  const handleSync = async () => {
    if (!driveFolderId) return;
    setSyncStatus({ state: 'syncing' });
    try {
      const { catalogMetadata, cacheName } = await syncAndCacheLibrary(driveFolderId, "SIMULATED_TOKEN");
      setSyncStatus({ state: 'ready', cacheName, lastSync: new Date() });
      setCatalogs(catalogMetadata);
    } catch (e: any) {
      setSyncStatus({ state: 'error', error: e.message });
    }
  };

  const handleSearch = async () => {
    if (syncStatus.state !== 'ready') return;
    setIsSearching(true);
    try {
      const res = await searchFurniture(query, referenceImage || undefined);
      setResults(res.items || []);
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Elegant Header / Nav Area */}
      <nav className="glass-nav sticky top-0 z-50 px-12 py-6">
        <div className="max-w-[1800px] mx-auto flex justify-between items-center">
          <div className="flex items-center gap-16">
             <div className="text-3xl font-normal tracking-tight serif uppercase text-[#3a3d31] cursor-pointer" onClick={() => setActiveTab('search')}>Norhaus</div>
             <div className="flex items-center gap-12 text-[11px] font-bold uppercase tracking-[0.3em] text-[#3a3d31]">
               <button 
                onClick={() => setActiveTab('search')}
                className={`transition-all pb-1 border-b-2 ${activeTab === 'search' ? 'border-[#434738] opacity-100' : 'border-transparent opacity-40 hover:opacity-70'}`}
               >
                 Discover
               </button>
               <button 
                onClick={() => setActiveTab('sync')}
                className={`transition-all pb-1 border-b-2 ${activeTab === 'sync' ? 'border-[#434738] opacity-100' : 'border-transparent opacity-40 hover:opacity-70'}`}
               >
                 Library Sync
               </button>
             </div>
          </div>
          
          <div className="flex items-center gap-6">
             <div className="text-[10px] font-bold uppercase tracking-widest text-[#b0a99f]">
                {syncStatus.state === 'ready' ? `Engine Ready: ${catalogs.length} Assets` : 'System Initialization'}
             </div>
             <div className={`w-2 h-2 rounded-full ${syncStatus.state === 'ready' ? 'bg-[#434738]' : 'bg-red-200'} transition-colors`}></div>
          </div>
        </div>
      </nav>

      <div className="flex flex-1">
        <main className="flex-1 flex flex-col">
          {activeTab === 'search' ? (
            <>
              <div className="px-12 py-24 max-w-5xl mx-auto w-full text-center">
                <h1 className="text-6xl font-normal serif text-[#3a3d31] mb-8 animate-fade-up">Find your inspiration.</h1>
                <p className="text-[#7c766d] text-xl serif italic mb-16 animate-fade-up" style={{animationDelay: '0.1s'}}>Search through thousands of pages of curated furniture catalogs instantly.</p>
                
                <div className="relative group animate-fade-up" style={{animationDelay: '0.2s'}}>
                  <div className="flex items-center bg-white border border-[#e8e4dc] rounded-sm p-2 shadow-sm focus-within:border-[#434738] transition-all">
                    <div className="pl-8 text-[#b0a99f]">
                      <SearchIcon />
                    </div>
                    <input 
                      type="text" 
                      placeholder="e.g. 'Mid-century modern oak credenza' or 'Sage green linen sofas'..."
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
                        disabled={isSearching || syncStatus.state !== 'ready'}
                        className="luxury-button px-12 py-6 rounded-sm text-xs disabled:opacity-20 shadow-lg"
                      >
                        {isSearching ? 'Processing...' : 'Search Engine'}
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
                      <h3 className="text-2xl font-normal serif text-[#3a3d31]">Analyzing cached assets...</h3>
                   </div>
                ) : results.length > 0 ? (
                  <div className="max-w-[1600px] mx-auto">
                      <div className="flex items-center justify-between mb-16">
                          <h2 className="text-xs font-bold text-[#b0a99f] uppercase tracking-[0.45em]">Discovered Matches</h2>
                          <div className="h-px bg-[#e8e4dc] flex-1 ml-12 opacity-50"></div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-16">
                        {results.map((item, idx) => (
                            <ItemCard key={idx} item={item} catalogs={catalogs} />
                        ))}
                      </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-48 opacity-20">
                    <div className="w-24 h-24 mb-10 border border-[#3a3d31] rounded-full flex items-center justify-center">
                        <SearchIcon />
                    </div>
                    <p className="text-sm font-bold uppercase tracking-[0.7em]">Neural Engine Standby</p>
                    <p className="text-xs serif italic mt-4">Inquire above to begin extraction</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="max-w-4xl mx-auto w-full px-12 py-32 animate-fade-up">
              <div className="text-center mb-20">
                <h1 className="text-5xl font-normal serif text-[#3a3d31] mb-6">Catalog Intelligence</h1>
                <p className="text-[#7c766d] text-lg serif italic">Synchronize your Google Drive catalog library with the Norhaus Engine.</p>
              </div>

              <div className="grid md:grid-cols-2 gap-20">
                <div className="space-y-12">
                  <section>
                    <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-[#b0a99f] mb-8 border-b border-[#e8e4dc] pb-4">Configuration</h2>
                    <div className="space-y-10">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#3a3d31] block mb-4">Google Drive Folder ID</label>
                        <div className="relative mb-8">
                          <input 
                            type="text" 
                            placeholder="Enter folder unique identifier..." 
                            value={driveFolderId}
                            onChange={(e) => setDriveFolderId(e.target.value)}
                            className="w-full bg-transparent border-b border-[#dcd7cf] py-4 text-base focus:border-[#434738] outline-none transition-all serif italic"
                          />
                        </div>
                        <button 
                          onClick={handleSync}
                          disabled={syncStatus.state === 'syncing'}
                          className="w-full py-5 luxury-button rounded-sm text-xs shadow-xl active:scale-[0.99] disabled:opacity-30"
                        >
                          {syncStatus.state === 'syncing' ? 'Analyzing Documents...' : 'Sync Catalog Library'}
                        </button>
                      </div>
                    </div>
                  </section>
                </div>

                <div className="space-y-12">
                   <section>
                    <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-[#b0a99f] mb-8 border-b border-[#e8e4dc] pb-4">Engine Insights</h2>
                    <div className="bg-white/50 p-10 border border-[#e8e4dc] space-y-8 rounded-sm">
                      <div className="flex justify-between items-baseline border-b border-[#f3f0e9] pb-4">
                        <span className="text-[10px] text-[#b0a99f] uppercase tracking-tighter font-bold">Inference Status</span>
                        <span className="text-xs font-bold uppercase text-[#434738]">{syncStatus.state}</span>
                      </div>
                      {syncStatus.lastSync && (
                        <div className="flex justify-between items-baseline border-b border-[#f3f0e9] pb-4">
                          <span className="text-[10px] text-[#b0a99f] uppercase tracking-tighter font-bold">Last Refresh</span>
                          <span className="text-xs font-bold text-[#7c766d]">{syncStatus.lastSync.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-baseline border-b border-[#f3f0e9] pb-4">
                        <span className="text-[10px] text-[#b0a99f] uppercase tracking-tighter font-bold">Indexed Assets</span>
                        <span className="text-xs font-bold text-[#434738]">{catalogs.length} Documents</span>
                      </div>
                    </div>
                  </section>

                  {catalogs.length > 0 && (
                    <section>
                      <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#b0a99f] mb-6">Active Library</h2>
                      <div className="max-h-60 overflow-y-auto pr-4 space-y-2">
                        {catalogs.map(c => (
                          <div key={c.id} className="text-xs serif italic text-[#7c766d] py-2 border-b border-[#e8e4dc]/50 truncate">
                            {c.name}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              </div>
            </div>
          )}
          
          <footer className="px-12 py-20 border-t border-[#e8e4dc] text-center bg-white/40 mt-auto">
              <div className="text-3xl serif mb-6 opacity-40 uppercase tracking-[0.2em] font-light">Norhaus</div>
              <div className="flex justify-center gap-12 text-[10px] font-bold text-[#b0a99f] uppercase tracking-[0.4em] mb-8">
                <span>Sacramento / Nationwide</span>
              </div>
              <p className="text-[9px] font-bold text-[#b0a99f] uppercase tracking-[0.6em]">High-End Asset Intelligence &bull; Powered by Gemini 3.0</p>
          </footer>
        </main>
      </div>
    </div>
  );
};

export default App;
