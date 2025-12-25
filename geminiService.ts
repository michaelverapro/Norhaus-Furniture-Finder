// geminiService.ts - With IndexedDB Persistence
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { SearchResult, Catalog } from "../types";
import { downloadDriveFile, listFolderContents } from "./driveService";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
const SEARCH_MODEL_NAME = "gemini-1.5-pro-latest"; 
const CACHE_KEY_STORAGE = 'norhaus_cache_token';
const DB_NAME = 'NorhausDB';
const STORE_NAME = 'files';

// --- IN-MEMORY CACHE (Fast Access) ---
let CATALOG_MEMORY_BANK: { mimeType: string; data: string }[] = [];

// --- DATABASE HELPERS (IndexedDB) ---
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

const saveToDB = async (file: { id: string; mimeType: string; data: string }) => {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(file);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

const loadFromDB = async (): Promise<{ mimeType: string; data: string }[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => {
      // Map back to just the data format the AI needs
      const files = request.result.map((f: any) => ({
        mimeType: f.mimeType,
        data: f.data
      }));
      resolve(files);
    };
    request.onerror = () => reject(request.error);
  });
};

// --- MAIN FUNCTIONS ---

export const syncAndCacheLibrary = async (
  folderId: string, 
  accessToken: string
): Promise<{ cacheName: string; catalogMetadata: Catalog[] }> => {
  console.log("Norhaus: Starting Automated Sync...");

  const driveFiles = await listFolderContents(folderId, accessToken);
  if (driveFiles.length === 0) throw new Error("No PDFs found in Drive.");

  const catalogMetadata: Catalog[] = [];
  CATALOG_MEMORY_BANK = []; // Clear RAM

  // Clear DB (Optional: simpler to just overwrite/add for now)
  // For a cleaner sync, you might want to clearObjectStore here, but let's append.

  for (const file of driveFiles) {
    console.log(`Downloading: ${file.name}`);
    const base64Data = await downloadDriveFile(file.id, accessToken);
    
    const fileEntry = {
      id: file.id,
      mimeType: "application/pdf",
      data: base64Data
    };

    // 1. Save to RAM
    CATALOG_MEMORY_BANK.push({ mimeType: fileEntry.mimeType, data: fileEntry.data });
    
    // 2. Save to Database (Persistent)
    await saveToDB(fileEntry);

    // 3. Save Metadata
    catalogMetadata.push({
      id: file.id,
      name: file.name,
      driveId: file.id,
      uploadDate: new Date()
    });
  }

  // Save the "Index" to LocalStorage
  const simulatedCacheName = `persistent-bank-${Date.now()}`;
  localStorage.setItem(CACHE_KEY_STORAGE, JSON.stringify({
    name: simulatedCacheName,
    folderId,
    timestamp: Date.now(),
    catalogMetadata
  }));

  return { cacheName: simulatedCacheName, catalogMetadata };
};

export const searchFurniture = async (
  query: string,
  imageFile?: File
): Promise<SearchResult> => {
  
  // 1. CHECK MEMORY BANK
  if (CATALOG_MEMORY_BANK.length === 0) {
    console.log("RAM empty. Checking Database...");
    try {
      const storedFiles = await loadFromDB();
      if (storedFiles.length > 0) {
        console.log(`Restored ${storedFiles.length} catalogs from Database.`);
        CATALOG_MEMORY_BANK = storedFiles;
      } else {
        return { items: [], thinkingProcess: "Local database is empty. Please Sync Library." };
      }
    } catch (e) {
      console.error("DB Load Error:", e);
      return { items: [], thinkingProcess: "Database error. Please refresh or re-sync." };
    }
  }

  // 2. PREPARE AI REQUEST
  const model = genAI.getGenerativeModel({
    model: SEARCH_MODEL_NAME,
    systemInstruction: `You are the Norhaus Engine.
      1. SEARCH GOAL: Find luxury furniture matching the user's query in the attached PDFs.
      2. VISUALS: If an image is provided, match its style/shape primarily.
      3. OUTPUT: Return strictly valid JSON.`
  });

  const parts: any[] = [];

  // Inject Catalogs
  CATALOG_MEMORY_BANK.forEach(file => {
    parts.push({ inlineData: file });
  });

  // Inject User Image
  if (imageFile) {
    const reader = new FileReader();
    const base64Image = await new Promise<string>((resolve) => {
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.readAsDataURL(imageFile);
    });
    parts.push({
      inlineData: {
        data: base64Image,
        mimeType: imageFile.type
      }
    });
  }

  parts.push({ text: `Find 4-6 items matching: "${query}". Return JSON.` });

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature: 0.3,
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            thinkingProcess: { type: SchemaType.STRING },
            items: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  id: { type: SchemaType.STRING },
                  name: { type: SchemaType.STRING },
                  description: { type: SchemaType.STRING },
                  pageNumber: { type: SchemaType.INTEGER },
                  catalogName: { type: SchemaType.STRING },
                  category: { type: SchemaType.STRING },
                  visualSummary: { type: SchemaType.STRING }
                },
                required: ["name", "description", "visualSummary"]
              }
            }
          }
        }
      }
    });

    const text = result.response.text();
    const data = JSON.parse(text) as SearchResult;
    return { ...data, isCached: true };

  } catch (e) {
    console.error("Norhaus Engine Error:", e);
    return { items: [], thinkingProcess: "Error generating response." };
  }
};
