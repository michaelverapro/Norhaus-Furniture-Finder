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
  
  // AI CURATION FIELDS
  matchReason?: string; // Gemini 3's justification for this specific item
  
  // OPTIONAL: RELATIVE RELEVANCE
  // Gemini 3 can now "score" its confidence for each match
  relevanceScore?: number; 
}

export interface SearchResult {
  items: FurnitureItem[];
  
  // GEMINI 3 REASONING FIELDS
  thinkingProcess: string;  // The summarized logic shown to the user
  thoughtSignature?: string; // The raw ID of the AI's internal reasoning chain
  
  // PERFORMANCE METADATA
  executionTimeMs?: number;
}
