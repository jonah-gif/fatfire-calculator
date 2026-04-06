/**
 * FatFIRE Canada — calculator.js
 * Plain JS, no frameworks, no build step.
 */

// ── State ──────────────────────────────────────────────────────────────────
const state = {
  // Calc 1
  currentAge: 35,
  annualIncome: 180000,
  currentSavings: 100000,
  retirementExpenses: 120000,
  returnRate: 0.08,   // Moderate default
  savingsRate: 0.20,  // NEW — configurable savings rate
  province: 'ON',

  // Calc 2
  mortgageBalance: 650000,
  mortgageRate: 0.045,
  mortgageAmort: 22,
  heloc: 150000,
  calc2Income: 180000,

  // Gate / flow
  calc2Step: 'a',  // 'a' | 'b' | 'c'
  firstName: '',
  email: '',
};

// ── Province Tax Tables ────────────────────────────────────────────────────
// Brackets: [maxIncome, rate] — last entry is the 220K+ rate
const PROVINCE_TAX = {
  ON: [[50000, 0.20], [100000, 0.30], [150000, 0.35], [220000, 0.43], [Infinity, 0.48]],
  BC: [[50000, 0.20], [100000, 0.29], [150000, 0.35], [222000, 0.43], [Infinity, 0.47]],
  AB: [[50000, 0.18], [100000, 0.26], [150000, 0.33], [220000, 0.40], [Infinity, 0.44]],
  QC: [[50000, 0.25], [100000, 0.36], [150000, 0.42], [220000, 0.49], [Infinity, 0.53]],
  MB: [[50000, 0.24], [100000, 0.33], [150000, 0.40], [220000, 0.46], [Infinity, 0.50]],
  SK: [[50000, 0.22], [100000, 0.31], [150000, 0.38], [220000, 0.44], [Infinity, 0.48]],
  NS: [[50000, 0.24], [100000, 0.34], [150000, 0.41], [220000, 0.48], [Infinity, 0.54]],
  NB: [[50000, 0.23], [100000, 0.33], [150000, 0.40], [220000, 0.46], [Infinity, 0.50]],
  NL: [[50000, 0.24], [100000, 0.34], [150000, 0.41], [220000, 0.47], [Infinity, 0.51]],
  PE: [[50000, 0.24], [100000, 0.34], [150000, 0.41], [220000, 0.47], [Infinity, 0.51]],
};

const PROVINCE_NAMES = {
  ON: 'Ontario', BC: 'British Columbia', AB: 'Alberta', QC: 'Quebec',
  MB: 'Manitoba', SK: 'Saskatchewan', NS: 'Nova Scotia', NB: 'New Brunswick',
  NL: 'Newfoundland & Labrador', PE: 'Prince Edward Island',
};

// ── UTM Parameter Capture ──────────────────────────────────────────────────────────────────────
function getUTMParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    utm_source: params.get('utm_source') || '',
    utm_medium: params.get('utm_medium') || '',
    utm_campaign: params.get('utm_campaign') || '',
    utm_content: params.get('utm_content') || '',
    utm_term: params.get('utm_term') || '',
  };
}

function getEffectiveTaxRate(income, province) {
  const brackets = PROVINCE_TAX[province] || PROVINCE_TAX['ON'];
  for (const [max, rate] of brackets) {
    if (income <= max) return rate;
  }
  return brackets[brackets.length - 1][1];
}

// ── Core FatFIRE Calculation ───────────────────────────────────────────────
function calcFatFIRE(currentAge, income, savings, retExpenses, returnRate, province) {
  const target = retExpenses * 25;                           // 4% rule
  const taxRate = getEffectiveTaxRate(income, province || state.province);
  // Capital gains: 50% inclusion rate in Canada, so effective tax on investment gains
  // is approximately half the marginal rate
  const investmentTaxRate = taxRate * 0.5;
  const afterTaxReturn = returnRate * (1 - investmentTaxRate);
  const annualContrib = income * state.savingsRate;          // USE configurable rate
  const r = afterTaxReturn;
  const PV = savings;
  const PMT = annualContrib;

  let n = 0;
  let fv = PV;
  const maxYears = 80;
  while (fv < target && n < maxYears) {
    fv = fv * (1 + r) + PMT;
    n++;
  }

  const fireAge = currentAge + n;
  const progress = Math.min((savings / target) * 100, 100);

  return {
    target,
    afterTaxReturn,
    annualContrib,
    n,
    fireAge,
    progress,
    taxRate,
    fvAtN: fv,
  };
}

