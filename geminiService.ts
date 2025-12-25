// geminiService.ts - Robust JSON Handling
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { SearchResult, Catalog } from "../types";
import { downloadDriveFile, listFolderContents } from "./driveService";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

// SWITCH TO FLASH: It is faster and more reliable for "Live" demos on iPad
const SEARCH_MODEL_NAME = "gemini-1.5-flash-latest"; 

const CACHE_KEY_STORAGE = 'norhaus_cache_token';
const DB_NAME = 'NorhausDB';
const STORE_NAME = 'files';

// --- IN-MEMORY CACHE ---
let CATALOG_MEMORY_BANK: { mimeType: string; data: string }[] = [];

// --- DATABASE HELPERS ---
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
  CATALOG_MEMORY_BANK = []; 

  for (const file of driveFiles) {
    console.log(`Downloading: ${file.name}`);
    const base64Data = await downloadDriveFile(file.id, accessToken);
    
    const fileEntry = {
      id: file.id,
      mimeType: "application/pdf",
      data: base64Data
    };

    CATALOG_MEMORY_BANK.push({ mimeType: fileEntry.mimeType, data: fileEntry.data });
    await saveToDB(fileEntry);

    catalogMetadata.push({
      id: file.id,
      name: file.name,
      driveId: file.id,
      uploadDate: new Date()
    });
  }

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
    try {
      const storedFiles = await loadFromDB();
      if (storedFiles.length > 0) {
        CATALOG_MEMORY_BANK = storedFiles;
      } else {
        return { items: [], thinkingProcess: "Database empty. Please Sync." };
      }
    } catch (e) {
      return { items: [], thinkingProcess: "Database Error." };
    }
  }

  // 2. PREPARE AI REQUEST
  const model = genAI.getGenerativeModel({
    model: SEARCH_MODEL_NAME,
    systemInstruction: `You are the Norhaus Engine.
      1. SEARCH GOAL: Find furniture items matching the user's query in the attached PDFs.
      2. VISUALS: If an image is provided, match its style.
      3. OUTPUT: Return strictly valid JSON.`
  });

  const parts: any[] = [];

  CATALOG_MEMORY_BANK.forEach(file => {
    parts.push({ inlineData: file });
  });

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

    let text = result.response.text();
    
    // --- THE FIX: CLEAN MARKDOWN ---
    // Gemini often wraps JSON in ```json ... ```. We must strip this.
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    const data = JSON.parse(text) as SearchResult;
    return { ...data, isCached: true };

  } catch (e: any) {
    console.error("Norhaus Engine Error:", e);
    // Return the ACTUAL error so we can see it in the UI
    return { items: [], thinkingProcess: `Engine Error: ${e.message}` };
  }
};
