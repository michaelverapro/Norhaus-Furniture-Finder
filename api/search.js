// api/search.js
import { Storage } from '@google-cloud/storage';
import { createClient } from '@google/genai';

const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
const storage = new Storage({ credentials });

// Initialize the verified Unified SDK Client
const client = createClient({ 
  apiKey: process.env.GEMINI_API_KEY 
});

export default async function handler(req, res) {
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const fullUrl = new URL(req.url, `${protocol}://${req.headers.host}`);
  const q = fullUrl.searchParams.get('q');

  try {
    const file = storage.bucket('norhaus_catalogues').file('master_index.json');
    const [content] = await file.download();

    // Fact: Gemini 3 models on the Unified SDK use this exact request structure
    const response = await client.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{
        role: 'user',
        parts: [{
          text: `You are the Norhaus AI Curator. 
                 User Request: "${q}"
                 Catalog: ${content.toString()}
                 
                 Provide your response in JSON format with a "thinking" string and a "results" array.`
        }]
      }],
      config: {
        thinking: { include: true }, // Enables the Gemini 3 thinking process
        responseMimeType: "application/json"
      }
    });

    // Fact: The Unified SDK returns content in the 'response.text()' helper or nested parts
    const text = response.text().replace(/```json|```/g, "").trim();
    const data = JSON.parse(text);

    return res.status(200).json({
      items: data.results || [],
      thinkingProcess: data.thinking || "AI Reasoning complete."
    });

  } catch (error) {
    console.error("Gemini 3 Execution Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
