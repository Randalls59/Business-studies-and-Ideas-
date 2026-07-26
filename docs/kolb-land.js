(() => {
  let kolbOnly = true;
  const priceKnown = land => Number.isFinite(Number(land.price)) && Number(land.price) > 0;
  const priceText = land => priceKnown(land) ? money(land.price) : (land.price_label || 'Price upon request');
  const statusClass = status => /under contract|pending/i.test(status || '') ? 'tag-pending' : /active|available/i.test(status || '') ? 'tag-live' : 'tag-ready';
  const isKolb = land => /kolb/i.test(`${land.corridor || ''} ${land.address || ''} ${land.priority || ''}`);

  const toolbar = document.querySelector('#view-land .toolbar');
  if (toolbar && !document.getElementById('kolbOnlyBtn')) {
    const button = document.createElement('button');
    button.id = 'kolbOnlyBtn';
    button.className = 'primary';
    button.textContent = 'Kolb shortlist: ON';
    button.addEventListener('click', () => {
      kolbOnly = !kolbOnly;
      button.textContent = `Kolb shortlist: ${kolbOnly ? 'ON' : 'OFF'}`;
      button.className = kolbOnly ? 'primary' : 'secondary';
      applyLandFilters();
    });
    toolbar.insertBefore(button, toolbar.firstChild);
  }

  const priceInput = byId('landMaxPrice');
  if (priceInput && Number(priceInput.value) === 250000) priceInput.value = 1000000;

  applyLandFilters = function(){
    const maxPrice = Number(byId('landMaxPrice').value) || Infinity;
    const minSqft = Number(byId('landMinSqft').value) || 0;
    const sort = byId('landSort').value;
    state.filteredLands = state.lands.filter(land => {
      const matchesCorridor = !kolbOnly || isKolb(land);
      const matchesPrice = !priceKnown(land) || Number(land.price) <= maxPrice;
      return matchesCorridor && matchesPrice && lotSqft(land) >= minSqft;
    });
    state.filteredLands.sort((a,b) => {
      const priority = Number(Boolean(isKolb(b))) - Number(Boolean(isKolb(a)));
      if (priority) return priority;
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
    byId('landCount').textContent = all.length;
    byId('landUnderCap').textContent = all.filter(land => priceKnown(land) && Number(land.price) <= maxPrice).length;
    byId('landTopSite').textContent = all.length ? `${Math.max(...all.map(land=>land.site_score))}/100` : '—';
    byId('landTopHold').textContent = all.length ? `${Math.max(...all.map(land=>land.hold_score))}/100` : '—';
    state.landLayer.clearLayers();
    filtered.forEach(land => {
      const color = land.site_score >= 85 ? '#16a34a' : land.site_score >= 70 ? '#0284c7' : land.site_score >= 60 ? '#f97316' : '#b83232';
      L.circleMarker([land.lat,land.lng],{radius:9,color,fillColor:color,fillOpacity:.82,weight:2}).addTo(state.landLayer)
        .bindPopup(`<b>${escapeHtml(land.address)}</b><br>${escapeHtml(priceText(land))} · ${number(land.lot_size)} ${escapeHtml(land.lot_unit)}<br>${escapeHtml(land.status || 'Status unverified')}<br>Site ${land.site_score}/100 · Hold ${land.hold_score}/100`);
    });
    if(filtered.length){
      const bounds = L.latLngBounds(filtered.map(land=>[land.lat,land.lng]));
      state.landMap.fitBounds(bounds.pad(.18));
    }
    byId('landCards').innerHTML = filtered.length ? filtered.map(land => `
      <article class="land-card ${isKolb(land)?'kolb-priority':''}">
        <div class="price">${escapeHtml(priceText(land))}</div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:7px 0 5px">
          ${isKolb(land)?'<span class="tag-live">Kolb priority</span>':''}
          <span class="${statusClass(land.status)}">${escapeHtml(land.status || 'Verify status')}</span>
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
          ${priceKnown(land) ? `<button class="secondary use-land" data-price="${land.price}">Use price in build model</button>` : '<button class="secondary" disabled>Broker price required</button>'}
        </div>
      </article>`).join('') : '<div class="notice">No properties meet the current Kolb, price and lot-size filters.</div>';
    document.querySelectorAll('.use-land').forEach(btn => btn.addEventListener('click',()=>{
      byId('landPurchase').value = btn.dataset.price;
      calculateBuild();
      switchView('build');
    }));
    calculateDashboardScore();
  };

  const style = document.createElement('style');
  style.textContent = `.land-card.kolb-priority{border-color:rgba(73,198,255,.35);box-shadow:0 18px 55px rgba(14,165,233,.08)} .land-card button:disabled{opacity:.5;cursor:not-allowed}`;
  document.head.appendChild(style);

  if (state.lands.length) applyLandFilters();
})();
