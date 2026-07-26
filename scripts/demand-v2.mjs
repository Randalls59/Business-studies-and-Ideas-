import { readFile, writeFile } from 'node:fs/promises';

const NOW = new Date().toISOString();
const API_KEY = process.env.SERPAPI_KEY || '';
const errors = [];

const concepts = {
  coffee: { label: 'Coffee / café', terms: ['coffee shop'] },
  juice: { label: 'Juice / smoothie', terms: ['smoothie', 'juice bar'] },
  tea: { label: 'Tea / boba', terms: ['boba tea'] },
  breakfast: { label: 'Fast breakfast', terms: ['breakfast sandwich'] },
};
const trendTerms = [...new Set(Object.values(concepts).flatMap(item => item.terms))];

const trafficIntersections = [
  ['Swan Rd & Golf Links Rd',12693,13458],['Speedway Blvd & Kolb Rd',12369,13809],
  ['22nd St & Kolb Rd',11962,14228],['Grant Rd & Craycroft Rd',11801,13158],
  ['Grant Rd / Kolb Rd / Tanque Verde Rd',11428,null],['Valencia Rd & I-19',11264,null],
  ['Speedway Blvd & Wilmot Rd',11064,12683],['Broadway Blvd & Kolb Rd',10805,13880],
  ['Grant Rd & Swan Rd',10731,null],['Swan Rd & 22nd St',10644,null],
  ['Broadway Blvd & Wilmot Rd',null,13606],['22nd St & Craycroft Rd',null,13074],
  ['Broadway Blvd & Craycroft Rd',null,12781],['Campbell Ave & Speedway Blvd',null,12652],
].map(([intersection,morning,evening]) => {
  const values=[morning,evening].filter(Number.isFinite);
  return { intersection,morning,evening,peak_average:values.reduce((a,b)=>a+b,0)/values.length };
});

const corridorDefinitions = [
  ['Broadway Boulevard',[' broadway ']],['Speedway Boulevard',[' speedway ']],['Grant Road',[' grant ']],
  ['22nd Street',[' 22nd ']],['Golf Links Road',[' golf links ']],['Valencia Road',[' valencia ']],
  ['Irvington Road',[' irvington ']],['Ina Road',[' ina ']],['River Road',[' river ']],
  ['Tanque Verde Road',[' tanque verde ']],['Oracle Road',[' oracle ']],['Campbell Avenue',[' campbell ']],
  ['Swan Road',[' swan ']],['Craycroft Road',[' craycroft ']],['Kolb Road',[' kolb ']],
  ['Wilmot Road',[' wilmot ']],['Houghton Road',[' houghton ']],['Alvernon Way',[' alvernon ']],
  ['Country Club Road',[' country club ']],['First Avenue',[' 1st ave',' first ave']],
  ['Sixth Avenue',[' 6th ave',' sixth ave']],['Stone Avenue',[' stone ave']],
];

const numberOrNull = value => {
  if (value === null || value === undefined || value === '') return null;
  const parsed=Number(String(value).replace(/[^0-9.-]/g,''));
  return Number.isFinite(parsed)?parsed:null;
};
const mean = values => {
  const clean=values.filter(Number.isFinite);
  return clean.length?clean.reduce((a,b)=>a+b,0)/clean.length:null;
};
const median = values => {
  const clean=values.filter(Number.isFinite).sort((a,b)=>a-b);
  if(!clean.length)return null;
  const i=Math.floor(clean.length/2);
  return clean.length%2?clean[i]:(clean[i-1]+clean[i])/2;
};
const round = (value,digits=1) => Number.isFinite(value)?Number(value.toFixed(digits)):null;
const clamp = value => Math.max(0,Math.min(100,Math.round(Number(value)||0)));
function normalizeMap(object={}) {
  const keys=Object.keys(object);
  const valid=keys.map(key=>object[key]).filter(Number.isFinite);
  if(!keys.length)return {};
  if(!valid.length)return Object.fromEntries(keys.map(key=>[key,50]));
  const min=Math.min(...valid),max=Math.max(...valid);
  return Object.fromEntries(keys.map(key=>{
    const value=object[key];
    const normalized=!Number.isFinite(value)?0:(max===min?50:((value-min)/(max-min))*100);
    return [key,clamp(normalized)];
  }));
}

