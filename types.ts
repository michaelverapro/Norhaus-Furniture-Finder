// types.ts
export interface FurnitureItem {
  product_id: string;
  name: string;
  category: string;
  description: string;
  style: string[];      // Array to match master_index.json
  materials: string[];  // Array to match master_index.json
  finish: string;
  dimensions: {
    raw: string;
  };
  catalog: string;      // Matches 'catalog' key in JSON
  page: number;         // Matches 'page' key in JSON
  keywords: string[];   // Matches 'keywords' key in JSON
  
  // UI-Specific helper fields (mapped in App.tsx)
  catalogName?: string; 
  pageNumber?: number;
  matchReason?: string;
}

export interface SearchResult {
  items: FurnitureItem[];
  thinkingProcess: string;
}
