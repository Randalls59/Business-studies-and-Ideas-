import { readFile, writeFile, mkdir } from 'node:fs/promises';

const apiKey = process.env.SERPAPI_KEY;
if (!apiKey) throw new Error('SERPAPI_KEY is missing. Add it as a GitHub Actions repository secret.');

const concepts = {
  coffee: { label: 'Coffee / café', terms: ['coffee shop'], primary: 'coffee shop' },
  juice: { label: 'Juice / smoothie', terms: ['smoothie', 'juice bar'], primary: 'smoothie' },
  tea: { label: 'Tea / boba', terms: ['boba tea'], primary: 'boba tea' },
  breakfast: { label: 'Fast breakfast', terms: ['breakfast sandwich'], primary: 'breakfast sandwich' },
};
const trendTerms = [...new Set(Object.values(concepts).flatMap(item => item.terms))];

const trafficIntersections = [
  { intersection: 'Swan Rd & Golf Links Rd', morning: 12693, evening: 13458 },
  { intersection: 'Speedway Blvd & Kolb Rd', morning: 12369, evening: 13809 },
  { intersection: '22nd St & Kolb Rd', morning: 11962, evening: 14228 },
  { intersection: 'Grant Rd & Craycroft Rd', morning: 11801, evening: 13158 },
  { intersection: 'Grant Rd / Kolb Rd / Tanque Verde Rd', morning: 11428, evening: null },
  { intersection: 'Valencia Rd & I-19', morning: 11264, evening: null },
  { intersection: 'Speedway Blvd & Wilmot Rd', morning: 11064, evening: 12683 },
  { intersection: 'Broadway Blvd & Kolb Rd', morning: 10805, evening: 13880 },
  { intersection: 'Grant Rd & Swan Rd', morning: 10731, evening: null },
  { intersection: 'Swan Rd & 22nd St', morning: 10644, evening: null },
  { intersection: 'Broadway Blvd & Wilmot Rd', morning: null, evening: 13606 },
  { intersection: '22nd St & Craycroft Rd', morning: null, evening: 13074 },
  { intersection: 'Broadway Blvd & Craycroft Rd', morning: null, evening: 12781 },
  { intersection: 'Campbell Ave & Speedway Blvd', morning: null, evening: 12652 },
].map(item => ({
  ...item,
  peak_average: [item.morning, item.evening].filter(Number.isFinite).reduce((a, b) => a + b, 0) / [item.morning, item.evening].filter(Number.isFinite).length,
}));

const corridorDefinitions = [
  { name: 'Broadway Boulevard', patterns: [' broadway '] },
  { name: 'Speedway Boulevard', patterns: [' speedway '] },
  { name: 'Grant Road', patterns: [' grant '] },
  { name: '22nd Street', patterns: [' 22nd '] },
  { name: 'Golf Links Road', patterns: [' golf links '] },
  { name: 'Valencia Road', patterns: [' valencia '] },
  { name: 'Irvington Road', patterns: [' irvington '] },
  { name: 'Ina Road', patterns: [' ina '] },
  { name: 'River Road', patterns: [' river '] },
  { name: 'Tanque Verde Road', patterns: [' tanque verde '] },
  { name: 'Oracle Road', patterns: [' oracle '] },
  { name: 'Campbell Avenue', patterns: [' campbell '] },
  { name: 'Swan Road', patterns: [' swan '] },
  { name: 'Craycroft Road', patterns: [' craycroft '] },
  { name: 'Kolb Road', patterns: [' kolb '] },
  { name: 'Wilmot Road', patterns: [' wilmot '] },
  { name: 'Houghton Road', patterns: [' houghton '] },
  { name: 'Alvernon Way', patterns: [' alvernon '] },
  { name: 'Country Club Road', patterns: [' country club '] },
  { name: 'First Avenue', patterns: [' 1st ave', ' first ave'] },
  { name: 'Sixth Avenue', patterns: [' 6th ave', ' sixth ave'] },
  { name: 'Stone Avenue', patterns: [' stone ave'] },
];

