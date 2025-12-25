
import { GoogleGenAI, Type } from "@google/genai";
import { SearchResult, Catalog } from "../types";
import { downloadDriveFile, listFolderContents } from "./driveService";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const CACHE_KEY_STORAGE = 'norhaus_cache_token';
// Upgrading to Pro for superior reasoning over complex document caches
const SEARCH_MODEL_NAME = "gemini-3-pro-preview";
const SYNC_MODEL_NAME = "gemini-3-flash-preview";

/**
 * Manages the automated sync and context caching logic.
 */
export const syncAndCacheLibrary = async (
  folderId: string, 
  accessToken: string
): Promise<{ cacheName: string; catalogMetadata: Catalog[] }> => {
  console.log("Norhaus: Starting Automated Sync from Drive...");

  const driveFiles = await listFolderContents(folderId, accessToken);
  if (driveFiles.length === 0) throw new Error("No PDFs found in the specified Drive folder.");

  const contents: any[] = [];
  const catalogMetadata: Catalog[] = [];

  for (const file of driveFiles) {
    console.log(`Processing: ${file.name}`);
    const base64Data = await downloadDriveFile(file.id, accessToken);
    
    // Injecting clear semantic boundaries for the model
    contents.push({ text: `[METADATA_START: CATALOG_NAME="${file.name}" ID="${file.id}"]` });
    contents.push({
      inlineData: {
        data: base64Data,
        mimeType: "application/pdf"
      }
    });
    contents.push({ text: `[METADATA_END: CATALOG_NAME="${file.name}"]` });

    catalogMetadata.push({
      id: file.id,
      name: file.name,
      driveId: file.id,
      uploadDate: new Date()
    });
  }

  const cacheResponse = await (ai as any).caches.create({
    model: SEARCH_MODEL_NAME, // Cache for the Pro model
    displayName: `Norhaus_Inventory_${folderId}`,
    contents: [{ parts: contents }],
    ttlSeconds: 604800, 
    config: {
      systemInstruction: "You are the Norhaus Intelligence Engine. You have been provided with a library of luxury furniture catalogs. Your task is to maintain an absolute mapping between products, their visual traits, and the specific PDF page/catalog they originate from."
    }
  });

  localStorage.setItem(CACHE_KEY_STORAGE, JSON.stringify({
    name: cacheResponse.name,
    folderId,
    timestamp: Date.now(),
    catalogMetadata
  }));

  return { cacheName: cacheResponse.name, catalogMetadata };
};

export const searchFurniture = async (
  query: string,
  imageFile?: File
): Promise<SearchResult> => {
  const cachedDataStr = localStorage.getItem(CACHE_KEY_STORAGE);
  if (!cachedDataStr) throw new Error("No active cache found. Please sync your library first.");
  
  const { name: cacheName } = JSON.parse(cachedDataStr);
  const parts: any[] = [];

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

  parts.push({ text: `ACTIVATE DISCOVERY ENGINE: "${query || "Perform visual similarity analysis."}"` });

  const response = await ai.models.generateContent({
    model: SEARCH_MODEL_NAME,
    cachedContent: cacheName,
    contents: [{ parts }],
    config: {
      systemInstruction: `You are the Norhaus Deep Discovery Engine. 
      1. ANALYZE visual context markers [METADATA_START] and [METADATA_END] to accurately identify the source catalog.
      2. SCAN the PDF pages for printed page numbers to verify the 'pageNumber' property. Do not rely solely on sequence index.
      3. VISUAL MATCHING: If a reference image is provided, prioritize matching textures, silhouette, and material over text descriptions.
      4. DISAMBIGUATION: If multiple items appear on a page, identify the one that best fits the query.
      5. PRECISION: Ensure the catalogName exactly matches the name provided in the metadata markers.`,
      temperature: 0.2, // Low temperature for high precision/consistency
      responseMimeType: "application/json",
      thinkingConfig: { thinkingBudget: 4000 }, // Increased budget for complex visual reasoning
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          thinkingProcess: { 
            type: Type.STRING,
            description: "Step-by-step reasoning used to identify these items, including how the catalog and page number were verified."
          },
          items: {
            type: Type.ARRAY,
            description: "A collection of furniture items that match the user's intent.",
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING, description: "A unique identifier for the item." },
                name: { type: Type.STRING, description: "The commercial name of the product as seen in the catalog." },
                description: { type: Type.STRING, description: "A summary of the item's features and appeal." },
                pageNumber: { type: Type.INTEGER, description: "The actual page number displayed on the catalog page." },
                catalogId: { type: Type.STRING, description: "The ID from the [METADATA_START] marker." },
                catalogName: { type: Type.STRING, description: "The exact name from the [METADATA_START] marker." },
                category: { type: Type.STRING, description: "Product category (e.g., Seating, Tables)." },
                color: { type: Type.STRING, description: "Primary color or finish name." },
                priceEstimate: { type: Type.STRING, description: "Price if listed, or 'Contact for Pricing'." },
                visualSummary: { type: Type.STRING, description: "Detailed explanation of why this item matches the visual or text query." }
              },
              required: ["id", "name", "description", "pageNumber", "catalogId", "catalogName", "category", "color", "visualSummary"]
            }
          }
        },
        required: ["items", "thinkingProcess"]
      }
    }
  });

  try {
    const data = JSON.parse(response.text || "{}") as SearchResult;
    return { ...data, isCached: true };
  } catch (e) {
    console.error("Norhaus Engine Error:", e);
    return { items: [] };
  }
};
