// app/page.tsx
"use client";

import React, { useState, useCallback, useMemo } from 'react';
import { FurnitureItem } from './types';
import { searchFurniture } from './geminiService';

const formatCatalogName = (filename: string) => {
    if (!filename) return "Unknown";
    let clean = filename.replace('.pdf', '').replace(/_/g, ' ').replace(/-/g, ' ');
    return clean.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

const LUXURY_PALETTE = ['#E8E5DE', '#D9E5DE', '#E5DDD9', '#D3D6DB', '#E5E3D9', '#D9E0E5'];
const getColorForCatalog = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return LUXURY_PALETTE[Math.abs(hash) % LUXURY_PALETTE.length];
};
const getInitials = (name: string) => {
    const words = name.split(' ');
    return words.length === 1 ? words[0].substring(0, 2).toUpperCase() : (words[0][0] + words[1][0]).toUpperCase();
};

const ItemCard = ({ item, onClick }: { item: FurnitureItem, onClick: () => void }) => {
    const bgColor = useMemo(() => getColorForCatalog(item.catalog || ''), [item.catalog]);
    const initials = useMemo(() => getInitials(item.name), [item.name]);

    return (
        <div onClick={onClick} className="bg-white border border-[#e8e4dc] hover:border-[#434738] cursor-pointer hover:shadow-xl transition-all flex flex-col h-full group">
            <div className="h-40 relative flex items-center justify-center border-b" style={{ backgroundColor: bgColor }}>
                <span className="text-6xl font-serif text-[#434738] opacity-10">{initials}</span>
                <div className="absolute top-3 left-3 text-[8px] font-bold uppercase tracking-wider bg-white/50 px-2 py-1 rounded-sm">{formatCatalogName(item.catalog || '')}</div>
            </div>
            <div className="p-5 flex flex-col flex-1">
                <div className="flex items-start gap-2 mb-2">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-1.5"></div>
                    <p className="text-[10px] font-bold text-[#434738] leading-tight italic">"{item.matchReason || 'Match found'}"</p>
                </div>
                <h3 className="text-lg font-bold serif mb-1">{item.name}</h3>
                <p className="text-[11px] text-[#7c766d] line-clamp-2 mb-4">{item.description}</p>
                <div className="mt-auto border-t pt-3 flex justify-between items-center opacity-60">
                    <span className="text-[9px] font-bold uppercase tracking-widest">{item.style?.[0] || 'Furniture'}</span>
                    <span className="text-[9px] font-bold">Pg {item.page}</span>
                </div>
            </div>
        </div>
    );
};

export default function Page() {
    const [results, setResults] = useState<FurnitureItem[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [query, setQuery] = useState('');
    const [selectedItem, setSelectedItem] = useState<FurnitureItem | null>(null);

    const handleSearch = async () => {
        if (!query) return;
        setIsSearching(true);
        try {
            const res = await searchFurniture(query);
            setResults(res.items || []);
        } catch (e) { console.error(e); }
        setIsSearching(false);
    };

    return (
        <div className="min-h-screen bg-[#fcfbf9] text-[#3a3d31] font-sans">
            <header className="px-8 py-6 border-b bg-white flex justify-between items-center sticky top-0 z-50">
                <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-[#434738] rounded-full"></div>
                    <span className="text-lg font-bold uppercase tracking-tighter">Norhaus AI</span>
                </div>
            </header>

            <main className="max-w-[1400px] mx-auto p-8">
                <div className="max-w-2xl mx-auto mb-16 text-center">
                    <h1 className="text-4xl font-serif mb-6">Interior Design Concierge</h1>
                    <div className="flex items-center bg-white border border-[#e8e4dc] rounded-full p-2 shadow-sm focus-within:border-[#434738] transition-all">
                        <input 
                            type="text" 
                            placeholder="Describe your vision..." 
                            className="flex-1 p-4 bg-transparent outline-none text-lg"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        />
                        <button 
                            className="bg-[#434738] text-white px-8 py-4 rounded-full text-xs font-bold uppercase tracking-widest disabled:opacity-50"
                            onClick={handleSearch}
                            disabled={isSearching}
                        >
                            {isSearching ? 'Curating...' : 'Search'}
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {results.map((item, idx) => (
                        <ItemCard key={idx} item={item} onClick={() => setSelectedItem(item)} />
                    ))}
                </div>
            </main>

            {selectedItem && (
                <div className="fixed inset-0 bg-black/90 z-[100] flex flex-col p-4">
                    <div className="flex justify-between items-center p-4 bg-white rounded-t-lg">
                        <h3 className="font-bold">{selectedItem.name}</h3>
                        <button onClick={() => setSelectedItem(null)} className="text-red-500 font-bold px-4">CLOSE</button>
                    </div>
                    <object 
                        data={`https://storage.googleapis.com/norhaus_catalogues/${encodeURIComponent(selectedItem.catalog)}#page=${selectedItem.page}`} 
                        type="application/pdf" 
                        className="w-full h-full rounded-b-lg"
                    >
                        <div className="bg-white p-20 text-center">Preview unavailable.</div>
                    </object>
                </div>
            )}
        </div>
    );
}