// ── Format helpers ─────────────────────────────────────────────────────────
function fmt(n, decimals = 0) {
  if (!isFinite(n)) return '—';
  return '$' + Math.round(n).toLocaleString('en-CA', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtPct(n) {
  return (n * 100).toFixed(1) + '%';
}

function fmtYears(n) {
  return n + ' year' + (n !== 1 ? 's' : '');
}

// ── Slider fill helper ─────────────────────────────────────────────────────
function updateSliderFill(input) {
  const min = parseFloat(input.min);
  const max = parseFloat(input.max);
  const val = parseFloat(input.value);
  const pct = ((val - min) / (max - min)) * 100;
  input.style.setProperty('--fill', pct + '%');
  input.classList.add('filled');
}

// ── Bind Calc 1 Inputs ─────────────────────────────────────────────────────
function bindCalc1() {
  const sliders = [
    { id: 'slider-age',        stateKey: 'currentAge',        display: 'val-age',        format: v => v + ' yrs' },
    { id: 'slider-income',     stateKey: 'annualIncome',      display: 'val-income',     format: v => fmt(v) },
    { id: 'slider-savings',    stateKey: 'currentSavings',    display: 'val-savings',    format: v => fmt(v) },
    { id: 'slider-expenses',   stateKey: 'retirementExpenses',display: 'val-expenses',   format: v => fmt(v) },
    { id: 'slider-savingsrate',stateKey: 'savingsRate',       display: 'val-savingsrate',format: v => Math.round(v * 100) + '%' },
  ];

  sliders.forEach(({ id, stateKey, display, format }) => {
    const input = document.getElementById(id);
    const label = document.getElementById(display);
    if (!input) return;

    input.value = state[stateKey];
    label.textContent = format(state[stateKey]);
    updateSliderFill(input);

    input.addEventListener('input', () => {
      state[stateKey] = parseFloat(input.value);
      label.textContent = format(state[stateKey]);
      updateSliderFill(input);

      // Sync income to calc2 income slider if still at default
      if (stateKey === 'annualIncome') {
        syncCalc2Income();
      }

      renderCalc1();
    });
  });

  // Province dropdown
  const provinceSelect = document.getElementById('select-province');
  if (provinceSelect) {
    provinceSelect.value = state.province;
    provinceSelect.addEventListener('change', () => {
      state.province = provinceSelect.value;
      renderCalc1();
    });
  }

  // Return rate toggle
  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.returnRate = parseFloat(btn.dataset.rate);
      renderCalc1();
    });
  });
}

// Sync calc1 income to calc2 (no separate UI element — value carried silently)
function syncCalc2Income() {
  state.calc2Income = state.annualIncome;
}

