// api/search.js
import { Storage } from '@google-cloud/storage';
const { GoogleGenerativeAI } = require("@google-cloud/generative-ai");

const storage = new Storage();
const BUCKET_NAME = 'norhaus_catalogues';
const INDEX_FILE = 'master_index.json';
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  const { q } = req.query;

  if (!q) return res.status(400).json({ error: 'Search term is required' });

  try {
    // 1. Fetch the "Knowledge Base" (Your JSON Index)
    const file = storage.bucket(BUCKET_NAME).file(INDEX_FILE);
    const [content] = await file.download();
    const catalogData = content.toString();

    // 2. Initialize Gemini 1.5 Flash
    const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        generationConfig: { responseMimeType: "application/json" }
    });

    // 3. The "Curator" Prompt
    const prompt = `
      You are the Norhaus AI Concierge. Use the provided Furniture Catalog JSON to find the best matches for the user's request.
      
      User Request: "${q}"
      Catalog Data: ${catalogData}

      Instructions:
      1. Analyze the user's intent (style, size, material, or use-case).
      2. Select up to 10 relevant items.
      3. For each item, provide a brief 'matchReason' explaining why it fits the request.
      4. Return the data as a JSON object with a 'results' array containing the full original item objects plus the 'matchReason' field.
      
      Example Output: { "results": [{...item, "matchReason": "This piece fits your small space requirement..."}, ...] }
    `;

    const result = await model.generateContent(prompt);
    const aiResponse = JSON.parse(result.response.text());

    return res.status(200).json({
      count: aiResponse.results?.length || 0,
      results: aiResponse.results || [],
      thinkingProcess: `Gemini analyzed your request for "${q}" against the full catalog.`
    });

  } catch (error) {
    console.error('AI Search Error:', error);
    return res.status(500).json({ error: 'The AI Concierge is currently unavailable.' });
  }
}
