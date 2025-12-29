"use client";

import React, { useState, useRef } from 'react';
import { FurnitureItem } from './types';
import { searchFurniture } from './geminiService';
import { Search, ChevronDown, ChevronUp, Sparkles, Loader2, ExternalLink, Copy, Check, BookOpen, Lock, ArrowRight, ChevronLeft, ChevronRight, Camera, X } from 'lucide-react';

// --- VISUAL ITEM CARD COMPONENT ---
const ItemCard = ({ item, rank }: { item: FurnitureItem, rank: number }) => {
    const baseUrl = item.catalog 
        ? `https://storage.googleapis.com/norhaus_catalogues/${item.catalog}`
        : null;
    const openUrl = baseUrl ? `${baseUrl}#page=${item.page || 1}` : '#';
    const previewUrl = baseUrl ? `${baseUrl}#page=${item.page || 1}&view=FitH&toolbar=0&navpanes=0&scrollbar=0` : null;

    return (
        <a 
            href={openUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="group flex flex-col bg-white border border-[#e8e4dc] hover:border-[#6B6658] transition-all h-full relative overflow-hidden cursor-pointer shadow-sm hover:shadow-md duration-300"
        >
            <div className="absolute top-0 left-0 bg-[#2A2A2A] text-white text-[10px] font-sans tracking-[0.2em] font-medium px-3 py-1.5 z-30 uppercase">MATCH {rank}</div>
            <div className="h-72 relative bg-[#F8F8F8] group-hover:bg-[#F0F0F0] transition-colors overflow-hidden">
                {previewUrl ? (
                    <iframe 
                        src={previewUrl}
                        className="w-full h-full object-cover opacity-95 group-hover:opacity-100 transition-opacity pointer-events-none grayscale-[20%] group-hover:grayscale-0 duration-500" 
                        loading="lazy"
                        scrolling="no"
                        title={item.name}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <span className="text-5xl font-serif text-[#C0C0C0] opacity-30 italic">{item.name.substring(0, 2).toUpperCase()}</span>
                    </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-white/20 backdrop-blur-[1px] z-20">
                    <div className="bg-[#2A2A2A] text-white px-5 py-2 text-[10px] uppercase tracking-[0.2em] shadow-lg flex items-center gap-3 transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                         VIEW CATALOG
                    </div>
                </div>
            </div>
            <div className="p-6 flex flex-col flex-1 relative z-20 bg-white">
                <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-[#888888] mb-3 font-sans border-b border-[#F0F0F0] pb-3">
                    <span>{item.catalog?.replace('.pdf', '')}</span>
                    <span className="text-[#DDDDDD] mx-1">/</span>
                    <span>Pg. {item.page}</span>
                </div>
                <h3 className="text-xl font-serif text-[#111111] mb-3 leading-snug group-hover:text-[#555555] transition-colors">{item.name}</h3>
                <div className="mt-auto">
                    <p className="text-xs font-serif text-[#666666] leading-relaxed italic border-l-2 border-[#E5E5E5] pl-3">
                        "{item.matchReason}"
                    </p>
                </div>
            </div>
        </a>
    );
};

// --- MAIN PAGE COMPONENT ---
export default function Page() {
    // Auth State
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [accessCode, setAccessCode] = useState('');
    const [authError, setAuthError] = useState(false);

    // App State
    const [results, setResults] = useState<FurnitureItem[]>([]);
    const [thinking, setThinking] = useState<string>('');
    const [isSearching, setIsSearching] = useState(false);
    const [showThinking, setShowThinking] = useState(true);
    const [copied, setCopied] = useState(false);
    const [query, setQuery] = useState('');
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 25;
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = results.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(results.length / itemsPerPage);

    const handleLogin = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (accessCode === 'Norhaus2026') {
            setIsAuthenticated(true);
            setAuthError(false);
        } else {
            setAuthError(true);
            setAccessCode('');
        }
    };

    const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setSelectedImage(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const clearImage = () => {
        setSelectedImage(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSearch = async () => {
        if (!query && !selectedImage) return;
        setIsSearching(true);
        setResults([]);
        setThinking('');
        setShowThinking(true);
        setCurrentPage(1);
        
        try {
            const res = await searchFurniture(query, 'Norhaus2026', selectedImage || undefined);
            setResults(res.items || []);
            setThinking(res.thinkingProcess || '');
        } catch (e: any) { 
            console.error(e); 
            setThinking(e.message || "Search failed. Please try again.");
        }
        setIsSearching(false);
    };

    const copyThinking = () => {
        navigator.clipboard.writeText(thinking);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const scrollToTop = () => {
        const main = document.querySelector('main');
        if (main) main.scrollIntoView({ behavior: 'smooth' });
    };

    // --- RENDER LOCK SCREEN ---
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-[#F9F9F9] flex flex-col items-center justify-center p-4 font-sans">
                <div className="w-full max-w-lg bg-white border border-[#E5E5E5] p-12 shadow-2xl text-center">
                    
                    <div className="w-24 h-24 mx-auto mb-8 flex items-center justify-center">
                        <img 
                            src="/logo.png" 
                            alt="Norhaus" 
                            className="w-full h-full object-contain grayscale opacity-90"
                            onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                            }}
                        />
                        <div className="hidden w-16 h-16 bg-[#2A2A2A] flex items-center justify-center shadow-md">
                            <Lock className="w-6 h-6 text-white" />
                        </div>
                    </div>
                    
                    <h1 className="text-3xl font-serif text-[#111111] mb-6 tracking-wide">NORHAUS CONCIERGE</h1>
                    <div className="w-12 h-0.5 bg-[#111111] mx-auto mb-8"></div>
                    
                    <p className="text-xs text-[#666666] mb-10 leading-7 px-6 tracking-wide font-serif italic">
                        "Powered by Gemini 3.0. Intelligence meets Curation."
                    </p>
                    
                    <form onSubmit={handleLogin} className="flex flex-col gap-5 max-w-xs mx-auto">
                        <input 
                            type="password" 
                            placeholder="ACCESS CODE" 
                            className={`w-full py-4 bg-transparent border-b-2 ${authError ? 'border-red-400' : 'border-[#E5E5E5] focus:border-[#2A2A2A]'} outline-none transition-colors text-center tracking-[0.3em] text-xs font-sans uppercase placeholder:text-[#BBBBBB]`}
                            value={accessCode}
                            onChange={(e) => setAccessCode(e.target.value)}
                        />
                        {authError && <p className="text-[10px] text-red-500 tracking-widest uppercase mt-1">Invalid Credentials</p>}
                        
                        <button type="submit" className="w-full bg-[#111111] text-white py-4 mt-4 text-[10px] font-bold uppercase tracking-[0.25em] hover:bg-[#333333] transition-colors flex items-center justify-center gap-3">
                            Enter Portal
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // --- RENDER MAIN APP ---
    return (
        <div className="min-h-screen bg-[#FCFCFC] text-[#111111] font-sans selection:bg-[#E5E5E5]">
            <header className="px-10 py-8 border-b border-[#EAEAEA] bg-white/95 backdrop-blur-md flex justify-between items-center sticky top-0 z-50">
                <div className="flex items-center gap-6">
                    <img 
                        src="/logo.png" 
                        alt="Norhaus Logo" 
                        className="h-12 w-auto object-contain grayscale"
                        onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                        }}
                    />
                    <div className="hidden w-5 h-5 bg-[#2A2A2A]"></div>
                    
                    <div className="h-8 w-[1px] bg-[#E5E5E5]"></div>
                    
                    {/* UPDATED: Top-Left App Label */}
                    <span className="text-lg font-serif tracking-wide text-[#111111]">
                        Norhaus — <span className="font-sans text-[10px] uppercase tracking-[0.2em] text-[#888888] ml-1">AI-Powered Furniture Finder</span>
                    </span>
                </div>
                
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                         <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                         <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#888888]">
                            Gemini 3.0 Active
                        </span>
                    </div>
                </div>
            </header>

            <main className="max-w-[1600px] mx-auto px-8 py-12">
                <div className="max-w-4xl mx-auto mb-16 text-center pt-8">
                    
                    {/* UPDATED: Main Headline */}
                    <h1 className="text-5xl font-serif mb-6 text-[#111111] tracking-tight">Search the Norhaus Catalog Collection</h1>
                    
                    {/* UPDATED: Subtext */}
                    <p className="text-sm font-serif text-[#666666] mb-12 leading-relaxed max-w-2xl mx-auto">
                        Curated by Google’s newest Gemini AI. Describe what you’re looking for, 
                        and Gemini will search across all of your catalogs simultaneously to present the best matching options.
                    </p>
                    
                    {/* SEARCH INPUT AREA */}
                    <div className="bg-white border-b border-[#E5E5E5] hover:border-[#999999] transition-colors relative flex items-center pb-2">
                        
                        {selectedImage && (
                            <div className="absolute -top-24 left-0">
                                <div className="relative inline-block bg-white p-2 shadow-xl border border-[#E5E5E5]">
                                    <img src={selectedImage} alt="Upload" className="h-16 w-auto grayscale opacity-80" />
                                    <button onClick={clearImage} className="absolute -top-2 -right-2 bg-[#111111] text-white p-1 hover:bg-[#333333]">
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        )}

                        <Search className="text-[#BBBBBB] w-5 h-5 shrink-0" />
                        <input 
                            type="text" 
                            placeholder={selectedImage ? "ADD CONTEXT TO IMAGE..." : "DESCRIBE YOUR VISION (E.G. BELGIAN LINEN SOFA)..."}
                            className="flex-1 p-4 bg-transparent outline-none text-[#111111] placeholder:text-[#CCCCCC] font-sans uppercase tracking-[0.1em] text-xs"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        />
                        
                        <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />

                        <button 
                            className="p-3 mr-4 text-[#888888] hover:text-[#111111] transition-colors"
                            onClick={() => fileInputRef.current?.click()}
                            title="UPLOAD REFERENCE"
                        >
                            <Camera className="w-5 h-5" />
                        </button>

                        <button 
                            className="bg-[#111111] text-white px-10 py-3 text-[10px] font-bold uppercase tracking-[0.25em] hover:bg-[#333333] transition-colors"
                            onClick={handleSearch}
                            disabled={isSearching}
                        >
                            {isSearching ? <Loader2 className="animate-spin w-4 h-4" /> : 'SEARCH'}
                        </button>
                    </div>
                </div>

                {(isSearching || thinking) && (
                    <div className="max-w-3xl mx-auto mb-20 animate-in fade-in slide-in-from-top-4 duration-700">
                        <div className="bg-[#FAFAFA] border border-[#EAEAEA] p-8">
                            <div className="flex justify-between items-center cursor-pointer mb-6 border-b border-[#EAEAEA] pb-4" onClick={() => setShowThinking(!showThinking)}>
                                <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#666666]">
                                    <Sparkles className="w-3 h-3 text-[#111111]" />
                                    {isSearching ? "ANALYZING CATALOG..." : "CURATORIAL NOTES"}
                                </div>
                                <div className="flex items-center gap-4">
                                    {!isSearching && thinking && (
                                        <button onClick={(e) => { e.stopPropagation(); copyThinking(); }} className="hover:opacity-50 transition-opacity"><Copy className="w-3 h-3 text-[#111111]" /></button>
                                    )}
                                    {showThinking ? <ChevronUp className="w-4 h-4 text-[#111111]" /> : <ChevronDown className="w-4 h-4 text-[#111111]" />}
                                </div>
                            </div>
                            {showThinking && (
                                <div className="text-sm font-serif leading-8 text-[#444444] text-justify">
                                    {isSearching ? (
                                        <div className="flex gap-2 items-center text-[#999999] font-sans text-[10px] tracking-widest uppercase">
                                            <div className="w-1 h-1 bg-[#999999] animate-bounce"></div>
                                            <div className="w-1 h-1 bg-[#999999] animate-bounce [animation-delay:-.3s]"></div>
                                            <div className="w-1 h-1 bg-[#999999] animate-bounce [animation-delay:-.5s]"></div>
                                            CROSS-REFERENCING DIMENSIONS AND FINISHES...
                                        </div>
                                    ) : (
                                        thinking
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="pb-20">
                    {results.length > 0 && (
                       <div className="flex items-center gap-4 mb-10">
                           <div className="h-[1px] bg-[#E5E5E5] flex-1"></div>
                           <p className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.25em]">
                               Displaying {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, results.length)} of {results.length}
                           </p>
                           <div className="h-[1px] bg-[#E5E5E5] flex-1"></div>
                       </div>
                    )}
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-16">
                        {currentItems.map((item, idx) => (
                            <ItemCard key={idx} item={item} rank={indexOfFirstItem + idx + 1} />
                        ))}
                    </div>

                    {results.length > itemsPerPage && (
                        <div className="mt-24 flex justify-center items-center gap-12">
                            <button
                                onClick={() => { setCurrentPage(prev => Math.max(prev - 1, 1)); scrollToTop(); }}
                                disabled={currentPage === 1}
                                className={`flex items-center gap-3 px-8 py-4 border border-[#E5E5E5] text-[10px] font-bold uppercase tracking-[0.2em] transition-all hover:bg-[#111111] hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-inherit`}
                            >
                                <ChevronLeft className="w-3 h-3" /> PREVIOUS
                            </button>
                            
                            <span className="text-[10px] font-serif italic text-[#888888]">
                                Page {currentPage} <span className="mx-2 not-italic">/</span> {totalPages}
                            </span>
                            
                            <button
                                onClick={() => { setCurrentPage(prev => Math.min(prev + 1, totalPages)); scrollToTop(); }}
                                disabled={currentPage === totalPages}
                                className={`flex items-center gap-3 px-8 py-4 border border-[#E5E5E5] text-[10px] font-bold uppercase tracking-[0.2em] transition-all hover:bg-[#111111] hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-inherit`}
                            >
                                NEXT <ChevronRight className="w-3 h-3" />
                            </button>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
