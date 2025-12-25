// geminiService.ts - Final Robust Looping Version
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { SearchResult, FurnitureItem, Catalog } from "../types";
import { downloadDriveFile, listFolderContents } from "./driveService";

// Initialize the API
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

// ✅ CORRECT MODEL NAME
const SEARCH_MODEL_NAME = "gemini-1.5-flash"; 

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
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
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
  console.log("Norhaus: Starting Automated Sync...");
  
  const driveFiles = await listFolderContents(folderId, accessToken);
  if (driveFiles.length === 0) throw new Error("No PDFs found in the specified Drive folder.");

  CATALOG_MEMORY_BANK = [];
  const catalogMetadata: Catalog[] = [];

  for (const file of driveFiles) {
    console.log(`Downloading: ${file.name}`);
    const base64Data = await downloadDriveFile(file.id, accessToken);
    
    const entry = { id: file.id, name: file.name, mimeType: "application/pdf", data: base64Data };
    
    CATALOG_MEMORY_BANK.push(entry);
    await saveToDB(entry);

    catalogMetadata.push({ id: file.id, name: file.name, driveId: file.id, uploadDate: new Date() });
  }

  const cacheName = `persistent-${Date.now()}`;
  localStorage.setItem(CACHE_KEY_STORAGE, JSON.stringify({ 
    name: cacheName, 
    folderId, 
    timestamp: Date.now(), 
    catalogMetadata 
  }));

  return { cacheName, catalogMetadata };
};

// --- SEARCH (LOOP STRATEGY) ---
export const searchFurniture = async (query: string, imageFile?: File): Promise<SearchResult> => {
  
  // 1. Restore from DB if needed
  if (CATALOG_MEMORY_BANK.length === 0) {
    try {
      const stored = await loadFromDB();
      if (stored.length > 0) CATALOG_MEMORY_BANK = stored;
      else return { items: [], thinkingProcess: "Library is empty. Please run 'Library Sync'." };
    } catch (e) {
      return { items: [], thinkingProcess: "Database error. Please refresh." };
    }
  }

  // 2. Prepare Image (Sent with every request if present)
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
  let log = `Searched ${CATALOG_MEMORY_BANK.length} catalogs.\n`;

  // 3. THE LOOP (Crucial for handling 20MB+ data)
  for (const catalog of CATALOG_MEMORY_BANK) {
    try {
      const model = genAI.getGenerativeModel({ model: SEARCH_MODEL_NAME });
      
      const parts = [
        { inlineData: { data: catalog.data, mimeType: "application/pdf" } },
        { text: `Search this catalog for: "${query}". Return a JSON object with a property "items" containing the best 1-2 matches. If no close matches, return empty items.` }
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
                    visualSummary: { type: SchemaType.STRING },
                    category: { type: SchemaType.STRING },
                    priceEstimate: { type: SchemaType.STRING }
                  },
                  required: ["name", "description", "visualSummary"]
                }
              }
            }
          }
        }
      });

      // CLEANUP: Strip Markdown formatting
      const text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
      const data = JSON.parse(text);

      if (data.items && Array.isArray(data.items) && data.items.length > 0) {
        const taggedItems = data.items.map((item: any) => ({
          ...item,
          id: Math.random().toString(36).substr(2, 9),
          catalogName: catalog.name, // Tag the source!
          catalogId: catalog.id,
          category: item.category || "Furniture",
          priceEstimate: "Contact Dealer"
        }));
        allItems.push(...taggedItems);
      }

    } catch (e: any) {
      console.error(`Error scanning ${catalog.name}:`, e);
      // If one PDF fails (e.g. too big), we just log it and move to the next one
      log += `Skipped ${catalog.name} (Error: ${e.message})\n`;
    }
  }

  return { items: allItems, thinkingProcess: log };
};
