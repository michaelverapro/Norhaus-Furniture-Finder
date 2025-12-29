// app/page.tsx (Partial Update - Just replace the ItemCard component)

const ItemCard = ({ item, rank }: { item: FurnitureItem, rank: number }) => {
    // 1. Construct the Base URL for the public GCS bucket
    const baseUrl = item.catalog 
        ? `https://storage.googleapis.com/norhaus_catalogues/${item.catalog}`
        : null;

    // 2. The Link URL (Opens in new tab)
    const openUrl = baseUrl ? `${baseUrl}#page=${item.page || 1}` : '#';

    // 3. The Preview URL (Loads in iframe)
    // We add params to hide the PDF toolbar and scrollbars for a cleaner tile look
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
                    // The click passes through to the <a> tag, ensuring the new tab opens.
                    <iframe 
                        src={previewUrl}
                        className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity pointer-events-none" 
                        loading="lazy"
                        scrolling="no"
                        title={item.name}
                    />
                ) : (
                    // Fallback Initials if no PDF
                    <div className="w-full h-full flex items-center justify-center">
                        <span className="text-4xl font-serif text-[#434738] opacity-10">
                            {item.name.substring(0, 2).toUpperCase()}
                        </span>
                    </div>
                )}
                
                {/* HOVER OVERLAY (Also handles the click) */}
                {/* This sits ON TOP of the iframe (z-20) to capture the hover, 
                    but since it's inside the <a> tag, clicking it triggers the link. */}
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
