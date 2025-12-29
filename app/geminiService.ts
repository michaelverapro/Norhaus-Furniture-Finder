// app/geminiService.ts
import { SearchResult } from './types';

export async function searchFurniture(query: string): Promise<SearchResult> {
  const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.details || 'Search failed');
  }
  
  const data = await response.json();
  
  // Return the structure expected by your Page component
  return {
    items: data.items || [],
    thinkingProcess: data.thinkingProcess || ""
  };
}