function categoryFor(row) {
  const subtype=String(row.subtype||'').toLowerCase();
  const name=String(row.name||'').toLowerCase();
  const combined=`${subtype} ${name}`;
  const excluded=/cannabis|dispensary|department store|grocery store|mexican restaurant|american restaurant|steakhouse|seafood restaurant|bar & grill|pizza restaurant|chinese restaurant|thai restaurant|indian restaurant|hotel|gas station/.test(subtype);
  if(excluded)return null;
  if(/juice shop|juice bar|smoothie shop|açaí shop|acai shop/.test(subtype)||/\b(juice|smoothie|acai|açaí)\b/.test(name))return 'juice';
  if(/bubble tea store|bubble tea shop|tea store|tea shop|tea house|tea room/.test(subtype)||/\b(boba|bubble tea)\b/.test(name))return 'tea';
  if(/breakfast restaurant|brunch restaurant|bagel shop|donut shop|doughnut shop|bakery/.test(subtype))return 'breakfast';
  if(/coffee shop|coffee store|espresso bar|cafe|café/.test(subtype)||(/\b(coffee|espresso)\b/.test(name)&&!/restaurant/.test(subtype)))return 'coffee';
  return null;
}
function corridorFor(address='') {
  const text=` ${String(address).toLowerCase()} `;
  return corridorDefinitions.find(([,patterns])=>patterns.some(pattern=>text.includes(pattern)))?.[0]||null;
}
function roadTraffic(corridor) {
  const tokens=String(corridor).toLowerCase().replace(/boulevard|road|avenue|street|way/g,'').trim().split(/\s+/);
  return mean(trafficIntersections.filter(item=>tokens.some(token=>token.length>2&&item.intersection.toLowerCase().includes(token))).map(item=>item.peak_average));
}

async function serp(params,label) {
  if(!API_KEY){errors.push(`${label}: SERPAPI_KEY unavailable`);return null;}
  try{
    const url=new URL('https://serpapi.com/search.json');
    Object.entries({...params,api_key:API_KEY}).forEach(([key,value])=>{if(value!==null&&value!==undefined&&value!=='')url.searchParams.set(key,String(value));});
    const response=await fetch(url,{headers:{Accept:'application/json'}});
    const body=await response.json().catch(()=>({}));
    if(!response.ok||body.error)throw new Error(body.error||`HTTP ${response.status}`);
    return body;
  }catch(error){errors.push(`${label}: ${String(error.message||error).replace(/[A-Fa-f0-9]{32,}/g,'[redacted]').slice(0,300)}`);return null;}
}
function valueMap(values=[]) {
  return Object.fromEntries(values.map(item=>[String(item.query||'').toLowerCase(),numberOrNull(item.extracted_value??item.value)]).filter(([,value])=>Number.isFinite(value)));
}

let competitorPayload={listings:[],updated_at:null};
try{competitorPayload=JSON.parse(await readFile('docs/competitor-data.json','utf8'));}
catch(error){errors.push(`Competitor feed: ${error.message}`);}
const seen=new Set();
const competitors=(competitorPayload.listings||[]).map(row=>({...row,category:categoryFor(row),reviewsCount:numberOrNull(row.reviewsCount)||0,rating:numberOrNull(row.rating)})).filter(row=>{
  if(!row.category||row.permanentlyClosed)return false;
  const id=row.id||`${row.name}|${row.address}`.toLowerCase();
  if(seen.has(id))return false;seen.add(id);return true;
});

const timeseries=await serp({engine:'google_trends',q:trendTerms.join(','),data_type:'TIMESERIES',geo:'US-AZ',date:'today 12-m',hl:'en',tz:420},'Google Trends timeseries');
let geography=await serp({engine:'google_trends',q:trendTerms.join(','),data_type:'GEO_MAP',geo:'US-AZ',region:'CITY',include_low_search_volume:'true',date:'today 12-m',hl:'en',tz:420},'Google Trends Tucson geography');
const geoRows=[...(geography?.compared_breakdown_by_region||[]),...(geography?.interest_by_region||[])];
let tucsonGeo=geoRows.find(row=>/tucson/i.test(row.location||row.geo_name||''))||null;
if(!tucsonGeo){
  geography=await serp({engine:'google_trends',q:trendTerms.join(','),data_type:'GEO_MAP',geo:'US',region:'DMA',include_low_search_volume:'true',date:'today 12-m',hl:'en',tz:420},'Google Trends Tucson DMA');
  const dmaRows=[...(geography?.compared_breakdown_by_region||[]),...(geography?.interest_by_region||[])];
  tucsonGeo=dmaRows.find(row=>/tucson/i.test(row.location||row.geo_name||''))||null;
}
const related={};
for(const [key,concept] of Object.entries(concepts)){
  const response=await serp({engine:'google_trends',q:concept.terms[0],data_type:'RELATED_QUERIES',geo:'US-AZ',date:'today 12-m',hl:'en',tz:420},`Related queries ${key}`);
  related[key]={
    top:(response?.related_queries?.top||[]).slice(0,8).map(item=>({query:item.query,value:item.value,score:numberOrNull(item.extracted_value)})),
    rising:(response?.related_queries?.rising||[]).slice(0,8).map(item=>({query:item.query,value:item.value,score:numberOrNull(item.extracted_value)})),
  };
}