const numeric = value => {
  if (value === null || value === undefined) return null;
  const parsed = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
};
const mean = values => {
  const clean = values.filter(Number.isFinite);
  return clean.length ? clean.reduce((a, b) => a + b, 0) / clean.length : null;
};
const median = values => {
  const clean = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!clean.length) return null;
  const middle = Math.floor(clean.length / 2);
  return clean.length % 2 ? clean[middle] : (clean[middle - 1] + clean[middle]) / 2;
};
const round = (value, digits = 1) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
const normalizeMap = object => {
  const entries = Object.entries(object).filter(([, value]) => Number.isFinite(value));
  if (!entries.length) return Object.fromEntries(Object.keys(object).map(key => [key, 50]));
  const values = entries.map(([, value]) => value);
  const min = Math.min(...values), max = Math.max(...values);
  return Object.fromEntries(Object.keys(object).map(key => {
    const value = object[key];
    if (!Number.isFinite(value)) return 0;
    return max === min ? 50 : Math.round(((value - min) / (max - min)) * 100);
  }));
};
const cleanText = value => String(value || '').trim();

async function serp(params) {
  const url = new URL('https://serpapi.com/search.json');
  Object.entries({ ...params, api_key: apiKey }).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  });
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.error) throw new Error(body.error || `SerpApi returned ${response.status}`);
  return body;
}

function queryValueMap(values = []) {
  return Object.fromEntries(values.map(item => [cleanText(item.query).toLowerCase(), numeric(item.extracted_value ?? item.value)]));
}

function categoryFromListing(row) {
  const text = `${row.category || ''} ${row.subtype || ''} ${row.name || ''}`.toLowerCase();
  if (/juice|smoothie|açaí|acai/.test(text)) return 'juice';
  if (/boba|bubble tea|tea shop|tea house|tea room/.test(text)) return 'tea';
  if (/breakfast|bakery|bagel|donut|doughnut|brunch|sandwich/.test(text)) return 'breakfast';
  if (/coffee|cafe|café|espresso/.test(text)) return 'coffee';
  return null;
}

function corridorForAddress(address = '') {
  const padded = ` ${address.toLowerCase()} `;
  return corridorDefinitions.find(corridor => corridor.patterns.some(pattern => padded.includes(pattern)))?.name || null;
}

function roadTraffic(corridorName) {
  const tokens = corridorName.toLowerCase().replace(/boulevard|road|avenue|street|way/g, '').trim().split(/\s+/);
  const matches = trafficIntersections.filter(item => tokens.some(token => token.length > 2 && item.intersection.toLowerCase().includes(token)));
  return mean(matches.map(item => item.peak_average));
}

const errors = [];
let timeseries = null;
let cityBreakdown = null;
const related = {};

try {
  timeseries = await serp({
    engine: 'google_trends', q: trendTerms.join(','), data_type: 'TIMESERIES',
    geo: 'US-AZ', date: 'today 12-m', hl: 'en', tz: 420,
  });
} catch (error) { errors.push(`Trends timeseries: ${error.message}`); }

try {
  cityBreakdown = await serp({
    engine: 'google_trends', q: trendTerms.join(','), data_type: 'GEO_MAP',
    geo: 'US-AZ', region: 'CITY', include_low_search_volume: 'true', date: 'today 12-m', hl: 'en', tz: 420,
  });
  const rows = cityBreakdown.compared_breakdown_by_region || [];
  if (!rows.some(row => /tucson/i.test(row.location || ''))) {
    cityBreakdown = await serp({
      engine: 'google_trends', q: trendTerms.join(','), data_type: 'GEO_MAP',
      geo: 'US', region: 'DMA', include_low_search_volume: 'true', date: 'today 12-m', hl: 'en', tz: 420,
    });
  }
} catch (error) { errors.push(`Trends Tucson geography: ${error.message}`); }

