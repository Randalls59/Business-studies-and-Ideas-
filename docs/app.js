const money = value => new Intl.NumberFormat('en-US', {style:'currency', currency:'USD', maximumFractionDigits:0}).format(Number(value)||0);
const money2 = value => new Intl.NumberFormat('en-US', {style:'currency', currency:'USD', minimumFractionDigits:2, maximumFractionDigits:2}).format(Number(value)||0);
const number = value => new Intl.NumberFormat('en-US', {maximumFractionDigits:1}).format(Number(value)||0);
const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
const byId = id => document.getElementById(id);

const state = {
  competitors: JSON.parse(localStorage.getItem('snapCompetitors') || '[]'),
  competitorScannedAt: localStorage.getItem('snapCompetitorsAt') || '',
  lands: [],
  filteredLands: [],
  prices: JSON.parse(localStorage.getItem('snapPrices') || '[]'),
  build: {},
  competitorMap: null,
  competitorLayer: null,
  landMap: null,
  landLayer: null
};

const viewTitles = {
  command:'Command Center', ask:'Ask SNAP', competitors:'Competitor Scan', pricing:'Price Lab', land:'Land Watch', build:'Build Model', sources:'Sources & Status'
};

function switchView(name){
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === `view-${name}`));
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  byId('pageTitle').textContent = viewTitles[name] || 'SNAP Intelligence';
  window.scrollTo({top:0,behavior:'smooth'});
  setTimeout(() => {
    if(name === 'competitors' && state.competitorMap) state.competitorMap.invalidateSize();
    if(name === 'land' && state.landMap) state.landMap.invalidateSize();
  },120);
}

document.querySelectorAll('#nav button,.jump').forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.view)));

function initMaps(){
  state.competitorMap = L.map('competitorMap',{scrollWheelZoom:false}).setView([32.2226,-110.9747],11);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(state.competitorMap);
  state.competitorLayer = L.layerGroup().addTo(state.competitorMap);

  state.landMap = L.map('landMap',{scrollWheelZoom:false}).setView([32.2226,-110.9747],10);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(state.landMap);
  state.landLayer = L.layerGroup().addTo(state.landMap);
}

function classifyCompetitor(tags={}){
  const text = `${tags.name||''} ${tags.amenity||''} ${tags.shop||''} ${tags.cuisine||''}`.toLowerCase();
  if(/juice|smoothie/.test(text)) return 'juice';
  if(/tea|boba|bubble/.test(text)) return 'tea';
  if(/breakfast|sandwich|bakery|bagel/.test(text)) return 'breakfast';
  return 'coffee';
}

function normalizeCompetitors(elements){
  const seen = new Set();
  const rows = [];
  elements.forEach(el => {
    const lat = el.lat || (el.center && el.center.lat);
    const lng = el.lon || (el.center && el.center.lon);
    if(!lat || !lng) return;
    const tags = el.tags || {};
    const name = tags.name || 'Unnamed listing';
    const key = `${name}|${Number(lat).toFixed(4)}|${Number(lng).toFixed(4)}`;
    if(seen.has(key)) return;
    seen.add(key);
    rows.push({
      id:key,
      name,
      lat:Number(lat),
      lng:Number(lng),
      category:classifyCompetitor(tags),
      subtype:tags.cuisine || tags.shop || tags.amenity || 'beverage venue',
      website:tags.website || tags['contact:website'] || '',
      phone:tags.phone || tags['contact:phone'] || '',
      openingHours:tags.opening_hours || '',
      driveThrough:tags.drive_through || 'unknown',
      address:[tags['addr:housenumber'],tags['addr:street']].filter(Boolean).join(' ')
    });
  });
  return rows.sort((a,b)=>a.name.localeCompare(b.name));
}

