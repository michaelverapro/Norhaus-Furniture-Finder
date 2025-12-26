import { Storage } from '@google-cloud/storage';
import { VertexAI, HarmCategory, HarmBlockThreshold } from '@google-cloud/vertexai';

export const config = {
  maxDuration: 300, 
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    const startTime = Date.now();
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    const projectId = credentials.project_id;
    
    const storage = new Storage({ projectId, credentials });
    const bucketName = 'norhaus_catalogues'; 

    const vertexAI = new VertexAI({ project: projectId, location: 'us-central1', googleAuthOptions: { credentials } });
    
    const model = vertexAI.getGenerativeModel({ 
        model: 'gemini-2.5-flash',
        safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE }
        ],
        generationConfig: {
            maxOutputTokens: 1000, 
            responseMimeType: "application/json"
        }
    });

    const { query } = req.body;
    
    const [files] = await storage.bucket(bucketName).getFiles();
    const pdfs = files.filter(f => f.name.toLowerCase().endsWith('.pdf'));

    if (pdfs.length === 0) return res.status(200).json({ items: [], log: "Bucket is empty." });

    const allItems = [];
    const BATCH_SIZE = 15;
    
    for (let i = 0; i < pdfs.length; i += BATCH_SIZE) {
        const batch = pdfs.slice(i, i + BATCH_SIZE);
        
        const batchPromises = batch.map(async (file) => {
            try {
                // --- NEW PROMPT LOGIC ---
                const result = await model.generateContent({
                    contents: [{
                        role: 'user',
                        parts: [
                            { fileData: { fileUri: `gs://${bucketName}/${file.name}`, mimeType: 'application/pdf' } },
                            { text: `You are an expert furniture consultant. The user is searching for: "${query}".
                            
                            Task: Find items in this catalog that match the user's request.
                            
                            Rules:
                            1. **match_reason**: For each item, write a short, persuasive sentence explaining WHY it fits the query. (e.g., "This sofa features the deep brown leather finish you requested.")
                            2. **dimensions**: Extract dimensions if found (e.g. "80W x 40D").
                            3. JSON Only.
                            
                            Schema:
                            { "items": [{ 
                                "name": "Product Name", 
                                "description": "Standard catalog description", 
                                "match_reason": "Your expert analysis of why this fits",
                                "dimensions": "Dimensions or null",
                                "page_number_digit": "Page Number" 
                            }] }
                            
                            If NO matches, return { "items": [] }` }
                        ]
                    }]
                });
                
                const response = await result.response;
                let text = response.candidates[0].content.parts[0].text;
                text = text.replace(/```json/g, '').replace(/```/g, '').trim();
                
                const data = JSON.parse(text);

                if (data.items && Array.isArray(data.items)) {
                    return data.items.map(item => {
                        let cleanPage = null;
                        let rawPage = item.page_number_digit || item.pageNumber;
                        if (rawPage) {
                            const match = rawPage.toString().match(/(\d+)/);
                            if (match) cleanPage = match[0];
                        }
                        
                        return { 
                            name: item.name,
                            description: item.description,
                            matchReason: item.match_reason, // Capturing the AI insight
                            dimensions: item.dimensions,
                            pageNumber: cleanPage, 
                            catalogName: file.name 
                        };
                    });
                }
                return [];
            } catch (e) {
                console.error(`Error scanning ${file.name}:`, e.message);
                return [];
            }
        });

        const batchResults = await Promise.all(batchPromises);
        batchResults.forEach(items => {
            if (items && items.length > 0) allItems.push(...items);
        });
    }

    res.status(200).json({ 
        items: allItems, 
        thinkingProcess: `Consultant Scan: Reviewed ${pdfs.length} catalogs in ${((Date.now() - startTime)/1000).toFixed(1)}s.` 
    });

  } catch (error) {
    console.error("Server Error:", error);
    res.status(500).json({ error: error.message });
  }
}
