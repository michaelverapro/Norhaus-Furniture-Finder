// geminiService.ts - Fixed Import Path
import { SearchResult } from "./types"; // <--- CHANGED from "../types" to "./types"

export const syncAndCacheLibrary = async () => {
  // In the Cloud version, "Sync" just means confirming the server is reachable.
  return { cacheName: "cloud-mode", catalogMetadata: [] };
};

export const searchFurniture = async (query: string, imageFile?: File): Promise<SearchResult> => {
  try {
    // We send the query to our new Vercel API
    const response = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });

    if (!response.ok) {
      throw new Error(`Server Error: ${response.statusText}`);
    }

    const data = await response.json();
    return { 
      items: data.items || [], 
      thinkingProcess: data.thinkingProcess || "Search complete." 
    };

  } catch (e: any) {
    console.error(e);
    return { 
      items: [], 
      thinkingProcess: `Connection Error: ${e.message}` 
    };
  }
};