async function scanTucsonCompetitors(){
  const btn = byId('scanCityBtn');
  btn.disabled = true;
  btn.textContent = 'Scanning Tucson…';
  byId('competitorStatus').textContent = 'Querying open data…';
  const bbox = '31.98,-111.22,32.43,-110.64';
  const query = `[out:json][timeout:70];(
    nwr["amenity"="cafe"](${bbox});
    nwr["shop"="coffee"](${bbox});
    nwr["shop"="tea"](${bbox});
    nwr["shop"="beverages"](${bbox});
    nwr["cuisine"~"juice|smoothie|bubble_tea|coffee_shop|breakfast|bagel|sandwich",i](${bbox});
    nwr["amenity"="fast_food"]["cuisine"~"breakfast|coffee_shop|juice|smoothie|bagel|sandwich",i](${bbox});
  );out center tags;`;
  try{
    const response = await fetch('https://overpass-api.de/api/interpreter',{method:'POST',body:query,headers:{'Content-Type':'text/plain'}});
    if(!response.ok) throw new Error(`Open-data response ${response.status}`);
    const data = await response.json();
    state.competitors = normalizeCompetitors(data.elements || []);
    state.competitorScannedAt = new Date().toISOString();
    localStorage.setItem('snapCompetitors',JSON.stringify(state.competitors));
    localStorage.setItem('snapCompetitorsAt',state.competitorScannedAt);
    renderCompetitors();
    byId('competitorStatus').textContent = `${state.competitors.length} listings · just updated`;
    byId('liveStatus').textContent = 'Tucson scan updated';
  }catch(error){
    console.error(error);
    byId('competitorStatus').textContent = 'Scan unavailable—try again';
    alert('The live Tucson scan could not load right now. The rest of the dashboard still works.');
  }finally{
    btn.disabled = false;
    btn.textContent = 'Scan Tucson now';
  }
}

function competitorFiltered(){
  const term = (byId('competitorSearch').value || '').trim().toLowerCase();
  const category = byId('competitorCategory').value;
  return state.competitors.filter(item => {
    const matchesCategory = category === 'all' || item.category === category;
    const matchesTerm = !term || `${item.name} ${item.subtype} ${item.address}`.toLowerCase().includes(term);
    return matchesCategory && matchesTerm;
  });
}

function renderCompetitors(){
  const rows = competitorFiltered();
  const totals = state.competitors.reduce((acc,item)=>{acc[item.category]=(acc[item.category]||0)+1;return acc;},{});
  byId('compTotal').textContent = state.competitors.length || '—';
  byId('compCoffee').textContent = totals.coffee || 0;
  byId('compJuice').textContent = totals.juice || 0;
  byId('compTea').textContent = totals.tea || 0;
  byId('kpiCompetitors').textContent = state.competitors.length ? number(state.competitors.length) : 'Not scanned';
  if(state.competitorScannedAt) byId('competitorStatus').textContent = `${state.competitors.length} listings · ${new Date(state.competitorScannedAt).toLocaleDateString('en-US')}`;

  state.competitorLayer.clearLayers();
  rows.forEach(item => {
    const color = item.category === 'juice' ? '#2f855a' : item.category === 'tea' ? '#7b4bb7' : item.category === 'breakfast' ? '#f26a2e' : '#155e75';
    L.circleMarker([item.lat,item.lng],{radius:5,color,fillColor:color,fillOpacity:.72,weight:1.5})
      .addTo(state.competitorLayer)
      .bindPopup(`<b>${escapeHtml(item.name)}</b><br>${escapeHtml(item.subtype)}${item.driveThrough!=='unknown'?`<br>Drive-through: ${escapeHtml(item.driveThrough)}`:''}`);
  });

  byId('competitorList').innerHTML = rows.length ? rows.slice(0,350).map(item => `
    <div class="list-item">
      <b>${escapeHtml(item.name)}</b>
      <small>${labelCategory(item.category)} · ${escapeHtml(item.subtype)}${item.driveThrough!=='unknown'?` · drive-through ${escapeHtml(item.driveThrough)}`:''}</small>
      ${item.website ? `<div><a href="${safeUrl(item.website)}" target="_blank" rel="noreferrer">Official website</a></div>` : ''}
    </div>`).join('') : '<div class="empty">No listings match the current filters.</div>';
  calculateDashboardScore();
}