// ── Render Calc 1 ──────────────────────────────────────────────────────────
function renderCalc1() {
  const { target, afterTaxReturn, annualContrib, n, fireAge, progress, taxRate } = calcFatFIRE(
    state.currentAge,
    state.annualIncome,
    state.currentSavings,
    state.retirementExpenses,
    state.returnRate,
    state.province
  );

  document.getElementById('result-number').textContent = fmt(target);

  if (fireAge > 100) {
    document.getElementById('result-trajectory').innerHTML =
      `At current pace, FatFIRE may not be achievable with these numbers. Consider increasing income or adjusting expenses.`;
  } else {
    const yearsAway = fireAge - state.currentAge;
    document.getElementById('result-trajectory').innerHTML =
      `At your current trajectory, you'll reach FatFIRE at age <em>${fireAge}</em> (in <em>${fmtYears(yearsAway)}</em>)`;
  }

  document.getElementById('progress-fill').style.width = progress.toFixed(1) + '%';
  document.getElementById('progress-now').textContent = fmt(state.currentSavings);
  document.getElementById('progress-target').textContent = fmt(target);
  document.getElementById('progress-pct').textContent = progress.toFixed(1) + '%';

  document.getElementById('math-target').textContent   = fmt(target);
  document.getElementById('math-taxrate').textContent  = fmtPct(taxRate);
  document.getElementById('math-aftertax').textContent = fmtPct(afterTaxReturn);
  document.getElementById('math-contrib').textContent  = fmt(annualContrib);

  // Update province label in breakdown
  const taxLabel = document.getElementById('math-taxrate-label');
  if (taxLabel) taxLabel.textContent = `Effective Tax Rate (${PROVINCE_NAMES[state.province] || 'Ontario'})`;

  // Update contribution label to reflect current savings rate
  const contribLabel = document.getElementById('math-contrib-label');
  if (contribLabel) contribLabel.textContent = `Annual Contributions (${Math.round(state.savingsRate * 100)}% income)`;

  // If calc 2 full results unlocked, re-render
  if (state.calc2Step === 'c') renderCalc2();
}

