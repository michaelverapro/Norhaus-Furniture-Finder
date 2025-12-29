// api/search.js
import { Storage } from '@google-cloud/storage';
import { GoogleGenerativeAI } from "@google/generative-ai";

let storage;
try {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  storage = new Storage({ credentials });
} catch (e) {
  storage = new Storage(); 
}

const BUCKET_NAME = 'norhaus_catalogues';
const INDEX_FILE = 'master_index.json';

// Initialize SDK
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const fullUrl = new URL(req.url, `${protocol}://${req.headers.host}`);
  const q = fullUrl.searchParams.get('q');

  if (!q) return res.status(400).json({ error: 'Search term is required' });

  try {
    const file = storage.bucket(BUCKET_NAME).file(INDEX_FILE);
    const [content] = await file.download();
    const catalogData = content.toString();

    // TARGETING THE NEW PREVIEW MODEL
    const model = genAI.getGenerativeModel(
      { 
        model: "gemini-3-flash-preview",
        // Optional: You can set thinking_level to "high" for better curation
        generationConfig: {
          responseMimeType: "application/json"
        }
      },
      { apiVersion: "v1beta" } // Preview models require v1beta
    );

    const prompt = `
      You are the Norhaus AI Interior Design Curator using Gemini 3's reasoning.
      Analyze the user's request and find the best matches from the catalog.
      
      User Request: "${q}"
      Catalog: ${catalogData}

      Rules:
      1. Think step-by-step about style, size, and material matches.
      2. Return ONLY a JSON object with a "results" array.
      3. Each result must have the original item data + a "matchReason".
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```json|```/g, "").trim();
    const aiData = JSON.parse(text);

    return res.status(200).json({
      results: aiData.results || [],
      thinkingProcess: "Gemini 3 Flash reasoning active."
    });

  } catch (error) {
    console.error('Gemini 3 Error:', error);
    return res.status(500).json({ error: 'Gemini 3 connection failed', details: error.message });
  }
}