function labelCategory(value){
  return ({coffee:'Coffee / cafe',juice:'Juice / smoothie',tea:'Tea / boba',breakfast:'Fast breakfast'})[value] || value;
}

async function loadLandData(){
  try{
    const response = await fetch(`land-data.json?v=${Date.now()}`);
    if(!response.ok) throw new Error('Land feed unavailable');
    const data = await response.json();
    state.lands = data.listings || [];
    byId('landUpdated').textContent = `Updated ${new Date(data.updated_at).toLocaleDateString('en-US')}`;
    byId('kpiLand').textContent = state.lands.length;
    applyLandFilters();
  }catch(error){
    console.error(error);
    byId('landUpdated').textContent = 'Land feed unavailable';
    byId('landCards').innerHTML = '<div class="notice error">The repository land feed could not be loaded. Refresh the page in a moment.</div>';
  }
}

function lotSqft(land){
  return land.lot_unit === 'Acres' ? Number(land.lot_size)*43560 : Number(land.lot_size);
}

function applyLandFilters(){
  const maxPrice = Number(byId('landMaxPrice').value) || Infinity;
  const minSqft = Number(byId('landMinSqft').value) || 0;
  const sort = byId('landSort').value;
  state.filteredLands = state.lands.filter(l => Number(l.price) <= maxPrice && lotSqft(l) >= minSqft);
  state.filteredLands.sort((a,b)=>{
    if(sort === 'hold') return b.hold_score-a.hold_score;
    if(sort === 'price') return a.price-b.price;
    if(sort === 'size') return lotSqft(b)-lotSqft(a);
    return b.site_score-a.site_score;
  });
  renderLands(maxPrice);
}

function scoreClass(score){return score>=75?'high':score>=60?'mid':'low'}

function renderLands(maxPrice){
  const all = state.lands;
  const filtered = state.filteredLands;
  byId('landCount').textContent = all.length;
  byId('landUnderCap').textContent = all.filter(l=>l.price<=maxPrice).length;
  byId('landTopSite').textContent = all.length ? `${Math.max(...all.map(l=>l.site_score))}/100` : '—';
  byId('landTopHold').textContent = all.length ? `${Math.max(...all.map(l=>l.hold_score))}/100` : '—';
  state.landLayer.clearLayers();
  filtered.forEach(land => {
    const color = land.site_score >= 75 ? '#2f855a' : land.site_score >= 60 ? '#f26a2e' : '#b83232';
    L.circleMarker([land.lat,land.lng],{radius:8,color,fillColor:color,fillOpacity:.78,weight:2}).addTo(state.landLayer)
      .bindPopup(`<b>${escapeHtml(land.address)}</b><br>${money(land.price)} · ${number(land.lot_size)} ${escapeHtml(land.lot_unit)}<br>Site ${land.site_score}/100 · Hold ${land.hold_score}/100`);
  });
  if(filtered.length){
    const bounds = L.latLngBounds(filtered.map(l=>[l.lat,l.lng]));
    state.landMap.fitBounds(bounds.pad(.15));
  }
  byId('landCards').innerHTML = filtered.length ? filtered.map(land => `
    <article class="land-card">
      <div class="price">${money(land.price)}</div>
      <h3>${escapeHtml(land.address)}</h3>
      <div class="land-meta"><span>${number(land.lot_size)} ${escapeHtml(land.lot_unit)}</span><span>${escapeHtml(land.corridor)}</span><span>Zoning: ${escapeHtml(land.zoning)}</span></div>
      <p>${escapeHtml(land.note)}</p>
      <div class="land-actions">
        <span class="score-chip ${scoreClass(land.site_score)}">Site ${land.site_score}</span>
        <span class="score-chip ${scoreClass(land.hold_score)}">Hold ${land.hold_score}</span>
      </div>
      <div class="land-actions" style="margin-top:10px">
        <a href="${safeUrl(land.url)}" target="_blank" rel="noreferrer">Open listing</a>
        <button class="secondary use-land" data-price="${land.price}">Use price in build model</button>
      </div>
    </article>`).join('') : '<div class="notice">No watchlist parcels meet the current price and lot-size filters.</div>';
  document.querySelectorAll('.use-land').forEach(btn => btn.addEventListener('click',()=>{
    byId('landPurchase').value = btn.dataset.price;
    calculateBuild();
    switchView('build');
  }));
  calculateDashboardScore();
}

