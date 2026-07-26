import { readFile, writeFile } from 'node:fs/promises';

const now = new Date().toISOString();
const safeError = error => String(error?.message || error || 'Unknown error').replace(/[A-Fa-f0-9]{32,}/g, '[redacted]').slice(0, 900);

function normalizeMap(object) {
  const entries = Object.entries(object).filter(([, value]) => Number.isFinite(value));
  if (!entries.length) return Object.fromEntries(Object.keys(object).map(key => [key, 50]));
  const values = entries.map(([, value]) => value);
  const min = Math.min(...values), max = Math.max(...values);
  return Object.fromEntries(Object.keys(object).map(key => {
    const value = object[key];
    if (!Number.isFinite(value)) return 0;
    return max === min ? 50 : Math.round(((value - min) / (max - min)) * 100);
  }));
}

function median(values) {
  const rows = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!rows.length) return 0;
  const middle = Math.floor(rows.length / 2);
  return rows.length % 2 ? rows[middle] : (rows[middle - 1] + rows[middle]) / 2;
}

function categoryFor(row) {
  const text = `${row.subtype || ''} ${row.name || ''}`.toLowerCase();
  if (/juice|smoothie|açaí|acai/.test(text)) return 'juice';
  if (/boba|bubble tea|tea shop|tea house|tea room/.test(text)) return 'tea';
  if (/breakfast restaurant|breakfast sandwich|bagel|donut|doughnut|brunch|bakery/.test(text)) return 'breakfast';
  if (/coffee shop|coffee store|cafe|café|espresso/.test(text)) return 'coffee';
  return null;
}

function corridorFor(address = '') {
  const text = ` ${address.toLowerCase()} `;
  const corridors = [
    ['Broadway Boulevard', [' broadway ']], ['Speedway Boulevard', [' speedway ']], ['Grant Road', [' grant ']],
    ['22nd Street', [' 22nd ']], ['Golf Links Road', [' golf links ']], ['Valencia Road', [' valencia ']],
    ['Irvington Road', [' irvington ']], ['Ina Road', [' ina ']], ['River Road', [' river ']],
    ['Tanque Verde Road', [' tanque verde ']], ['Oracle Road', [' oracle ']], ['Campbell Avenue', [' campbell ']],
    ['Swan Road', [' swan ']], ['Craycroft Road', [' craycroft ']], ['Kolb Road', [' kolb ']],
    ['Wilmot Road', [' wilmot ']], ['Houghton Road', [' houghton ']], ['Alvernon Way', [' alvernon ']],
    ['First Avenue', [' 1st ave', ' first ave']], ['Sixth Avenue', [' 6th ave', ' sixth ave']], ['Stone Avenue', [' stone ave']]
  ];
  return corridors.find(([, patterns]) => patterns.some(pattern => text.includes(pattern)))?.[0] || null;
}

