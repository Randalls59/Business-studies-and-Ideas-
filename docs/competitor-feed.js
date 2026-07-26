(() => {
  function cleanValue(value=''){
    const text=String(value||'').trim();
    return /^(undefined|null|\[object Object\])$/i.test(text)?'':text;
  }
  function classify(row){
    const subtype=cleanValue(row.subtype).toLowerCase();
    const name=cleanValue(row.name).toLowerCase();
    const excluded=/cannabis|dispensary|department store|grocery store|mexican restaurant|american restaurant|steakhouse|seafood restaurant|bar & grill|pizza restaurant|chinese restaurant|thai restaurant|indian restaurant|hotel|gas station/.test(subtype);
    if(excluded)return null;
    if(/juice shop|juice bar|smoothie shop|açaí shop|acai shop/.test(subtype)||/\b(juice|smoothie|acai|açaí)\b/.test(name))return 'juice';
    if(/bubble tea store|bubble tea shop|tea store|tea shop|tea house|tea room/.test(subtype)||/\b(boba|bubble tea)\b/.test(name))return 'tea';
    if(/breakfast restaurant|brunch restaurant|bagel shop|donut shop|doughnut shop|bakery/.test(subtype))return 'breakfast';
    if(/coffee shop|coffee store|espresso bar|cafe|café/.test(subtype)||(/\b(coffee|espresso)\b/.test(name)&&!/restaurant/.test(subtype)))return 'coffee';
    return null;
  }
  async function loadStoredCompetitors(){
    try{
      const response=await fetch(`competitor-data.json?v=${Date.now()}`,{cache:'no-store'});
      if(!response.ok)throw new Error(`Competitor feed returned ${response.status}`);
      const data=await response.json();
      const seen=new Set();
      state.competitors=(data.listings||[]).map(row=>{
        const category=classify(row);
        return {
          ...row,
          category,
          name:cleanValue(row.name)||'Unnamed business',
          subtype:cleanValue(row.subtype)||'Beverage business',
          website:cleanValue(row.website),
          googleMapsUrl:cleanValue(row.googleMapsUrl),
          menuUrl:cleanValue(row.menuUrl),
          openingHours:cleanValue(row.openingHours),
          address:cleanValue(row.address),
          rating:Number(row.rating)||null,
          reviewsCount:Number(row.reviewsCount)||0,
          lat:Number(row.lat),lng:Number(row.lng)
        };
      }).filter(row=>{
        if(!row.category||!Number.isFinite(row.lat)||!Number.isFinite(row.lng)||row.permanentlyClosed)return false;
        const key=row.id||`${row.name}|${row.address}`.toLowerCase();
        if(seen.has(key))return false;seen.add(key);return true;
      });
      state.competitorScannedAt=data.updated_at||new Date().toISOString();
      localStorage.setItem('snapCompetitors',JSON.stringify(state.competitors));
      localStorage.setItem('snapCompetitorsAt',state.competitorScannedAt);
      renderCompetitors();
      if(byId('competitorStatus'))byId('competitorStatus').textContent=`${state.competitors.length} qualified listings · ${new Date(state.competitorScannedAt).toLocaleDateString('en-US')}`;
    }catch(error){
      console.warn('Stored competitor feed unavailable.',error);
      if(state.competitors.length)renderCompetitors();
    }
  }
  const loadScript = (src) => new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src=src;script.onload=resolve;script.onerror=reject;
    document.body.appendChild(script);
  });
  loadScript(`kolb-land.js?v=20260726-2`)
    .then(()=>loadScript(`concept-studio.js?v=20260726-1`))
    .catch(error=>console.warn('Dashboard extension failed to load.',error));
  loadStoredCompetitors();
})();
