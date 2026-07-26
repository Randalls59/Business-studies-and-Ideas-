(() => {
  viewTitles.finance = 'Capital Stack';

  const financeInputIds = ['financeCredit','financeCash','financeIncome','financeMonthlyDebt','financeRate','financeTerm','financeOperatingMonths','financePilotRevenue','financeSecondGenCost'];
  const financeState = {score:0,dscr:0,loanNeed:0,maxSupportableDebt:0,fundingGap:0,annualDebtService:0,creditBand:'',label:'',projectCost:0};

  function financeVal(id){ return Number(byId(id)?.value)||0; }
  function pct(value){ return `${Math.round(value*100)}%`; }
  function payment(principal,annualRate,years){
    if(principal<=0) return 0;
    const n=Math.max(1,years*12),r=Math.max(0,annualRate)/100/12;
    return r===0 ? principal/n : principal*r*Math.pow(1+r,n)/(Math.pow(1+r,n)-1);
  }
  function principalFromPayment(monthlyPayment,annualRate,years){
    if(monthlyPayment<=0) return 0;
    const n=Math.max(1,years*12),r=Math.max(0,annualRate)/100/12;
    return r===0 ? monthlyPayment*n : monthlyPayment*(Math.pow(1+r,n)-1)/(r*Math.pow(1+r,n));
  }
  function creditBand(score){
    if(score>=740) return {label:'Strong starting profile',points:30,note:'Personal credit is a positive input, but lenders still underwrite cash flow, equity, collateral and repayment ability.'};
    if(score>=700) return {label:'Competitive starting profile',points:26,note:'Potentially workable for lender conversations when the cash injection and projections are credible.'};
    if(score>=660) return {label:'Developing profile',points:20,note:'Possible, but stronger cash, collateral, operating evidence or a partner may matter more.'};
    if(score>=620) return {label:'Constrained profile',points:12,note:'Expect a narrower lender pool and heavier emphasis on cash, collateral and proof.'};
    return {label:'Repair-first profile',points:5,note:'Focus on credit cleanup, cash reserves, proof of demand and alternative capital before major construction debt.'};
  }
  function dscrPoints(value){if(value>=1.5)return 30;if(value>=1.35)return 26;if(value>=1.25)return 22;if(value>=1.1)return 14;if(value>=1)return 8;return 2;}
  function cashPoints(injection){if(injection>=.25)return 25;if(injection>=.20)return 22;if(injection>=.15)return 18;if(injection>=.10)return 13;if(injection>=.05)return 7;return 2;}
  function evidencePoints(months,pilotRevenue){let points=0;if(months>=24)points+=10;else if(months>=12)points+=8;else if(months>=6)points+=5;else if(months>=3)points+=3;if(pilotRevenue>=30000)points+=5;else if(pilotRevenue>=15000)points+=4;else if(pilotRevenue>=5000)points+=2;return Math.min(15,points);}
  function readinessLabel(score){
    if(score>=82)return ['Lender conversation ready','Your inputs are strong enough to prepare a lender package, subject to real underwriting.'];
    if(score>=68)return ['Promising, not proven','The capital structure is plausible, but one or two weak points still need work.'];
    if(score>=52)return ['Build the file first','Improve equity, repayment coverage or operating proof before pursuing a full project loan.'];
    return ['Do not finance ground-up yet','The current profile makes large construction debt too fragile. Test the concept and repair the funding profile first.'];
  }

  function strategyVerdict(type,capital,cash,credit,dscr,months,pilotRevenue){
    const injection=capital>0?cash/capital:0;
    if(type==='pilot')return cash>=25000||pilotRevenue>=5000?['START WITH TEST','verdict-go']:['BUILD STARTER CASH','verdict-test'];
    if(type==='secondgen'){
      if(credit>=680&&injection>=.12&&dscr>=1.25&&(months>=6||pilotRevenue>=10000))return ['BEST SCALE PATH','verdict-go'];
      if(dscr>=1.1&&injection>=.08)return ['PREP + TEST','verdict-test'];
      return ['WAIT','verdict-wait'];
    }
    if(type==='groundup'){
      if(credit>=700&&injection>=.20&&dscr>=1.35&&(months>=12||pilotRevenue>=30000))return ['FINANCEABLE THESIS','verdict-go'];
      if(dscr>=1.15&&injection>=.10)return ['NOT YET','verdict-wait'];
      return ['TOO FRAGILE','verdict-no'];
    }
    return ['SEPARATE ASSET BET','verdict-test'];
  }

  function renderStrategyMatrix(rate,credit,cash,months,pilotRevenue){
    const profitAnnual=Math.max(0,state.build.profit*12);
    const selectedLand=val('landPurchase');
    const rows=[
      {type:'pilot',name:'Paid pilot / modular test',sub:'Prove demand before property risk',capital:50000,term:7,cashFlow:Math.max(pilotRevenue*12,18000)},
      {type:'secondgen',name:'Second-generation location',sub:'Lease or buy an existing fitted site',capital:financeVal('financeSecondGenCost'),term:15,cashFlow:profitAnnual},
      {type:'groundup',name:'Buy land + build SNAP',sub:'Maximum control and maximum execution risk',capital:state.build.lowTotal,term:25,cashFlow:profitAnnual},
      {type:'landhold',name:'Buy land and hold',sub:'Asset thesis without proven store cash flow',capital:selectedLand*1.12,term:15,cashFlow:0}
    ];
    byId('strategyRows').innerHTML=rows.map(row=>{
      const debt=Math.max(0,row.capital-cash),annualDebt=payment(debt,rate,row.term)*12,rowDscr=annualDebt>0?row.cashFlow/annualDebt:row.cashFlow>0?9.9:0;
      const [verdict,klass]=strategyVerdict(row.type,row.capital,cash,credit,rowDscr,months,pilotRevenue);
      return `<div class="strategy-card"><div class="strategy-name"><b>${escapeHtml(row.name)}</b><small>${escapeHtml(row.sub)}</small></div><div class="strategy-value">${money(row.capital)}</div><div class="strategy-value">${money(debt)}</div><div class="strategy-value">${rowDscr?rowDscr.toFixed(2)+'×':'No cash flow'}</div><span class="strategy-verdict ${klass}">${verdict}</span></div>`;
    }).join('');
  }

  function calculateFinance(){
    if(!state.build?.lowTotal||!byId('financeCredit'))return;
    const credit=financeVal('financeCredit'),cash=financeVal('financeCash'),income=financeVal('financeIncome'),monthlyDebt=financeVal('financeMonthlyDebt'),rate=financeVal('financeRate'),term=financeVal('financeTerm'),months=financeVal('financeOperatingMonths'),pilotRevenue=financeVal('financePilotRevenue');
    const projectCost=state.build.lowTotal,loanNeed=Math.max(0,projectCost-cash),monthlyLoan=payment(loanNeed,rate,term),operatingCash=Math.max(0,state.build.profit*12),annualDebtService=(monthlyLoan+monthlyDebt)*12;
    const dscr=annualDebtService>0?operatingCash/annualDebtService:operatingCash>0?9.9:0;
    const targetDscr=1.25,availableMonthlyDebt=Math.max(0,operatingCash/12/targetDscr-monthlyDebt),maxSupportableDebt=principalFromPayment(availableMonthlyDebt,rate,term),supportedDebt=Math.min(loanNeed,maxSupportableDebt),fundingGap=Math.max(0,loanNeed-supportedDebt);
    const injection=projectCost>0?Math.min(1,cash/projectCost):0,creditData=creditBand(credit),score=Math.round(Math.min(100,creditData.points+cashPoints(injection)+dscrPoints(dscr)+evidencePoints(months,pilotRevenue))),[label,detail]=readinessLabel(score),householdCoverage=monthlyDebt>0?(income/12)/monthlyDebt:null;

    Object.assign(financeState,{score,dscr,loanNeed,maxSupportableDebt:supportedDebt,fundingGap,annualDebtService,creditBand:creditData.label,label,projectCost});
    byId('readinessRing').style.setProperty('--score',score);byId('readinessScore').textContent=score;byId('readinessLabel').textContent=label;byId('readinessDetail').textContent=detail;
    byId('financeProjectCost').textContent=money(projectCost);byId('financeCashPct').textContent=pct(injection);byId('financeLoanNeed').textContent=money(loanNeed);byId('financeMonthlyPayment').textContent=money(monthlyLoan);byId('financeDscr').textContent=isFinite(dscr)?`${dscr.toFixed(2)}×`:'—';
    byId('financeCreditBand').textContent=creditData.label;byId('financeCreditNote').textContent=creditData.note;byId('financeHousehold').textContent=householdCoverage?`${householdCoverage.toFixed(1)}× income/debt`:'No monthly debts entered';

    const cashShare=projectCost?Math.min(100,cash/projectCost*100):0,debtShare=projectCost?Math.min(100-cashShare,supportedDebt/projectCost*100):0,gapShare=projectCost?Math.min(100,fundingGap/projectCost*100):0;
    byId('stackBar').innerHTML=`<div class="stack-segment stack-cash" style="width:${cashShare}%">${cashShare>=9?'Owner cash':''}</div><div class="stack-segment stack-debt" style="width:${debtShare}%">${debtShare>=12?'Cash-flow-supported debt':''}</div>${gapShare?`<div class="stack-segment stack-gap" style="width:${gapShare}%">Gap</div>`:''}`;
    byId('stackNarrative').textContent=`The project requests ${money(loanNeed)} of debt. At a 1.25× planning DSCR, current modeled cash flow supports about ${money(supportedDebt)}, leaving an illustrative ${money(fundingGap)} equity, investor or cost-reduction gap. This is not a lender decision.`;
    renderStrategyMatrix(rate,credit,cash,months,pilotRevenue);updateCapitalVerdict();
  }

  function updateCapitalVerdict(){
    const selectedLand=val('landPurchase'),total=state.build.lowTotal,landShare=total?selectedLand/total:0;
    let verdict='TEST THE STORE BEFORE BUYING LAND',reason='The land may be an asset, but appreciation does not prove the operating concept. A paid pilot and second-generation site preserve cash and create evidence for lenders.';
    if(financeState.score>=82&&financeState.dscr>=1.35&&financeVal('financeOperatingMonths')>=12){verdict='PREPARE A TWO-LAYER CAPITAL STACK';reason='Use fixed-asset financing for land/building and a separate working-capital layer, while keeping a meaningful contingency reserve.';}
    else if(financeState.score>=68&&financeState.dscr>=1.2){verdict='SECOND-GENERATION FIRST';reason='The economics can support a lender conversation, but ground-up construction adds avoidable cost and entitlement risk before demand is proven.';}
    if(financeState.fundingGap>250000){verdict='CLOSE THE FUNDING GAP BEFORE LAND';reason=`Modeled cash flow does not currently support the full debt request. The illustrative funding gap is ${money(financeState.fundingGap)}, so the next move is a smaller format, more equity, an investor partner or a lower-cost site.`;}
    byId('capitalVerdictTitle').textContent=verdict;byId('capitalVerdictText').textContent=reason;byId('capitalVerdictLandShare').textContent=pct(landShare);byId('capitalVerdictProfit').textContent=money(state.build.profit);byId('capitalVerdictPayback').textContent=isFinite(state.build.payback)?`${state.build.payback.toFixed(1)} months`:'Not reached';
  }

  function financeAnswer(question){
    if(/credit score/i.test(question))return `A credit score does not translate directly into a guaranteed loan amount. At the current ${financeVal('financeCredit')} score, the dashboard classifies the profile as “${financeState.creditBand}.” Lenders also evaluate cash flow, equity, collateral, projections and repayment ability.`;
    if(/how much.*loan|loan amount|borrow|finance|fund/i.test(question))return `The current low-case project is ${money(financeState.projectCost)}. With ${money(financeVal('financeCash'))} of owner cash, the requested debt is ${money(financeState.loanNeed)}. Current modeled cash flow supports about ${money(financeState.maxSupportableDebt)} at a 1.25× planning DSCR, leaving an illustrative ${money(financeState.fundingGap)} gap. Readiness: ${financeState.score}/100 — ${financeState.label}.`;
    return `Current funding readiness is ${financeState.score}/100. The model favors a paid pilot and second-generation site before ground-up construction unless cash injection, operating proof and debt coverage improve.`;
  }

  const baseAskSnap=askSnap;
  askSnap=async function(question){if(/loan|finance|financing|credit score|capital|borrow|funding|down payment|sba|lender/i.test(question)){calculateFinance();setTimeout(()=>switchView('finance'),900);return financeAnswer(question);}return baseAskSnap(question);};
  const baseCalculateBuild=calculateBuild;calculateBuild=function(){baseCalculateBuild();calculateFinance();};

  financeInputIds.forEach(id=>byId(id)?.addEventListener('input',calculateFinance));
  buildInputIds.forEach(id=>byId(id)?.addEventListener('input',calculateFinance));
  byId('useCurrentProject')?.addEventListener('click',()=>{calculateFinance();byId('liveStatus').textContent='Capital stack recalculated';});
  byId('openLenderMatch')?.addEventListener('click',()=>window.open('https://www.sba.gov/funding-programs/loans/lender-match-connects-you-lenders','_blank','noopener'));
  const wait=setInterval(()=>{if(state.build?.lowTotal){clearInterval(wait);calculateFinance();}},100);setTimeout(()=>clearInterval(wait),12000);
})();

const apifyStyle = document.createElement('link');
apifyStyle.rel = 'stylesheet';
apifyStyle.href = 'apify-dashboard.css?v=20260726-1';
document.head.appendChild(apifyStyle);
const apifyScript = document.createElement('script');
apifyScript.src = 'apify-dashboard.js?v=20260726-1';
document.body.appendChild(apifyScript);
