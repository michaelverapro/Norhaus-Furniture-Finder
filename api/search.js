// api/search.js
import { Storage } from '@google-cloud/storage';
import { GoogleGenerativeAI } from "@google/generative-ai";

// 1. Safe Initialization of GCS
let storage;
try {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  storage = new Storage({ credentials });
} catch (e) {
  console.error("GCS Credential Error:", e.message);
  storage = new Storage(); // Fallback to default auth if JSON fails
}

const BUCKET_NAME = 'norhaus_catalogues';
const INDEX_FILE = 'master_index.json';

// 2. Initialize Gemini with explicit stable model
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  // Use the modern URL API to fix the DeprecationWarning
  const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
  const q = searchParams.get('q');

  if (!q) return res.status(400).json({ error: 'Search term is required' });
  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: 'API Key Missing' });

  try {
    // 3. Fetch Catalog Data from Google Cloud
    const file = storage.bucket(BUCKET_NAME).file(INDEX_FILE);
    const [content] = await file.download();
    const catalogData = content.toString();

    // 4. Set up Gemini 1.5 Flash (STABLE)
    // We use "gemini-1.5-flash" without beta prefixes for maximum stability
    const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash" 
    });

    const prompt = `
      You are the Norhaus AI Interior Design Curator. 
      Use the following catalog data to find the best items for the user's request.
      
      User Request: "${q}"
      Catalog Data: ${catalogData}

      Instructions:
      1. Find up to 10 relevant matches.
      2. For each, provide a "matchReason" explaining why it fits.
      3. Return ONLY a valid JSON object with a "results" array.
      
      Example Format: { "results": [ { "name": "Item Name", "matchReason": "This fits because..." } ] }
    `;

    const result = await model.generateContent(prompt);
    const textResponse = result.response.text();
    
    // Clean potential markdown from AI response
    const jsonString = textResponse.replace(/```json|```/g, "").trim();
    const aiData = JSON.parse(jsonString);

    return res.status(200).json({
      results: aiData.results || [],
      thinkingProcess: `Curated selections for: "${q}"`
    });

  } catch (error) {
    console.error('Curator Error:', error);
    return res.status(500).json({ 
      error: 'AI Curator Connection Failed',
      details: error.message 
    });
  }
}
