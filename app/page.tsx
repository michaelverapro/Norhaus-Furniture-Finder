"use client";

import React, { useState } from 'react';
import { FurnitureItem } from './types';
import { searchFurniture } from './geminiService';
import { Search, ChevronDown, ChevronUp, Sparkles, Loader2, ExternalLink, Copy, Check, BookOpen } from 'lucide-react';

// --- VISUAL ITEM CARD COMPONENT ---
const ItemCard = ({ item, rank }: { item: FurnitureItem, rank: number }) => {
    // 1. Construct the Base URL
    const baseUrl = item.catalog 
        ? `https://storage.googleapis.com/norhaus_catalogues/${item.catalog}`
        : null;

    // 2. The Link URL (Opens in new tab)
    const openUrl = baseUrl ? `${baseUrl}#page=${item.page || 1}` : '#';

    // 3. The Preview URL (Loads in iframe)
    const previewUrl = baseUrl ? `${baseUrl}#page=${item.page || 1}&view=FitH&toolbar=0&navpanes=0&scrollbar=0` : null;

    return (
        <a 
            href={openUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="group flex flex-col bg-white border border-[#e8e4dc] hover:border-[#434738] hover:shadow-xl transition-all h-full relative overflow-hidden cursor-pointer"
        >
            {/* Relevance Badge */}
            <div className="absolute top-0 left-0 bg-[#434738] text-white text-[9px] font-bold px-2 py-1 z-30">
                MATCH #{rank}
            </div>

            {/* PREVIEW CONTAINER */}
            <div className="h-64 relative bg-[#F4F1EA] group-hover:bg-[#EFEDE6] transition-colors overflow-hidden">
                
                {previewUrl ? (
                    // THE TRICK: pointer-events-none makes the iframe "transparent" to clicks.
                    <iframe 
                        src={previewUrl}
                        className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity pointer-events-none" 
                        loading="lazy"
                        scrolling="no"
                        title={item.name}
                    />
                ) : (
                    // Fallback Initials
                    <div className="w-full h-full flex items-center justify-center">
                        <span className="text-4xl font-serif text-[#434738] opacity-10">
                            {item.name.substring(0, 2).toUpperCase()}
                        </span>
                    </div>
                )}
                
                {/* HOVER OVERLAY */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/10 backdrop-blur-[2px] z-20">
                    <div className="bg-white text-[#434738] px-3 py-2 rounded-full text-xs font-bold shadow-sm flex items-center gap-2 transform translate-y-2 group-hover:translate-y-0 transition-transform">
                        <ExternalLink className="w-3 h-3" />
                        Open PDF
                    </div>
                </div>
            </div>
            
            {/* TEXT CONTENT */}
            <div className="p-5 flex flex-col flex-1 relative z-20 bg-white">
                <div className="flex items-center gap-2 text-[9px] uppercase tracking-widest text-[#9ca3af] mb-2">
                    <BookOpen className="w-3 h-3" />
                    <span>{item.catalog?.replace('.pdf', '')}</span>
                    <span className="text-[#e5e7eb]">|</span>
                    <span>Pg. {item.page}</span>
                </div>

                <h3 className="text-lg font-bold serif text-[#3a3d31] mb-2 leading-tight group-hover:underline decoration-1 underline-offset-4">
                    {item.name}
                </h3>

                <div className="mt-auto pt-3 border-t border-[#f3f4f6]">
                    <p className="text-[11px] font-medium text-[#5a5e4e] italic leading-relaxed">
                        <span className="not-italic mr-1">💡</span>
                        {item.matchReason}
                    </p>
                </div>
            </div>
        </a>
    );
};

// --- MAIN PAGE COMPONENT ---
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
            {/* Header */}
            <header className="px-8 py-6 border-b bg-white flex justify-between items-center sticky top-0 z-50">
                <div className="flex items-center gap-3">
                    <div className="w-4 h-4 bg-[#434738] rounded-sm rotate-45"></div>
                    <span className="text-xl font-serif font-bold tracking-tight">Norhaus <span className="font-sans font-light text-slate-400">Design Concierge</span></span>
                </div>
                
                {/* App Status Badge */}
                <div className="flex items-center gap-3 bg-[#f8f9fa] border border-[#e9ecef] px-3 py-1.5 rounded-full">
                    <div className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#6c757d]">
                        System Active • 14 Catalogs
                    </span>
                </div>
            </header>

            <main className="max-w-[1400px] mx-auto p-8">
                {/* Search Hero */}
                <div className="max-w-2xl mx-auto mb-12 text-center pt-8">
                    <h1 className="text-4xl font-serif mb-2 text-[#3a3d31]">What are we curating today?</h1>
                    <p className="text-sm text-[#8a8d85] mb-8">Ask for styles, dimensions, or specific materials.</p>
                    
                    <div className="flex items-center bg-white border border-[#e8e4dc] rounded-full p-2 shadow-sm focus-within:ring-1 ring-[#434738] focus-within:shadow-md transition-shadow">
                        <Search className="ml-4 text-slate-300 w-5 h-5" />
                        <input 
                            type="text" 
                            placeholder="e.g. A mid-century arm chair in walnut..." 
                            className="flex-1 p-4 bg-transparent outline-none text-[#3a3d31] placeholder:text-slate-300"
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

                {/* Reasoning Block */}
                {(isSearching || thinking) && (
                    <div className="max-w-2xl mx-auto mb-16 animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="bg-[#F0EEE6] border border-[#E2DFD5] rounded-xl p-4 relative shadow-sm">
                            <div 
                                className="flex justify-between items-center cursor-pointer"
                                onClick={() => setShowThinking(!showThinking)}
                            >
                                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#6B6658]">
                                    <Sparkles className="w-3 h-3 text-amber-600" />
                                    {isSearching ? "Curator is analyzing catalog..." : "Curator's Logic"}
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
                                <div className="mt-4 text-xs leading-relaxed text-[#434738] border-t border-[#E2DFD5] pt-4 font-serif italic">
                                    {isSearching ? (
                                        <div className="flex gap-2 items-center text-slate-400 font-sans not-italic">
                                            <div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce"></div>
                                            <div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce [animation-delay:-.3s]"></div>
                                            <div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce [animation-delay:-.5s]"></div>
                                            Reviewing dimensions and finishes...
                                        </div>
                                    ) : (
                                        thinking
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Results Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-10 pb-20">
                    {results.map((item, idx) => (
                        <ItemCard key={idx} item={item} rank={idx + 1} />
                    ))}
                </div>
            </main>
        </div>
    );
}
