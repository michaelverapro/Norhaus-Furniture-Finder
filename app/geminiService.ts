// app/geminiService.ts
import { SearchResult } from './types';

export async function searchFurniture(query: string, accessCode: string): Promise<SearchResult> {
  const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
    headers: {
      // Pass the code securely in the header
      'x-access-code': accessCode
    }
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.details || 'Search failed');
  }
  
  const data = await response.json();
  
  return {
    items: data.items || [],
    thinkingProcess: data.thinkingProcess || ""
  };
}