function savePrices(){localStorage.setItem('snapPrices',JSON.stringify(state.prices));}
function median(values){
  const rows=[...values].sort((a,b)=>a-b); if(!rows.length) return null;
  const mid=Math.floor(rows.length/2); return rows.length%2?rows[mid]:(rows[mid-1]+rows[mid])/2;
}
function quantile(values,q){
  const rows=[...values].sort((a,b)=>a-b); if(!rows.length) return null;
  const pos=(rows.length-1)*q,base=Math.floor(pos),rest=pos-base;
  return rows[base+1]!==undefined?rows[base]+rest*(rows[base+1]-rows[base]):rows[base];
}
function renderPrices(){
  byId('priceEntryCount').textContent=state.prices.length;
  const latte=state.prices.filter(p=>['latte','iced-latte'].includes(p.category)).map(p=>Number(p.price));
  const cold=state.prices.filter(p=>['iced-latte','cold-brew','juice','smoothie','tea'].includes(p.category)).map(p=>Number(p.price));
  byId('medianLatte').textContent=latte.length?money2(median(latte)):'Need data';
  byId('medianCold').textContent=cold.length?money2(median(cold)):'Need data';
  byId('priceTableBody').innerHTML=state.prices.length?state.prices.map((p,index)=>`<tr>
    <td>${escapeHtml(p.business)}</td><td>${escapeHtml(labelPriceCategory(p.category))}</td><td>${p.size} oz</td><td>${money2(p.price)}</td><td>${money2(p.price/p.size)}</td><td>${escapeHtml(p.date||'—')}</td><td>${p.url?`<a href="${safeUrl(p.url)}" target="_blank" rel="noreferrer">Open</a>`:'—'}</td><td><button class="danger remove-price" data-index="${index}">Delete</button></td>
  </tr>`).join(''):'<tr><td colspan="8"><div class="empty">No verified competitor prices yet.</div></td></tr>';
  document.querySelectorAll('.remove-price').forEach(btn=>btn.addEventListener('click',()=>{state.prices.splice(Number(btn.dataset.index),1);savePrices();renderPrices();}));
}
function labelPriceCategory(value){return ({latte:'Latte','iced-latte':'Iced latte','cold-brew':'Cold brew',coffee:'Drip coffee',juice:'Juice',smoothie:'Smoothie',tea:'Tea / boba',sandwich:'Breakfast sandwich',combo:'Combo'})[value]||value;}

function handlePriceSubmit(event){
  event.preventDefault();
  state.prices.push({
    business:byId('priceBusiness').value.trim(),category:byId('priceCategory').value,size:Number(byId('priceSize').value),price:Number(byId('priceAmount').value),url:byId('priceUrl').value.trim(),date:byId('priceDate').value,notes:byId('priceNotes').value.trim()
  });
  savePrices();renderPrices();event.target.reset();byId('priceSize').value=16;byId('priceDate').value=new Date().toISOString().slice(0,10);
}

