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

// Initialize AI
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default async function handler(req, res) {
  // --- SECURITY CHECKPOINT ---
  // We check the custom header sent from the frontend
  const userCode = req.headers['x-access-code'];
  
  // STRICT MATCH: If the code isn't exactly "Norhaus2026", block the request.
  if (userCode !== 'Norhaus2026') {
    return res.status(401).json({ 
      error: 'Unauthorized', 
      details: 'Invalid Access Code. Please refresh and try again.' 
    });
  }
  // ---------------------------

  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const fullUrl = new URL(req.url, `${protocol}://${req.headers.host}`);
  const q = fullUrl.searchParams.get('q');

  if (!q) return res.status(400).json({ error: 'Search term is required' });

  try {
    const file = storage.bucket('norhaus_catalogues').file('master_index.json');
    const [content] = await file.download();

    // GEMINI 3.0 FLASH PREVIEW
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{
        role: 'user',
        parts: [{
          text: `You are the Norhaus Design Concierge.
                 User Request: "${q}"
                 Catalog Data: ${content.toString()}

                 INSTRUCTIONS:
                 1. Analyze the request against the catalog.
                 2. Select the best items.
                 3. ORDER BY RELEVANCE: The best match must be first.
                 4. Return ONLY a JSON object.

                 JSON Structure:
                 {
                   "thinking": "Your design reasoning...",
                   "items": [
                      {
                        "product_id": "...",
                        "name": "...",
                        "description": "...",
                        "catalog": "filename.pdf",
                        "page": 10,
                        "matchReason": "Briefly explain why this fits..."
                      }
                   ]
                 }`
        }]
      }],
      config: {
        thinkingConfig: { includeThoughts: true }, 
        responseMimeType: "application/json"
      }
    });

    const rawText = response.text;
    const cleanJson = rawText.replace(/```json|```/g, "").trim();
    const data = JSON.parse(cleanJson);

    return res.status(200).json({
      items: data.items || data.results || [],
      thinkingProcess: data.thinking || "Reasoning complete."
    });

  } catch (error) {
    console.error("Search Error:", error);
    return res.status(500).json({ error: 'Search failed', details: error.message });
  }
}
