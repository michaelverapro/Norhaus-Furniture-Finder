import { Storage } from '@google-cloud/storage';
import { VertexAI, HarmCategory, HarmBlockThreshold } from '@google-cloud/vertexai';

// VERCEL PRO CONFIGURATION
// We now allow the server to run for up to 5 minutes (300 seconds).
// This guarantees we can read every single catalog without timing out.
export const config = {
  maxDuration: 300, 
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    const startTime = Date.now();
    
    // --- AUTHENTICATION ---
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    const projectId = credentials.project_id;
    
    const storage = new Storage({ projectId, credentials });
    const bucketName = 'norhaus_catalogues'; 

    const vertexAI = new VertexAI({ project: projectId, location: 'us-central1', googleAuthOptions: { credentials } });
    
    // --- GOOGLE AI OPTIMIZATION ---
    // 1. No Safety Filters (Prevents false positives on furniture)
    // 2. Strict JSON Mode (Faster processing)
    // 3. Token Limit (Stops the AI from rambling, saving milliseconds)
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
    
    // 1. FETCH ALL FILES
    // We no longer limit this. We grab everything.
    const [files] = await storage.bucket(bucketName).getFiles();
    const pdfs = files.filter(f => f.name.toLowerCase().endsWith('.pdf'));

    if (pdfs.length === 0) return res.status(200).json({ items: [], log: "Bucket is empty." });

    const allItems = [];
    
    // 2. MASSIVE PARALLEL PROCESSING
    // Since we are on Pro, we can push the engine harder.
    // Batch Size 15: We send 15 catalogs to Google simultaneously.
    // This is the sweet spot between "Maximum Speed" and "Google Rate Limits".
    const BATCH_SIZE = 15;
    
    for (let i = 0; i < pdfs.length; i += BATCH_SIZE) {
        const batch = pdfs.slice(i, i + BATCH_SIZE);
        
        // Execute the batch
        const batchPromises = batch.map(async (file) => {
            try {
                // The Prompt: Optimized for machine speed, not conversation.
                const result = await model.generateContent({
                    contents: [{
                        role: 'user',
                        parts: [
                            { fileData: { fileUri: `gs://${bucketName}/${file.name}`, mimeType: 'application/pdf' } },
                            { text: `Search for "${query}". 
                            Rules:
                            1. JSON ONLY. No markdown.
                            2. Schema: { "items": [{ "name": "string", "description": "string", "page_number_digit": "string" }] }
                            3. "page_number_digit" must be a single number (e.g. "5").
                            4. If no match, return { "items": [] }` }
                        ]
                    }]
                });
                
                const response = await result.response;
                let text = response.candidates[0].content.parts[0].text;
                // Rapid cleanup
                text = text.replace(/```json/g, '').replace(/```/g, '').trim();
                
                const data = JSON.parse(text);

                // Data Normalization
                if (data.items && Array.isArray(data.items)) {
                    return data.items.map(item => {
                        let cleanPage = null;
                        let rawPage = item.page_number_digit || item.pageNumber;
                        if (rawPage) {
                            const match = rawPage.toString().match(/(\d+)/);
                            if (match) {
                                cleanPage = match[0];
                            }
                        }
                        return { ...item, pageNumber: cleanPage, catalogName: file.name };
                    });
                }
                return [];
            } catch (e) {
                console.error(`Error scanning ${file.name}:`, e.message);
                return [];
            }
        });

        // Wait for these 15 to finish before starting the next 15
        // This ensures we don't crash the memory, but keeps the pipe full.
        const batchResults = await Promise.all(batchPromises);
        
        batchResults.forEach(items => {
            if (items && items.length > 0) allItems.push(...items);
        });
    }

    // 3. RETURN COMPREHENSIVE RESULTS
    res.status(200).json({ 
        items: allItems, 
        thinkingProcess: `Full Archive Scan Complete. Checked ${pdfs.length} catalogs in ${((Date.now() - startTime)/1000).toFixed(1)}s.` 
    });

  } catch (error) {
    console.error("Server Error:", error);
    res.status(500).json({ error: error.message });
  }
}
