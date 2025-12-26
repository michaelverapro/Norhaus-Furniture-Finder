import React, { useState, useRef, useCallback, memo, useMemo } from 'react';
import { FurnitureItem } from './types';
import { searchFurniture } from './geminiService';

// ==========================================
// 1. HELPER FUNCTIONS & ICONS
// ==========================================

const formatCatalogName = (filename: string) => {
    if (!filename) return "Unknown";
    let clean = filename.replace('.pdf', '').replace(/_/g, ' ').replace(/-/g, ' ');
    if (clean.length > 25) clean = clean.substring(0, 25) + "...";
    return clean.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

const SearchIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>;
const PaperclipIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>;
const CloseIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 18L18 6M6 6l12 12" /></svg>;
const ExternalLinkIcon = () => <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>;
const XCircleIcon = () => <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>;
const FurnitureIcon = () => <svg className="w-10 h-10 text-[#434738] opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
const LayersIcon = () => <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>;

// ==========================================
// 2. ISOLATED COMPONENTS
// ==========================================

const SearchInput = memo(({ onSearch, isSearching }: { onSearch: (q: string, f: File | null) => void, isSearching: boolean }) => {
    const [localQuery, setLocalQuery] = useState('');
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [referenceImage, setReferenceImage] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleTrigger = () => onSearch(localQuery, referenceImage);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setReferenceImage(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    return (
        <div className="relative max-w-2xl mx-auto group animate-fade-up">
            <div className="flex items-center bg-white border border-[#e8e4dc] rounded-full p-1.5 shadow-sm focus-within:border-[#434738] focus-within:shadow-md transition-all">
                <div className="pl-6 text-[#b0a99f]"><SearchIcon /></div>
                <input
                    type="text"
                    placeholder="Search catalogs..."
                    value={localQuery}
                    onChange={(e) => setLocalQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleTrigger()}
                    className="flex-1 bg-transparent py-4 px-4 text-lg outline-none serif placeholder:text-slate-300"
                />
                <div className="flex items-center gap-2 pr-2">
                    <button onClick={() => fileInputRef.current?.click()} className="p-3 text-[#b0a99f] hover:text-[#434738] hover:bg-slate-50 transition-all rounded-full"><PaperclipIcon /></button>
                    <button onClick={handleTrigger} disabled={isSearching} className="bg-[#434738] hover:bg-[#33362a] text-white px-8 py-3 rounded-full text-xs font-bold tracking-widest uppercase transition-all shadow-md disabled:opacity-50">
                        {isSearching ? '...' : 'Search'}
                    </button>
                </div>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
            </div>
            {previewUrl && (
                <div className="absolute top-full mt-4 left-0 flex items-center gap-3 bg-white border border-[#e8e4dc] p-2 pr-4 rounded-lg shadow-xl animate-fade-up z-20">
                    <img src={previewUrl} className="w-10 h-10 object-cover rounded-md" alt="Context" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#434738]">Image Context</span>
                    <button onClick={() => { setReferenceImage(null); setPreviewUrl(null); }} className="ml-auto text-slate-400 hover:text-red-400"><XCircleIcon /></button>
                </div>
            )}
        </div>
    );
});

// -- UPDATED: ItemCard with Prominent Variants --
const ItemCard = memo(({ group, onClick }: { group: FurnitureItem[], onClick: () => void }) => {
    // Primary item is the first one found
    const item = group[0];
    const variantCount = group.length;

    return (
        <div onClick={onClick} className="bg-white rounded-lg border border-[#f0ede6] overflow-hidden cursor-pointer hover:shadow-xl hover:border-[#d6d3cc] transition-all duration-300 group flex flex-col h-full relative">
            
            {/* Taller Image Area for 4-Col Layout */}
            <div className="h-48 bg-[#faf9f6] relative flex items-center justify-center border-b border-[#f0ede6] group-hover:bg-[#f0ede6] transition-colors">
                <FurnitureIcon />
                
                {item.dimensions && (
                    <div className="absolute top-3 left-3 bg-white/90 backdrop-blur border border-[#e8e4dc] text-[#434738] text-[9px] font-bold px-2 py-0.5 rounded shadow-sm">
                        {item.dimensions}
                    </div>
                )}
                
                {/* --- NEW: High-Priority Variant Badge --- */}
                {variantCount > 1 ? (
                    <div className="absolute bottom-3 right-3 bg-[#434738] text-white text-[10px] font-bold px-3 py-1.5 rounded-full shadow-md flex items-center gap-1.5 ring-2 ring-white animate-pulse-slow">
                        <LayersIcon />
                        <span className="uppercase tracking-wider">{variantCount} Variants</span>
                    </div>
                ) : (
                    <div className="absolute bottom-3 right-3 bg-white text-[#434738] border border-[#e8e4dc] text-[10px] font-bold px-2 py-1 rounded shadow-sm opacity-60">
                        Pg {item.pageNumber || '?'}
                    </div>
                )}
            </div>

            <div className="p-5 flex flex-col flex-1">
                <div className="mb-3">
                    <div className="text-[9px] font-bold text-[#b0a99f] uppercase tracking-wider truncate mb-1">{formatCatalogName(item.catalogName)}</div>
                    <h3 className="text-lg font-bold text-[#3a3d31] leading-tight line-clamp-2 group-hover:text-[#434738] transition-colors">{item.name}</h3>
                </div>
                <p className="text-[12px] text-[#7c766d] leading-relaxed line-clamp-3 mb-4 flex-1">{item.description}</p>
                <div className="pt-4 mt-auto border-t border-[#f5f5f5] flex items-center justify-between">
                     <span className="text-[10px] font-medium text-[#b0a99f] uppercase tracking-widest group-hover:text-[#434738] transition-colors">
                        {variantCount > 1 ? 'View Collection' : 'View Details'}
                     </span>
                     <svg className="w-4 h-4 text-[#b0a99f] group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </div>
            </div>
        </div>
    );
});

const PDFViewerModal = ({ group, onClose }: { group: FurnitureItem[] | null, onClose: () => void }) => {
    if (!group || group.length === 0) return null;
    
    const [selectedVariant, setSelectedVariant] = useState<FurnitureItem>(group[0]);

    const cleanName = encodeURIComponent(selectedVariant.catalogName);
    const baseUrl = `https://storage.googleapis.com/norhaus_catalogues/${cleanName}`;
    const pageNum = selectedVariant.pageNumber;
    const deepLinkUrl = pageNum ? `${baseUrl}#page=${pageNum}` : baseUrl;

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex flex-col animate-in fade-in duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-[#e8e4dc] shadow-md z-10 relative">
                <div className="flex flex-col">
                    <h3 className="text-sm font-bold text-[#3a3d31]">{selectedVariant.name}</h3>
                    <p className="text-[10px] text-[#b0a99f] uppercase tracking-wider">
                        {formatCatalogName(selectedVariant.catalogName)} • Page {pageNum || '1'}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <a href={deepLinkUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-[#f0ede6] hover:bg-[#e8e4dc] text-[#434738] px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors">
                        <span>Open PDF</span>
                        <ExternalLinkIcon />
                    </a>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-red-500 transition-colors"><CloseIcon /></button>
                </div>
            </div>

            <div className="flex-1 w-full relative flex overflow-hidden">
                {/* Variant Sidebar */}
                {group.length > 1 && (
                    <div className="w-72 bg-[#1a1a1a] text-white flex-shrink-0 flex flex-col border-r border-white/10 overflow-y-auto">
                        <div className="p-5 border-b border-white/10 bg-[#222]">
                            <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#b0a99f] mb-1">Select Variant</h4>
                            <p className="text-xs text-gray-500">{group.length} options available</p>
                        </div>
                        {group.map((item, idx) => (
                            <button 
                                key={idx}
                                onClick={() => setSelectedVariant(item)}
                                className={`p-4 text-left border-b border-white/5 hover:bg-white/5 transition-colors ${selectedVariant === item ? 'bg-[#434738] border-l-4 border-l-white' : 'border-l-4 border-l-transparent'}`}
                            >
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs font-bold text-white">Option {idx + 1}</span>
                                    <span className="text-[9px] bg-black/30 px-1.5 py-0.5 rounded text-gray-400">Pg {item.pageNumber}</span>
                                </div>
                                <div className="text-[11px] text-gray-400 line-clamp-2 leading-relaxed">{item.description}</div>
                            </button>
                        ))}
                    </div>
                )}

                {/* PDF Viewer */}
                <div className="flex-1 bg-[#525659] relative flex justify-center p-6">
                     <div className="w-full h-full bg-white shadow-2xl rounded-sm overflow-hidden border border-black/20">
                        <object key={deepLinkUrl} data={deepLinkUrl} type="application/pdf" className="w-full h-full block">
                            <div className="flex items-center justify-center h-full text-slate-500">
                                <p>Unable to display PDF. Please use the "Open PDF" button.</p>
                            </div>
                        </object>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ==========================================
// 3. MAIN APP
// ==========================================
const App: React.FC = () => {
    const [results, setResults] = useState<FurnitureItem[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [thinkingLog, setThinkingLog] = useState('');
    const [selectedGroup, setSelectedGroup] = useState<FurnitureItem[] | null>(null);

    const handleSearch = useCallback(async (query: string, file: File | null) => {
        if (!query && !file) return;
        setIsSearching(true);
        setResults([]);
        setThinkingLog('');
        try {
            const res = await searchFurniture(query, file || undefined);
            setResults(res.items || []);
            setThinkingLog(res.thinkingProcess || '');
        } catch (e: any) {
            console.error(e);
            setThinkingLog(`Error: ${e.message}`);
        } finally {
            setIsSearching(false);
        }
    }, []);

    // Logic to Group Results by Name + Catalog
    const groupedResults = useMemo(() => {
        const groups: { [key: string]: FurnitureItem[] } = {};
        results.forEach(item => {
            const key = `${item.catalogName}-${item.name}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        });
        return Object.values(groups);
    }, [results]);

    const uniqueCatalogs = new Set(results.map(r => r.catalogName)).size;

    return (
        <div className="min-h-screen flex flex-col bg-[#fcfbf9] text-[#3a3d31] font-sans">
            {selectedGroup && <PDFViewerModal group={selectedGroup} onClose={() => setSelectedGroup(null)} />}

            <header className="px-8 py-6 border-b border-[#f0ede6] bg-white/80 backdrop-blur sticky top-0 z-40">
                <div className="max-w-[1920px] mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-[#434738] rounded-full"></div>
                        <span className="text-lg font-bold tracking-tight uppercase">Norhaus</span>
                        <span className="mx-2 text-slate-300">/</span>
                        <span className="text-xs font-bold uppercase tracking-widest text-[#b0a99f]">Intelligence</span>
                    </div>
                    <div className="text-[10px] font-bold text-[#b0a99f] uppercase tracking-widest">Engine: Vercel Pro</div>
                </div>
            </header>

            <main className="flex-1 max-w-[1920px] mx-auto w-full px-8 py-12 flex flex-col">
                <div className="mb-16 text-center">
                    <h1 className="text-4xl font-serif text-[#3a3d31] mb-8 animate-fade-up">Explore the archives.</h1>
                    <SearchInput onSearch={handleSearch} isSearching={isSearching} />
                </div>

                <div className="flex-1">
                    {isSearching ? (
                        <div className="text-center py-20 opacity-50 animate-pulse">
                            <p className="text-xs uppercase tracking-widest font-bold">Analyzing catalogs...</p>
                        </div>
                    ) : results.length > 0 ? (
                        <div className="animate-fade-up">
                            <div className="flex items-center justify-between mb-8 pb-4 border-b border-[#f0ede6]">
                                <h2 className="text-xs font-bold uppercase tracking-widest text-[#b0a99f]">
                                    {groupedResults.length} Products Found <span className="text-slate-300 mx-2">•</span> {results.length - groupedResults.length} Variants Hidden
                                </h2>
                            </div>
                            
                            {/* UPDATED: 4-Column Layout (xl:grid-cols-4) instead of 5 */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                                {groupedResults.map((group, idx) => (
                                    <ItemCard key={idx} group={group} onClick={() => setSelectedGroup(group)} />
                                ))}
                            </div>

                            {thinkingLog && (
                                <div className="mt-12 bg-white border border-[#f0ede6] p-4 rounded-lg">
                                    <p className="text-[10px] font-bold uppercase text-[#b0a99f] mb-2">Process Log</p>
                                    <pre className="text-[10px] text-slate-400 whitespace-pre-wrap font-mono">{thinkingLog}</pre>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-20 opacity-25">
                            <p className="serif italic text-slate-400">Enter a query to begin your search.</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default App;
