// api/search.js
import { Storage } from '@google-cloud/storage';
import { GoogleGenAI } from '@google/genai';

// Initialize GCS
let storage;
try {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  storage = new Storage({ credentials });
} catch (e) {
  storage = new Storage();
}

// Initialize the Unified SDK
const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY 
});

export default async function handler(req, res) {
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const fullUrl = new URL(req.url, `${protocol}://${req.headers.host}`);
  const q = fullUrl.searchParams.get('q');

  if (!q) return res.status(400).json({ error: 'Search term is required' });

  try {
    const file = storage.bucket('norhaus_catalogues').file('master_index.json');
    const [content] = await file.download();

    // SWITCH TO GEMINI 2.5 FLASH (Stable & Free Tier Friendly)
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{
        role: 'user',
        parts: [{
          text: `You are the Norhaus AI Curator.
                 User Request: "${q}"
                 Catalog Data: ${content.toString()}

                 INSTRUCTIONS:
                 1. Analyze the request against the catalog.
                 2. Write a short "thinking" summary explaining your design choices.
                 3. Select the best matching items.
                 4. Return ONLY a JSON object with the exact keys below.

                 JSON Structure:
                 {
                   "thinking": "I selected these items because...",
                   "items": [
                      {
                        "product_id": "...",
                        "name": "...",
                        "description": "...",
                        "catalog": "filename.pdf",
                        "page": 10,
                        "matchReason": "..."
                      }
                   ]
                 }`
        }]
      }],
      config: {
        // Enforces strict JSON output (prevents parsing errors)
        responseMimeType: "application/json"
      }
    });

    // Parse the response
    const rawText = response.text;
    if (!rawText) throw new Error("Empty response from AI");
    
    const cleanJson = rawText.replace(/```json|```/g, "").trim();
    const data = JSON.parse(cleanJson);

    return res.status(200).json({
      items: data.items || data.results || [],
      thinkingProcess: data.thinking || "Gemini 2.5 analysis complete."
    });

  } catch (error) {
    console.error("Gemini 2.5 Search Error:", error);

    // Friendly 429 Handling
    if (error.message.includes('429')) {
      return res.status(429).json({
        error: 'System Busy',
        details: 'The free AI tier is currently busy. Please try again in 30 seconds.'
      });
    }

    return res.status(500).json({ 
      error: 'Search failed', 
      details: error.message 
    });
  }
}
