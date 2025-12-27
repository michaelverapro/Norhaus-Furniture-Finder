import { Storage } from '@google-cloud/storage';

const storage = new Storage();
const BUCKET_NAME = 'norhaus_catalogues';
const INDEX_FILE = 'master_index.json';

export default async function handler(req, res) {
  const { q } = req.query;

  if (!q) {
    return res.status(400).json({ error: 'Search term is required' });
  }

  try {
    // 1. Fetch the consolidated index from Google Cloud
    const file = storage.bucket(BUCKET_NAME).file(INDEX_FILE);
    const [content] = await file.download();
    const products = JSON.parse(content.toString());

    // 2. Perform a multi-attribute "Smart Scan"
    const query = q.toLowerCase();
    const results = products.filter(item => {
      return (
        item.name.toLowerCase().includes(query) ||
        item.category?.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.attributes?.style?.toLowerCase().includes(query) ||
        // Scan the entire list of materials
        item.attributes?.materials?.some(m => m.toLowerCase().includes(query)) ||
        // Scan the rich search tags we built in AI Studio
        item.search_tags?.some(tag => tag.toLowerCase().includes(query))
      );
    });

    // 3. Return results with their coordinates for the PDF viewer
    return res.status(200).json({
      count: results.length,
      results: results.slice(0, 15) // Limit to top 15 matches for speed
    });

  } catch (error) {
    console.error('Search API Error:', error);
    return res.status(500).json({ error: 'Failed to process furniture search' });
  }
}
