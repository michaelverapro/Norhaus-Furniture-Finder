// geminiService.ts - DIAGNOSTICS MODE
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { SearchResult, FurnitureItem, Catalog } from "../types";
import { downloadDriveFile, listFolderContents } from "./driveService";

// 1. CHECK API KEY
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
if (!apiKey) console.error("CRITICAL: API Key is missing!");

const genAI = new GoogleGenerativeAI(apiKey || "MISSING_KEY");
const SEARCH_MODEL_NAME = "gemini-1.5-flash-latest"; 
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
    
    // SAFETY CHECK: Ensure file is not empty
    if (!base64Data || base64Data.length < 100) {
      console.warn(`File ${file.name} seems empty or corrupt.`);
    }

    const entry = { id: file.id, name: file.name, mimeType: "application/pdf", data: base64Data };
    
    CATALOG_MEMORY_BANK.push(entry);
    await saveToDB(entry);

    catalogMetadata.push({ id: file.id, name: file.name, driveId: file.id, uploadDate: new Date() });
  }

  const cacheName = `persistent-${Date.now()}`;
  localStorage.setItem(CACHE_KEY_STORAGE, JSON.stringify({ name: cacheName, folderId, timestamp: Date.now(), catalogMetadata }));
  return { cacheName, catalogMetadata };
};

// --- DIAGNOSTIC SEARCH ---
export const searchFurniture = async (query: string, imageFile?: File): Promise<SearchResult> => {
  
  // STEP 1: LOAD
  if (CATALOG_MEMORY_BANK.length === 0) {
    const stored = await loadFromDB();
    if (stored.length > 0) CATALOG_MEMORY_BANK = stored;
    else return { items: [], thinkingProcess: "DIAGNOSTIC: Memory Empty. Please Sync." };
  }

  // STEP 2: VERIFY DATA INTEGRITY
  const activeCatalogs = CATALOG_MEMORY_BANK.slice(0, 3); // Test first 3 only
  let diagnosticsLog = `API Key Status: ${apiKey ? "Present" : "MISSING"}\n`;
  diagnosticsLog += `Catalogs Loaded: ${CATALOG_MEMORY_BANK.length}\n`;

  const allItems: FurnitureItem[] = [];

  for (const catalog of activeCatalogs) {
    try {
      const kbSize = Math.round(catalog.data.length / 1024);
      diagnosticsLog += `\nScanning: ${catalog.name} (${kbSize} KB)... `;

      if (kbSize < 5) {
        diagnosticsLog += " [FAILED: FILE TOO SMALL - LIKELY CORRUPT DOWNLOAD]";
        continue;
      }

      const model = genAI.getGenerativeModel({ model: SEARCH_MODEL_NAME });
      const result = await model.generateContent({
        contents: [{ 
          role: "user", 
          parts: [
            { inlineData: { data: catalog.data, mimeType: "application/pdf" } },
            { text: `Return a JSON object with a single property "items" containing 1 furniture item that matches "${query}".` }
          ] 
        }],
        generationConfig: { responseMimeType: "application/json" }
      });

      const text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
      const data = JSON.parse(text);
      
      diagnosticsLog += " [SUCCESS]";
      
      if (data.items && Array.isArray(data.items)) {
        allItems.push(...data.items.map((item: any) => ({
          ...item,
          id: Math.random().toString(36).substr(2, 9),
          catalogName: catalog.name,
          catalogId: catalog.id,
          category: "Furniture",
          visualSummary: `Matched in ${catalog.name}`
        })));
      }
    } catch (e: any) {
      console.error(e);
      // CAPTURE THE EXACT API ERROR
      diagnosticsLog += ` [API ERROR: ${e.message}]`;
    }
  }

  // FORCE RETURN THE LOG SO WE CAN SEE IT
  if (allItems.length === 0) {
    
    alert(diagnosticsLog); // <--- PASTE THIS EXACT LINE HERE!
    
    return { 
      items: [{
        id: "diag-log",
        name: "DIAGNOSTIC REPORT",
        description: diagnosticsLog, // READ THIS TEXT ON SCREEN
        pageNumber: 0,
        catalogName: "System",
        catalogId: "0",
        category: "Debug",
        visualSummary: "Check the description for the exact error."
      }],
      thinkingProcess: diagnosticsLog
    };
  }

  return { items: allItems, thinkingProcess: diagnosticsLog };
};
