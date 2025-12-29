// api/search.js
import { Storage } from '@google-cloud/storage';
import { GoogleGenerativeAI } from "@google/generative-ai";

const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
const storage = new Storage({ credentials });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
  const q = searchParams.get('q');

  try {
    const file = storage.bucket('norhaus_catalogues').file('master_index.json');
    const [content] = await file.download();
    
    // FORCING GEMINI 3 PREVIEW
    const model = genAI.getGenerativeModel(
      { model: "gemini-3-flash-preview" },
      { apiVersion: "v1beta" }
    );

    const prompt = `
      You are the Norhaus Curator. User wants: "${q}". 
      Catalog Data: ${content.toString()}

      TASK:
      1. Think about the style, materials, and vibe.
      2. Select top 8 items.
      3. Return a JSON object with:
         - "thinking": A 2-sentence explanation of your interior design logic for this search.
         - "results": The array of items + "matchReason" for each.
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```json|```/g, "").trim();
    const data = JSON.parse(text);

    return res.status(200).json({
      items: data.results || [],
      thinkingProcess: data.thinking || "Matches selected based on catalog stylistic traits."
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
