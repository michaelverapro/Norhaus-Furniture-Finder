import { Storage } from '@google-cloud/storage';
import { GoogleGenAI } from '@google/genai';

let storage;
try {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  storage = new Storage({ credentials });
} catch (e) {
  storage = new Storage();
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default async function handler(req, res) {
  // 1. Security Check
  const userCode = req.headers['x-access-code'];
  if (userCode !== 'Norhaus2026') {
    return res.status(401).json({ 
      error: 'Unauthorized', 
      details: 'Invalid Access Code.' 
    });
  }

  // 2. Parse Body
  const { q, image } = req.body || {};

  if (!q && !image) {
    return res.status(400).json({ error: 'Search term or image is required' });
  }

  try {
    const file = storage.bucket('norhaus_catalogues').file('master_index.json');
    const [content] = await file.download();

    // 3. Construct the Multimodal Request
    const promptParts = [
      {
        text: `You are the Norhaus Design Concierge.
               User Request: "${q || "Find items matching this image."}"
               Catalog Data: ${content.toString()}

               INSTRUCTIONS:
               1. If an IMAGE is provided, analyze its style, material, shape, and "vibe". 
                  Find items in the catalog that visually resemble the uploaded image.
               2. If only TEXT is provided, search based on the text description.
               3. SEARCH GOAL: Find 50 relevant items.
               4. ORDER BY RELEVANCE: Visual matches should be top priority.
               5. Return ONLY a JSON object.

               JSON Structure:
               {
                 "thinking": "I analyzed the image and see a [describe image]...",
                 "items": [
                    {
                      "product_id": "...",
                      "name": "...",
                      "description": "...",
                      "catalog": "filename.pdf",
                      "page": 10,
                      "matchReason": "Visual Match: Similar curved arms and velvet texture..."
                    }
                 ]
               }`
      }
    ];

    // If image exists, add it to the payload
    if (image) {
      const base64Data = image.split(',')[1];
      const mimeType = image.split(';')[0].split(':')[1];

      promptParts.push({
        inlineData: {
          mimeType: mimeType,
          data: base64Data
        }
      });
    }

    // 4. Call Gemini 3.0
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{
        role: 'user',
        parts: promptParts
      }],
      config: {
        thinkingConfig: { includeThoughts: true }, 
        responseMimeType: "application/json"
      }
    });

    const rawText = response.text;

    // --- CRITICAL FIX: CLEAN THE JSON ---
    // Finds the first '{' and the last '}' to ignore any extra text the AI adds
    const startIndex = rawText.indexOf('{');
    const endIndex = rawText.lastIndexOf('}') + 1;
    
    if (startIndex === -1 || endIndex === -1) {
        throw new Error("No JSON found in response");
    }

    const cleanJson = rawText.substring(startIndex, endIndex);
    // ------------------------------------

    const data = JSON.parse(cleanJson);

    return res.status(200).json({
      items: data.items || data.results || [],
      thinkingProcess: data.thinking || "Visual analysis complete."
    });

  } catch (error) {
    console.error("Search Error:", error);
    return res.status(500).json({ error: 'Search failed', details: error.message });
  }
}