const timelineRows=timeseries?.interest_over_time?.timeline_data||[];
const averages=valueMap(timeseries?.interest_over_time?.averages||[]);
for(const term of trendTerms){
  if(!Number.isFinite(averages[term]))averages[term]=mean(timelineRows.map(row=>valueMap(row.values||[])[term]).filter(Number.isFinite));
}
const geoValues=valueMap(tucsonGeo?.values||[]);
const categorySearch={},categoryGeo={};
for(const [key,concept] of Object.entries(concepts)){
  categorySearch[key]=mean(concept.terms.map(term=>averages[term]));
  categoryGeo[key]=mean(concept.terms.map(term=>geoValues[term]));
}

const supply={},reviewRaw={};
for(const [key,concept] of Object.entries(concepts)){
  const rows=competitors.filter(item=>item.category===key);
  const totalReviews=rows.reduce((sum,row)=>sum+row.reviewsCount,0);
  const reviewValues=rows.map(row=>row.reviewsCount);
  const rated=rows.filter(row=>Number.isFinite(row.rating)&&row.reviewsCount>0);
  supply[key]={key,label:concept.label,supply_count:rows.length,total_reviews:totalReviews,median_reviews:median(reviewValues),reviews_per_listing:rows.length?totalReviews/rows.length:0,weighted_rating:rated.length?rated.reduce((sum,row)=>sum+row.rating*row.reviewsCount,0)/rated.reduce((sum,row)=>sum+row.reviewsCount,0):null,review_coverage:rows.length?rows.filter(row=>row.reviewsCount>0).length/rows.length:0};
  reviewRaw[key]=Math.log10((supply[key].reviews_per_listing||0)+1);
}
const searchIndex=normalizeMap(categorySearch),geoIndex=normalizeMap(categoryGeo),reviewIndex=normalizeMap(reviewRaw),supplyIndex=normalizeMap(Object.fromEntries(Object.entries(supply).map(([key,row])=>[key,row.supply_count])));
const hasAnySearch=Object.values(categorySearch).some(Number.isFinite);
const hasAnyGeo=Object.values(categoryGeo).some(Number.isFinite);
const rankings=Object.keys(concepts).map(key=>{
  const demandScore=clamp((hasAnySearch?searchIndex[key]:50)*.45+reviewIndex[key]*.35+(hasAnyGeo?geoIndex[key]:50)*.20);
  const saturationScore=clamp(supplyIndex[key]);
  const opportunityScore=clamp(demandScore*.65+(100-saturationScore)*.35);
  const confidence=clamp(35+(hasAnySearch?25:0)+(hasAnyGeo?15:0)+(supply[key].supply_count>=15?15:5)+(supply[key].review_coverage>=.7?10:3));
  const verdict=opportunityScore>=76?'TEST FIRST':opportunityScore>=66?'PROMISING':opportunityScore>=55?'VALIDATE':saturationScore>=70?'CROWDED':'LOW PROOF';
  return {...supply[key],search_average:round(categorySearch[key]),tucson_search_share:round(categoryGeo[key]),search_index:hasAnySearch?searchIndex[key]:null,review_index:reviewIndex[key],demand_score:demandScore,saturation_score:saturationScore,opportunity_score:opportunityScore,confidence_score:confidence,verdict,related_queries:related[key]};
}).sort((a,b)=>b.opportunity_score-a.opportunity_score);

const timeline=timelineRows.map(row=>{
  const map=valueMap(row.values||[]),values={};
  for(const [key,concept] of Object.entries(concepts))values[key]=round(mean(concept.terms.map(term=>map[term])),0);
  return {date:row.date,timestamp:row.timestamp||null,values};
});

