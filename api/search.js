import { Storage } from '@google-cloud/storage';

const storage = new Storage();
const BUCKET_NAME = 'norhaus_catalogues';
const INDEX_FILE = 'master_index.json';

export default async function handler(req, res) {
  // Use the modern WHATWG URL API to prevent security deprecation warnings
  const fullUrl = `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}${req.url}`;
  const { searchParams } = new URL(fullUrl);
  const q = searchParams.get('q');

  if (!q) {
    return res.status(400).json({ error: 'Search term is required' });
  }

  try {
    // 1. Fetch the consolidated Master Index from your Google Cloud bucket
    const file = storage.bucket(BUCKET_NAME).file(INDEX_FILE);
    const [content] = await file.download();
    const products = JSON.parse(content.toString());

    // 2. Perform an Intelligence Scan across the rich metadata
    const query = q.toLowerCase();
    const results = products.filter(item => {
      // Check for matches in basic info
      const basicMatch = 
        item.name?.toLowerCase().includes(query) ||
        item.category?.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query);

      // Check for matches in high-end attributes
      const attributeMatch = 
        item.attributes?.style?.toLowerCase().includes(query) ||
        item.attributes?.materials?.some(m => m.toLowerCase().includes(query)) ||
        item.attributes?.finish?.toLowerCase().includes(query);

      // Check for matches in the rich search tags (synonyms/intent)
      const tagMatch = item.search_tags?.some(tag => tag.toLowerCase().includes(query));

      return basicMatch || attributeMatch || tagMatch;
    });

    // 3. Return results with their cloud coordinates (Catalog & Page)
    return res.status(200).json({
      count: results.length,
      // Limits to top 15 matches for UI performance
      results: results.slice(0, 15) 
    });

  } catch (error) {
    console.error('Search API Error:', error);
    return res.status(500).json({ error: 'Failed to process furniture search' });
  }
}
