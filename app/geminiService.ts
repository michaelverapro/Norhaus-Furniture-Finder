// app/geminiService.ts
import { SearchResult } from './types';

export async function searchFurniture(query: string, accessCode: string, imageBase64?: string): Promise<SearchResult> {
  // We switch to POST to handle the large image data
  const response = await fetch('/api/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-access-code': accessCode
    },
    body: JSON.stringify({ 
      q: query,
      image: imageBase64 // Optional image string
    })
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