async function buildFallback(reason) {
  const labels = { coffee: 'Coffee / café', juice: 'Juice / smoothie', tea: 'Tea / boba', breakfast: 'Fast breakfast' };
  const payload = JSON.parse(await readFile('docs/competitor-data.json', 'utf8'));
  const seen = new Set();
  const rows = (payload.listings || []).map(row => ({
    ...row,
    category: categoryFor(row),
    reviewsCount: Number(row.reviewsCount) || 0,
    rating: Number(row.rating) || null,
  })).filter(row => {
    if (!row.category || row.permanentlyClosed) return false;
    const key = row.id || `${row.name}|${row.address}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const rawReview = {}, rawSupply = {};
  const metrics = {};
  for (const key of Object.keys(labels)) {
    const group = rows.filter(row => row.category === key);
    const reviews = group.map(row => row.reviewsCount);
    const totalReviews = reviews.reduce((a, b) => a + b, 0);
    rawReview[key] = Math.log10((group.length ? totalReviews / group.length : 0) + 1);
    rawSupply[key] = group.length;
    metrics[key] = {
      key,
      label: labels[key],
      supply_count: group.length,
      total_reviews: totalReviews,
      median_reviews: median(reviews),
      reviews_per_listing: group.length ? totalReviews / group.length : 0,
      weighted_rating: group.length ? group.reduce((sum, row) => sum + (row.rating || 0) * Math.max(1, row.reviewsCount), 0) / group.reduce((sum, row) => sum + Math.max(1, row.reviewsCount), 0) : null,
      review_coverage: group.length ? group.filter(row => row.reviewsCount > 0).length / group.length : 0,
    };
  }
  const reviewIndex = normalizeMap(rawReview);
  const supplyIndex = normalizeMap(rawSupply);
  const rankings = Object.keys(labels).map(key => {
    const demandScore = reviewIndex[key];
    const saturationScore = supplyIndex[key];
    const opportunityScore = Math.round(demandScore * 0.65 + (100 - saturationScore) * 0.35);
    return {
      ...metrics[key],
      search_average: null,
      tucson_search_share: null,
      search_index: null,
      review_index: reviewIndex[key],
      demand_score: demandScore,
      saturation_score: saturationScore,
      opportunity_score: opportunityScore,
      confidence_score: 45,
      verdict: opportunityScore >= 72 ? 'PROMISING — SEARCH DATA PENDING' : opportunityScore >= 55 ? 'VALIDATE — SEARCH DATA PENDING' : 'LOW PROOF',
      related_queries: { top: [], rising: [] },
    };
  }).sort((a, b) => b.opportunity_score - a.opportunity_score);

  const corridorGroups = {};
  for (const row of rows) {
    const corridor = corridorFor(row.address);
    if (!corridor) continue;
    (corridorGroups[corridor] ||= []).push(row);
  }
  const corridors = {};
  for (const concept of Object.keys(labels)) {
    corridors[concept] = Object.entries(corridorGroups).map(([name, group]) => {
      const categorySupply = group.filter(row => row.category === concept).length;
      const totalReviews = group.reduce((sum, row) => sum + row.reviewsCount, 0);
      const reviewsPerListing = group.length ? totalReviews / group.length : 0;
      const whiteSpace = Math.max(0, 100 - categorySupply * 18);
      const demandBase = Math.min(100, Math.round(Math.log10(totalReviews + 1) * 22));
      return {
        name,
        total_listings: group.length,
        total_reviews: totalReviews,
        reviews_per_listing: reviewsPerListing,
        traffic_peak_proxy: null,
        category_counts: Object.fromEntries(Object.keys(labels).map(key => [key, group.filter(row => row.category === key).length])),
        weighted_rating: null,
        category: concept,
        category_supply: categorySupply,
        white_space_score: whiteSpace,
        demand_base_score: demandBase,
        gap_score: Math.round(demandBase * 0.7 + whiteSpace * 0.3),
        confidence_score: 35,
        rationale: `Review-activity and category-white-space fallback only; official traffic and Google Trends were not loaded.`,
      };
    }).filter(row => row.total_listings >= 2).sort((a, b) => b.gap_score - a.gap_score).slice(0, 12);
  }

  const performanceRaw = Object.fromEntries(rows.map((row, index) => [String(index), (row.rating || 3.5) * Math.log10(row.reviewsCount + 10)]));
  const performanceIndex = normalizeMap(performanceRaw);
  const topBusinessSignals = rows.map((row, index) => ({
    id: row.id,
    name: row.name,
    address: row.address,
    category: row.category,
    rating: row.rating,
    reviews_count: row.reviewsCount,
    corridor: corridorFor(row.address),
    google_maps_url: row.googleMapsUrl || '',
    website: row.website || '',
    performance_proxy: performanceIndex[String(index)],
  })).sort((a, b) => b.performance_proxy - a.performance_proxy).slice(0, 40);

  const output = {
    updated_at: now,
    market: 'Tucson, Arizona',
    status: 'partial — SerpApi demand source failed',
    methodology_version: '1.0-fallback',
    sources: [{ name: 'Stored Google Maps competitor snapshot', role: 'Supply and review-volume demand proxy', updated_at: payload.updated_at || null }],
    score_formula: {
      demand: 'Fallback: normalized reviews per listing only',
      opportunity: '65% review-demand proxy + 35% inverse supply saturation',
      corridor_gap: 'Fallback: 70% corridor review activity + 30% category white space',
    },
    caveats: [
      'Google Trends and Tucson geographic search data did not load in this run.',
      'Review volume is a demand proxy, not revenue or verified foot traffic.',
      'Fallback rankings are temporary and must not be treated as the final concept verdict.'
    ],
    errors: [reason],
    competitor_snapshot: { updated_at: payload.updated_at || null, analyzed_count: rows.length },
    tucson_geo_match: null,
    rankings,
    timeline: [],
    corridors,
    traffic_intersections: [],
    top_business_signals: topBusinessSignals,
  };
  await writeFile('docs/demand-data.json', `${JSON.stringify(output, null, 2)}\n`, 'utf8');
}

try {
  await import('./update-demand-intelligence.mjs');
  await writeFile('docs/demand-error.json', `${JSON.stringify({ updated_at: now, status: 'success', error: null }, null, 2)}\n`, 'utf8');
} catch (error) {
  const reason = safeError(error);
  console.error(`Primary demand build failed: ${reason}`);
  await buildFallback(reason);
  await writeFile('docs/demand-error.json', `${JSON.stringify({ updated_at: now, status: 'fallback', error: reason }, null, 2)}\n`, 'utf8');
  console.log('A transparent fallback demand dataset was generated so the dashboard remains usable.');
}
