// geminiService.ts
import { SearchResult } from "./types";

export const searchFurniture = async (query: string): Promise<SearchResult> => {
  try {
    // We send a simple GET request; the AI Brain handles everything on the server
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server Error: ${response.statusText}`);
    }

    const data = await response.json();
    
    return { 
      items: data.results || [], 
      thinkingProcess: data.thinkingProcess || "AI successfully curated these items for you." 
    };

  } catch (e: any) {
    console.error("Frontend Search Error:", e);
    return { 
      items: [], 
      thinkingProcess: `Consultation Error: ${e.message}` 
    };
  }
};

// Placeholder to keep the app from breaking if other components call it
export const syncAndCacheLibrary = async () => {
  return { cacheName: "cloud-mode", catalogMetadata: [] };
};
