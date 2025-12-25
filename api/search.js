import { Storage } from '@google-cloud/storage';
import { VertexAI, HarmCategory, HarmBlockThreshold } from '@google-cloud/vertexai';

export const config = {
  maxDuration: 60, // Vercel limit
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    const projectId = credentials.project_id;
    
    const storage = new Storage({ projectId, credentials });
    const bucketName = 'norhaus_catalogues'; 

    const vertexAI = new VertexAI({ project: projectId, location: 'us-central1', googleAuthOptions: { credentials } });
    
    // Use the new Flash model
    const model = vertexAI.getGenerativeModel({ 
        model: 'gemini-2.5-flash',
        generationConfig: { responseMimeType: "application/json" }, // <--- FORCE JSON
        safetySettings: [{ category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }]
    });

    const { query } = req.body;
    
    // 1. List Files
    const [files] = await storage.bucket(bucketName).getFiles();
    const pdfs = files.filter(f => f.name.toLowerCase().endsWith('.pdf'));

    if (pdfs.length === 0) return res.status(200).json({ items: [], log: "Bucket is empty." });

    // 2. Scan in Parallel (Limit to 5 at a time to be safe, or all if small)
    // We will race them to get results faster.
    const searchPromises = pdfs.map(async (file) => {
        try {
            const result = await model.generateContent({
                contents: [{
                    role: 'user',
                    parts: [
                        { fileData: { fileUri: `gs://${bucketName}/${file.name}`, mimeType: 'application/pdf' } },
                        { text: `Search this catalog for "${query}". Return a JSON object with a key "items" containing a list of matches. Each match must have "name", "description", "pageNumber". If no match, return {"items": []}.` }
                    ]
                }]
            });
            
            const response = await result.response;
            // The AI is now forced to return JSON, so we can parse directly
            return JSON.parse(response.candidates[0].content.parts[0].text);
        } catch (e) {
            console.error(`Error scanning ${file.name}:`, e.message);
            return { items: [] }; // Return empty on error so we don't crash
        }
    });

    // 3. Wait for all scans to finish
    const results = await Promise.all(searchPromises);

    // 4. Combine results
    const allItems = [];
    results.forEach((res, index) => {
        if (res.items && res.items.length > 0) {
            res.items.forEach(item => {
                allItems.push({ ...item, catalogName: pdfs[index].name });
            });
        }
    });

    res.status(200).json({ 
        items: allItems, 
        thinkingProcess: `Scanned ${pdfs.length} catalogs in parallel. Found ${allItems.length} matches.` 
    });

  } catch (error) {
    console.error("Server Error:", error);
    res.status(500).json({ error: error.message });
  }
}
