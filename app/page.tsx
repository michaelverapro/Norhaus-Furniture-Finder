// app/page.tsx
"use client";

import React, { useState } from 'react';
import { FurnitureItem } from './types';
import { searchFurniture } from './geminiService';
import { Search, ChevronDown, ChevronUp, Sparkles, Loader2, ExternalLink, Copy, Check } from 'lucide-react';

const ItemCard = ({ item }: { item: FurnitureItem }) => {
    const initials = item.name.substring(0, 2).toUpperCase();
    
    // Construct the direct PDF link (Public GCS Bucket URL)
    const pdfUrl = item.catalog 
        ? `https://storage.googleapis.com/norhaus_catalogues/${item.catalog}#page=${item.page || 1}`
        : '#';

    return (
        <a 
            href={pdfUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="group block bg-white border border-[#e8e4dc] hover:border-[#434738] hover:shadow-xl transition-all h-full relative"
        >
            <div className="h-40 relative flex items-center justify-center bg-[#F4F1EA] group-hover:bg-[#EFEDE6] transition-colors">
                <span className="text-5xl font-serif text-[#434738] opacity-10">{initials}</span>
                
                {/* PDF Badge */}
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-white p-1.5 rounded-full shadow-sm">
                    <ExternalLink className="w-3 h-3 text-[#434738]" />
                </div>

                <div className="absolute bottom-3 left-3 text-[9px] font-bold uppercase tracking-widest bg-white/60 px-2 py-1 backdrop-blur-sm">
                    {item.catalog?.replace('.pdf', '')} — Pg. {item.page}
                </div>
            </div>
            
            <div className="p-5 flex flex-col">
                <div className="flex items-start gap-2 mb-3">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-1.5 shrink-0"></div>
                    <p className="text-[10px] font-bold text-[#434738] leading-tight italic">"{item.matchReason}"</p>
                </div>
                <h3 className="text-lg font-bold serif mb-1 group-hover:underline decoration-1 underline-offset-4">{item.name}</h3>
                <p className="text-[11px] text-[#7c766d] line-clamp-2">{item.description}</p>
            </div>
        </a>
    );
};

export default function Page() {
    const [results, setResults] = useState<FurnitureItem[]>([]);
    const [thinking, setThinking] = useState<string>('');
    const [isSearching, setIsSearching] = useState(false);
    const [showThinking, setShowThinking] = useState(true);
    const [copied, setCopied] = useState(false);
    const [query, setQuery] = useState('');

    const handleSearch = async () => {
        if (!query) return;
        setIsSearching(true);
        setResults([]);
        setThinking('');
        setShowThinking(true);
        
        try {
            const res = await searchFurniture(query);
            setResults(res.items || []);
            setThinking(res.thinkingProcess || '');
        } catch (e) { 
            console.error(e); 
            setThinking("Search failed. Please try again.");
        }
        setIsSearching(false);
    };

    const copyThinking = () => {
        navigator.clipboard.writeText(thinking);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="min-h-screen bg-[#fcfbf9] text-[#3a3d31] font-sans">
            <header className="px-8 py-6 border-b bg-white flex justify-between items-center sticky top-0 z-50">
                <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-[#434738] rounded-full"></div>
                    {/* Badge showing Gemini 3 Power */}
                    <span className="text-lg font-bold uppercase tracking-tighter">Norhaus AI <span className="text-[8px] bg-indigo-100 text-indigo-700 px-1 ml-1">G3 Preview</span></span>
                </div>
            </header>

            <main className="max-w-[1400px] mx-auto p-8">
                <div className="max-w-2xl mx-auto mb-10 text-center">
                    <h1 className="text-4xl font-serif mb-6">Interior Design Concierge</h1>
                    <div className="flex items-center bg-white border border-[#e8e4dc] rounded-full p-2 shadow-sm focus-within:ring-1 ring-[#434738]">
                        <Search className="ml-4 text-slate-300 w-5 h-5" />
                        <input 
                            type="text" 
                            placeholder="e.g. A velvet sofa for a moody lounge..." 
                            className="flex-1 p-4 bg-transparent outline-none"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        />
                        <button 
                            className="bg-[#434738] text-white px-8 py-4 rounded-full text-xs font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-[#2c3024] transition-colors"
                            onClick={handleSearch}
                            disabled={isSearching}
                        >
                            {isSearching ? <Loader2 className="animate-spin w-4 h-4" /> : 'Search'}
                        </button>
                    </div>
                </div>

                {/* Gemini 3 Reasoning Block */}
                {(isSearching || thinking) && (
                    <div className="max-w-2xl mx-auto mb-12 animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="bg-[#F0EEE6] border border-[#E2DFD5] rounded-xl p-4 relative">
                            <div 
                                className="flex justify-between items-center cursor-pointer"
                                onClick={() => setShowThinking(!showThinking)}
                            >
                                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#6B6658]">
                                    <Sparkles className="w-3 h-3" />
                                    {isSearching ? "Gemini 3 is thinking..." : "AI Curator Reasoning"}
                                </div>
                                <div className="flex items-center gap-2">
                                    {!isSearching && thinking && (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); copyThinking(); }}
                                            className="p-1 hover:bg-white/50 rounded transition-colors"
                                            title="Copy reasoning"
                                        >
                                            {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3 text-[#6B6658]" />}
                                        </button>
                                    )}
                                    {showThinking ? <ChevronUp className="w-4 h-4 text-[#6B6658]" /> : <ChevronDown className="w-4 h-4 text-[#6B6658]" />}
                                </div>
                            </div>
                            
                            {showThinking && (
                                <div className="mt-4 text-xs leading-relaxed text-[#434738] border-t border-[#E2DFD5] pt-4 italic">
                                    {isSearching ? (
                                        <div className="flex gap-2 items-center text-slate-400">
                                            <div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce"></div>
                                            <div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce [animation-delay:-.3s]"></div>
                                            <div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce [animation-delay:-.5s]"></div>
                                            Parsing catalog for stylistic matches...
                                        </div>
                                    ) : (
                                        thinking
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {results.map((item, idx) => (
                        <ItemCard key={idx} item={item} />
                    ))}
                </div>
            </main>
        </div>
    );
}
