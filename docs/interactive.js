(() => {
  const premium = document.createElement('link');
  premium.rel = 'stylesheet';
  premium.href = `premium.css?v=20260726-2`;
  document.head.appendChild(premium);

  const style = document.createElement('style');
  style.textContent = `
    .visual-results{margin-top:16px;border:1px solid var(--line);border-radius:20px;padding:18px}
    .visual-results.hidden{display:none}.visual-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px}.visual-head h3{margin:0;font-size:22px}.visual-head p{margin:5px 0 0;color:var(--muted);font-size:13px}
    .ask-land-layout{display:grid;grid-template-columns:1.05fr .95fr;gap:14px}.ask-map{height:490px;border-radius:16px;border:1px solid var(--line);overflow:hidden;position:sticky;top:82px}
    .ask-parcels{display:grid;gap:10px;max-height:490px;overflow:auto;padding-right:3px}.ask-parcel{border:1px solid var(--line);border-radius:15px;padding:14px;cursor:pointer;transition:.18s ease}
    .ask-parcel-top{display:flex;justify-content:space-between;gap:10px}.ask-parcel h4{margin:0;font-size:15px;line-height:1.3}.ask-parcel .ask-price{font-weight:950;font-size:18px;white-space:nowrap}.ask-parcel p{font-size:12px;color:var(--muted);line-height:1.45;margin:8px 0}.ask-parcel-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.ask-parcel-actions button,.ask-parcel-actions a{font-size:11px;font-weight:850;text-decoration:none}
    .parcel-index{width:26px;height:26px;border-radius:50%;display:inline-grid;place-items:center;background:#201a16;color:#fff;font-weight:950;font-size:11px;margin-right:7px;flex:0 0 auto}.parcel-title{display:flex;align-items:flex-start}.interactive-note{font-size:12px;color:var(--muted);margin-top:10px}
    .land-card{transition:.18s ease}.land-card .show-main-map{margin-left:auto}
    @media(max-width:1000px){.ask-land-layout{grid-template-columns:1fr}.ask-map{height:390px;position:relative;top:auto}.ask-parcels{max-height:none}}
    @media(max-width:600px){.visual-head{display:block}.visual-head button{margin-top:10px}.ask-map{height:330px}.ask-parcel-top{display:block}.ask-parcel .ask-price{margin:6px 0}}
  `;
  document.head.appendChild(style);

  const askView = document.getElementById('view-ask');
  const panel = document.createElement('section');
  panel.id = 'askVisualResults';
  panel.className = 'visual-results';
  panel.innerHTML = `
    <div class="visual-head">
      <div><h3>Parcel explorer</h3><p id="askVisualSummary">Loading the strongest current land candidates…</p></div>
      <button class="secondary" id="openAllLand">Open full Land Watch</button>
    </div>
    <div class="ask-land-layout">
      <div id="askLandMap" class="ask-map"></div>
      <div id="askParcelCards" class="ask-parcels"><div class="empty">Loading parcel data…</div></div>
    </div>
    <div class="interactive-note">Click a parcel card or marker to inspect it. Listing scores are preliminary; zoning, access, utilities, drainage and drive-through rights still require official verification.</div>`;
  askView.appendChild(panel);

  const askMap = L.map('askLandMap',{scrollWheelZoom:false}).setView([32.2226,-110.9747],10);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(askMap);
  const askLayer = L.layerGroup().addTo(askMap);
  let askHighlight = null;
  let lastAskRows = [];

  function parseCap(question=''){
    const match = question.match(/(?:under|below|less than|max(?:imum)?(?: price)?(?: of)?)\s*\$?([\d,.]+)\s*(k)?/i);
    if(!match) return null;
    let amount = Number(match[1].replace(/,/g,''));
    if(match[2]) amount *= 1000;
    return amount;
  }

  function getRowsForQuestion(question=''){
    let rows = [...state.lands];
    const cap = parseCap(question);
    if(cap) rows = rows.filter(land => Number(land.price) <= cap);
    if(/hold|investment|appreciat|buy and hold/i.test(question)) rows.sort((a,b)=>b.hold_score-a.hold_score);
    else if(/cheap|lowest|least expensive/i.test(question)) rows.sort((a,b)=>a.price-b.price);
    else if(/largest|acre|size/i.test(question)) rows.sort((a,b)=>lotSqft(b)-lotSqft(a));
    else rows.sort((a,b)=>b.site_score-a.site_score);
    return rows.slice(0,12);
  }

  function popupHtml(land){
    return `<b>${escapeHtml(land.address)}</b><br>${money(land.price)} · ${number(land.lot_size)} ${escapeHtml(land.lot_unit)}<br>Operating site ${land.site_score}/100 · Land hold ${land.hold_score}/100<br><a href="${safeUrl(land.url)}" target="_blank" rel="noreferrer">Open listing</a>`;
  }

  function focusAskParcel(land,index){
    askMap.setView([land.lat,land.lng],15,{animate:true});
    if(askHighlight) askHighlight.remove();
    askHighlight = L.circleMarker([land.lat,land.lng],{radius:14,color:'#081018',fillColor:'#49c6ff',fillOpacity:.95,weight:4}).addTo(askMap).bindPopup(popupHtml(land)).openPopup();
    document.querySelectorAll('.ask-parcel').forEach(card=>card.classList.toggle('selected',Number(card.dataset.index)===index));
  }

  function focusMainParcel(land,index){
    switchView('land');
    setTimeout(()=>{
      state.landMap.setView([land.lat,land.lng],16,{animate:true});
      if(state.landFocusMarker) state.landFocusMarker.remove();
      state.landFocusMarker = L.circleMarker([land.lat,land.lng],{radius:15,color:'#081018',fillColor:'#49c6ff',fillOpacity:.96,weight:4}).addTo(state.landMap).bindPopup(popupHtml(land)).openPopup();
      document.querySelectorAll('#landCards .land-card').forEach((card,i)=>card.classList.toggle('selected',i===index));
    },180);
  }

  function useLandInBuild(land){
    byId('landPurchase').value = land.price;
    calculateBuild();
    switchView('build');
  }

  function renderAskParcels(question=''){
    if(!state.lands.length){
      byId('askVisualSummary').textContent='Waiting for the land feed to load…';
      byId('askParcelCards').innerHTML='<div class="empty">Loading parcel data…</div>';
      return;
    }
    const rows = getRowsForQuestion(question);
    lastAskRows = rows;
    const cap = parseCap(question);
    const mode = /hold|investment|appreciat/i.test(question) ? 'land-hold score' : 'operating-site score';
    byId('askVisualSummary').textContent = cap ? `${rows.length} top visible candidates under ${money(cap)}, ordered by ${mode}.` : `${rows.length} strongest visible candidates, ordered by ${mode}.`;
    askLayer.clearLayers();
    rows.forEach((land,index)=>{
      const color = land.site_score>=75?'#55e6a5':land.site_score>=60?'#ffd166':'#ff6b7a';
      const marker = L.circleMarker([land.lat,land.lng],{radius:9,color:'#081018',fillColor:color,fillOpacity:.94,weight:2}).addTo(askLayer).bindTooltip(String(index+1),{permanent:true,direction:'center',className:'parcel-number'}).bindPopup(popupHtml(land));
      marker.on('click',()=>focusAskParcel(land,index));
    });
    if(rows.length) askMap.fitBounds(L.latLngBounds(rows.map(land=>[land.lat,land.lng])).pad(.18));
    byId('askParcelCards').innerHTML = rows.length ? rows.map((land,index)=>`
      <article class="ask-parcel" data-index="${index}">
        <div class="ask-parcel-top"><div class="parcel-title"><span class="parcel-index">${index+1}</span><h4>${escapeHtml(land.address)}</h4></div><div class="ask-price">${money(land.price)}</div></div>
        <div class="land-meta"><span>${number(land.lot_size)} ${escapeHtml(land.lot_unit)}</span><span>${escapeHtml(land.corridor)}</span><span>Site ${land.site_score}</span><span>Hold ${land.hold_score}</span></div>
        <p>${escapeHtml(land.note)}</p>
        <div class="ask-parcel-actions"><button class="secondary ask-show-map" data-index="${index}">Show on map</button><button class="secondary ask-open-land" data-index="${index}">Open in Land Watch</button><button class="secondary ask-use-build" data-index="${index}">Use in build model</button><a class="secondary" href="${safeUrl(land.url)}" target="_blank" rel="noreferrer">View listing</a></div>
      </article>`).join('') : '<div class="notice">No watchlist parcels match that request.</div>';

    document.querySelectorAll('.ask-parcel').forEach(card=>card.addEventListener('click',event=>{if(event.target.closest('button,a')) return;const index=Number(card.dataset.index);focusAskParcel(rows[index],index);}));
    document.querySelectorAll('.ask-show-map').forEach(btn=>btn.addEventListener('click',()=>{const index=Number(btn.dataset.index);focusAskParcel(rows[index],index);}));
    document.querySelectorAll('.ask-open-land').forEach(btn=>btn.addEventListener('click',()=>{const index=Number(btn.dataset.index);const land=rows[index];if(cap)byId('landMaxPrice').value=cap;byId('landMinSqft').value=0;byId('landSort').value=/hold|investment|appreciat/i.test(question)?'hold':'site';applyLandFilters();const filteredIndex=state.filteredLands.findIndex(item=>item.address===land.address);focusMainParcel(land,filteredIndex);}));
    document.querySelectorAll('.ask-use-build').forEach(btn=>btn.addEventListener('click',()=>useLandInBuild(rows[Number(btn.dataset.index)])));
  }

  function enhanceMainLandCards(){
    document.querySelectorAll('#landCards .land-card').forEach((card,index)=>{
      const land = state.filteredLands[index];
      if(!land || card.querySelector('.show-main-map')) return;
      const actions=card.querySelector('.land-actions:last-child') || card;
      const button=document.createElement('button');button.className='secondary show-main-map';button.textContent='Show on map';button.addEventListener('click',()=>focusMainParcel(land,index));actions.appendChild(button);
      card.addEventListener('click',event=>{if(event.target.closest('button,a'))return;focusMainParcel(land,index);});
    });
  }

  const originalRenderLands = renderLands;
  renderLands = function(maxPrice){originalRenderLands(maxPrice);enhanceMainLandCards();};
  const originalAskSnap = askSnap;
  askSnap = async function(question){const answer = await originalAskSnap(question);if(/land|parcel|lot|site under|acre/i.test(question)){panel.classList.remove('hidden');renderAskParcels(question);setTimeout(()=>askMap.invalidateSize(),80);}return answer;};
  const originalSwitchView = switchView;
  switchView = function(name){originalSwitchView(name);if(name==='ask')setTimeout(()=>askMap.invalidateSize(),150);};

  byId('openAllLand').addEventListener('click',()=>{const cap=lastAskRows.length?Math.max(...lastAskRows.map(l=>l.price)):null;if(cap)byId('landMaxPrice').value=cap;byId('landMinSqft').value=0;applyLandFilters();switchView('land');});

  function installFinanceView(){
    const nav=document.getElementById('nav');
    const financeButton=document.createElement('button');
    financeButton.dataset.view='finance';financeButton.innerHTML='<span class="icon">◈</span><span>Capital Stack</span>';
    const sourceButton=[...nav.children].find(button=>button.dataset.view==='sources');
    nav.insertBefore(financeButton,sourceButton || null);
    financeButton.addEventListener('click',()=>switchView('finance'));

    const finance=document.createElement('section');
    finance.className='view';finance.id='view-finance';
    finance.innerHTML=`
      <div class="finance-hero">
        <div class="finance-title"><span class="finance-kicker">Funding architecture · not a loan approval</span><h2>Capital Stack<br/>Control Room</h2><p>See what the project costs, what cash you bring, how much debt the plan requests, whether projected cash flow covers that debt, and which launch path is financially safest.</p><button class="primary" id="useCurrentProject">Recalculate from current project</button></div>
        <div class="panel readiness-card"><div class="readiness-ring" id="readinessRing"><div><strong id="readinessScore">—</strong><br><span>readiness</span></div></div><div class="readiness-label" id="readinessLabel">Calculating</div><div class="readiness-detail" id="readinessDetail">Reading the current project and funding inputs.</div></div>
      </div>

      <div class="finance-grid">
        <div class="panel"><h3>Your funding profile</h3><p>Credit score does not determine a loan amount by itself. The model also weighs owner cash, repayment coverage and operating evidence.</p><div class="finance-inputs">
          <div class="field"><label>Personal credit score</label><input id="financeCredit" type="number" min="300" max="850" value="680"></div>
          <div class="field"><label>Owner cash available</label><input id="financeCash" type="number" min="0" step="5000" value="100000"></div>
          <div class="field"><label>Annual personal income</label><input id="financeIncome" type="number" min="0" step="5000" value="120000"></div>
          <div class="field"><label>Existing monthly debt payments</label><input id="financeMonthlyDebt" type="number" min="0" step="100" value="1000"></div>
          <div class="field"><label>Planning interest rate</label><input id="financeRate" type="number" min="1" max="30" step="0.25" value="10.5"></div>
          <div class="field"><label>Loan term in years</label><input id="financeTerm" type="number" min="3" max="30" value="25"></div>
          <div class="field"><label>Months of operating history</label><input id="financeOperatingMonths" type="number" min="0" max="240" value="0"></div>
          <div class="field"><label>Current monthly pilot revenue</label><input id="financePilotRevenue" type="number" min="0" step="1000" value="0"></div>
          <div class="field"><label>Second-generation project baseline</label><input id="financeSecondGenCost" type="number" min="50000" step="10000" value="400000"></div>
        </div><div class="notice" style="margin-top:12px"><b id="financeCreditBand">—</b><br><span id="financeCreditNote">This is a planning band, not a lender rule.</span><br><span id="financeHousehold">—</span></div></div>

        <div class="panel"><h3>Illustrative project stack</h3><div class="metric-strip"><div class="metric"><span>Low project cost</span><b id="financeProjectCost">—</b></div><div class="metric"><span>Cash injection</span><b id="financeCashPct">—</b></div><div class="metric"><span>Debt request</span><b id="financeLoanNeed">—</b></div><div class="metric"><span>Monthly debt service</span><b id="financeMonthlyPayment">—</b></div></div><div class="capital-stack"><div class="stack-bar" id="stackBar"></div><div class="stack-legend"><span><i style="background:var(--green)"></i>Owner cash</span><span><i style="background:var(--blue)"></i>Debt request</span><span><i style="background:var(--red)"></i>Funding gap</span></div><p id="stackNarrative"></p></div><div class="metric-strip" style="margin-top:14px"><div class="metric"><span>Modeled DSCR</span><b id="financeDscr">—</b></div><div class="metric"><span>Operating profit</span><b id="capitalVerdictProfit">—</b></div><div class="metric"><span>Land share of project</span><b id="capitalVerdictLandShare">—</b></div><div class="metric"><span>Simple payback</span><b id="capitalVerdictPayback">—</b></div></div></div>
      </div>

      <div class="panel" style="margin-top:14px"><div class="section-head" style="margin-top:0"><div><h2 id="capitalVerdictTitle">Calculating verdict</h2></div><p id="capitalVerdictText">The verdict connects funding, proof, property strategy and store economics.</p></div></div>

      <div class="section-head"><div><h2>Strategy verdict matrix</h2></div><p>The same idea produces very different risk depending on whether you pilot, lease an existing site, build from scratch or simply hold land.</p></div>
      <div class="panel verdict-matrix"><div class="strategy-card header"><div>Strategy</div><div>Capital</div><div>Debt request</div><div>DSCR</div><div>Verdict</div></div><div id="strategyRows"></div></div>

      <div class="section-head"><div><h2>Financing paths to investigate</h2></div><p>Program facts come from SBA sources. Your lender sets underwriting, documentation and final terms.</p></div>
      <div class="loan-options">
        <div class="panel loan-card"><span class="tag-live">Flexible</span><div class="loan-max">Up to $5M</div><h3>SBA 7(a)</h3><ul><li>Land, building and renovations</li><li>Equipment and fixtures</li><li>Startup and working capital</li><li>Real-estate terms can reach 25 years</li></ul><a href="https://www.sba.gov/funding-programs/loans/7a-loans" target="_blank" rel="noreferrer">Official SBA details</a></div>
        <div class="panel loan-card"><span class="tag-ready">Fixed assets</span><div class="loan-max">Up to $5.5M</div><h3>SBA 504</h3><ul><li>Land and existing buildings</li><li>New construction</li><li>Long-term equipment</li><li>Not the working-capital layer</li></ul><a href="https://www.sba.gov/funding-programs/loans/504-loans" target="_blank" rel="noreferrer">Official SBA details</a></div>
        <div class="panel loan-card"><span class="tag-ready">Small test</span><div class="loan-max">Up to $50K</div><h3>SBA Microloan</h3><ul><li>Equipment, supplies and inventory</li><li>Working capital</li><li>Useful for a small pilot</li><li>Intermediary lender rules vary</li></ul><a href="https://www.sba.gov/funding-programs/loans/microloans" target="_blank" rel="noreferrer">Official SBA details</a></div>
        <div class="panel loan-card"><span class="tag-pending">Lender specific</span><div class="loan-max">Custom</div><h3>Land / construction loan</h3><ul><li>May finance acquisition and build</li><li>Often needs stronger cash and collateral</li><li>Terms differ widely by lender</li><li>Compare with SBA structure</li></ul><button class="secondary" id="openLenderMatch">Open SBA Lender Match</button></div>
      </div>
      <div class="disclaimer-box" style="margin-top:14px">This dashboard is a planning model, not financial advice, a credit decision or a commitment to lend. It does not know a lender’s minimum credit score, collateral policy, equity requirement or final rate. Speak with an SBA lender, CDC, accountant and attorney before committing capital.</div>`;
    const footer=document.querySelector('.footer');
    footer.parentNode.insertBefore(finance,footer);

    const script=document.createElement('script');script.src=`finance.js?v=20260726-2`;document.body.appendChild(script);
  }
  installFinanceView();

  const waitForLand=setInterval(()=>{if(state.lands.length){clearInterval(waitForLand);renderAskParcels('best land');enhanceMainLandCards();}},120);
  setTimeout(()=>clearInterval(waitForLand),15000);
})();