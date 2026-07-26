(() => {
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = `concept-studio.css?v=20260726-1`;
  document.head.appendChild(css);

  viewTitles.concept = 'Oh Snap Studio';
  let conceptData = null;
  let conceptMap = null;
  let conceptLayer = null;
  let selectedZone = 0;
  const storageKey = 'ohSnapMenuLabV1';

  const nav = document.getElementById('nav');
  const navButton = document.createElement('button');
  navButton.dataset.view = 'concept';
  navButton.innerHTML = '<span class="icon">✺</span><span>Oh Snap Studio</span>';
  const pricingButton = [...nav.children].find(button => button.dataset.view === 'pricing');
  nav.insertBefore(navButton, pricingButton || null);

  const section = document.createElement('section');
  section.className = 'view';
  section.id = 'view-concept';
  section.innerHTML = `
    <div class="snap-brand-hero">
      <div class="snap-brand-copy">
        <span class="snap-descriptor">Smoothies + Cold Fuel</span>
        <div class="snap-wordmark">OH <em>SNAP</em></div>
        <div class="snap-tagline" id="snapTagline">Cold. Fast. Craveable.</div>
        <p id="snapPositioning">Loading the working brand and operating blueprint…</p>
      </div>
      <aside class="snap-verdict-card">
        <div><small>Current strategic verdict</small><strong id="snapVerdictTitle">Build the pilot before the building</strong><p id="snapVerdictText">Loading demand, menu and site strategy.</p></div>
        <span class="snap-verdict-chip" id="snapBrandStatus">Working name</span>
      </aside>
    </div>

    <div class="snap-kpi-grid">
      <div class="snap-kpi"><span>Hero category</span><strong>Smoothies</strong><small>Demand-adjusted opportunity leader</small></div>
      <div class="snap-kpi"><span>First test zone</span><strong id="snapFirstZone">—</strong><small>Intersection strategy</small></div>
      <div class="snap-kpi"><span>Pilot menu</span><strong id="snapPilotCount">—</strong><small>Core items only</small></div>
      <div class="snap-kpi"><span>Land rule</span><strong>Lease first</strong><small>Under-$200K land is not required</small></div>
    </div>

    <section class="snap-section snap-surface">
      <div class="snap-section-head"><div><h2>What Oh Snap actually is</h2><p>This locks the business model before we start decorating a store or chasing random parcels.</p></div><span class="snap-badge orange">Concept architecture</span></div>
      <div class="snap-grid-3" id="snapConceptCards"></div>
      <div class="snap-warning" style="margin-top:13px"><b>Name caution:</b> OH SNAP is the working brand. Similar food marks exist, so trademark and legal clearance must happen before paying for permanent signs, packaging or a long lease.</div>
    </section>

    <section class="snap-section snap-surface">
      <div class="snap-section-head"><div><h2>Brand system</h2><p>The descriptor makes the name understandable: <b>OH SNAP Smoothies + Cold Fuel</b>. The look should feel energetic and premium, not like a generic wellness clinic.</p></div><span class="snap-badge pink">Working identity</span></div>
      <div class="snap-grid-2">
        <div class="snap-brand-card"><b>Voice</b><p>Fast, playful and clear. Product names can have personality, but the ingredient line must remain simple enough to order from a car.</p><div class="snap-color-row" id="snapPalette" style="margin-top:14px"></div></div>
        <div class="snap-brand-card"><b>Message hierarchy</b><p><b>Store sign:</b> OH SNAP<br><b>Descriptor:</b> Smoothies + Cold Fuel<br><b>Tagline:</b> Cold. Fast. Craveable.<br><b>Proof:</b> Real fruit · protein options · blended fast</p><p style="margin-top:12px">Do not lead with medical claims. Lead with flavor, speed and an easy reason to return.</p></div>
      </div>
    </section>

    <section class="snap-section snap-surface">
      <div class="snap-section-head"><div><h2>Menu Lab</h2><p>Edit the working price and unit cost. The table recalculates gross margin and turns the selected pilot items into a live menu-board preview.</p></div><span class="snap-badge green">Interactive</span></div>
      <div class="snap-menu-toolbar"><label>Show <select id="snapMenuPhase"><option value="all">All menu phases</option><option value="Pilot" selected>Pilot only</option><option value="Expansion">Expansion only</option></select></label><span class="grow"></span><button class="secondary" id="snapResetMenu">Reset assumptions</button></div>
      <div class="snap-table-wrap"><table class="snap-table"><thead><tr><th>Use</th><th>Item</th><th>Phase</th><th>Ingredients</th><th>16 oz / unit price</th><th>Estimated unit cost</th><th>Gross margin</th><th>Service target</th><th>Strategic role</th></tr></thead><tbody id="snapMenuRows"></tbody></table></div>
      <div class="snap-menu-summary"><div class="snap-summary-card"><span>Selected items</span><strong id="snapSelectedCount">—</strong></div><div class="snap-summary-card"><span>Average price</span><strong id="snapAveragePrice">—</strong></div><div class="snap-summary-card"><span>Average cost</span><strong id="snapAverageCost">—</strong></div><div class="snap-summary-card"><span>Blended margin</span><strong id="snapAverageMargin">—</strong></div><div class="snap-summary-card"><span>Average service target</span><strong id="snapAverageSpeed">—</strong></div></div>
      <div class="snap-grid-2" style="margin-top:14px">
        <div class="snap-board"><h3>OH <em>SNAP</em></h3><div class="snap-board-sub">Smoothies + Cold Fuel · pilot menu</div><div class="snap-board-grid" id="snapMenuBoard"></div></div>
        <div><div class="snap-grid-2" id="snapMenuRules"></div><div class="snap-warning" style="margin-top:12px"><b>Menu rule:</b> do not start with pressed juices, unlimited customization, ten bowl bases and a full hot kitchen. Complexity destroys speed, inventory control and your ability to learn what customers actually came for.</div></div>
      </div>
    </section>

    <section class="snap-section snap-surface">
      <div class="snap-section-head"><div><h2>Where to test it</h2><p>The opportunity is not “Kolb” as a vague street. It is the strongest cross-corridor at a practical Kolb-area site.</p></div><span class="snap-badge dark">Location thesis</span></div>
      <div class="snap-zone-layout"><div id="snapZoneMap" class="snap-zone-map"></div><div id="snapZoneCards" class="snap-zone-list"></div></div>
      <div class="snap-section-head" style="margin-top:22px"><div><h2 style="font-size:23px">Non-negotiable site filter</h2><p>Any broker lead should pass these checks before we discuss design or a letter of intent.</p></div></div>
      <div class="snap-site-checklist" id="snapSiteChecklist"></div>
      <div class="snap-warning" style="margin-top:12px"><b>Budget implication:</b> with a hard land cap under $200,000 and no confirmed Kolb-area commercial parcel meeting that cap, the practical first-location search is a second-generation end-cap, shopping-center pad, trailer agreement, subdivided pad or ground lease.</div>
    </section>

    <section class="snap-section snap-surface">
      <div class="snap-section-head"><div><h2>How to set it up without guessing</h2><p>Each phase earns the right to spend more money. Land ownership is not phase one.</p></div><span class="snap-badge orange">De-risked launch</span></div>
      <div class="snap-grid-4" id="snapLaunchPhases"></div>
    </section>

    <section class="snap-section snap-surface">
      <div class="snap-section-head"><div><h2>Pilot scorecard</h2><p>After the paid test, enter the real results. The dashboard will tell us whether to advance, repeat or stop.</p></div><span class="snap-badge green">Real evidence</span></div>
      <div class="snap-scorecard">
        <div class="snap-metric-inputs">
          <div class="snap-metric-field"><label>Paid transactions</label><input id="snapTransactions" type="number" value="0" min="0"></div>
          <div class="snap-metric-field"><label>Average ticket</label><input id="snapTicket" type="number" value="0" min="0" step="0.25"></div>
          <div class="snap-metric-field"><label>Gross margin %</label><input id="snapGrossMargin" type="number" value="0" min="0" max="100" step="0.5"></div>
          <div class="snap-metric-field"><label>Average service seconds</label><input id="snapService" type="number" value="0" min="0"></div>
          <div class="snap-metric-field"><label>Top six SKU share %</label><input id="snapSkuShare" type="number" value="0" min="0" max="100"></div>
          <div class="snap-metric-field"><label>Repeat intent / return %</label><input id="snapRepeat" type="number" value="0" min="0" max="100"></div>
        </div>
        <div class="snap-score-verdict"><div class="snap-score-ring" id="snapPilotRing"><strong id="snapPilotScore">0</strong></div><h3 id="snapPilotVerdict">No paid evidence yet</h3><p id="snapPilotReason">Run the recipe and corridor tests before signing a permanent lease.</p></div>
      </div>
    </section>

    <section class="snap-section snap-surface">
      <div class="snap-section-head"><div><h2>Evidence used</h2><p>The working menu combines the dashboard’s demand model, current Tucson menu benchmarks and the operating discipline from the earlier breakfast concept files.</p></div><span class="snap-badge">Sources</span></div>
      <div class="snap-source-list" id="snapSources"></div>
    </section>`;

  const pricingView = document.getElementById('view-pricing');
  pricingView.parentNode.insertBefore(section, pricingView);

  const dollars = value => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value)||0);
  const getSavedMenu = () => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '{}'); }
    catch { return {}; }
  };
  const saveMenu = value => localStorage.setItem(storageKey,JSON.stringify(value));
  const menuState = getSavedMenu();

  function itemState(item){
    const saved = menuState[item.id] || {};
    return {
      selected: saved.selected ?? (item.phase === 'Pilot'),
      price: Number(saved.price ?? item.price16),
      cost: Number(saved.cost ?? item.cost16)
    };
  }
  function margin(price,cost){ return price > 0 ? ((price-cost)/price)*100 : 0; }
  function marginClass(value){ return value >= 68 ? 'good' : value >= 62 ? 'mid' : 'low'; }

  function renderConcept(){
    const strategy = conceptData.strategic_verdict;
    byId('snapTagline').textContent = conceptData.brand.tagline;
    byId('snapPositioning').textContent = conceptData.brand.positioning;
    byId('snapVerdictTitle').textContent = strategy.launch_format;
    byId('snapVerdictText').textContent = strategy.reason;
    byId('snapBrandStatus').textContent = conceptData.brand.working_name_status;
    byId('snapFirstZone').textContent = conceptData.zones[0].name;
    byId('snapPilotCount').textContent = conceptData.menu.filter(item=>item.phase==='Pilot').length;

    const cards = [
      ['Hero product',strategy.concept,'Smoothies lead. Coffee becomes one bridge product, not the whole identity.'],
      ['Launch format',strategy.launch_format,'The first store is earned by paid demand, not assumed by a dashboard.'],
      ['Location rule',strategy.first_test_zone,'Use the cross-street with the stronger demand signal; do not choose a parcel only because its address says Kolb.']
    ];
    byId('snapConceptCards').innerHTML = cards.map((card,index)=>`<article class="snap-rule-card"><span class="snap-rule-number">${index+1}</span><b>${escapeHtml(card[0])}</b><p><strong>${escapeHtml(card[1])}</strong><br>${escapeHtml(card[2])}</p></article>`).join('');
    byId('snapPalette').innerHTML = conceptData.brand.palette.map(color=>`<div class="snap-color"><i style="background:${color.hex}"></i><b>${escapeHtml(color.name)}</b><small>${escapeHtml(color.hex)}</small></div>`).join('');
    renderMenu();
    renderZones();
    byId('snapSiteChecklist').innerHTML = conceptData.site_requirements.map(item=>`<div class="snap-check"><span>${escapeHtml(item)}</span></div>`).join('');
    byId('snapLaunchPhases').innerHTML = conceptData.launch_plan.map(phase=>`<article class="snap-phase-card"><span class="snap-phase-number">${escapeHtml(phase.phase)}</span><b>${escapeHtml(phase.name)}</b><span class="duration">${escapeHtml(phase.duration)}</span><span class="budget">${escapeHtml(phase.budget)}</span><p>${escapeHtml(phase.deliverable)}</p></article>`).join('');
    byId('snapSources').innerHTML = conceptData.sources.map(source=>`<div class="snap-source"><div><b>${escapeHtml(source.name)}</b><br><small>${escapeHtml(source.role)}</small></div>${/^https?:/i.test(source.url)?`<a href="${safeUrl(source.url)}" target="_blank" rel="noreferrer">Open source</a>`:'<span class="snap-badge">Stored evidence</span>'}</div>`).join('');
    calculatePilot();
  }

  function filteredMenu(){
    const phase = byId('snapMenuPhase').value;
    return conceptData.menu.filter(item=>phase==='all'||item.phase===phase);
  }
  function renderMenu(){
    const rows = filteredMenu();
    byId('snapMenuRows').innerHTML = rows.map(item=>{
      const state = itemState(item);
      const gross = margin(state.price,state.cost);
      return `<tr data-id="${escapeHtml(item.id)}">
        <td><input class="snap-use-item" type="checkbox" ${state.selected?'checked':''} aria-label="Use ${escapeHtml(item.name)}"></td>
        <td class="snap-item-title"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.description)}</small></td>
        <td><span class="snap-badge ${item.phase==='Pilot'?'green':''}">${escapeHtml(item.phase)}</span></td>
        <td class="snap-ingredients">${escapeHtml(item.ingredients)}</td>
        <td><input class="snap-price-input" type="number" min="0" step="0.10" value="${state.price.toFixed(2)}"></td>
        <td><input class="snap-cost-input" type="number" min="0" step="0.05" value="${state.cost.toFixed(2)}"></td>
        <td><span class="snap-margin ${marginClass(gross)}">${gross.toFixed(1)}%</span></td>
        <td><b>${number(item.service_seconds)} sec</b></td>
        <td class="snap-role">${escapeHtml(item.role)}</td>
      </tr>`;
    }).join('');
    document.querySelectorAll('#snapMenuRows tr').forEach(row=>{
      const id = row.dataset.id;
      const checkbox = row.querySelector('.snap-use-item');
      const price = row.querySelector('.snap-price-input');
      const cost = row.querySelector('.snap-cost-input');
      const update = () => {
        menuState[id] = {selected:checkbox.checked,price:Number(price.value)||0,cost:Number(cost.value)||0};
        saveMenu(menuState);
        renderMenuSummary();
        const gross = margin(Number(price.value),Number(cost.value));
        const badge = row.querySelector('.snap-margin');
        badge.textContent = `${gross.toFixed(1)}%`;
        badge.className = `snap-margin ${marginClass(gross)}`;
      };
      checkbox.addEventListener('change',update);price.addEventListener('input',update);cost.addEventListener('input',update);
    });
    renderMenuSummary();
    byId('snapMenuRules').innerHTML = conceptData.menu_rules.slice(0,6).map((rule,index)=>`<div class="snap-rule-card"><span class="snap-rule-number">${index+1}</span><p>${escapeHtml(rule)}</p></div>`).join('');
  }
  function renderMenuSummary(){
    const selected = conceptData.menu.filter(item=>itemState(item).selected);
    const prices = selected.map(item=>itemState(item).price);
    const costs = selected.map(item=>itemState(item).cost);
    const avg = values => values.length ? values.reduce((a,b)=>a+b,0)/values.length : 0;
    const totalPrice = prices.reduce((a,b)=>a+b,0);
    const totalCost = costs.reduce((a,b)=>a+b,0);
    const blended = margin(totalPrice,totalCost);
    const speed = avg(selected.map(item=>item.service_seconds));
    byId('snapSelectedCount').textContent = selected.length;
    byId('snapAveragePrice').textContent = dollars(avg(prices));
    byId('snapAverageCost').textContent = dollars(avg(costs));
    byId('snapAverageMargin').textContent = `${blended.toFixed(1)}%`;
    byId('snapAverageSpeed').textContent = `${Math.round(speed)} sec`;
    byId('snapMenuBoard').innerHTML = selected.length ? selected.slice(0,10).map(item=>{
      const state = itemState(item);
      return `<div class="snap-board-item"><div><b>${escapeHtml(item.name)}</b><strong>${dollars(state.price)}</strong></div><small>${escapeHtml(item.ingredients)}</small></div>`;
    }).join('') : '<div class="snap-board-item"><b>Select at least one pilot item.</b></div>';
  }

  function initZoneMap(){
    if(conceptMap) return;
    conceptMap = L.map('snapZoneMap',{scrollWheelZoom:false}).setView([32.215,-110.841],11.5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(conceptMap);
    conceptLayer = L.layerGroup().addTo(conceptMap);
  }
  function renderZones(){
    initZoneMap();
    conceptLayer.clearLayers();
    conceptData.zones.forEach((zone,index)=>{
      const color = index===0?'#ff6b35':index===1?'#e83e8c':index===2?'#b7e44a':'#24152d';
      const marker = L.circleMarker([zone.lat,zone.lng],{radius:11,color:'#fff',fillColor:color,fillOpacity:.95,weight:3}).addTo(conceptLayer).bindTooltip(String(zone.rank),{permanent:true,direction:'center',className:'parcel-number'}).bindPopup(`<b>${escapeHtml(zone.name)}</b><br>Gap score ${zone.gap_score}/100<br>${number(zone.traffic_proxy)} traffic proxy<br>${zone.juice_supply} captured juice/smoothie listings`);
      marker.on('click',()=>focusZone(index));
      L.circle([zone.lat,zone.lng],{radius:1609,color,weight:1,fillColor:color,fillOpacity:.035,dashArray:'5 6'}).addTo(conceptLayer);
    });
    byId('snapZoneCards').innerHTML = conceptData.zones.map((zone,index)=>`<article class="snap-zone-card ${selectedZone===index?'selected':''}" data-index="${index}"><div class="snap-zone-top"><div style="display:flex;gap:10px;align-items:flex-start"><span class="snap-zone-rank">${zone.rank}</span><div><b>${escapeHtml(zone.name)}</b><div class="snap-zone-verdict">${escapeHtml(zone.verdict)}</div></div></div><span class="snap-zone-score">${zone.gap_score}</span></div><div class="snap-zone-meta"><span>${number(zone.traffic_proxy)} traffic proxy</span><span>${zone.juice_supply} juice listings</span><span>${zone.confidence}% confidence</span></div><p>${escapeHtml(zone.reason)}</p><p><b>Best format:</b> ${escapeHtml(zone.format)}</p></article>`).join('');
    document.querySelectorAll('.snap-zone-card').forEach(card=>card.addEventListener('click',()=>focusZone(Number(card.dataset.index))));
    focusZone(selectedZone,false);
  }
  function focusZone(index,animate=true){
    selectedZone=index;
    const zone=conceptData.zones[index];
    conceptMap.setView([zone.lat,zone.lng],13.5,{animate});
    document.querySelectorAll('.snap-zone-card').forEach(card=>card.classList.toggle('selected',Number(card.dataset.index)===index));
  }

  function calculatePilot(){
    if(!conceptData) return;
    const target=conceptData.pilot_targets;
    const values={
      transactions:Number(byId('snapTransactions').value)||0,
      ticket:Number(byId('snapTicket').value)||0,
      margin:Number(byId('snapGrossMargin').value)||0,
      service:Number(byId('snapService').value)||0,
      sku:Number(byId('snapSkuShare').value)||0,
      repeat:Number(byId('snapRepeat').value)||0
    };
    const ratios=[
      Math.min(1,values.transactions/target.paid_transactions),
      Math.min(1,values.ticket/target.average_ticket),
      Math.min(1,values.margin/target.gross_margin_percent),
      values.service>0?Math.min(1,target.service_seconds/values.service):0,
      Math.min(1,values.sku/target.top_sku_share_percent),
      Math.min(1,values.repeat/target.repeat_intent_percent)
    ];
    const score=Math.round(ratios.reduce((a,b)=>a+b,0)/ratios.length*100);
    byId('snapPilotScore').textContent=score;
    byId('snapPilotRing').style.setProperty('--score',score);
    let title='No paid evidence yet',reason='Run the recipe and corridor tests before signing a permanent lease.';
    if(score>=80){title='Advance to a 90-day pilot';reason='The working thresholds are substantially met. Validate the results across multiple days before committing to a full store.';}
    else if(score>=65){title='Promising — repeat the test';reason='The concept is showing useful evidence, but at least one major metric still needs improvement or more sample size.';}
    else if(score>=45){title='Revise menu or location';reason='There is some demand, but the current offer or corridor is not yet strong enough for a permanent lease.';}
    else if(values.transactions>0){title='Do not scale this version';reason='Pause permanent-site spending. Fix product, pricing, service speed or location and run another controlled test.';}
    byId('snapPilotVerdict').textContent=title;byId('snapPilotReason').textContent=reason;
  }

  function conceptAnswer(question){
    const first=conceptData.zones[0],second=conceptData.zones[1];
    return `OH SNAP working plan:\n\n• Brand: OH SNAP Smoothies + Cold Fuel — “${conceptData.brand.tagline}”\n• Pilot menu: six core smoothies plus two fast refreshers. Add bowls and the breakfast baguette only after the drink menu proves demand.\n• First location test: ${first.name}, followed by ${second.name}. The model ranks the cross-corridors above Kolb Road alone.\n• Site strategy: paid pop-up or trailer first, then a second-generation end-cap or pad lease. Do not make a sub-$200,000 land purchase the prerequisite.\n• First step: run a two-week recipe lab, then collect at least ${conceptData.pilot_targets.paid_transactions} paid test transactions before signing a permanent lease.\n\nOpen Oh Snap Studio for the editable menu, map and scorecard.`;
  }

  async function loadConcept(){
    try{
      const response=await fetch(`oh-snap-concept.json?v=${Date.now()}`,{cache:'no-store'});
      if(!response.ok)throw new Error(`Concept feed returned ${response.status}`);
      conceptData=await response.json();window.ohSnapConcept=conceptData;renderConcept();
    }catch(error){console.error(error);byId('snapPositioning').textContent='The Oh Snap concept file could not load. Refresh the page in a moment.';}
  }

  navButton.addEventListener('click',()=>switchView('concept'));
  byId('snapMenuPhase').addEventListener('change',renderMenu);
  byId('snapResetMenu').addEventListener('click',()=>{localStorage.removeItem(storageKey);Object.keys(menuState).forEach(key=>delete menuState[key]);renderMenu();});
  ['snapTransactions','snapTicket','snapGrossMargin','snapService','snapSkuShare','snapRepeat'].forEach(id=>byId(id).addEventListener('input',calculatePilot));

  const previousSwitchView=window.switchView||switchView;
  switchView=function(name){previousSwitchView(name);if(name==='concept'&&conceptMap)setTimeout(()=>conceptMap.invalidateSize(),140);};
  const previousAsk=askSnap;
  askSnap=async function(question){
    if(conceptData&&/oh snap|smoothie menu|menu design|what.*menu|where.*(location|site|store)|golf links.*kolb|speedway.*kolb|set up.*smoothie|brand.*smoothie/i.test(question)){
      setTimeout(()=>switchView('concept'),600);return conceptAnswer(question);
    }
    return previousAsk(question);
  };

  loadConcept();
})();
