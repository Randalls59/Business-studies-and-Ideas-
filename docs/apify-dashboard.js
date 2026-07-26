(() => {
  const dataUrl = `competitor-data.json?v=${Date.now()}`;
  let focusMarker = null;
  let apifyMeta = null;

  const validUrl = value => {
    try {
      const url = new URL(value, window.location.href);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch {
      return '';
    }
  };

  function displayPrice(value) {
    if (!value) return '—';
    const text = String(value);
    if (/^\d+$/.test(text)) return '$'.repeat(Math.min(4, Math.max(1, Number(text))));
    return text.length > 18 ? `${text.slice(0, 18)}…` : text;
  }

  function driveStatus(value) {
    const text = String(value || 'unknown').toLowerCase();
    if (['yes', 'true', 'possible'].includes(text)) return { label: text === 'possible' ? 'Possible' : 'Yes', klass: 'yes' };
    if (['no', 'false'].includes(text)) return { label: 'No', klass: 'no' };
    return { label: 'Unknown', klass: 'unknown' };
  }

  function focusBusiness(item, row) {
    if (!state.competitorMap || item.lat == null || item.lng == null) return;
    state.competitorMap.setView([item.lat, item.lng], 16, { animate: true });
    if (focusMarker) focusMarker.remove();
    focusMarker = L.circleMarker([item.lat, item.lng], {
      radius: 14,
      color: '#07111c',
      fillColor: '#49c6ff',
      fillOpacity: .96,
      weight: 4,
    }).addTo(state.competitorMap)
      .bindPopup(`<b>${escapeHtml(item.name)}</b><br>${escapeHtml(item.address || item.subtype || '')}<br>${item.rating ? `Rating ${item.rating} · ${number(item.reviewsCount || 0)} reviews<br>` : ''}${item.googleMapsUrl ? `<a href="${validUrl(item.googleMapsUrl)}" target="_blank" rel="noreferrer">Open Google Maps</a>` : ''}`)
      .openPopup();
    document.querySelectorAll('.premium-data-table tbody tr').forEach(current => current.classList.toggle('selected', current === row));
    setTimeout(() => state.competitorMap.invalidateSize(), 80);
  }

  function renderPremiumTable(rows) {
    const target = byId('competitorList');
    if (!target) return;
    const sourceText = apifyMeta?.updated_at
      ? `Google Maps via Apify · updated ${new Date(apifyMeta.updated_at).toLocaleString('en-US')}`
      : 'Open data fallback';

    const summary = `<div class="apify-summary"><span class="source-pill">${escapeHtml(sourceText)}</span><small>Click any row to focus the map. Ratings and review counts come from the latest stored feed.</small></div>`;
    if (!rows.length) {
      target.innerHTML = `${summary}<div class="empty">No businesses match the current filters.</div>`;
      return;
    }

    target.innerHTML = `${summary}<div class="premium-table-wrap"><table class="premium-data-table"><thead><tr>
      <th>Business</th><th>Category</th><th>Rating</th><th>Price</th><th>Drive-through</th><th>Hours</th><th>Links</th>
    </tr></thead><tbody>${rows.slice(0, 750).map((item, index) => {
      const drive = driveStatus(item.driveThrough);
      const website = validUrl(item.website);
      const maps = validUrl(item.googleMapsUrl);
      const menu = validUrl(item.menuUrl);
      return `<tr data-index="${index}">
        <td class="business-cell"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.address || 'Address not captured')}</small></td>
        <td><span class="category-pill">${escapeHtml(labelCategory(item.category))}</span></td>
        <td class="rating-cell">${item.rating ? `<span class="rating-star">★</span>${Number(item.rating).toFixed(1)}<span class="review-count">${number(item.reviewsCount || 0)} reviews</span>` : '—'}</td>
        <td>${escapeHtml(displayPrice(item.priceLevel))}</td>
        <td><span class="drive-pill ${drive.klass}">${drive.label}</span></td>
        <td class="hours-cell">${escapeHtml(item.openingHours || 'Not captured')}</td>
        <td><div class="table-actions">${maps ? `<a class="secondary" href="${maps}" target="_blank" rel="noreferrer">Maps</a>` : ''}${website ? `<a class="secondary" href="${website}" target="_blank" rel="noreferrer">Website</a>` : ''}${menu ? `<a class="secondary" href="${menu}" target="_blank" rel="noreferrer">Menu</a>` : ''}<button class="secondary focus-business" data-index="${index}">Show map</button></div></td>
      </tr>`;
    }).join('')}</tbody></table></div>`;

    const tableRows = [...target.querySelectorAll('tbody tr')];
    tableRows.forEach(row => row.addEventListener('click', event => {
      if (event.target.closest('a,button')) return;
      focusBusiness(rows[Number(row.dataset.index)], row);
    }));
    target.querySelectorAll('.focus-business').forEach(button => button.addEventListener('click', () => {
      const row = button.closest('tr');
      focusBusiness(rows[Number(button.dataset.index)], row);
    }));
  }

  const baseRenderCompetitors = renderCompetitors;
  renderCompetitors = function renderCompetitorsWithTable() {
    baseRenderCompetitors();
    renderPremiumTable(competitorFiltered());
  };

  async function loadApifyFeed({ announce = false } = {}) {
    const status = byId('competitorStatus');
    if (announce && status) status.textContent = 'Loading Google Maps data…';
    try {
      const response = await fetch(`${dataUrl}&refresh=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Feed returned ${response.status}`);
      const payload = await response.json();
      if (!Array.isArray(payload.listings) || !payload.listings.length) throw new Error('The Apify feed is not populated yet.');
      apifyMeta = payload;
      state.competitors = payload.listings.map(item => ({
        ...item,
        lat: Number(item.lat),
        lng: Number(item.lng),
        category: item.category || 'coffee',
        subtype: item.subtype || 'business',
        driveThrough: item.driveThrough || 'unknown',
      })).filter(item => Number.isFinite(item.lat) && Number.isFinite(item.lng) && !item.permanentlyClosed);
      state.competitorScannedAt = payload.updated_at || new Date().toISOString();
      localStorage.setItem('snapCompetitors', JSON.stringify(state.competitors));
      localStorage.setItem('snapCompetitorsAt', state.competitorScannedAt);
      renderCompetitors();
      if (status) status.textContent = `${state.competitors.length} Google Maps listings`;
      if (byId('liveStatus')) byId('liveStatus').textContent = 'Apify competitor feed loaded';
      const button = byId('scanCityBtn');
      if (button) button.textContent = 'Refresh Google Maps data';
      return true;
    } catch (error) {
      console.warn('Apify competitor feed unavailable; keeping current dashboard data.', error);
      if (announce && status) status.textContent = 'Apify feed pending — using fallback';
      return false;
    }
  }

  const scanButton = byId('scanCityBtn');
  if (scanButton) {
    scanButton.textContent = 'Refresh Google Maps data';
    scanButton.addEventListener('click', async event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      scanButton.disabled = true;
      scanButton.textContent = 'Refreshing…';
      const loaded = await loadApifyFeed({ announce: true });
      if (!loaded) {
        scanButton.textContent = 'Use open-data fallback';
        await scanTucsonCompetitors();
      }
      scanButton.disabled = false;
      if (loaded) scanButton.textContent = 'Refresh Google Maps data';
    }, true);
  }

  const refreshButton = byId('refreshAllBtn');
  if (refreshButton) refreshButton.addEventListener('click', () => setTimeout(() => loadApifyFeed(), 50));

  loadApifyFeed().then(loaded => {
    if (!loaded && state.competitors.length) renderCompetitors();
  });
})();
