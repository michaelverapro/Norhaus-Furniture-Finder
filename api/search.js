// api/search.js
import { Storage } from '@google-cloud/storage';
import { GoogleGenAI } from '@google/genai';

const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
const storage = new Storage({ credentials });
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default async function handler(req, res) {
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const fullUrl = new URL(req.url, `${protocol}://${req.headers.host}`);
  const q = fullUrl.searchParams.get('q');

  if (!q) return res.status(400).json({ error: 'Search term is required' });

  try {
    const file = storage.bucket('norhaus_catalogues').file('master_index.json');
    const [content] = await file.download();

    // MIGRATION: Gemini 2.5 Flash (Stable, Free Tier Friendly)
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash', 
      contents: [{
        role: 'user',
        parts: [{
          text: `You are the Norhaus AI Curator. 
                 Identify matches for: "${q}" 
                 Using this catalog: ${content.toString()}
                 
                 INSTRUCTIONS:
                 1. Return the original "catalog" filename and "page" number exactly.
                 2. Provide a "thinking" summary explaining your choice.
                 3. Return ONLY a JSON object.
                 
                 Structure:
                 {
                   "thinking": "I selected these because...",
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
        // REMOVED: thinkingConfig (Gemini 3 only)
        // ADDED: standard JSON enforcement
        responseMimeType: "application/json"
      }
    });

    const rawText = response.text;
    const cleanJson = rawText.replace(/```json|```/g, "").trim();
    const data = JSON.parse(cleanJson);

    return res.status(200).json({
      items: data.items || data.results || [],
      thinkingProcess: data.thinking || "Gemini 2.5 analysis complete."
    });

  } catch (error) {
    console.error("Gemini 2.5 Search Error:", error);
    
    // Graceful error handling for limits
    if (error.message.includes('429')) {
         return res.status(429).json({ 
             error: 'System Busy', 
             details: 'The free AI tier is busy. Please try again in 1 minute.' 
         });
    }

    return res.status(500).json({ error: 'Search failed', details: error.message });
  }
}
