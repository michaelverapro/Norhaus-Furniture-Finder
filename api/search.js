// api/search.js
import { Storage } from '@google-cloud/storage';
import { GoogleGenerativeAI } from "@google/generative-ai";

// This helper ensures we find your GCP credentials regardless of the variable name
const getGCPCredentials = () => {
  const envVar = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!envVar) return null;
  try {
    return JSON.parse(envVar);
  } catch (e) {
    return null;
  }
};

const credentials = getGCPCredentials();
const storage = credentials ? new Storage({ credentials }) : new Storage();

const BUCKET_NAME = 'norhaus_catalogues';
const INDEX_FILE = 'master_index.json';
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  const { q } = req.query;

  if (!q) return res.status(400).json({ error: 'Search term is required' });
  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY is missing in Vercel settings.' });

  try {
    // 1. Fetch Catalog from GCS
    const file = storage.bucket(BUCKET_NAME).file(INDEX_FILE);
    const [content] = await file.download();
    const catalogData = content.toString();

    // 2. Setup Gemini 1.5 Flash
    const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
      You are the Norhaus AI Concierge. Use this catalog: ${catalogData}
      Find the best matches for: "${q}"
      Return ONLY JSON: { "results": [ { ...originalItem, "matchReason": "why this fits" } ] }
    `;

    const result = await model.generateContent(prompt);
    const aiResponse = JSON.parse(result.response.text());

    return res.status(200).json({
      results: aiResponse.results || [],
      thinkingProcess: `AI analyzed "${q}" against the master catalog.`
    });

  } catch (error) {
    console.error('Search Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
