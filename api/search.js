import { Storage } from '@google-cloud/storage';
import { VertexAI, HarmCategory, HarmBlockThreshold } from '@google-cloud/vertexai';

export const config = {
  maxDuration: 60,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    const projectId = credentials.project_id;
    
    const storage = new Storage({ projectId, credentials });
    const bucketName = 'norhaus_catalogues'; 

    const vertexAI = new VertexAI({ project: projectId, location: 'us-central1', googleAuthOptions: { credentials } });
    
    // Safety: Turn off all filters so it doesn't "refuse" to look at furniture
    const safetySettings = [
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE }
    ];

    const model = vertexAI.getGenerativeModel({ 
        model: 'gemini-2.5-flash',
        safetySettings: safetySettings
    });

    const { query } = req.body;
    
    // 1. List Files
    const [files] = await storage.bucket(bucketName).getFiles();
    const pdfs = files.filter(f => f.name.toLowerCase().endsWith('.pdf'));

    if (pdfs.length === 0) return res.status(200).json({ items: [], log: "Bucket is empty." });

    // 2. Scan in Parallel
    const searchPromises = pdfs.map(async (file) => {
        try {
            const result = await model.generateContent({
                contents: [{
                    role: 'user',
                    parts: [
                        { fileData: { fileUri: `gs://${bucketName}/${file.name}`, mimeType: 'application/pdf' } },
                        { text: `STRICT INSTRUCTION: You are a search engine. Search this document for "${query}".
                        
                        Rules:
                        1. Output ONLY valid JSON.
                        2. Do NOT speak. Do NOT say "I'm sorry" or "I have reviewed".
                        3. If matches are found, return: { "items": [{ "name": "...", "description": "...", "pageNumber": "..." }] }
                        4. If NO matches are found, return: { "items": [] }` }
                    ]
                }]
            });
            
            const response = await result.response;
            let text = response.candidates[0].content.parts[0].text;

            // --- THE FIX: CLEAN THE RESPONSE ---
            // Remove markdown wrappers (```json ... ```)
            text = text.replace(/```json/g, '').replace(/```/g, '');
            // Trim whitespace
            text = text.trim();

            return JSON.parse(text);

        } catch (e) {
            console.error(`Error scanning ${file.name}:`, e.message);
            return { items: [] }; 
        }
    });

    const results = await Promise.all(searchPromises);

    const allItems = [];
    results.forEach((res, index) => {
        if (res && res.items && Array.isArray(res.items)) {
            res.items.forEach(item => {
                allItems.push({ ...item, catalogName: pdfs[index].name });
            });
        }
    });

    res.status(200).json({ 
        items: allItems, 
        thinkingProcess: `Scanned ${pdfs.length} catalogs. Found ${allItems.length} results.` 
    });

  } catch (error) {
    console.error("Server Error:", error);
    res.status(500).json({ error: error.message });
  }
}