const buildInputIds=['buildSqft','lowPsf','highPsf','landPurchase','siteWork','equipment','softCosts','driveThrough','opening','workingCapital','dailyCustomers','averageTicket','operatingDays','cogsPercent','monthlyLabor','monthlyOccupancy','monthlyOther','ownerSalary'];

function val(id){return Number(byId(id).value)||0;}
function calculateBuild(){
  const sqft=val('buildSqft'),lowPsf=val('lowPsf'),highPsf=val('highPsf');
  const lowConstruction=sqft*lowPsf,highConstruction=sqft*highPsf;
  const land=val('landPurchase'),site=val('siteWork'),equipment=val('equipment'),soft=val('softCosts'),drive=val('driveThrough'),opening=val('opening'),working=val('workingCapital');
  const lowContingency=(lowConstruction+site+equipment+soft+drive)*.10;
  const highContingency=(highConstruction+site+equipment+soft+drive)*.10;
  const lowTotal=land+lowConstruction+site+equipment+soft+drive+opening+working+lowContingency;
  const highTotal=land+highConstruction+site+equipment+soft+drive+opening+working+highContingency;
  const customers=val('dailyCustomers'),ticket=val('averageTicket'),days=val('operatingDays'),cogs=val('cogsPercent')/100;
  const revenue=customers*ticket*days;
  const fixed=val('monthlyLabor')+val('monthlyOccupancy')+val('monthlyOther')+val('ownerSalary');
  const profit=revenue-(revenue*cogs)-fixed;
  const contribution=ticket*(1-cogs);
  const breakEven=contribution>0&&days>0?fixed/(contribution*days):Infinity;
  const payback=profit>0?lowTotal/profit:Infinity;
  state.build={sqft,lowPsf,highPsf,lowConstruction,highConstruction,lowTotal,highTotal,revenue,profit,breakEven,payback,customers,ticket};

  byId('buildSqftOut').textContent=`${number(sqft)} sq ft`;
  byId('lowPsfOut').textContent=`${money(lowPsf)}`;
  byId('highPsfOut').textContent=`${money(highPsf)}`;
  byId('lowProjectTotal').textContent=money(lowTotal);
  byId('highProjectTotal').textContent=money(highTotal);
  byId('constructionOnly').textContent=`${money(lowConstruction)}–${money(highConstruction)}`;
  byId('monthlyRevenue').textContent=money(revenue);
  byId('monthlyProfit').textContent=money(profit);
  byId('buildBreakEven').textContent=isFinite(breakEven)?Math.ceil(breakEven):'—';
  byId('paybackMonths').textContent=isFinite(payback)?`${payback.toFixed(1)} mo`:'Not reached';
  byId('kpiBuild').textContent=`${money(lowConstruction)}–${money(highConstruction)}`;
  byId('kpiBreakEven').textContent=isFinite(breakEven)?Math.ceil(breakEven):'—';
  byId('targetTicketPrice').textContent=money2(ticket);
  const parts=[
    ['Land',land],['Construction — low case',lowConstruction],['Site work & utilities',site],['Kitchen & coffee equipment',equipment],['Design, permits & professional',soft],['Drive-through, signage & exterior',drive],['Opening marketing & inventory',opening],['Working capital',working],['Low-case contingency',lowContingency]
  ];
  const max=Math.max(...parts.map(p=>p[1]),1);
  byId('costBreakdown').innerHTML=parts.map(([label,amount])=>`<div class="break-row"><div><span>${escapeHtml(label)}</span><div class="bar-shell"><div class="bar" style="width:${Math.max(2,amount/max*100)}%"></div></div></div><b>${money(amount)}</b></div>`).join('');
  calculateDashboardScore();
}

