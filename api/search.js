import { Storage } from '@google-cloud/storage';

const storage = new Storage();
const BUCKET_NAME = 'norhaus_catalogues';
const INDEX_FILE = 'master_index.json';

export default async function handler(req, res) {
  // Safe URL parsing
  const fullUrl = `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}${req.url}`;
  const { searchParams } = new URL(fullUrl);
  const q = searchParams.get('q');

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

      // 2. Check the NEW "keywords" array
      const keywordMatch = item.keywords?.some(k => k.toLowerCase().includes(query));

      // 3. Check the NEW "style" and "materials" arrays
      const attributeMatch = 
        item.style?.some(s => s.toLowerCase().includes(query)) ||
        item.materials?.some(m => m.toLowerCase().includes(query));

      return basicMatch || keywordMatch || attributeMatch;
    });

    return res.status(200).json({
      count: results.length,
      results: results.slice(0, 20) 
    });

  } catch (error) {
    console.error('Search API Error:', error);
    return res.status(500).json({ error: 'Failed to process search' });
  }
}
