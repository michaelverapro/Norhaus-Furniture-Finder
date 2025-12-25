// geminiService.ts - Status Summary Mode
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

// --- SEARCH WITH CLEAN STATUS REPORT ---
export const searchFurniture = async (query: string, imageFile?: File): Promise<SearchResult> => {
  
  // 1. Restore from DB
  if (CATALOG_MEMORY_BANK.length === 0) {
    try {
      const stored = await loadFromDB();
      if (stored.length > 0) CATALOG_MEMORY_BANK = stored;
      else return { items: [], thinkingProcess: "Library is empty. Please run 'Library Sync'." };
    } catch (e) {
      return { items: [], thinkingProcess: "Database error. Please refresh." };
    }
  }

  // 2. Prepare Image
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
  
  // WE WILL BUILD A CLEAN LIST OF RESULTS HERE
  let statusReport: string[] = []; 

  // 3. THE LOOP
  for (const catalog of CATALOG_MEMORY_BANK) {
    try {
      // SIZE CHECK: 12MB Limit
      const kbSize = Math.round(catalog.data.length / 1024);
      
      if (kbSize > 12000) {
        statusReport.push(`⚠️ ${catalog.name.substring(0, 15)}...: SKIPPED (${Math.round(kbSize/1024)}MB is too large)`);
        continue; 
      }

      const model = genAI.getGenerativeModel({ model: SEARCH_MODEL_NAME });
      
      const parts = [
        { inlineData: { data: catalog.data, mimeType: "application/pdf" } },
        { text: `Search this catalog for: "${query}". Return a JSON object with a property "items" containing the best 1 match. If NO match, return empty array.` }
      ];
      if (imagePart) parts.push(imagePart);

      const result = await model.generateContent({
        contents: [{ role: "user", parts }],
        generationConfig: { responseMimeType: "application/json" }
      });

      const text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
      const data = JSON.parse(text);

      if (data.items && Array.isArray(data.items) && data.items.length > 0) {
        const taggedItems = data.items.map((item: any) => ({
          ...item,
          id: Math.random().toString(36).substr(2, 9),
          catalogName: catalog.name, 
          catalogId: catalog.id,
          category: item.category || "Furniture",
          priceEstimate: "Contact Dealer"
        }));
        allItems.push(...taggedItems);
        statusReport.push(`✅ ${catalog.name.substring(0, 15)}...: MATCH FOUND`);
      } else {
        statusReport.push(`⚪ ${catalog.name.substring(0, 15)}...: No matches`);
      }

    } catch (e: any) {
      console.error(`Error scanning ${catalog.name}:`, e);
      statusReport.push(`❌ ${catalog.name.substring(0, 15)}...: ERROR (${e.message.includes('403') ? 'Permission' : 'API'})`);
    }
  }

  const finalLog = statusReport.join("\n");

  // 4. FALLBACK: IF NO MATCHES, SHOW THE REPORT CARD
  if (allItems.length === 0) {
    return { 
      items: [{
        id: "status-report",
        name: "Search Status Report",
        description: finalLog, // <--- THIS WILL NOW LIST EVERY FILE'S FATE
        pageNumber: 0,
        catalogName: "System",
        catalogId: "0",
        category: "System",
        visualSummary: "See list above for details."
      }],
      thinkingProcess: finalLog 
    };
  }

  return { items: allItems, thinkingProcess: finalLog };
};
