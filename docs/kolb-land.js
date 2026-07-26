(() => {
  const HARD_CAP = 200000;
  let kolbOnly = true;
  let includeUnpriced = false;
  const priceKnown = land => Number.isFinite(Number(land.price)) && Number(land.price) > 0;
  const priceText = land => priceKnown(land) ? money(land.price) : (land.price_label || 'Price upon request');
  const statusClass = status => /under contract|pending/i.test(status || '') ? 'tag-pending' : /active|available/i.test(status || '') ? 'tag-live' : 'tag-ready';
  const isKolb = land => /kolb/i.test(`${land.corridor || ''} ${land.address || ''} ${land.priority || ''}`);
  const isBudgetQualified = land => priceKnown(land) && Number(land.price) <= HARD_CAP;
  window.SNAP_LAND_HARD_CAP = HARD_CAP;

  const toolbar = document.querySelector('#view-land .toolbar');
  if (toolbar && !document.getElementById('kolbOnlyBtn')) {
    const kolbButton = document.createElement('button');
    kolbButton.id = 'kolbOnlyBtn';
    kolbButton.className = 'primary';
    kolbButton.textContent = 'Kolb shortlist: ON';
    kolbButton.addEventListener('click', () => {
      kolbOnly = !kolbOnly;
      kolbButton.textContent = `Kolb shortlist: ${kolbOnly ? 'ON' : 'OFF'}`;
      kolbButton.className = kolbOnly ? 'primary' : 'secondary';
      applyLandFilters();
    });

    const unpricedButton = document.createElement('button');
    unpricedButton.id = 'unpricedLandBtn';
    unpricedButton.className = 'secondary';
    unpricedButton.textContent = 'Unpriced leads: OFF';
    unpricedButton.addEventListener('click', () => {
      includeUnpriced = !includeUnpriced;
      unpricedButton.textContent = `Unpriced leads: ${includeUnpriced ? 'ON' : 'OFF'}`;
      unpricedButton.className = includeUnpriced ? 'primary' : 'secondary';
      applyLandFilters();
    });

    toolbar.insertBefore(unpricedButton, toolbar.firstChild);
    toolbar.insertBefore(kolbButton, toolbar.firstChild);
  }

  const landPanel = document.querySelector('#view-land > .panel');
  if (landPanel && !document.getElementById('landBudgetRule')) {
    const notice = document.createElement('div');
    notice.id = 'landBudgetRule';
    notice.className = 'notice warning';
    notice.style.marginBottom = '12px';
    notice.innerHTML = '<b>Budget rule:</b> Only properties with a confirmed asking price of <b>$200,000 or less</b> qualify. “Price upon request” listings are excluded unless you deliberately turn them on.';
    landPanel.insertBefore(notice, landPanel.firstChild);
  }

  const priceInput = byId('landMaxPrice');
  if (priceInput) {
    priceInput.value = HARD_CAP;
    priceInput.max = HARD_CAP;
    priceInput.title = 'Maximum land acquisition budget';
  }

  applyLandFilters = function(){
    const requestedMax = Number(byId('landMaxPrice').value) || HARD_CAP;
    const maxPrice = Math.min(requestedMax, HARD_CAP);
    byId('landMaxPrice').value = maxPrice;
    const minSqft = Number(byId('landMinSqft').value) || 0;
    const sort = byId('landSort').value;
    state.filteredLands = state.lands.filter(land => {
      const matchesCorridor = !kolbOnly || isKolb(land);
      const matchesPrice = priceKnown(land) ? Number(land.price) <= maxPrice : includeUnpriced;
      return matchesCorridor && matchesPrice && lotSqft(land) >= minSqft;
    });
    state.filteredLands.sort((a,b) => {
      if (sort === 'hold') return b.hold_score-a.hold_score;
      if (sort === 'price') {
        if (!priceKnown(a) && !priceKnown(b)) return b.site_score-a.site_score;
        if (!priceKnown(a)) return 1;
        if (!priceKnown(b)) return -1;
        return a.price-b.price;
      }
      if (sort === 'size') return lotSqft(b)-lotSqft(a);
      return b.site_score-a.site_score;
    });
    renderLands(maxPrice);
  };

  renderLands = function(maxPrice){
    const all = state.lands;
    const filtered = state.filteredLands;
    const qualified = all.filter(land => (!kolbOnly || isKolb(land)) && priceKnown(land) && Number(land.price) <= maxPrice);
    byId('landCount').textContent = kolbOnly ? all.filter(isKolb).length : all.length;
    byId('landUnderCap').textContent = qualified.length;
    byId('landTopSite').textContent = qualified.length ? `${Math.max(...qualified.map(land=>land.site_score))}/100` : 'None';
    byId('landTopHold').textContent = qualified.length ? `${Math.max(...qualified.map(land=>land.hold_score))}/100` : 'None';
    state.landLayer.clearLayers();
    filtered.forEach(land => {
      const color = isBudgetQualified(land) ? '#16a34a' : '#64748b';
      L.circleMarker([land.lat,land.lng],{radius:9,color,fillColor:color,fillOpacity:.82,weight:2}).addTo(state.landLayer)
        .bindPopup(`<b>${escapeHtml(land.address)}</b><br>${escapeHtml(priceText(land))} · ${number(land.lot_size)} ${escapeHtml(land.lot_unit)}<br>${escapeHtml(land.status || 'Status unverified')}<br>${isBudgetQualified(land) ? 'Within $200K land budget' : 'Not budget-qualified'}<br>Site ${land.site_score}/100 · Hold ${land.hold_score}/100`);
    });
    if(filtered.length){
      const bounds = L.latLngBounds(filtered.map(land=>[land.lat,land.lng]));
      state.landMap.fitBounds(bounds.pad(.18));
    }
    const emptyMessage = kolbOnly && !includeUnpriced
      ? '<div class="notice warning"><b>No confirmed Kolb commercial parcel is currently listed at $200,000 or less.</b><br><br>The unpriced Kolb pads are not being counted because their prices could exceed the budget. The practical alternatives are a ground lease, a subdivided pad, an existing second-generation drive-through, or a nearby corridor where the land price is confirmed.</div>'
      : '<div class="notice">No properties meet the current corridor, price and lot-size filters.</div>';
    byId('landCards').innerHTML = filtered.length ? filtered.map(land => `
      <article class="land-card ${isKolb(land)?'kolb-priority':''}">
        <div class="price">${escapeHtml(priceText(land))}</div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:7px 0 5px">
          ${isKolb(land)?'<span class="tag-live">Kolb priority</span>':''}
          <span class="${statusClass(land.status)}">${escapeHtml(land.status || 'Verify status')}</span>
          <span class="${isBudgetQualified(land)?'tag-live':'tag-pending'}">${isBudgetQualified(land)?'Within $200K':'Not price-qualified'}</span>
          ${land.fit ? `<span class="tag-ready">${escapeHtml(land.fit)}</span>` : ''}
        </div>
        <h3>${escapeHtml(land.address)}</h3>
        <div class="land-meta"><span>${number(land.lot_size)} ${escapeHtml(land.lot_unit)}</span><span>${escapeHtml(land.corridor)}</span><span>Zoning: ${escapeHtml(land.zoning)}</span></div>
        ${land.traffic ? `<div class="notice" style="margin:10px 0 0"><b>Traffic evidence:</b> ${escapeHtml(land.traffic)}</div>` : ''}
        <p>${escapeHtml(land.note)}</p>
        <div class="land-actions">
          <span class="score-chip ${scoreClass(land.site_score)}">Site ${land.site_score}</span>
          <span class="score-chip ${scoreClass(land.hold_score)}">Hold ${land.hold_score}</span>
        </div>
        <div class="land-actions" style="margin-top:10px">
          <a href="${safeUrl(land.url)}" target="_blank" rel="noreferrer">Open commercial listing</a>
          ${isBudgetQualified(land) ? `<button class="secondary use-land" data-price="${land.price}">Use price in build model</button>` : '<button class="secondary" disabled>Outside confirmed budget</button>'}
        </div>
      </article>`).join('') : emptyMessage;
    document.querySelectorAll('.use-land').forEach(btn => btn.addEventListener('click',()=>{
      byId('landPurchase').value = btn.dataset.price;
      calculateBuild();
      switchView('build');
    }));
    calculateDashboardScore();
  };

  const baseAskSnap = askSnap;
  askSnap = async function(question){
    const normalized = String(question || '').toLowerCase();
    if ((/kolb/.test(normalized) || /under\s*\$?200(?:,?000|k)/.test(normalized)) && /land|parcel|lot|site/.test(normalized)) {
      kolbOnly = true;
      includeUnpriced = false;
      if (byId('kolbOnlyBtn')) { byId('kolbOnlyBtn').textContent = 'Kolb shortlist: ON'; byId('kolbOnlyBtn').className = 'primary'; }
      if (byId('unpricedLandBtn')) { byId('unpricedLandBtn').textContent = 'Unpriced leads: OFF'; byId('unpricedLandBtn').className = 'secondary'; }
      byId('landMaxPrice').value = HARD_CAP;
      byId('landMinSqft').value = 0;
      applyLandFilters();
      setTimeout(()=>switchView('land'),500);
      const count = state.lands.filter(land => isKolb(land) && isBudgetQualified(land)).length;
      return count
        ? `I found ${count} Kolb-area commercial properties with confirmed asking prices at or below $200,000. I opened the budget-qualified Land Watch view.`
        : `There are currently no confirmed Kolb-area commercial parcels listed at $200,000 or less in the stored commercial snapshot. Unpriced listings are excluded because “price upon request” cannot be treated as within budget. I opened Land Watch so you can see the strict result and optionally review unpriced leads separately.`;
    }
    return baseAskSnap(question);
  };

  const style = document.createElement('style');
  style.textContent = `.land-card.kolb-priority{border-color:rgba(73,198,255,.35);box-shadow:0 18px 55px rgba(14,165,233,.08)} .land-card button:disabled{opacity:.5;cursor:not-allowed}`;
  document.head.appendChild(style);

  if (state.lands.length) applyLandFilters();
})();
