// api/search.js
// This runs securely on Vercel's servers, not in the user's browser.
import { Storage } from '@google-cloud/storage';
import { VertexAI } from '@google-cloud/vertexai';

export const config = {
  maxDuration: 60, // Allow search to run for up to 60 seconds
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    // 1. Authenticate using the Key from Vercel Settings
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    const projectId = credentials.project_id;
    
    // 2. Connect to the Bucket
    const storage = new Storage({ projectId, credentials });
    const bucketName = 'norhaus_catalogues'; // ✅ YOUR BUCKET NAME

    // 3. Connect to the AI
    const vertexAI = new VertexAI({ project: projectId, location: 'us-central1', googleAuthOptions: { credentials } });
    const model = vertexAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const { query } = req.body;
    console.log(`Searching for "${query}" in bucket: ${bucketName}`);

    // 4. Get List of PDFs
    const [files] = await storage.bucket(bucketName).getFiles();
    const pdfs = files.filter(f => f.name.toLowerCase().endsWith('.pdf'));

    if (pdfs.length === 0) return res.status(200).json({ items: [], log: "Bucket is empty or has no PDFs." });

    const allItems = [];
    let log = `Scanned ${pdfs.length} catalogs in cloud.\n`;

    // 5. Scan Each PDF (Server-Side)
    for (const file of pdfs) {
        const gcsUri = `gs://${bucketName}/${file.name}`;
        
        // This is the magic: We send the LINK (gs://), not the file data.
        const request = {
            contents: [{
                role: 'user',
                parts: [
                    { fileData: { fileUri: gcsUri, mimeType: 'application/pdf' } },
                    { text: `Search this catalog for "${query}". Return a JSON object with a property "items" containing the best 1 match. If NO match, return empty items.` }
                ]
            }]
        };

        try {
            const result = await model.generateContent(request);
            const response = await result.response;
            const text = response.candidates[0].content.parts[0].text.replace(/```json/g, '').replace(/```/g, '').trim();
            const data = JSON.parse(text);

            if (data.items && data.items.length > 0) {
                allItems.push(...data.items.map(item => ({
                    ...item,
                    catalogName: file.name,
                    id: Math.random().toString(36).substr(2, 9)
                })));
                log += `✅ Match in ${file.name}\n`;
            } else {
                log += `⚪ No match in ${file.name}\n`;
            }
        } catch (err) {
            console.error(err);
            log += `❌ Error scanning ${file.name}\n`;
        }
    }

    res.status(200).json({ items: allItems, thinkingProcess: log });

  } catch (error) {
    console.error("Server Error:", error);
    res.status(500).json({ error: error.message });
  }
}