// ── Calc 2 — Mortgage Math ─────────────────────────────────────────────────
function monthlyMortgagePayment(balance, annualRate, years) {
  const r = annualRate / 12;
  const n = years * 12;
  if (r === 0) return balance / n;
  return balance * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

function totalInterest(balance, annualRate, years) {
  const monthly = monthlyMortgagePayment(balance, annualRate, years);
  return monthly * years * 12 - balance;
}

// Smith Manoeuvre capacity:
// Base from mortgage balance (cash-damming, income parking effect)
// PLUS HELOC-driven SM investing:
//   - Each year they borrow from HELOC to invest: heloc * helocDeployRate / helocYears
//   - Tax refund on SM interest: (helocBalance * mortRate) * marginalTaxRate (deductible interest)
function smAdditionalCapacity(mortgageBalance, helocAvailable, mortRate, income, province) {
  // Base capacity from mortgage structure (income parking, cash-damming)
  const min = 200000, max = 1500000;
  const t = Math.max(0, Math.min(1, (mortgageBalance - min) / (max - min)));
  const baseCapacity = 8000 + t * 7000;

  // Smith Manoeuvre HELOC component
  // Assume they deploy HELOC into investments over ~10 years
  const helocDeployYears = 10;
  const annualHelocInvested = (helocAvailable || 0) / helocDeployYears;

  // Tax refund on deductible HELOC interest (SM makes interest tax-deductible)
  // Growing HELOC balance: average ~50% of total over deployment period
  const avgHelocBalance = (helocAvailable || 0) * 0.5;
  const taxRate = getEffectiveTaxRate(income, province || state.province);
  const annualTaxRefund = avgHelocBalance * (mortRate || state.mortgageRate) * taxRate;

  return baseCapacity + annualHelocInvested + annualTaxRefund;
}

function acceleratedPayoffYears(mortgageBalance, amort) {
  const min = 200000, max = 1500000;
  const t = Math.max(0, Math.min(1, (mortgageBalance - min) / (max - min)));
  const yearsEarlier = 8 + t * 3;
  return Math.min(yearsEarlier, amort - 1);
}

function calcScenarioB(currentAge, income, savings, retExpenses, returnRate, mortBalance, mortRate, mortAmort, province) {
  const target = retExpenses * 25;
  const taxRate = getEffectiveTaxRate(income, province || state.province);
  const investmentTaxRate = taxRate * 0.5; // 50% capital gains inclusion
  const afterTaxReturn = returnRate * (1 - investmentTaxRate);
  const r = afterTaxReturn;
  const baseContrib = income * state.savingsRate;  // USE configurable rate

  const helocAvailable = state.heloc || 0;
  const smAddl = smAdditionalCapacity(mortBalance, helocAvailable, mortRate, income, province);
  const yearsEarlier = acceleratedPayoffYears(mortBalance, mortAmort);
  const acceleratedAmort = Math.max(1, mortAmort - yearsEarlier);
  const monthlyPayment = monthlyMortgagePayment(mortBalance, mortRate, mortAmort);
  const annualMortgagePayment = monthlyPayment * 12;

  // HELOC deploy only runs for 10 years — after that, invested capital stays in market
  // but no new HELOC borrowing. Base capacity (income parking) continues throughout.
  const helocDeployYears = 10;
  const helocAvailableLocal = helocAvailable;
  const smBase = smAdditionalCapacity(mortBalance, 0, mortRate, income, province); // base only, no HELOC
  const smFull = smAddl; // base + HELOC years

  let fv = savings;
  let n = 0;
  const maxYears = 80;

  while (fv < target && n < maxYears) {
    const currentSmAddl = n < helocDeployYears ? smFull : smBase;
    if (n < acceleratedAmort) {
      fv = fv * (1 + r) + baseContrib + currentSmAddl;
    } else {
      fv = fv * (1 + r) + baseContrib + currentSmAddl + annualMortgagePayment;
    }
    n++;
  }

  const fireAge = currentAge + n;
  const intSaved = totalInterest(mortBalance, mortRate, mortAmort) - totalInterest(mortBalance, mortRate, acceleratedAmort);
  // SM tax benefit = deductible HELOC interest over the deployment period
  const avgHelocBalance = helocAvailable * 0.5;
  const annualSmTaxRefund = avgHelocBalance * mortRate * taxRate;
  const smTaxBenefit = annualSmTaxRefund * Math.min(n, 10);

  // Portfolio value at Scenario A fire age (for boost calculation)
  const aResult = calcFatFIRE(currentAge, income, savings, retExpenses, returnRate, province);
  const aFireAge = aResult.fireAge;
  // Portfolio at Scenario B at the Scenario A's fire age
  let fvAtAAge = savings;
  const yearsToAAge = Math.max(0, aFireAge - currentAge);
  for (let i = 0; i < yearsToAAge; i++) {
    const currentSmAddl = i < helocDeployYears ? smFull : smBase;
    if (i < acceleratedAmort) {
      fvAtAAge = fvAtAAge * (1 + r) + baseContrib + currentSmAddl;
    } else {
      fvAtAAge = fvAtAAge * (1 + r) + baseContrib + currentSmAddl + annualMortgagePayment;
    }
  }
  const portfolioBoost = Math.max(0, fvAtAAge - aResult.target);

  return {
    fireAge,
    n,
    target,
    smAddl,
    yearsEarlier,
    intSaved: Math.max(0, intSaved),
    smTaxBenefit,
    annualMortgagePayment,
    portfolioBoost,
  };
}

// ── Bind Calc 2 Inputs ─────────────────────────────────────────────────────
function bindCalc2() {
  const sliders = [
    { id: 'slider-mortgage',  stateKey: 'mortgageBalance', display: 'val-mortgage',  format: v => fmt(v) },
    { id: 'slider-mortrate',  stateKey: 'mortgageRate',    display: 'val-mortrate',  format: v => (v * 100).toFixed(1) + '%' },
    { id: 'slider-amort',     stateKey: 'mortgageAmort',   display: 'val-amort',     format: v => v + ' yrs' },
    { id: 'slider-heloc',     stateKey: 'heloc',           display: 'val-heloc',     format: v => fmt(v) },
  ];

  sliders.forEach(({ id, stateKey, display, format }) => {
    const input = document.getElementById(id);
    const label = document.getElementById(display);
    if (!input) return;

    input.value = state[stateKey];
    label.textContent = format(state[stateKey]);
    updateSliderFill(input);

    input.addEventListener('input', () => {
      state[stateKey] = parseFloat(input.value);
      label.textContent = format(state[stateKey]);
      updateSliderFill(input);
    });
  });
}

// ── Calculate teaser numbers ───────────────────────────────────────────────
function calcTeaserNumbers() {
  const income = state.calc2Income;
  const a = calcFatFIRE(
    state.currentAge, income, state.currentSavings,
    state.retirementExpenses, state.returnRate, state.province
  );
  const b = calcScenarioB(
    state.currentAge, income, state.currentSavings,
    state.retirementExpenses, state.returnRate,
    state.mortgageBalance, state.mortgageRate, state.mortgageAmort, state.province
  );

  const yearsSooner = Math.max(0, Math.round(a.fireAge - b.fireAge));
  // Simplified interest saved estimate
  const roughInterestSaved = Math.round(state.mortgageBalance * state.mortgageRate * 3);
  // Portfolio boost: round to nearest $10K
  const portfolioBoost = Math.round(b.portfolioBoost / 10000) * 10000;

  return { yearsSooner, portfolioBoost, roughInterestSaved, a, b };
}

// ── Render Teaser ──────────────────────────────────────────────────────────
function renderTeaser() {
  const { yearsSooner, portfolioBoost, roughInterestSaved } = calcTeaserNumbers();

  document.getElementById('teaser-years').textContent =
    yearsSooner > 0 ? `~${yearsSooner} year${yearsSooner !== 1 ? 's' : ''} sooner` : 'Significant acceleration';
  document.getElementById('teaser-portfolio').textContent =
    portfolioBoost > 0 ? `~${fmt(portfolioBoost)}` : '~$50,000+';
  document.getElementById('teaser-interest').textContent =
  // Province-specific punchline
  const provinceName = PROVINCE_NAMES[state.province] || 'Ontario';
  const taxRate = getEffectiveTaxRate(state.annualIncome, state.province);
  const avgHelocBalance = (state.heloc || 150000) * 0.5;
  const annualSmRefund = Math.round(avgHelocBalance * state.mortgageRate * taxRate);
  const punchlineEl = document.getElementById('province-punchline');
  if (punchlineEl && annualSmRefund > 0) {
    punchlineEl.innerHTML = `<span class="punchline-icon">🍁</span> As a homeowner in <strong>${provinceName}</strong> with a <strong>${Math.round(taxRate * 100)}%</strong> marginal rate, the Smith Manoeuvre could generate an estimated <strong>$${annualSmRefund.toLocaleString('en-CA')}/year</strong> in tax refunds — reinvested to compound your acceleration.`;
  }
    `~${fmt(roughInterestSaved)}`;
}

// ── Render Calc 2 Full ─────────────────────────────────────────────────────
function renderCalc2() {
  const income = state.calc2Income;

  const a = calcFatFIRE(
    state.currentAge, income, state.currentSavings,
    state.retirementExpenses, state.returnRate, state.province
  );
  const b = calcScenarioB(
    state.currentAge, income, state.currentSavings,
    state.retirementExpenses, state.returnRate,
    state.mortgageBalance, state.mortgageRate, state.mortgageAmort, state.province
  );

  const yearsSooner = Math.max(0, a.fireAge - b.fireAge);

  document.getElementById('c2-income-display').textContent = fmt(income);

  document.getElementById('scenario-a-age').textContent = a.fireAge <= 100 ? `Age ${a.fireAge}` : 'Age 100+';
  document.getElementById('scenario-a-sub').textContent =
    a.fireAge <= 100
      ? `In ${a.n} years — standard investing`
      : 'May not be achievable at current pace';

  document.getElementById('scenario-b-age').textContent = b.fireAge <= 100 ? `Age ${b.fireAge}` : 'Age 100+';
  document.getElementById('scenario-b-sub').textContent =
    b.fireAge <= 100
      ? `In ${b.n} years — with Freedom Accelerator`
      : 'Adjust inputs to unlock potential';

  if (yearsSooner > 0 && b.fireAge <= 100) {
    document.getElementById('reveal-headline').textContent =
      `You could reach FatFIRE ${yearsSooner} year${yearsSooner !== 1 ? 's' : ''} sooner 🍁`;
    document.getElementById('reveal-sub').textContent =
      `Traditional path: FatFIRE at age ${a.fireAge}  ·  Freedom Accelerator: FatFIRE at age ${b.fireAge}`;
  } else if (yearsSooner === 0) {
    document.getElementById('reveal-headline').textContent = `Same FatFIRE age — strategy frees up flexibility 🍁`;
    document.getElementById('reveal-sub').textContent =
      `Restructuring builds wealth resilience and reduces mortgage stress`;
  } else {
    document.getElementById('reveal-headline').textContent = `Strategy is working — review your inputs 🍁`;
    document.getElementById('reveal-sub').textContent = `Adjust mortgage balance or income to see the full acceleration`;
  }

  // Lifetime freed payment = annual mortgage payment × years remaining after acceleration
  const yearsFreed = Math.max(0, b.yearsEarlier);
  const lifetimeFreed = b.annualMortgagePayment * yearsFreed;
  document.getElementById('gain-interest').textContent = fmt(b.intSaved);
  document.getElementById('gain-taxdeductions').textContent = fmt(b.smTaxBenefit);
  document.getElementById('gain-freed').textContent = fmt(lifetimeFreed);
}

// ── Calculator 2 Flow Handlers ─────────────────────────────────────────────

// Step A → Step B: show teaser after Calculate clicked
function handleCalc2Calculate() {
  state.calc2Step = 'b';

  // Render teaser
  renderTeaser();

  // Show step B, hide step A
  document.getElementById('calc2-step-a').classList.add('hidden');
  document.getElementById('calc2-step-b').classList.remove('hidden');

  // Scroll to teaser
  document.getElementById('calc2-step-b').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Back to Step A
function handleCalc2Back() {
  state.calc2Step = 'a';
  document.getElementById('calc2-step-b').classList.add('hidden');
  document.getElementById('calc2-step-a').classList.remove('hidden');
  document.getElementById('calc2-step-a').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Step B → Step C: email submitted, unlock full results
async function handleGateSubmit(e) {
  e.preventDefault();
  const firstName = document.getElementById('gate-firstname').value.trim();
  const email = document.getElementById('gate-email').value.trim();

  if (!firstName || !email) return;

  state.firstName = firstName;
  state.email = email;
  state.calc2Step = 'c';

  // Compute full results for the lead note
  const a = calcFatFIRE(
    state.currentAge, state.calc2Income, state.currentSavings,
    state.retirementExpenses, state.returnRate, state.province
  );
  const b = calcScenarioB(
    state.currentAge, state.calc2Income, state.currentSavings,
    state.retirementExpenses, state.returnRate,
    state.mortgageBalance, state.mortgageRate, state.mortgageAmort, state.province
  );
  const yearsSooner  = Math.max(0, a.fireAge - b.fireAge);
  const yearsFreed   = Math.max(0, b.yearsEarlier);
  const lifetimeFreed = b.annualMortgagePayment * yearsFreed;

  // POST to serverless function
  const payload = {
    firstName,
    email,
    currentAge:          state.currentAge,
    annualIncome:        state.calc2Income,
    currentSavings:      state.currentSavings,
    retirementExpenses:  state.retirementExpenses,
    province:            state.province,
    fatfireTarget:       a.target,
    fatfireAge:          a.fireAge,
    fatfireYears:        a.n,
    mortgageBalance:     state.mortgageBalance,
    mortgageRate:        state.mortgageRate,
    mortgageAmort:       state.mortgageAmort,
    heloc:               state.heloc || 0,
    scenarioAAge:        a.fireAge,
    scenarioBAge:        b.fireAge,
    yearsSooner,
    interestSaved:       b.intSaved,
    smTaxBenefit:        b.smTaxBenefit,
    lifetimeFreed,
      // UTM tracking
      ...getUTMParams(),
    };

  console.log('[FatFIRE] Submitting lead:', payload);

  try {
    const res = await fetch('/api/submit', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    const json = await res.json();
    console.log('[FatFIRE] API response:', res.status, json);
  } catch (err) {
    console.error('[FatFIRE] API error:', err);
  }

  // Hide step B, show step C immediately (don't wait for API)
  document.getElementById('calc2-step-b').classList.add('hidden');
  document.getElementById('calc2-step-c').classList.remove('hidden');

  // Sync step-c sliders to current state
  syncStepCSliders();

  // Render full results
  renderCalc2();

  // Bind live update sliders in step-c
  bindStepCSliders();

  document.getElementById('calc2-step-c').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Sync step-c sliders to match current state ─────────────────────────────
function syncStepCSliders() {
  const b = document.getElementById('c2b-balance');
  const r = document.getElementById('c2b-rate');
  const a = document.getElementById('c2b-amort');
  const h = document.getElementById('c2b-heloc');
  if (b) { b.value = state.mortgageBalance; updateSliderFill(b); document.getElementById('c2b-balance-val').textContent = fmt(state.mortgageBalance); }
  if (r) { r.value = state.mortgageRate; updateSliderFill(r); document.getElementById('c2b-rate-val').textContent = (state.mortgageRate * 100).toFixed(1) + '%'; }
  if (a) { a.value = state.mortgageAmort; updateSliderFill(a); document.getElementById('c2b-amort-val').textContent = state.mortgageAmort + ' years'; }
  if (h) { h.value = state.heloc || 150000; updateSliderFill(h); document.getElementById('c2b-heloc-val').textContent = fmt(state.heloc || 150000); }
}

// ── Bind live-update sliders in step-c ────────────────────────────────────
let stepCBound = false;
function bindStepCSliders() {
  if (stepCBound) return;
  stepCBound = true;

  const sliders = [
    { id: 'c2b-balance', valId: 'c2b-balance-val', key: 'mortgageBalance', fmt: v => fmt(v) },
    { id: 'c2b-rate',    valId: 'c2b-rate-val',    key: 'mortgageRate',    fmt: v => (v * 100).toFixed(1) + '%', parse: parseFloat },
    { id: 'c2b-amort',   valId: 'c2b-amort-val',   key: 'mortgageAmort',  fmt: v => v + ' years', parse: parseInt },
    { id: 'c2b-heloc',   valId: 'c2b-heloc-val',   key: 'heloc',          fmt: v => fmt(v) },
  ];

  sliders.forEach(({ id, valId, key, fmt: fmtFn, parse }) => {
    const el = document.getElementById(id);
    const valEl = document.getElementById(valId);
    if (!el) return;
    el.addEventListener('input', () => {
      const raw = el.value;
      state[key] = parse ? parse(raw) : Number(raw);
      if (valEl) valEl.textContent = fmtFn(state[key]);
      updateSliderFill(el);
      renderCalc2();
    });
  });
}

// ── Scroll Arrow Visibility ─────────────────────────────────────────────────
function initScrollArrow() {
  const arrow = document.querySelector('.scroll-arrow-wrap');
  if (!arrow) return;

  const calc2 = document.getElementById('calc2-card');

  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;

    // Show after user scrolls 200px down
    if (scrollY < 200) {
      arrow.classList.remove('visible');
      arrow.classList.add('hidden');
      return;
    }

    // Hide once user has scrolled past Calc 2
    if (calc2) {
      const calc2Top = calc2.getBoundingClientRect().top + window.scrollY;
      if (scrollY >= calc2Top - 100) {
        arrow.classList.remove('visible');
        arrow.classList.add('hidden');
        return;
      }
    }

    arrow.classList.add('visible');
    arrow.classList.remove('hidden');
  }, { passive: true });

  // Click arrow scrolls to Calc 2
  arrow.addEventListener('click', () => {
    const target = document.getElementById('calc2-card');
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

// ── Init ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  bindCalc1();
  renderCalc1();

  bindCalc2();

  // Gate form
  const gateForm = document.getElementById('gate-form');
  if (gateForm) gateForm.addEventListener('submit', handleGateSubmit);

  // Init all sliders with fill
  document.querySelectorAll('input[type="range"]').forEach(updateSliderFill);

  // Scroll arrow
  initScrollArrow();
});
