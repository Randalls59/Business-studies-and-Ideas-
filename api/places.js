const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://randalls59.github.io';
const endpoint = 'https://places.googleapis.com/v1/places:searchText';
const fieldMask = [
  'places.id','places.displayName','places.formattedAddress','places.location','places.primaryType',
  'places.types','places.googleMapsUri','places.websiteUri','places.rating','places.userRatingCount',
  'places.priceLevel','places.businessStatus','places.regularOpeningHours','nextPageToken'
].join(',');

function categoryFor(query) {
  if (query.includes('juice') || query.includes('smoothie')) return 'juice';
  if (query.includes('tea') || query.includes('boba')) return 'tea';
  if (query.includes('breakfast')) return 'breakfast';
  return 'coffee';
}

async function searchQuery(apiKey, textQuery, pages) {
  const results = [];
  let pageToken;
  for (let page = 0; page < pages; page += 1) {
    const body = {
      textQuery,
      pageSize: 20,
      locationRestriction: {
        rectangle: {
          low: { latitude: 31.98, longitude: -111.22 },
          high: { latitude: 32.43, longitude: -110.64 }
        }
      }
    };
    if (pageToken) body.pageToken = pageToken;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': fieldMask
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error(`Google Places returned ${response.status}`);
    const data = await response.json();
    results.push(...(data.places || []).map(place => ({ ...place, snapCategory: categoryFor(textQuery) })));
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }
  return results;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.GOOGLE_MAPS_API_KEY) return res.status(503).json({ error: 'GOOGLE_MAPS_API_KEY is not configured' });

  const pages = Math.max(1, Math.min(3, Number(req.query.pages) || 1));
  const queries = ['coffee shops in Tucson Arizona','juice and smoothie shops in Tucson Arizona','tea and boba shops in Tucson Arizona','fast breakfast restaurants in Tucson Arizona'];

  try {
    const batches = await Promise.all(queries.map(query => searchQuery(process.env.GOOGLE_MAPS_API_KEY, query, pages)));
    const deduped = new Map();
    batches.flat().forEach(place => {
      if (!place.id) return;
      const prior = deduped.get(place.id);
      if (!prior) deduped.set(place.id, place);
      else if (prior.snapCategory === 'coffee' && place.snapCategory !== 'coffee') deduped.set(place.id, place);
    });
    return res.status(200).json({
      updatedAt: new Date().toISOString(),
      pagesPerQuery: pages,
      count: deduped.size,
      places: [...deduped.values()]
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Google Places scan failed' });
  }
}
