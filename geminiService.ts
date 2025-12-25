// geminiService.ts - Batch Processing (Safe Mode)
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { SearchResult, FurnitureItem, Catalog } from "../types";
import { downloadDriveFile, listFolderContents } from "./driveService";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
const SEARCH_MODEL_NAME = "gemini-1.5-flash-latest"; // Flash is fast enough for loops
const CACHE_KEY_STORAGE = 'norhaus_cache_token';
const DB_NAME = 'NorhausDB';
const STORE_NAME = 'files';

// --- DATABASE LOGIC ---
let CATALOG_MEMORY_BANK: { id: string; name: string; mimeType: string; data: string }[] = [];

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const saveToDB = async (file: any) => {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).put(file);
};

const loadFromDB = async (): Promise<any[]> => {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => resolve([]);
  });
};

// --- SYNC ---
export const syncAndCacheLibrary = async (folderId: string, accessToken: string) => {
  const driveFiles = await listFolderContents(folderId, accessToken);
  if (driveFiles.length === 0) throw new Error("No PDFs found.");

  CATALOG_MEMORY_BANK = [];
  const catalogMetadata: Catalog[] = [];

  for (const file of driveFiles) {
    console.log(`Downloading: ${file.name}`);
    const base64Data = await downloadDriveFile(file.id, accessToken);
    
    const entry = { id: file.id, name: file.name, mimeType: "application/pdf", data: base64Data };
    
    // Save to RAM and DB
    CATALOG_MEMORY_BANK.push(entry);
    await saveToDB(entry);

    catalogMetadata.push({ id: file.id, name: file.name, driveId: file.id, uploadDate: new Date() });
  }

  const cacheName = `persistent-${Date.now()}`;
  localStorage.setItem(CACHE_KEY_STORAGE, JSON.stringify({ name: cacheName, folderId, timestamp: Date.now(), catalogMetadata }));
  return { cacheName, catalogMetadata };
};

// --- BATCH SEARCH ---
export const searchFurniture = async (query: string, imageFile?: File): Promise<SearchResult> => {
  
  // 1. Load Data if RAM is empty
  if (CATALOG_MEMORY_BANK.length === 0) {
    const stored = await loadFromDB();
    if (stored.length > 0) CATALOG_MEMORY_BANK = stored;
    else return { items: [], thinkingProcess: "Library empty. Please Sync." };
  }

  // 2. Prepare the Image (re-used for every request)
  let imagePart: any = null;
  if (imageFile) {
    const reader = new FileReader();
    const base64 = await new Promise<string>(r => {
      reader.onload = () => r((reader.result as string).split(',')[1]);
      reader.readAsDataURL(imageFile);
    });
    imagePart = { inlineData: { data: base64, mimeType: imageFile.type } };
  }

  const allItems: FurnitureItem[] = [];
  let debugLog = "Processing Catalogs:\n";

  // 3. LOOP through catalogs ONE BY ONE
  // We limit to searching the first 5 to prevent long waits/timeouts in this demo
  const activeCatalogs = CATALOG_MEMORY_BANK.slice(0, 5); 

  for (const catalog of activeCatalogs) {
    try {
      debugLog += `Scanning ${catalog.name}...\n`;
      
      const model = genAI.getGenerativeModel({ model: SEARCH_MODEL_NAME });
      const parts = [
        { inlineData: { data: catalog.data, mimeType: "application/pdf" } }, // Only 1 PDF
        { text: `Search this catalog for: "${query}". Return 1-2 best matches as JSON.` }
      ];
      if (imagePart) parts.push(imagePart);

      const result = await model.generateContent({
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: SchemaType.OBJECT,
            properties: {
              items: {
                type: SchemaType.ARRAY,
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    name: { type: SchemaType.STRING },
                    description: { type: SchemaType.STRING },
                    pageNumber: { type: SchemaType.INTEGER },
                    visualSummary: { type: SchemaType.STRING }
                  }
                }
              }
            }
          }
        }
      });

      const text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
      const data = JSON.parse(text);
      
      // Add Catalog Metadata to the items found
      if (data.items && Array.isArray(data.items)) {
        const taggedItems = data.items.map((item: any) => ({
          ...item,
          id: Math.random().toString(36).substr(2, 9),
          catalogName: catalog.name, // Important: Tag the source
          catalogId: catalog.id,
          category: "Furniture",
          priceEstimate: "Contact Dealer"
        }));
        allItems.push(...taggedItems);
      }
    } catch (e) {
      console.error(`Error scanning ${catalog.name}`, e);
      debugLog += `Failed to read ${catalog.name}\n`;
    }
  }

  if (allItems.length === 0) {
    // If we fail, return a fake item so the user SEES the error log
    return { 
      items: [{
        id: "error-log",
        name: "Search Complete - No Matches",
        description: debugLog,
        pageNumber: 0,
        catalogName: "System Log",
        catalogId: "0",
        category: "System",
        visualSummary: "Try a different query or fewer documents."
      }],
      thinkingProcess: debugLog
    };
  }

  return { items: allItems, thinkingProcess: debugLog };
};