function calculateDashboardScore(){
  if(!state.build.profit) return;
  const economics=clamp(48+state.build.profit/650,0,100);
  const breakEvenScore=clamp(105-state.build.breakEven*.35,0,100);
  const landScore=state.lands.length?Math.max(...state.lands.map(l=>l.site_score)):55;
  const marketScore=state.competitors.length?72:50;
  const evidencePenalty=10;
  const score=Math.round(economics*.34+breakEvenScore*.24+landScore*.20+marketScore*.12+78*.10-evidencePenalty);
  byId('commandScore').textContent=clamp(score,0,100);
  let verdict,reason,path;
  if(state.build.profit>=25000 && state.build.breakEven<=140){
    verdict='TEST → LEAN SITE';reason='The economics can support further validation, but paid demand and site diligence are still missing.';path='Pop-up → second-gen';
  }else if(state.build.profit>0){
    verdict='TEST FIRST';reason='The model is positive, but the margin is not strong enough to justify ground-up risk without customer proof.';path='Pop-up → optimize';
  }else{
    verdict='REWORK MODEL';reason='Current costs and traffic assumptions do not produce a safe operating margin.';path='Lower cost / raise ticket';
  }
  byId('commandVerdict').textContent=verdict;
  byId('commandReason').textContent=reason;
  byId('kpiPath').textContent=path;
}

function buildContext(){
  const topLand=[...state.lands].sort((a,b)=>b.site_score-a.site_score).slice(0,5);
  const priceGroups={};
  state.prices.forEach(p=>(priceGroups[p.category]||(priceGroups[p.category]=[])).push(Number(p.price)));
  return {
    build:state.build,
    competitorCount:state.competitors.length,
    competitorCategories:state.competitors.reduce((a,c)=>{a[c.category]=(a[c.category]||0)+1;return a;},{}),
    topLand,
    priceMedians:Object.fromEntries(Object.entries(priceGroups).map(([k,v])=>[k,median(v)])),
    missing:['paid pop-up demand','official zoning','drive-through entitlement','traffic counts by parcel','utility and site-work quotes','verified local menu-price sample']
  };
}

