// api/search.js
import { Storage } from '@google-cloud/storage';
import { GoogleGenerativeAI } from "@google/generative-ai";

// 1. Initialize GCS
let storage;
try {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  storage = new Storage({ credentials });
} catch (e) {
  console.error("GCS Credential Error:", e.message);
  storage = new Storage();
}

const BUCKET_NAME = 'norhaus_catalogues';
const INDEX_FILE = 'master_index.json';

// 2. Initialize Gemini with STABLE v1 API configuration
// This overrides the SDK default of v1beta
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  // Use WHATWG URL API to resolve the DeprecationWarning
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const fullUrl = new URL(req.url, `${protocol}://${req.headers.host}`);
  const q = fullUrl.searchParams.get('q');

  if (!q) return res.status(400).json({ error: 'Search term is required' });
  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: 'API Key Missing' });

  try {
    const file = storage.bucket(BUCKET_NAME).file(INDEX_FILE);
    const [content] = await file.download();
    const catalogData = content.toString();

    // 3. Force the use of the stable v1 endpoint
    // "gemini-1.5-flash" is the canonical name supported in v1
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      apiVersion: "v1" // <--- CRITICAL FIX: Stops the 404 on v1beta
    });

    const prompt = `
      You are the Norhaus AI Interior Design Curator. 
      Use the provided furniture catalog to find matches for: "${q}"
      Catalog: ${catalogData}
      
      Return ONLY a JSON object with a "results" array. 
      Each result should include a "matchReason" explaining the selection.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // 4. Robust JSON Parsing
    const cleanJson = text.replace(/```json|```/g, "").trim();
    const aiData = JSON.parse(cleanJson);

    return res.status(200).json({
      results: aiData.results || [],
      thinkingProcess: `AI Curator identified matches for: "${q}"`
    });

  } catch (error) {
    console.error('Search Error:', error);
    return res.status(500).json({ 
      error: 'Search Failed',
      details: error.message 
    });
  }
}
