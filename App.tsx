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
const CloseIcon = () => (
  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 18L18 6M6 6l12 12" /></svg>
);
const ExternalLinkIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
);
const XCircleIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
);

// --- Helper: Clean Title Case Filenames ---
// Turns "MERIDIAN_FURNITURE_LOOKBOOK.pdf" into "Meridian Furniture Lookbook"
const formatCatalogName = (filename: string) => {
    if (!filename) return "Unknown Catalog";
    // 1. Remove extension
    let clean = filename.replace('.pdf', '');
    // 2. Replace separators with spaces
    clean = clean.replace(/_/g, ' ').replace(/-/g, ' ');
    // 3. Title Case
    return clean.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

// --- The PDF Viewer Modal ---
const PDFViewerModal: React.FC<{ item: FurnitureItem | null, onClose: () => void }> = ({ item, onClose }) => {
  if (!item) return null;

  const cleanName = encodeURIComponent(item.catalogName);
  let url = `https://storage.googleapis.com/norhaus_catalogues/${cleanName}`;
  const pageNum = item.pageNumber;
  const deepLinkUrl = pageNum ? `${url}#page=${pageNum}` : url;

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex flex-col animate-in fade-in duration-200">
      <div className="flex items-center justify-between px-6 py-4 bg-[#1a1a1a] border-b border-white/10 text-white shadow-lg">
        <div className="flex flex-col">
          <h3 className="text-lg font-serif tracking-wide text-white">{item.name}</h3>
          <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-1">
             {formatCatalogName(item.catalogName)} <span className="text-white/30 mx-2">|</span> Page {pageNum || '1'}
          </p>
        </div>
        
        <div className="flex items-center gap-4">
            <a 
              href={deepLinkUrl} 
              target="_blank" 
              rel="noreferrer"
              className="flex items-center gap-2 bg-[#434738] hover:bg-[#535845] text-white px-4 py-2 rounded-sm text-xs font-bold uppercase tracking-wider transition-colors"
            >
              <span>Open Page {pageNum}</span>
              <ExternalLinkIcon />
            </a>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white">
              <CloseIcon />
            </button>
        </div>
      </div>
      <div className="flex-1 w-full bg-[#333] relative">
         <iframe src={deepLinkUrl} className="w-full h-full border-none" title="PDF Viewer" />
      </div>
    </div>
  );
};

