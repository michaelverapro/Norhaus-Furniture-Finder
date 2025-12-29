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

    // GEMINI 3 FLASH PREVIEW (Premium Reasoning)
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{
        role: 'user',
        parts: [{
          text: `You are the Norhaus AI Curator.
                 User Request: "${q}"
                 Catalog Data: ${content.toString()}

                 INSTRUCTIONS:
                 1. Use your reasoning capabilities to analyze the style, materials, and fit.
                 2. Select the best items.
                 3. Return ONLY a JSON object with the exact keys below.
                 4. CRITICAL: Preserve the exact "catalog" filename and "page" number.

                 JSON Structure:
                 {
                   "thinking": "Your design logic summary...",
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
        // NATIVE THINKING ENABLED
        // This generates the deep reasoning tokens before the response
        thinkingConfig: { includeThoughts: true }, 
        responseMimeType: "application/json"
      }
    });

    // Access the text property (Unified SDK syntax)
    const rawText = response.text;
    
    if (!rawText) throw new Error("Empty response from Gemini 3");
    
    const cleanJson = rawText.replace(/```json|```/g, "").trim();
    const data = JSON.parse(cleanJson);

    return res.status(200).json({
      items: data.items || data.results || [],
      thinkingProcess: data.thinking || "Gemini 3 reasoning complete."
    });

  } catch (error) {
    console.error("Gemini 3 Search Error:", error);
    return res.status(500).json({ 
      error: 'Search failed', 
      details: error.message 
    });
  }
}
