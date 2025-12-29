// app/types.ts
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
  matchReason: string; // Ensure this line exists!
}

export interface SearchResult {
  items: FurnitureItem[];
  thinkingProcess: string;
}
