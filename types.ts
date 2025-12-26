export interface Catalog {
  id: string;
  name: string;
  file?: File;
  driveId?: string;
  uploadDate: Date;
}

export interface FurnitureItem {
  name: string;
  description: string;
  catalogName: string;
  pageNumber?: string | number; 
  dimensions?: string; 
  
  // --- NEW FIELD ---
  // This holds the AI's specific explanation of the match
  matchReason?: string; 

  // Optional legacy fields
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
