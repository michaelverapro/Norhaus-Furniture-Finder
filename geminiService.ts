// geminiService.ts - Final "All-At-Once" Version
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { SearchResult, FurnitureItem, Catalog } from "../types";
import { downloadDriveFile, listFolderContents } from "./driveService";

// Initialize the API
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

// ✅ CORRECT MODEL NAME (Stable)
const SEARCH_MODEL_NAME = "gemini-1.5-flash"; 

const CACHE_KEY_STORAGE = 'norhaus_cache_token';
const DB_NAME = 'NorhausDB';
const STORE_NAME = 'files';

// --- DATABASE LOGIC (IndexedDB) ---
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

// --- SYNC FUNCTION ---
export const syncAndCacheLibrary = async (folderId: string, accessToken: string) => {
  console.log("Norhaus: Starting Automated Sync...");
  
  const driveFiles = await listFolderContents(folderId, accessToken);
  if (driveFiles.length === 0) throw new Error("No PDFs found in the specified Drive folder.");

  CATALOG_MEMORY_BANK = [];
  const catalogMetadata: Catalog[] = [];

  for (const file of driveFiles) {
    console.log(`Downloading: ${file.name}`);
    const base64Data = await downloadDriveFile(file.id, accessToken);
    
    // Create Entry
    const entry = { 
      id: file.id, 
      name: file.name, 
      mimeType: "application/pdf", 
      data: base64Data 
    };
    
    // Save to Memory (RAM) and Database (Disk)
    CATALOG_MEMORY_BANK.push(entry);
    await saveToDB(entry);

    catalogMetadata.push({ 
      id: file.id, 
      name: file.name, 
      driveId: file.id, 
      uploadDate: new Date() 
    });
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

// --- SEARCH FUNCTION (ALL AT ONCE) ---
export const searchFurniture = async (query: string, imageFile?: File): Promise<SearchResult> => {
  
  // 1. Restore from Database if RAM is empty
  if (CATALOG_MEMORY_BANK.length === 0) {
    try {
      const stored = await loadFromDB();
      if (stored.length > 0) {
        CATALOG_MEMORY_BANK = stored;
      } else {
        return { items: [], thinkingProcess: "Library is empty. Please run 'Library Sync'." };
      }
    } catch (e) {
      return { items: [], thinkingProcess: "Database error. Please refresh and Sync." };
    }
  }

  // 2. Prepare the Massive Payload
  // We will construct one single message containing ALL catalogs + the user query.
  const parts: any[] = [];
  
  // A. Inject ALL Catalogs
  CATALOG_MEMORY_BANK.forEach(file => {
    parts.push({ 
      inlineData: { 
        data: file.data, 
        mimeType: "application/pdf" 
      } 
    });
  });

  // B. Inject User Image (if any)
  if (imageFile) {
    const reader = new FileReader();
    const base64 = await new Promise<string>(r => {
      reader.onload = () => r((reader.result as string).split(',')[1]);
      reader.readAsDataURL(imageFile);
    });
    parts.push({ 
      inlineData: { 
        data: base64, 
        mimeType: imageFile.type 
      } 
    });
  }

  // C. Inject The Prompt
  parts.push({ text: `You are the Norhaus Engine. Analyze ALL the provided PDF catalogs above. 
  Find 4-6 furniture items that best match this user query: "${query}". 
  
  CRITICAL INSTRUCTIONS:
  1. Return ONLY valid JSON.
  2. For every item, identify exactly which Catalog Name it came from.
  3. Extract the Page Number if visible.
  
  Output JSON Schema:
  {
    "items": [
      {
        "name": "Product Name",
        "description": "Visual description...",
        "catalogName": "Exact Filename of the source PDF",
        "pageNumber": 12,
        "category": "Seating/Tables/etc",
        "visualSummary": "Why this matches the query..."
      }
    ]
  }` });

  try {
    const model = genAI.getGenerativeModel({ model: SEARCH_MODEL_NAME });

    const result = await model.generateContent({
      contents: [{ role: "user", parts }],
      generationConfig: {
        responseMimeType: "application/json",
        // We let the model decide the schema structure naturally to avoid rigid constraints on "All at once" reasoning
      }
    });

    // 3. Process Response
    const text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    const data = JSON.parse(text);

    let allItems: FurnitureItem[] = [];

    if (data.items && Array.isArray(data.items)) {
      allItems = data.items.map((item: any) => ({
        ...item,
        id: Math.random().toString(36).substr(2, 9),
        // If the model didn't return a catalog name, we mark it as "Unknown" 
        // (This is the risk of "All at once", but Gemini 1.5 is usually good at this)
        catalogName: item.catalogName || "Detected in Library",
        catalogId: "000", 
        priceEstimate: "Contact Dealer"
      }));
    }

    return { items: allItems, thinkingProcess: `Successfully scanned ${CATALOG_MEMORY_BANK.length} catalogs simultaneously.` };

  } catch (e: any) {
    console.error("Norhaus Engine Error:", e);
    
    // Safety Fallback Message
    if (e.message && e.message.includes("400")) {
      return { items: [], thinkingProcess: "Error: The combined library size is too large for a single search. Please try removing a few large catalogs from the Drive folder." };
    }
    
    return { items: [], thinkingProcess: `Engine Error: ${e.message}` };
  }
};

    }
  }

  return { items: allItems, thinkingProcess: log };
};
