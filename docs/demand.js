(() => {
  viewTitles.demand = 'Demand Lab';
  const colors = { coffee:'#49c6ff', juice:'#55e6a5', tea:'#a78bfa', breakfast:'#ff7a45' };
  const labels = { coffee:'Coffee / café', juice:'Juice / smoothie', tea:'Tea / boba', breakfast:'Fast breakfast' };
  let demandData = null;
  let selectedConcept = 'juice';
  let rankMode = 'opportunity';

  const nav = document.getElementById('nav');
  const button = document.createElement('button');
  button.dataset.view = 'demand';
  button.innerHTML = '<span class="icon">⌁</span><span>Demand Lab</span>';
  const pricingButton = [...nav.children].find(item => item.dataset.view === 'pricing');
  nav.insertBefore(button, pricingButton || null);
  button.addEventListener('click', () => switchView('demand'));

  const section = document.createElement('section');
  section.className = 'view';
  section.id = 'view-demand';
  section.innerHTML = `
    <div class="demand-hero">
      <div class="demand-hero-main">
        <span class="demand-kicker">Search demand × review activity × supply</span>
        <h2 id="demandHeroTitle">Building the demand thesis</h2>
        <p id="demandHeroText">The system is loading Arizona search interest, Tucson competitor activity and corridor evidence. Every score is a decision aid, not a promise of revenue.</p>
        <div class="demand-toolbar" style="margin-top:20px">
          <button class="primary" id="refreshDemandBtn">Refresh stored demand data</button>
          <span class="status-pill" id="demandStatus">Loading demand feed…</span>
        </div>
      </div>
      <div class="panel demand-verdict-card">
        <div class="demand-score-ring" id="demandScoreRing"><div><strong id="demandHeroScore">—</strong><span>opportunity</span></div></div>
        <h3 id="demandHeroVerdict">Waiting for data</h3>
        <p id="demandHeroConfidence">Confidence will appear after the first secure SerpApi workflow run.</p>
      </div>
    </div>

    <div class="grid demand-kpis">
      <div class="card"><span>Demand leader</span><strong id="demandLeader">—</strong><small>Highest demand score</small></div>
      <div class="card"><span>Opportunity leader</span><strong id="opportunityLeader">—</strong><small>Demand adjusted for supply</small></div>
      <div class="card"><span>Businesses analyzed</span><strong id="demandBusinessCount">—</strong><small>Ratings and review signals</small></div>
      <div class="card"><span>Trend periods</span><strong id="trendPeriodCount">—</strong><small>Arizona search-interest history</small></div>
      <div class="card"><span>Best corridor gap</span><strong id="bestCorridorGap">—</strong><small>Current selected concept</small></div>
    </div>

    <div class="panel">
      <div class="demand-toolbar">
        <div><h3 style="margin:0">Concept ranking</h3><p style="margin:4px 0 0">Demand, saturation and opportunity are separated so a low business count is not mistaken for strong demand.</p></div>
        <span class="grow"></span>
        <label>Rank by <select id="demandRankMode"><option value="opportunity">Opportunity</option><option value="demand">Demand</option><option value="saturation">Lowest saturation</option><option value="confidence">Confidence</option></select></label>
      </div>
      <div class="demand-table-wrap" style="margin-top:14px"><table class="demand-table"><thead><tr><th>Rank</th><th>Concept</th><th>Demand</th><th>Supply</th><th>Saturation</th><th>Reviews / listing</th><th>AZ search</th><th>Tucson share</th><th>Opportunity</th><th>Confidence</th><th>Verdict</th></tr></thead><tbody id="demandRankingRows"></tbody></table></div>
    </div>

    <div class="section-head"><div><h2>Demand versus supply</h2></div><p>The upper-left quadrant is the most interesting: stronger demand with lower relative saturation.</p></div>
    <div class="demand-grid-2">
      <div class="panel"><div class="quadrant" id="demandQuadrant"><span class="quadrant-label ql-top">Higher demand</span><span class="quadrant-label ql-bottom">Lower demand</span><span class="quadrant-label ql-left">Less saturated</span><span class="quadrant-label ql-right">More saturated</span></div></div>
      <div class="panel trend-panel"><div class="demand-toolbar"><div><h3 style="margin:0">Search interest over time</h3><p style="margin:4px 0 0">Relative Google Trends index for Arizona; 100 is the peak within the comparison.</p></div></div><svg id="demandTrendChart" class="trend-chart" viewBox="0 0 760 390" preserveAspectRatio="none"></svg><div class="trend-legend" id="trendLegend"></div></div>
    </div>

    <div class="section-head"><div><h2>Corridor demand gaps</h2></div><p>Ranks major Tucson roads using official peak-traffic proxies, review activity and category white space.</p></div>
    <div class="panel">
      <div class="demand-toolbar"><label>Concept <select id="corridorConcept"><option value="coffee">Coffee / café</option><option value="juice" selected>Juice / smoothie</option><option value="tea">Tea / boba</option><option value="breakfast">Fast breakfast</option></select></label><span class="grow"></span><span class="status-pill">Traffic source: PAG published peak counts</span></div>
      <div class="demand-table-wrap" style="margin-top:14px"><table class="demand-table corridor-table"><thead><tr><th>Rank</th><th>Corridor</th><th>Gap score</th><th>Peak traffic proxy</th><th>Category supply</th><th>All relevant businesses</th><th>Reviews / listing</th><th>Confidence</th><th>Why it ranks</th></tr></thead><tbody id="corridorRows"></tbody></table></div>
    </div>

    <div class="section-head"><div><h2>Competitor demand signals</h2></div><p>This is a review-and-rating performance proxy—not revenue, transactions or verified foot traffic.</p></div>
    <div class="panel">
      <div class="demand-toolbar"><label>Show <select id="businessConcept"><option value="all">All concepts</option><option value="coffee">Coffee / café</option><option value="juice">Juice / smoothie</option><option value="tea">Tea / boba</option><option value="breakfast">Fast breakfast</option></select></label><span class="grow"></span><button class="secondary" id="openCompetitorScan">Open full competitor map</button></div>
      <div class="demand-table-wrap" style="margin-top:14px"><table class="demand-table"><thead><tr><th>Rank</th><th>Business</th><th>Concept</th><th>Rating</th><th>Reviews</th><th>Demand proxy</th><th>Corridor</th><th>Links</th></tr></thead><tbody id="businessSignalRows"></tbody></table></div>
    </div>

    <div class="section-head"><div><h2>What people are searching for</h2></div><p>Related Google Trends queries reveal product language and rising themes worth testing in ads and pop-ups.</p></div>
    <div class="related-grid" id="relatedQueryCards"></div>

    <div class="section-head"><div><h2>How the verdict is built</h2></div><p>Recommendation first, evidence underneath, uncertainty kept visible.</p></div>
    <div class="demand-grid-3">
      <div class="method-card"><b>Demand score</b><p>45% Arizona search-interest index, 35% reviews per listing and 20% Tucson/DMA search share.</p></div>
      <div class="method-card"><b>Opportunity score</b><p>65% demand score plus 35% inverse saturation. Low supply alone cannot win.</p></div>
      <div class="method-card"><b>Corridor gap</b><p>70% corridor demand evidence plus 30% category white space along that road.</p></div>
    </div>
    <div class="demand-warning" id="demandCaveats">Loading methodology notes…</div>`;
  const pricingView = document.getElementById('view-pricing');
  pricingView.parentNode.insertBefore(section, pricingView);

  function fmt(value, digits = 0) {
    return Number.isFinite(Number(value)) ? Number(value).toLocaleString('en-US', { maximumFractionDigits: digits }) : '—';
  }
  function verdictClass(verdict = '') {
    const text = verdict.toLowerCase();
    if (text.includes('test')) return 'go';
    if (text.includes('promising')) return 'promising';
    if (text.includes('validate')) return 'validate';
    if (text.includes('crowded')) return 'crowded';
    return 'low';
  }
  function scoreBar(value, saturation = false) {
    const safe = Math.max(0, Math.min(100, Number(value) || 0));
    return `<div class="score-bar"><div class="score-bar-head"><span>${safe}</span><span>/100</span></div><div class="score-bar-track"><div class="score-bar-fill ${saturation ? 'saturation-fill' : ''}" style="width:${safe}%"></div></div></div>`;
  }
  function sortedRankings() {
    if (!demandData) return [];
    const rows = [...demandData.rankings];
    if (rankMode === 'demand') rows.sort((a,b) => b.demand_score-a.demand_score);
    else if (rankMode === 'saturation') rows.sort((a,b) => a.saturation_score-b.saturation_score);
    else if (rankMode === 'confidence') rows.sort((a,b) => b.confidence_score-a.confidence_score);
    else rows.sort((a,b) => b.opportunity_score-a.opportunity_score);
    return rows;
  }
  function renderRankings() {
    const rows = sortedRankings();
    byId('demandRankingRows').innerHTML = rows.map((row,index) => `<tr>
      <td><span class="demand-rank">${index+1}</span></td>
      <td class="demand-concept"><strong>${escapeHtml(row.label)}</strong><small>${fmt(row.total_reviews)} captured reviews</small></td>
      <td>${scoreBar(row.demand_score)}</td>
      <td><b>${fmt(row.supply_count)}</b><span class="proxy-note">listings</span></td>
      <td>${scoreBar(row.saturation_score,true)}</td>
      <td><b>${fmt(row.reviews_per_listing)}</b><span class="proxy-note">median ${fmt(row.median_reviews)}</span></td>
      <td><b>${fmt(row.search_average,1)}</b><span class="proxy-note">relative average</span></td>
      <td><b>${fmt(row.tucson_search_share,1)}${Number.isFinite(row.tucson_search_share)?'%':''}</b><span class="proxy-note">within comparison</span></td>
      <td>${scoreBar(row.opportunity_score)}</td>
      <td><span class="confidence-chip">${fmt(row.confidence_score)}/100</span></td>
      <td><span class="demand-pill ${verdictClass(row.verdict)}">${escapeHtml(row.verdict)}</span></td>
    </tr>`).join('');
  }
  function renderQuadrant() {
    const target = byId('demandQuadrant');
    target.querySelectorAll('.quadrant-point').forEach(node => node.remove());
    demandData.rankings.forEach(row => {
      const point = document.createElement('button');
      point.type = 'button';
      point.className = 'quadrant-point';
      point.style.left = `${10 + row.saturation_score * .8}%`;
      point.style.bottom = `${9 + row.demand_score * .78}%`;
      point.style.borderColor = `${colors[row.key]}66`;
      point.innerHTML = `<b style="color:${colors[row.key]}">${escapeHtml(row.label)}</b><span>Demand ${row.demand_score} · Supply ${row.saturation_score}</span>`;
      point.addEventListener('click', () => { selectedConcept = row.key; byId('corridorConcept').value=row.key; renderCorridors(); });
      target.appendChild(point);
    });
  }
  function renderTrend() {
    const svg = byId('demandTrendChart');
    const timeline = demandData.timeline || [];
    if (timeline.length < 2) {
      svg.innerHTML = '<text x="380" y="195" text-anchor="middle" fill="#7f8b9b" font-size="14">Waiting for the first Google Trends refresh</text>';
      byId('trendLegend').innerHTML=''; return;
    }
    const width=760,height=390,left=42,right=18,top=22,bottom=40,plotW=width-left-right,plotH=height-top-bottom;
    const grid=[0,25,50,75,100].map(value=>{
      const y=top+plotH-(value/100)*plotH;
      return `<line class="trend-grid" x1="${left}" y1="${y}" x2="${width-right}" y2="${y}"/><text x="${left-8}" y="${y+4}" text-anchor="end" fill="#738095" font-size="10">${value}</text>`;
    }).join('');
    const lines = Object.keys(labels).map(key => {
      const points=timeline.map((row,index)=>{
        const x=left+(index/(timeline.length-1))*plotW;
        const value=Number(row.values?.[key]);
        const y=top+plotH-(Number.isFinite(value)?value:0)/100*plotH;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(' ');
      return `<polyline class="trend-line" points="${points}" stroke="${colors[key]}"/>`;
    }).join('');
    const tickIndexes=[0,Math.floor((timeline.length-1)/3),Math.floor((timeline.length-1)*2/3),timeline.length-1];
    const ticks=[...new Set(tickIndexes)].map(index=>{
      const x=left+(index/(timeline.length-1))*plotW;
      return `<text x="${x}" y="${height-13}" text-anchor="middle" fill="#738095" font-size="10">${escapeHtml(timeline[index].date||'')}</text>`;
    }).join('');
    svg.innerHTML=`${grid}<line class="trend-axis" x1="${left}" y1="${top}" x2="${left}" y2="${top+plotH}"/><line class="trend-axis" x1="${left}" y1="${top+plotH}" x2="${width-right}" y2="${top+plotH}"/>${lines}${ticks}`;
    byId('trendLegend').innerHTML=Object.keys(labels).map(key=>`<span><i style="background:${colors[key]}"></i>${labels[key]}</span>`).join('');
  }
  function renderCorridors() {
    const rows = demandData.corridors?.[selectedConcept] || [];
    byId('bestCorridorGap').textContent = rows[0]?.name || '—';
    byId('corridorRows').innerHTML = rows.length ? rows.map((row,index)=>`<tr>
      <td><span class="demand-rank">${index+1}</span></td>
      <td class="corridor-title"><strong>${escapeHtml(row.name)}</strong><small>${labels[selectedConcept]}</small></td>
      <td><span class="gap-score">${fmt(row.gap_score)}</span></td>
      <td class="traffic-value">${fmt(row.traffic_peak_proxy)}<small>${Number.isFinite(row.traffic_peak_proxy)?'published peak-period proxy':'not loaded'}</small></td>
      <td><b>${fmt(row.category_supply)}</b><span class="proxy-note">white space ${fmt(row.white_space_score)}/100</span></td>
      <td><b>${fmt(row.total_listings)}</b><span class="proxy-note">all tracked concepts</span></td>
      <td><b>${fmt(row.reviews_per_listing)}</b></td>
      <td><span class="confidence-chip">${fmt(row.confidence_score)}/100</span></td>
      <td class="rationale">${escapeHtml(row.rationale)}</td>
    </tr>`).join('') : '<tr><td colspan="9"><div class="empty">No corridor ranking is available yet.</div></td></tr>';
  }
  function renderBusinesses() {
    const category = byId('businessConcept').value;
    const rows=(demandData.top_business_signals||[]).filter(row=>category==='all'||row.category===category).slice(0,25);
    byId('businessSignalRows').innerHTML=rows.length?rows.map((row,index)=>`<tr>
      <td><span class="demand-rank">${index+1}</span></td>
      <td class="demand-concept"><strong>${escapeHtml(row.name)}</strong><small>${escapeHtml(row.address||'Address unavailable')}</small></td>
      <td><span class="demand-pill promising">${escapeHtml(labels[row.category]||row.category)}</span></td>
      <td><b>${fmt(row.rating,1)}</b></td>
      <td><b>${fmt(row.reviews_count)}</b></td>
      <td>${scoreBar(row.performance_proxy)}</td>
      <td>${escapeHtml(row.corridor||'Unassigned')}</td>
      <td>${row.google_maps_url?`<a href="${safeUrl(row.google_maps_url)}" target="_blank" rel="noreferrer">Maps</a>`:'—'}</td>
    </tr>`).join(''):'<tr><td colspan="8"><div class="empty">No matching demand-signal businesses.</div></td></tr>';
  }
  function renderRelated() {
    byId('relatedQueryCards').innerHTML=demandData.rankings.map(row=>{
      const rising=row.related_queries?.rising||[];
      const top=row.related_queries?.top||[];
      const queries=[...rising.slice(0,5),...top.slice(0,3)].filter((item,index,array)=>array.findIndex(other=>other.query===item.query)===index);
      return `<div class="related-card"><h4 style="color:${colors[row.key]}">${escapeHtml(row.label)}</h4><div class="query-list">${queries.length?queries.map(item=>`<span class="query-chip">${escapeHtml(item.query)}${item.value?` · ${escapeHtml(item.value)}`:''}</span>`).join(''):'<span class="query-chip">Waiting for related-query data</span>'}</div></div>`;
    }).join('');
  }
  function renderHero() {
    const opportunity=[...demandData.rankings].sort((a,b)=>b.opportunity_score-a.opportunity_score)[0];
    const demand=[...demandData.rankings].sort((a,b)=>b.demand_score-a.demand_score)[0];
    byId('demandHeroTitle').textContent=`${opportunity?.label||'Demand'} leads the current opportunity model`;
    byId('demandHeroText').textContent=opportunity?`${opportunity.label} combines a ${opportunity.demand_score}/100 demand score with ${opportunity.supply_count} captured listings, producing a ${opportunity.opportunity_score}/100 opportunity score. This tells us what to test first—not what will automatically succeed.`:'The secure demand workflow has not produced a ranking yet.';
    byId('demandHeroScore').textContent=opportunity?.opportunity_score??'—';
    byId('demandScoreRing').style.setProperty('--demand-score',opportunity?.opportunity_score||0);
    byId('demandHeroVerdict').textContent=opportunity?.verdict||'Waiting for data';
    byId('demandHeroConfidence').textContent=opportunity?`Evidence confidence ${opportunity.confidence_score}/100 · ${demandData.status==='complete'?'all scheduled sources loaded':'some sources are incomplete'}`:'Run the GitHub demand workflow first.';
    byId('demandLeader').textContent=demand?.label||'—';
    byId('opportunityLeader').textContent=opportunity?.label||'—';
    byId('demandBusinessCount').textContent=fmt(demandData.competitor_snapshot?.analyzed_count);
    byId('trendPeriodCount').textContent=fmt(demandData.timeline?.length);
    const date=demandData.updated_at?new Date(demandData.updated_at):null;
    byId('demandStatus').textContent=date?`${demandData.status} · ${date.toLocaleDateString('en-US')}`:'Waiting for first run';
    const caveats=(demandData.caveats||[]).map(item=>`• ${escapeHtml(item)}`).join('<br>');
    const errors=(demandData.errors||[]).length?`<br><br><b>Incomplete source notes:</b><br>${demandData.errors.map(item=>`• ${escapeHtml(item)}`).join('<br>')}`:'';
    byId('demandCaveats').innerHTML=`<b>Read this correctly:</b><br>${caveats||'Demand data is still loading.'}${errors}`;
    const existing=byId('kpiDemandLeader');
    if(existing) existing.textContent=opportunity?.label||'—';
  }
  function renderAll() {
    renderHero();renderRankings();renderQuadrant();renderTrend();renderCorridors();renderBusinesses();renderRelated();
  }
  async function loadDemand({announce=false}={}) {
    if(announce) byId('demandStatus').textContent='Refreshing stored demand feed…';
    try {
      const response=await fetch(`demand-data.json?v=${Date.now()}`,{cache:'no-store'});
      if(!response.ok) throw new Error(`Demand feed returned ${response.status}`);
      const data=await response.json();
      if(!Array.isArray(data.rankings)||!data.rankings.length) throw new Error('The first demand workflow has not completed yet.');
      demandData=data;window.snapDemandData=data;
      if(!data.corridors?.[selectedConcept]?.length) selectedConcept=data.rankings[0].key;
      byId('corridorConcept').value=selectedConcept;
      renderAll();
      if(byId('liveStatus'))byId('liveStatus').textContent='Demand intelligence loaded';
      return true;
    } catch(error) {
      console.warn(error);
      byId('demandStatus').textContent='Demand workflow pending';
      byId('demandCaveats').innerHTML=`<b>Demand feed is not populated yet.</b><br>${escapeHtml(error.message)} The secure GitHub Action will use SERPAPI_KEY and publish the results here.`;
      return false;
    }
  }

  function demandAnswer(question) {
    if(!demandData) return 'The secure demand workflow has not populated the dashboard yet. Open Demand Lab to see its current status.';
    const rankings=[...demandData.rankings].sort((a,b)=>b.opportunity_score-a.opportunity_score);
    const top=rankings[0];
    const demandTop=[...demandData.rankings].sort((a,b)=>b.demand_score-a.demand_score)[0];
    const corridor=demandData.corridors?.[top.key]?.[0];
    if(/how many.*coffee|coffee shops/.test(question.toLowerCase())) {
      const coffee=demandData.rankings.find(row=>row.key==='coffee');
      return `The current cleaned Tucson snapshot contains ${coffee?.supply_count||0} coffee/café listings. That is a captured supply count, not an official census of every shop. Coffee's demand score is ${coffee?.demand_score||0}/100, saturation is ${coffee?.saturation_score||0}/100 and opportunity is ${coffee?.opportunity_score||0}/100.`;
    }
    return `Current demand thesis:\n\n1. ${top.label} ranks first for opportunity at ${top.opportunity_score}/100, with demand ${top.demand_score}/100, saturation ${top.saturation_score}/100 and confidence ${top.confidence_score}/100.\n2. ${demandTop.label} has the strongest pure demand signal at ${demandTop.demand_score}/100.\n3. The current leading ${top.label.toLowerCase()} corridor gap is ${corridor?.name||'not available'} at ${corridor?.gap_score||0}/100.\n\nThis ranking combines Google Trends, ratings/review activity, captured supply and published traffic proxies. It does not claim revenue or guarantee success. Open Demand Lab for the tables and trend chart.`;
  }

  const baseAskSnap=askSnap;
  askSnap=async function(question){
    if(/demand|saturat|white.?space|which.*idea|best.*(coffee|juice|smoothie|tea|boba|breakfast|beverage)|search interest|market gap|corridor|how many.*coffee|coffee shops.*tucson/i.test(question)){
      setTimeout(()=>switchView('demand'),700);
      return demandAnswer(question);
    }
    return baseAskSnap(question);
  };

  const kpis=document.querySelector('#view-command .kpis');
  if(kpis&&!byId('kpiDemandLeader')){
    const card=document.createElement('div');card.className='card';card.innerHTML='<span>Demand opportunity</span><strong id="kpiDemandLeader">Loading</strong><small>Search + reviews + supply</small>';kpis.appendChild(card);
    kpis.style.gridTemplateColumns='repeat(auto-fit,minmax(180px,1fr))';
  }
  const sourcesGrid=document.querySelector('#view-sources .three-col');
  if(sourcesGrid){
    const source=document.createElement('div');source.className='panel connection-card';source.innerHTML='<b>SerpApi demand workflow <span class="tag-live">Secure</span></b><p>Weekly Arizona Google Trends, Tucson/DMA comparison and related-query data. The secret remains in GitHub Actions.</p>';sourcesGrid.prepend(source);
    const traffic=document.createElement('div');traffic.className='panel connection-card';traffic.innerHTML='<b>PAG traffic evidence <span class="tag-ready">Loaded</span></b><p>Published peak-period counts provide an initial corridor demand proxy. Full station-level traffic remains a future layer.</p>';sourcesGrid.prepend(traffic);
  }

  byId('demandRankMode').addEventListener('change',event=>{rankMode=event.target.value;renderRankings();});
  byId('corridorConcept').addEventListener('change',event=>{selectedConcept=event.target.value;renderCorridors();});
  byId('businessConcept').addEventListener('change',renderBusinesses);
  byId('refreshDemandBtn').addEventListener('click',()=>loadDemand({announce:true}));
  byId('openCompetitorScan').addEventListener('click',()=>switchView('competitors'));

  const originalSwitchView=window.switchView||switchView;
  switchView=function(name){originalSwitchView(name);if(name==='demand'&&demandData)setTimeout(renderTrend,100);};
  button.addEventListener('click',()=>switchView('demand'));
  loadDemand();
})();
