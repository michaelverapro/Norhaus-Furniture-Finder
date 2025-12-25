
export interface Catalog {
  id: string;
  name: string;
  file?: File;
  driveId?: string;
  uploadDate: Date;
}

export interface FurnitureItem {
  id: string;
  name: string;
  description: string;
  pageNumber: number;
  catalogId: string;
  catalogName: string;
  category: string;
  color: string;
  priceEstimate?: string;
  visualSummary: string;
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
