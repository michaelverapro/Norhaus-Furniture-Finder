// geminiService.ts
import { SearchResult } from "./types";

export const syncAndCacheLibrary = async () => {
  return { cacheName: "cloud-mode", catalogMetadata: [] };
};

export const searchFurniture = async (query: string, imageFile?: File): Promise<SearchResult> => {
  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server Error: ${response.statusText}`);
    }

    const data = await response.json();
    
    return { 
      items: data.results || [], 
      thinkingProcess: data.count !== undefined ? `Successfully retrieved ${data.count} items.` : "Search complete." 
    };

  } catch (e: any) {
    console.error("Frontend Search Error:", e);
    return { 
      items: [], 
      thinkingProcess: `Connection Error: ${e.message}` 
    };
  }
};
