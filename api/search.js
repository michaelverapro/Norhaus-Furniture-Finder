// api/search.js
import { Storage } from '@google-cloud/storage';
import { GoogleGenerativeAI } from "@google-cloud/generative-ai";

const storage = new Storage();
const BUCKET_NAME = 'norhaus_catalogues';
const INDEX_FILE = 'master_index.json';
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  const { q } = req.query;

  if (!q) return res.status(400).json({ error: 'Search term is required' });

  try {
    // 1. Fetch the Knowledge Base from GCS
    const file = storage.bucket(BUCKET_NAME).file(INDEX_FILE);
    const [content] = await file.download();
    const catalogData = content.toString();

    // 2. Initialize Gemini 1.5 Flash with JSON output mode
    const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        generationConfig: { responseMimeType: "application/json" }
    });

    // 3. The Curator Prompt
    const prompt = `
      You are the Norhaus AI Interior Design Consultant. 
      Analyze the user's request and find the best matches from the provided furniture catalog.
      
      User Request: "${q}"
      Catalog Data: ${catalogData}

      Instructions:
      1. Interpret the user's intent (e.g., style, material, mood, or room type).
      2. Select up to 10 products that best fit the request.
      3. For each selected product, create a "matchReason" (a short, persuasive 1-sentence explanation of why it fits).
      4. Return ONLY a JSON object with a "results" array. Each object in the array must be the EXACT original product data plus the "matchReason" field.
      
      Expected JSON structure: { "results": [ { ...originalData, "matchReason": "string" } ] }
    `;

    const result = await model.generateContent(prompt);
    const aiResponse = JSON.parse(result.response.text());

    return res.status(200).json({
      count: aiResponse.results?.length || 0,
      results: aiResponse.results || [],
      thinkingProcess: `The AI Consultant interpreted: "${q}"`
    });

  } catch (error) {
    console.error('AI Search Error:', error);
    return res.status(500).json({ 
      error: 'The AI Concierge is currently offline.',
      details: error.message 
    });
  }
}