// --- The New Structured Card ---
const ItemCard: React.FC<{ item: FurnitureItem, onClick: () => void }> = ({ item, onClick }) => {
  return (
    <div 
      onClick={onClick}
      className="luxury-card rounded-sm overflow-hidden flex flex-col h-full group animate-fade-up cursor-pointer hover:shadow-2xl transition-all duration-500 bg-white border border-[#f0ede6]"
    >
      {/* Visual Placeholder Area */}
      <div className="h-48 relative overflow-hidden bg-[#f8f6f3] flex items-center justify-center p-6 group-hover:bg-[#e8e5de] transition-colors">
        <div className="text-center opacity-30 group-hover:opacity-50 transition-opacity transform group-hover:scale-110 duration-500">
            <svg className="w-12 h-12 text-[#434738]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
        </div>
        <div className="absolute top-3 right-3 text-[9px] font-bold text-[#b0a99f] uppercase tracking-widest bg-white px-2 py-1 rounded-sm shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
            View PDF
        </div>
      </div>

      <div className="p-6 flex flex-col flex-1 text-left">
        {/* 1. Name of Furniture (Top, Big, Bold) */}
        <h3 className="text-xl font-medium serif text-[#3a3d31] mb-2 leading-tight">
            {item.name}
        </h3>

        {/* 2. AI Description (Below Name, Readable) */}
        <p className="text-xs text-[#7c766d] leading-relaxed mb-6 flex-1 line-clamp-3">
          {item.description}
        </p>

        {/* Divider */}
        <div className="h-px bg-[#f0ede6] w-full mb-4"></div>

        {/* 3 & 4. Catalog & Page (Footer) */}
        <div className="flex items-start justify-between gap-4">
             <div className="flex flex-col">
                <span className="text-[8px] font-bold text-[#b0a99f] uppercase tracking-widest mb-1">Source Catalog</span>
                <span className="text-[10px] font-bold text-[#434738] uppercase tracking-wider leading-tight line-clamp-1" title={formatCatalogName(item.catalogName)}>
                    {formatCatalogName(item.catalogName)}
                </span>
             </div>
             <div className="flex flex-col items-end min-w-[50px]">
                <span className="text-[8px] font-bold text-[#b0a99f] uppercase tracking-widest mb-1">Page</span>
                <span className="text-[10px] font-bold text-[#434738] uppercase tracking-wider">
                    {item.pageNumber || 'N/A'}
                </span>
             </div>
        </div>
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
  const [selectedItem, setSelectedItem] = useState<FurnitureItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSearch = async () => {
    if (!query && !referenceImage) return;
    setIsSearching(true);
    setResults([]);
    setThinkingLog('');
    
    try {
      const res = await searchFurniture(query, referenceImage || undefined);
      setResults(res.items || []);
      setThinkingLog(res.thinkingProcess || '');
    } catch (e: any) {
      console.error(e);
      setThinkingLog(`System Error: ${e.message}`);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#faf9f6]">
      {selectedItem && (
        <PDFViewerModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}

      <nav className="glass-nav sticky top-0 z-40 px-12 py-6 border-b border-[#e8e4dc] bg-white/80 backdrop-blur-md">
        <div className="max-w-[1800px] mx-auto flex justify-between items-center">
          <div className="flex items-center gap-16">
             <div className="text-3xl font-normal tracking-tight serif uppercase text-[#3a3d31]">Norhaus</div>
             <div className="flex items-center gap-12 text-[11px] font-bold uppercase tracking-[0.3em] text-[#3a3d31]">
               <span className="pb-1 border-b-2 border-[#434738]">Cloud Intelligence</span>
             </div>
          </div>
          <div className="flex items-center gap-6">
             <div className="text-[10px] font-bold uppercase tracking-widest text-[#b0a99f]">
                Status: Pro Active
             </div>
             <div className="w-2 h-2 rounded-full bg-[#434738] shadow-[0_0_8px_rgba(67,71,56,0.5)]"></div>
          </div>
        </div>
      </nav>

      <main className="flex-1 flex flex-col">
        <div className="px-12 py-20 max-w-5xl mx-auto w-full text-center">
          <h1 className="text-6xl font-normal serif text-[#3a3d31] mb-8 animate-fade-up">Find your inspiration.</h1>
          
          <div className="relative group animate-fade-up" style={{animationDelay: '0.1s'}}>
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
                className="flex-1 bg-transparent py-6 px-8 text-xl outline-none serif"
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
                  className="luxury-button px-10 py-5 rounded-sm text-xs disabled:opacity-50 shadow-lg"
                >
                  {isSearching ? 'Processing...' : 'Search'}
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
              <div className="absolute -bottom-20 left-0 flex items-center gap-4 bg-white border border-[#e8e4dc] p-2 pr-6 rounded-sm shadow-xl animate-fade-up z-20">
                  <img src={previewUrl} className="w-12 h-12 object-cover rounded-sm" />
                  <div className="text-left">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-[#434738] block">Visual Context</span>
                  </div>
                  <button onClick={() => { setReferenceImage(null); setPreviewUrl(null); }} className="ml-2 text-[#b0a99f] hover:text-red-400">
                      <XCircleIcon />
                  </button>
              </div>
            )}
          </div>
        </div>

        <div className="px-12 pb-32 flex-1">
          {isSearching ? (
             <div className="flex flex-col items-center justify-center py-24 opacity-60">
                <div className="w-10 h-10 border-b-2 border-[#434738] rounded-full animate-spin mb-6" />
                <p className="text-xs uppercase tracking-[0.2em] text-[#b0a99f]">Scanning Full Archives...</p>
             </div>
          ) : results.length > 0 ? (
            <div className="max-w-[1600px] mx-auto">
                <div className="flex items-center justify-between mb-12">
                    <h2 className="text-xs font-bold text-[#b0a99f] uppercase tracking-[0.45em]">Discovered Matches</h2>
                    <div className="h-px bg-[#e8e4dc] flex-1 ml-12 opacity-50"></div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-12">
                  {results.map((item, idx) => (
                      <ItemCard 
                        key={idx} 
                        item={item} 
                        onClick={() => setSelectedItem(item)}
                      />
                  ))}
                </div>

                {thinkingLog && (
                  <div className="mt-20 p-8 border border-[#e8e4dc] rounded-sm bg-white/50 text-left animate-fade-up">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-[#b0a99f] mb-4">Search Log</p>
                    <pre className="text-[10px] text-[#7c766d] whitespace-pre-wrap serif italic opacity-70 font-mono">{thinkingLog}</pre>
                  </div>
                )}
            </div>
          ) : (
             <div className="text-center py-24 opacity-30">
               <p className="text-sm serif italic text-[#7c766d]">Enter a query to begin.</p>
             </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
