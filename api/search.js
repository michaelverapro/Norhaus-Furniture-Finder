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
    
    const [files] = await storage.bucket(bucketName).getFiles();
    const pdfs = files.filter(f => f.name.toLowerCase().endsWith('.pdf'));

    if (pdfs.length === 0) return res.status(200).json({ items: [], log: "Bucket is empty." });

    const searchPromises = pdfs.map(async (file) => {
        try {
            const result = await model.generateContent({
                contents: [{
                    role: 'user',
                    parts: [
                        { fileData: { fileUri: `gs://${bucketName}/${file.name}`, mimeType: 'application/pdf' } },
                        { text: `STRICT INSTRUCTION: Search this document for "${query}".
                        
                        Rules:
                        1. Return ONLY valid JSON.
                        2. NO markdown formatting.
                        3. Format: { "items": [{ "name": "...", "description": "...", "page_number_digit": "NUMBER ONLY" }] }
                        4. For "page_number_digit", extract only the actual PDF page number as a digit (e.g., "8", not "Page Y-8").
                        5. If NO matches, return: { "items": [] }` }
                    ]
                }]
            });
            
            const response = await result.response;
            let text = response.candidates[0].content.parts[0].text;
            text = text.replace(/```json/g, '').replace(/```/g, '').trim();
            
            let data = JSON.parse(text);

            // --- POWERFUL FIX: Post-process the page number ---
            if (data.items && Array.isArray(data.items)) {
                data.items = data.items.map(item => {
                    let cleanPage = null;
                    // Look for the new field first
                    let rawPage = item.page_number_digit || item.pageNumber;
                    if (rawPage) {
                        // Extract the very first sequence of numbers found
                        const match = rawPage.toString().match(/(\d+)/);
                        if (match) {
                            cleanPage = match[0];
                        }
                    }
                    return { ...item, pageNumber: cleanPage }; // Standardize on "pageNumber"
                });
            }

            return data;

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
        thinkingProcess: `Scanned ${pdfs.length} catalogs. Found ${allItems.length} matches.` 
    });

  } catch (error) {
    console.error("Server Error:", error);
    res.status(500).json({ error: error.message });
  }
}