for (const [key, concept] of Object.entries(concepts)) {
  try {
    const result = await serp({
      engine: 'google_trends', q: concept.primary, data_type: 'RELATED_QUERIES',
      geo: 'US-AZ', date: 'today 12-m', hl: 'en', tz: 420,
    });
    related[key] = {
      top: (result.related_queries?.top || []).slice(0, 8).map(item => ({ query: item.query, value: item.value, score: numeric(item.extracted_value) })),
      rising: (result.related_queries?.rising || []).slice(0, 8).map(item => ({ query: item.query, value: item.value, score: numeric(item.extracted_value) })),
    };
  } catch (error) {
    errors.push(`Related queries ${key}: ${error.message}`);
    related[key] = { top: [], rising: [] };
  }
}

let competitorPayload = { listings: [], updated_at: null };
try {
  competitorPayload = JSON.parse(await readFile('docs/competitor-data.json', 'utf8'));
} catch (error) { errors.push(`Competitor feed: ${error.message}`); }

const seen = new Set();
const competitors = (competitorPayload.listings || []).map(row => ({
  ...row,
  category: categoryFromListing(row),
  reviewsCount: numeric(row.reviewsCount) || 0,
  rating: numeric(row.rating),
})).filter(row => {
  if (!row.category || row.permanentlyClosed) return false;
  const key = row.id || `${row.name}|${row.address}`.toLowerCase();
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

const trendAverageRaw = queryValueMap(timeseries?.interest_over_time?.averages || []);
const timelineRows = timeseries?.interest_over_time?.timeline_data || [];
if (!Object.keys(trendAverageRaw).length && timelineRows.length) {
  for (const term of trendTerms) {
    trendAverageRaw[term.toLowerCase()] = mean(timelineRows.flatMap(row => (row.values || []).filter(value => cleanText(value.query).toLowerCase() === term.toLowerCase()).map(value => numeric(value.extracted_value ?? value.value))));
  }
}

const tucsonGeoRow = (cityBreakdown?.compared_breakdown_by_region || []).find(row => /tucson/i.test(row.location || '')) || null;
const tucsonShareRaw = queryValueMap(tucsonGeoRow?.values || []);

const categorySearchRaw = {};
const categoryCityRaw = {};
for (const [key, concept] of Object.entries(concepts)) {
  categorySearchRaw[key] = mean(concept.terms.map(term => trendAverageRaw[term.toLowerCase()]));
  categoryCityRaw[key] = mean(concept.terms.map(term => tucsonShareRaw[term.toLowerCase()]));
}

const supplyMetrics = {};
const reviewSignalRaw = {};
for (const [key, concept] of Object.entries(concepts)) {
  const rows = competitors.filter(item => item.category === key);
  const reviewValues = rows.map(item => item.reviewsCount || 0);
  const ratingRows = rows.filter(item => Number.isFinite(item.rating) && item.reviewsCount > 0);
  const weightedRating = ratingRows.length
    ? ratingRows.reduce((sum, item) => sum + item.rating * item.reviewsCount, 0) / ratingRows.reduce((sum, item) => sum + item.reviewsCount, 0)
    : null;
  const totalReviews = reviewValues.reduce((a, b) => a + b, 0);
  const reviewsPerListing = rows.length ? totalReviews / rows.length : 0;
  supplyMetrics[key] = {
    key, label: concept.label, supply_count: rows.length,
    total_reviews: totalReviews, median_reviews: median(reviewValues), reviews_per_listing: reviewsPerListing,
    weighted_rating: weightedRating,
    review_coverage: rows.length ? rows.filter(item => item.reviewsCount > 0).length / rows.length : 0,
  };
  reviewSignalRaw[key] = Math.log10(reviewsPerListing + 1);
}

const searchIndex = normalizeMap(categorySearchRaw);
const cityIndex = normalizeMap(categoryCityRaw);
const reviewIndex = normalizeMap(reviewSignalRaw);
const supplyIndex = normalizeMap(Object.fromEntries(Object.entries(supplyMetrics).map(([key, value]) => [key, value.supply_count])));

const rankings = Object.keys(concepts).map(key => {
  const supply = supplyMetrics[key];
  const hasSearch = Number.isFinite(categorySearchRaw[key]);
  const hasCity = Number.isFinite(categoryCityRaw[key]);
  const demandScore = Math.round(
    (hasSearch ? searchIndex[key] : 50) * 0.45 +
    reviewIndex[key] * 0.35 +
    (hasCity ? cityIndex[key] : 50) * 0.20
  );
  const saturationScore = Math.round(supplyIndex[key]);
  const opportunityScore = Math.round(demandScore * 0.65 + (100 - saturationScore) * 0.35);
  let confidence = 20;
  if (hasSearch) confidence += 25;
  if (hasCity) confidence += 15;
  if (supply.supply_count >= 20) confidence += 15;
  if (supply.review_coverage >= 0.7) confidence += 15;
  confidence += 10;
  const verdict = opportunityScore >= 76 ? 'TEST FIRST' : opportunityScore >= 66 ? 'PROMISING' : opportunityScore >= 55 ? 'VALIDATE' : saturationScore >= 70 ? 'CROWDED' : 'LOW PROOF';
  return {
    ...supply,
    search_average: round(categorySearchRaw[key]),
    tucson_search_share: round(categoryCityRaw[key]),
    search_index: searchIndex[key], review_index: reviewIndex[key], demand_score: demandScore,
    saturation_score: saturationScore, opportunity_score: opportunityScore,
    confidence_score: Math.min(100, confidence), verdict,
    related_queries: related[key],
  };
}).sort((a, b) => b.opportunity_score - a.opportunity_score);

const timeline = timelineRows.map(row => {
  const valueMap = queryValueMap(row.values || []);
  const values = {};
  for (const [key, concept] of Object.entries(concepts)) values[key] = round(mean(concept.terms.map(term => valueMap[term.toLowerCase()])), 0);
  return { date: row.date, timestamp: row.timestamp || null, values };
});

const corridorGroups = {};
for (const item of competitors) {
  const corridor = corridorForAddress(item.address);
  if (!corridor) continue;
  if (!corridorGroups[corridor]) corridorGroups[corridor] = [];
  corridorGroups[corridor].push(item);
}

const corridorBase = Object.entries(corridorGroups).map(([name, rows]) => ({
  name,
  total_listings: rows.length,
  total_reviews: rows.reduce((sum, row) => sum + (row.reviewsCount || 0), 0),
  reviews_per_listing: rows.length ? rows.reduce((sum, row) => sum + (row.reviewsCount || 0), 0) / rows.length : 0,
  traffic_peak_proxy: roadTraffic(name),
  category_counts: Object.fromEntries(Object.keys(concepts).map(key => [key, rows.filter(row => row.category === key).length])),
  weighted_rating: (() => {
    const rated = rows.filter(row => Number.isFinite(row.rating) && row.reviewsCount > 0);
    return rated.length ? rated.reduce((sum, row) => sum + row.rating * row.reviewsCount, 0) / rated.reduce((sum, row) => sum + row.reviewsCount, 0) : null;
  })(),
})).filter(row => row.total_listings >= 2);

const corridorTrafficIndex = normalizeMap(Object.fromEntries(corridorBase.map(row => [row.name, row.traffic_peak_proxy])));
const corridorReviewIndex = normalizeMap(Object.fromEntries(corridorBase.map(row => [row.name, Math.log10(row.total_reviews + 1)])));
const corridorVolumeIndex = normalizeMap(Object.fromEntries(corridorBase.map(row => [row.name, row.total_listings])));
const corridorRankings = {};
for (const key of Object.keys(concepts)) {
  const maxCategorySupply = Math.max(1, ...corridorBase.map(row => row.category_counts[key] || 0));
  corridorRankings[key] = corridorBase.map(row => {
    const localSupply = row.category_counts[key] || 0;
    const whiteSpace = Math.round((1 - localSupply / maxCategorySupply) * 100);
    const demandBase = Math.round(corridorTrafficIndex[row.name] * 0.45 + corridorReviewIndex[row.name] * 0.35 + corridorVolumeIndex[row.name] * 0.20);
    const gapScore = Math.round(demandBase * 0.70 + whiteSpace * 0.30);
    const confidence = Math.round((Number.isFinite(row.traffic_peak_proxy) ? 45 : 20) + (row.total_listings >= 5 ? 30 : 18) + (row.total_reviews > 1000 ? 25 : 12));
    const rationale = `${Number.isFinite(row.traffic_peak_proxy) ? `Peak-count proxy ${Math.round(row.traffic_peak_proxy).toLocaleString('en-US')} vehicles` : 'No official peak-count proxy loaded'}; ${row.total_listings} relevant businesses; ${localSupply} ${concepts[key].label.toLowerCase()} listings; ${Math.round(row.reviews_per_listing).toLocaleString('en-US')} reviews per listing.`;
    return { ...row, category: key, category_supply: localSupply, white_space_score: whiteSpace, demand_base_score: demandBase, gap_score: gapScore, confidence_score: Math.min(100, confidence), rationale };
  }).sort((a, b) => b.gap_score - a.gap_score).slice(0, 12);
}

const businessSignals = competitors.map(item => ({
  id: item.id, name: item.name, address: item.address, category: item.category,
  rating: item.rating, reviews_count: item.reviewsCount, corridor: corridorForAddress(item.address),
  google_maps_url: item.googleMapsUrl || '', website: item.website || '',
  performance_proxy_raw: (Number.isFinite(item.rating) ? item.rating : 3.5) * Math.log10((item.reviewsCount || 0) + 10),
}));
const businessIndex = normalizeMap(Object.fromEntries(businessSignals.map((item, index) => [`${index}`, item.performance_proxy_raw])));
businessSignals.forEach((item, index) => { item.performance_proxy = businessIndex[String(index)]; delete item.performance_proxy_raw; });
businessSignals.sort((a, b) => b.performance_proxy - a.performance_proxy);

const output = {
  updated_at: new Date().toISOString(),
  market: 'Tucson, Arizona',
  status: errors.length ? 'partial' : 'complete',
  methodology_version: '1.0',
  sources: [
    { name: 'Google Trends via SerpApi', role: 'Arizona search interest, Tucson/DMA share and related queries', url: 'https://serpapi.com/google-trends-api' },
    { name: 'Google Maps competitor snapshot', role: 'Supply, ratings and review-volume demand proxy', updated_at: competitorPayload.updated_at || null },
    { name: 'Pima Association of Governments', role: 'Published 2023 peak traffic counts for high-volume Tucson intersections', url: 'https://pagregion.com/uncategorized/where-are-the-busiest-intersections-in-the-pima-county-region/' },
  ],
  score_formula: {
    demand: '45% Arizona Google Trends index + 35% reviews-per-listing index + 20% Tucson/DMA search share index',
    opportunity: '65% demand score + 35% inverse supply saturation',
    corridor_gap: '70% corridor demand base + 30% category white space',
  },
  caveats: [
    'Google Trends values are relative search-interest indexes, not absolute search counts.',
    'Review volume is a demand proxy, not audited revenue or foot traffic.',
    'Traffic figures are published peak-period intersection counts from 2023 and do not cover every corridor.',
    'A high score identifies a thesis to test, not proof that a store will succeed.',
  ],
  errors,
  competitor_snapshot: { updated_at: competitorPayload.updated_at || null, analyzed_count: competitors.length },
  tucson_geo_match: tucsonGeoRow ? { location: tucsonGeoRow.location, geo: tucsonGeoRow.geo || null, coordinates: tucsonGeoRow.coordinates || null } : null,
  rankings,
  timeline,
  corridors: corridorRankings,
  traffic_intersections: trafficIntersections,
  top_business_signals: businessSignals.slice(0, 40),
};

await mkdir('docs', { recursive: true });
await writeFile('docs/demand-data.json', `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(`Demand intelligence saved: ${rankings.length} concepts, ${competitors.length} businesses, ${timeline.length} trend periods. Status: ${output.status}.`);
if (errors.length) console.warn(errors.join('\n'));
