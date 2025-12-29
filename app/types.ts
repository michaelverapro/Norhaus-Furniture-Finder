// types.ts
export interface FurnitureItem {
  product_id: string;
  name: string;
  category: string;
  description: string;
  style: string[];
  materials: string[];
  finish: string;
  dimensions: {
    raw: string;
  };
  catalog: string;
  page: number;
  keywords: string[];
  
  // The reason why this item was picked (from the AI prompt)
  matchReason?: string;
}

export interface SearchResult {
  items: FurnitureItem[];
  // The summary text explaining the AI's logic
  thinkingProcess: string;
}