function localAnswer(question){
  const q=question.toLowerCase();
  const context=buildContext();
  const moneyMatch=q.match(/under\s*\$?([\d,.]+)\s*(k)?/i);
  if(/land|parcel|lot/.test(q)){
    let rows=[...state.lands];
    if(moneyMatch){let cap=Number(moneyMatch[1].replace(/,/g,''));if(moneyMatch[2])cap*=1000;rows=rows.filter(l=>l.price<=cap);}
    if(/best|promising|recommend|show/.test(q)) rows.sort((a,b)=>b.site_score-a.site_score);
    if(/hold|appreciat|investment/.test(q)) rows.sort((a,b)=>b.hold_score-a.hold_score);
    if(!rows.length) return 'I do not have a watchlist parcel that matches that price threshold. Open Land Watch and raise the cap or reduce the minimum lot size.';
    const top=rows.slice(0,5);
    const intro=moneyMatch?`I found ${rows.length} watchlist parcels under ${money(Number(moneyMatch[1].replace(/,/g,''))*(moneyMatch[2]?1000:1))}.`:`The strongest current watchlist candidates are:`;
    return `${intro}\n\n${top.map((l,i)=>`${i+1}. ${l.address} — ${money(l.price)}, ${number(l.lot_size)} ${l.lot_unit}. Site score ${l.site_score}; hold score ${l.hold_score}. ${l.note}`).join('\n\n')}\n\nImportant: zoning, utilities, access and drive-through rights are still unverified.`;
  }
  if(/build|construction|square foot|sq ft|startup|cost/.test(q)){
    return `At the current inputs, ${number(context.build.sqft)} square feet at ${money(context.build.lowPsf)}–${money(context.build.highPsf)} per square foot produces construction-only costs of ${money(context.build.lowConstruction)}–${money(context.build.highConstruction)}.\n\nAfter land, site work, equipment, professional costs, drive-through work, opening costs, working capital and a 10% contingency, the current total project range is ${money(context.build.lowTotal)}–${money(context.build.highTotal)}. Open Build Model to change any number.`;
  }
  if(/break.?even|customers|traffic|orders/.test(q)){
    return `The current operating model needs about ${Math.ceil(context.build.breakEven)} customers per day to break even. At ${number(context.build.customers)} customers per day and a ${money2(context.build.ticket)} average ticket, modeled monthly revenue is ${money(context.build.revenue)} and operating profit is ${money(context.build.profit)} before debt service, taxes and depreciation.`;
  }
  if(/competitor|coffee shop|cafe|smoothie|juice|boba|tea/.test(q)){
    if(!context.competitorCount) return 'The Tucson competitor scan has not been run in this browser yet. Open Competitor Scan and click “Scan Tucson now.”';
    const cats=context.competitorCategories;
    return `The latest open-data scan in this browser contains ${context.competitorCount} Tucson-area listings: ${cats.coffee||0} coffee/cafe, ${cats.juice||0} juice/smoothie, ${cats.tea||0} tea/boba and ${cats.breakfast||0} fast-breakfast listings. Use the Competitor Scan filters to inspect names, locations, websites and drive-through tags.`;
  }
  if(/price|menu|latte|cold brew|smoothie/.test(q)){
    if(!state.prices.length) return 'There are no verified Tucson menu observations in Price Lab yet, so I will not invent a market average. Add official menu prices and the dashboard will calculate medians and price-per-ounce.';
    const latte=state.prices.filter(p=>['latte','iced-latte'].includes(p.category)).map(p=>p.price);
    const cold=state.prices.filter(p=>['iced-latte','cold-brew','juice','smoothie','tea'].includes(p.category)).map(p=>p.price);
    return `Price Lab currently contains ${state.prices.length} verified entries. ${latte.length?`The latte median is ${money2(median(latte))}; the middle 50% runs from ${money2(quantile(latte,.25))} to ${money2(quantile(latte,.75))}.`:'There are not enough latte observations yet.'} ${cold.length?`The current cold-drink median is ${money2(median(cold))}.`:'There are not enough cold-drink observations yet.'}`;
  }
  if(/where|location|area|neighborhood|test first/.test(q)){
    return 'My current launch recommendation is not to buy land first. Test paid demand near University/Main Gate and Fourth Avenue, then compare a compact second-generation site on a vehicle corridor such as Grant, Speedway, Broadway, Oracle or Campbell. The final site decision needs parcel traffic, access, zoning, utilities, competitor density and rent or land cost on the same scorecard.';
  }
  if(/missing|next|need|risk|unknown/.test(q)){
    return `The biggest missing evidence is:\n\n1. Paid pop-up demand and repeat intent\n2. Official zoning and drive-through entitlement\n3. Parcel-level traffic, ingress and egress\n4. Utility and site-work quotes\n5. A verified Tucson menu-price sample\n6. A contractor budget that separates second-generation, raw-shell and ground-up cases\n\nThe system can organize these inputs, but it should not pretend they are already proven.`;
  }
  if(/ai|connect|generative/.test(q)){
    return localStorage.getItem('snapAiEndpoint') ? 'A secure AI backend URL is saved. I will try that connection for future questions and fall back to the local data assistant if it is unavailable.' : 'The local data assistant works now. Full generative AI requires a secure server endpoint so the API key is never exposed in the public GitHub Pages website.';
  }
  return 'I can currently answer from the land watchlist, Tucson competitor scan, verified Price Lab entries and the build model. Ask about land under a price, build cost, break-even traffic, competitors, pricing, the best test area or missing diligence. Full open-ended generative AI is ready to connect through a secure backend.';
}

async function askSnap(question){
  const endpoint=localStorage.getItem('snapAiEndpoint');
  if(endpoint){
    try{
      const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question,context:buildContext()})});
      if(response.ok){const data=await response.json();if(data.answer)return data.answer;}
    }catch(error){console.warn('Secure AI endpoint unavailable; using local assistant.',error);}
  }
  return localAnswer(question);
}

