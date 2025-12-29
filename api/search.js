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

  try {
    const file = storage.bucket('norhaus_catalogues').file('master_index.json');
    const [content] = await file.download();

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{
        role: 'user',
        parts: [{
          text: `You are the Norhaus AI Curator. 
                 Identify matches for: "${q}" 
                 Using this catalog: ${content.toString()}
                 
                 Return ONLY a JSON object with this exact structure:
                 {
                   "thinking": "Your design reasoning here",
                   "items": [ { "product_id": "...", "name": "...", "description": "...", "matchReason": "..." } ]
                 }`
        }]
      }],
      config: {
        thinkingConfig: { includeThoughts: true },
        responseMimeType: "application/json"
      }
    });

    const rawText = response.text;
    // Strip potential markdown wrappers that prevent JSON parsing
    const cleanJson = rawText.replace(/```json|```/g, "").trim();
    const data = JSON.parse(cleanJson);

    // Standardize the response so the frontend always sees "items"
    return res.status(200).json({
      items: data.items || data.results || [], 
      thinkingProcess: data.thinking || "AI Reasoning complete."
    });

  } catch (error) {
    console.error("Gemini 3 Search Error:", error);
    return res.status(500).json({ error: 'Search failed', details: error.message });
  }
}
