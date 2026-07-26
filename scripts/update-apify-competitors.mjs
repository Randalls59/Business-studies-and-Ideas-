import { mkdir, writeFile } from 'node:fs/promises';

const token = process.env.APIFY_TOKEN;
const actorId = (process.env.APIFY_ACTOR_ID || 'compass~crawler-google-places').replace('/', '~');
const locationQuery = process.env.APIFY_LOCATION_QUERY || 'Tucson, Arizona, USA';

if (!token) {
  throw new Error('APIFY_TOKEN is missing. Add it as a GitHub Actions repository secret.');
}

const apiBase = 'https://api.apify.com/v2';
const headers = {
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
};

const input = {
  searchStringsArray: [
    'coffee shop',
    'cafe',
    'drive through coffee',
    'juice bar',
    'smoothie shop',
    'tea shop',
    'boba tea',
    'breakfast restaurant',
    'bakery cafe',
  ],
  locationQuery,
  maxCrawledPlacesPerSearch: 80,
  language: 'en',
  scrapeSocialMediaProfiles: {
    facebooks: false,
    instagrams: false,
    youtubes: false,
    tiktoks: false,
    twitters: false,
  },
  maximumLeadsEnrichmentRecords: 0,
  maxCompetitorsToAnalyze: 0,
};

async function request(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    throw new Error(`Apify request failed (${response.status}): ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  }
  return body;
}

const runResponse = await request(
  `${apiBase}/acts/${actorId}/runs?waitForFinish=300`,
  { method: 'POST', headers, body: JSON.stringify(input) },
);

let run = runResponse?.data || runResponse;
if (!run?.id) throw new Error('Apify did not return a run ID.');

for (let attempt = 0; attempt < 8 && !['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT'].includes(run.status); attempt += 1) {
  await new Promise(resolve => setTimeout(resolve, 30_000));
  const poll = await request(`${apiBase}/actor-runs/${run.id}?waitForFinish=60`, { headers });
  run = poll?.data || poll;
}

if (run.status !== 'SUCCEEDED') {
  throw new Error(`Apify run ${run.id} finished with status ${run.status || 'UNKNOWN'}.`);
}

if (!run.defaultDatasetId) throw new Error('Apify run did not provide a dataset ID.');

const rawItems = await request(
  `${apiBase}/datasets/${run.defaultDatasetId}/items?clean=true&format=json&limit=5000`,
  { headers },
);

if (!Array.isArray(rawItems)) throw new Error('Apify dataset response was not an array.');

const first = (...values) => values.find(value => value !== undefined && value !== null && value !== '');
const asNumber = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

function categoryFor(row) {
  const text = [
    row.categoryName,
    row.category,
    row.primaryCategory,
    ...(Array.isArray(row.categories) ? row.categories : []),
    row.title,
    row.name,
  ].filter(Boolean).join(' ').toLowerCase();
  if (/juice|smoothie/.test(text)) return 'juice';
  if (/boba|bubble tea|tea shop|tea house/.test(text)) return 'tea';
  if (/breakfast|bakery|bagel|sandwich|brunch/.test(text)) return 'breakfast';
  return 'coffee';
}

function normalize(row) {
  const location = row.location || row.coordinates || {};
  const lat = asNumber(first(row.latitude, row.lat, location.lat, location.latitude));
  const lng = asNumber(first(row.longitude, row.lng, row.lon, location.lng, location.lon, location.longitude));
  const name = first(row.title, row.name, row.placeName, 'Unnamed business');
  const address = first(
    row.address,
    row.fullAddress,
    row.street,
    [row.street, row.city, row.state, row.postalCode].filter(Boolean).join(', '),
  );
  const googleMapsUrl = first(row.url, row.googleMapsUrl, row.placeUrl, row.mapsUrl, '');
  const website = first(row.website, row.websiteUrl, row.webUrl, '');
  const reviewsCount = asNumber(first(row.reviewsCount, row.reviewCount, row.numberOfReviews, row.reviews));
  const rating = asNumber(first(row.totalScore, row.rating, row.stars));
  const openingHours = first(
    Array.isArray(row.openingHours) ? row.openingHours.join(' · ') : row.openingHours,
    Array.isArray(row.openingHoursStrings) ? row.openingHoursStrings.join(' · ') : row.openingHoursStrings,
    row.hours,
    '',
  );
  const driveThroughText = JSON.stringify(row).toLowerCase();
  const driveThrough = first(row.driveThrough, row.hasDriveThrough, /drive.?through/.test(driveThroughText) ? 'possible' : 'unknown');

  return {
    id: String(first(row.placeId, row.cid, row.fid, `${name}|${address}|${lat}|${lng}`)),
    name: String(name),
    address: address ? String(address) : '',
    lat,
    lng,
    category: categoryFor(row),
    subtype: String(first(row.categoryName, row.primaryCategory, row.category, Array.isArray(row.categories) ? row.categories[0] : '', 'business')),
    rating,
    reviewsCount,
    priceLevel: String(first(row.price, row.priceLevel, row.priceRange, '')),
    phone: String(first(row.phone, row.phoneNumber, row.unformattedPhone, '')),
    website: website ? String(website) : '',
    googleMapsUrl: googleMapsUrl ? String(googleMapsUrl) : '',
    menuUrl: String(first(row.menu, row.menuUrl, row.orderBy, '')),
    openingHours: openingHours ? String(openingHours) : '',
    driveThrough: typeof driveThrough === 'boolean' ? (driveThrough ? 'yes' : 'no') : String(driveThrough),
    permanentlyClosed: Boolean(first(row.permanentlyClosed, row.isPermanentlyClosed, false)),
    temporarilyClosed: Boolean(first(row.temporarilyClosed, row.isTemporarilyClosed, false)),
  };
}

const seen = new Set();
const listings = rawItems
  .map(normalize)
  .filter(item => item.lat !== null && item.lng !== null)
  .filter(item => item.lat >= 31.95 && item.lat <= 32.5 && item.lng >= -111.35 && item.lng <= -110.55)
  .filter(item => {
    const key = item.id || `${item.name}|${item.address}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  })
  .sort((a, b) => (b.reviewsCount || 0) - (a.reviewsCount || 0));

const output = {
  updated_at: new Date().toISOString(),
  source: 'Google Maps via Apify',
  actor: actorId.replace('~', '/'),
  location_query: locationQuery,
  raw_count: rawItems.length,
  count: listings.length,
  listings,
};

await mkdir('docs', { recursive: true });
await writeFile('docs/competitor-data.json', `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(`Saved ${listings.length} normalized Tucson competitors from ${rawItems.length} Apify results.`);