function addBubble(text,type){
  const bubble=document.createElement('div');bubble.className=`bubble ${type}`;bubble.textContent=text;byId('chatLog').appendChild(bubble);byId('chatLog').scrollTop=byId('chatLog').scrollHeight;
}
async function handleChat(event){
  event.preventDefault();
  const question=byId('chatInput').value.trim();if(!question)return;
  addBubble(question,'user');byId('chatInput').value='';
  const loading=document.createElement('div');loading.className='bubble bot';loading.textContent='Reading the dashboard data…';byId('chatLog').appendChild(loading);
  const answer=await askSnap(question);loading.textContent=answer;byId('chatLog').scrollTop=byId('chatLog').scrollHeight;
}

function setupSpeech(){
  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!Recognition){byId('micBtn').disabled=true;byId('micBtn').title='Voice input is not supported in this browser';return;}
  const recognition=new Recognition();recognition.lang='en-US';recognition.interimResults=false;
  recognition.onresult=event=>{byId('chatInput').value=event.results[0][0].transcript;byId('chatInput').focus();};
  recognition.onstart=()=>{byId('micBtn').textContent='●';};
  recognition.onend=()=>{byId('micBtn').textContent='🎙';};
  byId('micBtn').addEventListener('click',()=>recognition.start());
}

function escapeHtml(value=''){return String(value).replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));}
function safeUrl(value=''){try{const url=new URL(value,window.location.href);return ['http:','https:'].includes(url.protocol)?url.href:'#';}catch{return '#';}}

byId('scanCityBtn').addEventListener('click',scanTucsonCompetitors);
byId('competitorSearch').addEventListener('input',renderCompetitors);
byId('competitorCategory').addEventListener('change',renderCompetitors);
byId('applyLandFilters').addEventListener('click',applyLandFilters);
byId('priceForm').addEventListener('submit',handlePriceSubmit);
byId('clearPricesBtn').addEventListener('click',()=>{if(confirm('Clear all saved Price Lab entries from this browser?')){state.prices=[];savePrices();renderPrices();}});
buildInputIds.forEach(id=>byId(id).addEventListener('input',calculateBuild));
byId('chatForm').addEventListener('submit',handleChat);
document.querySelectorAll('.prompt').forEach(btn=>btn.addEventListener('click',()=>{byId('chatInput').value=btn.textContent;byId('chatForm').requestSubmit();}));
byId('refreshAllBtn').addEventListener('click',async()=>{byId('refreshAllBtn').disabled=true;await loadLandData();if(state.competitors.length)renderCompetitors();byId('refreshAllBtn').disabled=false;byId('liveStatus').textContent='Repository data refreshed';});

const aiModal=byId('aiModal');
byId('aiSettingsBtn').addEventListener('click',()=>{byId('aiEndpointInput').value=localStorage.getItem('snapAiEndpoint')||'';aiModal.classList.add('open');});
byId('closeAiModal').addEventListener('click',()=>aiModal.classList.remove('open'));
byId('saveAiEndpoint').addEventListener('click',()=>{const value=byId('aiEndpointInput').value.trim();if(value)localStorage.setItem('snapAiEndpoint',value);else localStorage.removeItem('snapAiEndpoint');aiModal.classList.remove('open');updateAiStatus();});
function updateAiStatus(){const connected=Boolean(localStorage.getItem('snapAiEndpoint'));byId('aiStatusTag').textContent=connected?'Connected':'Ready';byId('aiStatusTag').className=connected?'tag-live':'tag-ready';}

function initialize(){
  byId('priceDate').value=new Date().toISOString().slice(0,10);
  initMaps();renderPrices();calculateBuild();loadLandData();setupSpeech();updateAiStatus();
  if(state.competitors.length)renderCompetitors();
}
initialize();
