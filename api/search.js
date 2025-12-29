// api/search.js
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
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const fullUrl = new URL(req.url, `${protocol}://${req.headers.host}`);
  const q = fullUrl.searchParams.get('q');

  if (!q) return res.status(400).json({ error: 'Search term is required' });

  try {
    const file = storage.bucket('norhaus_catalogues').file('master_index.json');
    const [content] = await file.download();

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
                        "matchReason": "Briefly explain why this fits the user's specific request (e.g. 'Matches the velvet requirement and moody aesthetic')."
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
