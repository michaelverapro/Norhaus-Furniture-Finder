export interface Catalog {
  id: string;
  name: string;
  file?: File;
  driveId?: string;
  uploadDate: Date;
}

export interface FurnitureItem {
  // Core fields used by App.tsx
  name: string;
  description: string;
  catalogName: string;
  
  // Updated to allow string (AI often returns "5" as text) or number
  pageNumber?: string | number; 
  
  // --- NEW FIELD (Fixes your error) ---
  dimensions?: string; 

  // Optional fields from your legacy code (kept to prevent other errors)
  id?: string;
  catalogId?: string;
  category?: string;
  color?: string;
  priceEstimate?: string;
  visualSummary?: string;
}

export interface SearchResult {
  items: FurnitureItem[];
  thinkingProcess?: string;
  isCached?: boolean;
}

export interface SyncStatus {
  state: 'idle' | 'syncing' | 'ready' | 'error';
  lastSync?: Date;
  cacheName?: string;
  error?: string;
}

export enum SearchMode {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE'
}