const corridorGroups={};
for(const row of competitors){const corridor=corridorFor(row.address);if(corridor)(corridorGroups[corridor]||=[]).push(row);}
const corridorBase=Object.entries(corridorGroups).map(([name,rows])=>({name,total_listings:rows.length,total_reviews:rows.reduce((sum,row)=>sum+row.reviewsCount,0),reviews_per_listing:rows.length?rows.reduce((sum,row)=>sum+row.reviewsCount,0)/rows.length:0,traffic_peak_proxy:roadTraffic(name),category_counts:Object.fromEntries(Object.keys(concepts).map(key=>[key,rows.filter(row=>row.category===key).length]))})).filter(row=>row.total_listings>=2);
const trafficIndex=normalizeMap(Object.fromEntries(corridorBase.map(row=>[row.name,row.traffic_peak_proxy]))),corridorReviewIndex=normalizeMap(Object.fromEntries(corridorBase.map(row=>[row.name,Math.log10(row.total_reviews+1)]))),corridorVolumeIndex=normalizeMap(Object.fromEntries(corridorBase.map(row=>[row.name,row.total_listings])));
const corridors={};
for(const key of Object.keys(concepts)){
  const maxSupply=Math.max(1,...corridorBase.map(row=>row.category_counts[key]||0));
  corridors[key]=corridorBase.map(row=>{
    const categorySupply=row.category_counts[key]||0;
    const whiteSpace=clamp((1-categorySupply/maxSupply)*100);
    const demandBase=clamp((Number.isFinite(row.traffic_peak_proxy)?trafficIndex[row.name]:50)*.45+corridorReviewIndex[row.name]*.35+corridorVolumeIndex[row.name]*.20);
    const gapScore=clamp(demandBase*.70+whiteSpace*.30);
    const confidence=clamp((Number.isFinite(row.traffic_peak_proxy)?45:20)+(row.total_listings>=5?30:18)+(row.total_reviews>1000?25:12));
    return {...row,category:key,category_supply:categorySupply,white_space_score:whiteSpace,demand_base_score:demandBase,gap_score:gapScore,confidence_score:confidence,rationale:`${Number.isFinite(row.traffic_peak_proxy)?`Peak-count proxy ${Math.round(row.traffic_peak_proxy).toLocaleString('en-US')} vehicles`:'No official peak-count proxy'}; ${row.total_listings} relevant businesses; ${categorySupply} ${concepts[key].label.toLowerCase()} listings; ${Math.round(row.reviews_per_listing).toLocaleString('en-US')} reviews per listing.`};
  }).sort((a,b)=>b.gap_score-a.gap_score).slice(0,12);
}

const rawPerformance=Object.fromEntries(competitors.map((row,index)=>[String(index),(Number.isFinite(row.rating)?row.rating:3.5)*Math.log10(row.reviewsCount+10)]));
const performanceIndex=normalizeMap(rawPerformance);
const topBusinessSignals=competitors.map((row,index)=>({id:row.id,name:row.name,address:row.address,category:row.category,rating:row.rating,reviews_count:row.reviewsCount,corridor:corridorFor(row.address),google_maps_url:row.googleMapsUrl||'',website:row.website||'',performance_proxy:performanceIndex[String(index)]})).sort((a,b)=>b.performance_proxy-a.performance_proxy).slice(0,40);

const status=hasAnySearch?(hasAnyGeo?'complete':'partial — Tucson geographic search share unavailable'):'partial — Google Trends unavailable; review demand proxy used';
const output={updated_at:NOW,market:'Tucson, Arizona',status,methodology_version:'2.0',sources:[{name:'Google Trends via SerpApi',role:'Arizona search interest, Tucson/DMA share and related queries'},{name:'Stored Google Maps competitor snapshot',role:'Supply, rating and review-volume demand proxy',updated_at:competitorPayload.updated_at||null},{name:'Pima Association of Governments',role:'Published peak-period Tucson intersection counts'}],score_formula:{demand:'45% Arizona Google Trends + 35% reviews per listing + 20% Tucson/DMA search share; missing search layers use a neutral value and reduce confidence',opportunity:'65% demand + 35% inverse supply saturation',corridor_gap:'70% corridor demand evidence + 30% category white space'},caveats:['Google Trends is a relative index, not absolute search volume.','Review volume is a demand proxy, not audited revenue or verified foot traffic.','Traffic figures are published peak-period intersection proxies and do not cover every corridor.','A high score identifies what to test first; it does not prove that a store will succeed.'],errors,competitor_snapshot:{updated_at:competitorPayload.updated_at||null,analyzed_count:competitors.length},tucson_geo_match:tucsonGeo?{location:tucsonGeo.location||tucsonGeo.geo_name||'Tucson',geo:tucsonGeo.geo||null}:null,rankings,timeline,corridors,traffic_intersections:trafficIntersections,top_business_signals:topBusinessSignals};

await writeFile('docs/demand-data.json',`${JSON.stringify(output,null,2)}\n`,'utf8');
await writeFile('docs/demand-error.json',`${JSON.stringify({updated_at:NOW,status:errors.length?'completed_with_warnings':'success',errors},null,2)}\n`,'utf8');
console.log(`Demand v2 completed: ${competitors.length} qualified businesses, ${rankings.length} concepts, ${timeline.length} trend periods, status=${status}.`);
if(errors.length)console.warn(errors.join('\n'));
