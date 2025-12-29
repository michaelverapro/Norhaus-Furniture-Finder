// api/search.js
import { Storage } from '@google-cloud/storage';

const storage = new Storage();
const BUCKET_NAME = 'norhaus_catalogues';
const INDEX_FILE = 'master_index.json';

export default async function handler(req, res) {
  // Use req.query to capture the 'q' parameter from the GET request
  const { q } = req.query;

  if (!q) {
    return res.status(400).json({ error: 'Search term is required' });
  }

  try {
    const file = storage.bucket(BUCKET_NAME).file(INDEX_FILE);
    const [content] = await file.download();
    const products = JSON.parse(content.toString());

    const query = q.toLowerCase();
    
    const results = products.filter(item => {
      // 1. Check basic text fields
      const basicMatch = 
        item.name?.toLowerCase().includes(query) ||
        item.category?.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query);

      // 2. Check the 'keywords' array from your master_index.json
      const keywordMatch = item.keywords?.some(k => k.toLowerCase().includes(query));

      // 3. Check the 'style' and 'materials' arrays
      const attributeMatch = 
        item.style?.some(s => s.toLowerCase().includes(query)) ||
        item.materials?.some(m => m.toLowerCase().includes(query));

      return basicMatch || keywordMatch || attributeMatch;
    });

    // Return the results in the format expected by geminiService
    return res.status(200).json({
      count: results.length,
      results: results.slice(0, 20) 
    });

  } catch (error) {
    console.error('GCP Storage or Search Error:', error);
    return res.status(500).json({ 
      error: 'Failed to access catalog index',
      details: error.message 
    });
  }
}
