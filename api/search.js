// api/search.js
import { Storage } from '@google-cloud/storage';
import { GoogleGenAI } from '@google/genai';

const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
const storage = new Storage({ credentials });

// Unified SDK initialization
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
                 
                 Return ONLY a JSON object with this exact structure:
                 {
                   "thinking": "Your design reasoning here",
                   "items": [ { "product_id": "...", "name": "...", "description": "...", "matchReason": "..." } ]
                 }`
        }]
      }],
      config: {
        // Fact: includeThoughts: true makes the reasoning summary accessible
        thinkingConfig: { includeThoughts: true },
        responseMimeType: "application/json"
      }
    });

    // CRITICAL FACT: .text is a property in the new SDK, NOT a function
    const rawText = response.text; 
    
    // Safety: Strip markdown wrappers before parsing
    const cleanJson = rawText.replace(/```json|```/g, "").trim();
    const data = JSON.parse(cleanJson);

    // Standardize key names for the frontend
    return res.status(200).json({
      items: data.items || data.results || [],
      thinkingProcess: data.thinking || "AI Reasoning complete."
    });

  } catch (error) {
    console.error("Gemini 3 Search Error:", error);
    return res.status(500).json({ error: 'Search failed', details: error.message });
  }
}
