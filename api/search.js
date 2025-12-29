// api/search.js
import { Storage } from '@google-cloud/storage';
import { GoogleGenAI } from '@google/genai';

const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
const storage = new Storage({ credentials });

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
        // Correct parameter for Gemini 3 thinking depth
        thinkingConfig: { includeThoughts: true }, 
        responseMimeType: "application/json"
      }
    });

    // FACT: .text is a property, NOT a function. 
    // Accessing it as .text() causes the TypeError.
    const rawText = response.text; 
    
    if (!rawText) {
        throw new Error("No text returned from Gemini 3");
    }

    const cleanJson = rawText.replace(/```json|```/g, "").trim();
    const data = JSON.parse(cleanJson);

    return res.status(200).json({
      items: data.results || [],
      thinkingProcess: data.thinking || "AI Reasoning complete."
    });

  } catch (error) {
    console.error("Gemini 3 Search Error:", error);
    return res.status(500).json({ 
        error: 'Search failed', 
        details: error.message 
    });
  }
}
