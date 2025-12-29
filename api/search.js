// api/search.js
import { Storage } from '@google-cloud/storage';
import { GoogleGenAI } from '@google/genai';

// 1. Initialize GCS
let storage;
try {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  storage = new Storage({ credentials });
} catch (e) {
  storage = new Storage(); 
}

// 2. Initialize the Verified Unified SDK
// Fact: The client is instantiated using the GoogleGenAI class
const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY 
});

export default async function handler(req, res) {
  // Fact: WHATWG URL API prevents the 'url.parse' security warning
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const fullUrl = new URL(req.url, `${protocol}://${req.headers.host}`);
  const q = fullUrl.searchParams.get('q');

  if (!q) return res.status(400).json({ error: 'Search term is required' });

  try {
    const file = storage.bucket('norhaus_catalogues').file('master_index.json');
    const [content] = await file.download();

    // 3. Execution using Gemini 3 Flash Preview
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{
        role: 'user',
        parts: [{
          text: `You are the Norhaus AI Curator. 
                 Identify matches for: "${q}" 
                 Using this catalog: ${content.toString()}
                 Return ONLY JSON: { "thinking": "...", "results": [...] }`
        }]
      }],
      config: {
        // Fact: This enables the internal reasoning chain for Gemini 3
        thinking: { include: true },
        responseMimeType: "application/json"
      }
    });

    // Fact: response.text() is the standard helper in the new SDK
    const text = response.text().replace(/```json|```/g, "").trim();
    const data = JSON.parse(text);

    return res.status(200).json({
      items: data.results || [],
      thinkingProcess: data.thinking || "AI Reasoning complete."
    });

  } catch (error) {
    console.error("Gemini 3 Search Error:", error);
    return res.status(500).json({ error: 'Search failed', details: error.message });
  }
}
