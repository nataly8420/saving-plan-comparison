// calculator.js — pure calculation functions, no DOM/UI code.
// Every function reads from a planConfig object (see plans.js) and plain
// numeric inputs; nothing here touches the page.

/**
 * Flatten a product-level plan (see plans.js — id/name/company/disclaimer
 * at the top, span-dependent data under plan.spans[N]) into the shape
 * calculatePlan/calculatePF/etc. expect: a single object with returnTable,
 * discountTable or premiumDiscountTiers, pf, day1SVRatio, etc. directly on
 * it. Span-specific fields override top-level ones of the same name (e.g.
 * a span can supply its own disclaimer, though none currently do).
 * @param {object} plan - one entry from PLANS
 * @param {number} span - payment span in years
 * @returns {object|null} resolved plan config, or null if the plan doesn't offer this span
 */
function resolvePlanForSpan(plan, span) {
  const spanConfig = plan.spans[span];
  if (!spanConfig) return null;
  const { spans, ...planBase } = plan;
  return { ...planBase, ...spanConfig };
}

/**
 * Look up the discount tier that applies to a given gross premium amount.
 * Tiers apply at-or-above their minPremium threshold (highest matching tier wins).
 * @param {number} grossPremium
 * @param {Array<{minPremium:number, firstYearDiscount:number, bonusDiscount:number}>} tiers
 * @returns {{firstYearDiscount:number, bonusDiscount:number, totalRate:number}}
 */
function getPremiumTierDiscount(grossPremium, tiers) {
  const sorted = [...tiers].sort((a, b) => a.minPremium - b.minPremium);
  let match = sorted[0];
  for (const tier of sorted) {
    if (grossPremium >= tier.minPremium) match = tier;
  }
  return {
    firstYearDiscount: match.firstYearDiscount,
    bonusDiscount: match.bonusDiscount,
    totalRate: match.firstYearDiscount + match.bonusDiscount,
  };
}

/**
 * Apply the plan's discount schedule to gross premium and return net premium
 * per payment year.
 *
 * Two discount styles are supported:
 * - premiumDiscountTiers (single-premium products): one combined discount
 *   rate looked up by total gross premium size, applied to the lump sum.
 * - discountTable[span][year] (installment products): a separate discount
 *   rate per payment year, applied to each equal installment.
 *
 * @param {number} grossPremiumUSD - total gross premium across the whole span
 * @param {number} paymentSpan - number of years premium is paid over
 * @param {object} planConfig
 * @param {number[]} [discountOverridePercents] - advisor-entered per-year
 *   discount rates (0-1, index 0 = year 1, length === paymentSpan). When
 *   given, this REPLACES the plan's own premiumDiscountTiers/discountTable
 *   entirely — discount rates are no longer treated as sourced/confirmed
 *   data, but as something the advisor types in per case (see #discount-*
 *   inputs in app.js).
 * @returns {number[]} net premium per payment year, index 0 = year 1
 */
function applyDiscounts(grossPremiumUSD, paymentSpan, planConfig, discountOverridePercents) {
  if (discountOverridePercents) {
    const grossPremiumPerYear = grossPremiumUSD / paymentSpan;
    return discountOverridePercents.map((rate) => grossPremiumPerYear * (1 - rate));
  }

  if (planConfig.premiumDiscountTiers) {
    const { totalRate } = getPremiumTierDiscount(grossPremiumUSD, planConfig.premiumDiscountTiers);
    const netTotal = grossPremiumUSD * (1 - totalRate);
    return Array(paymentSpan).fill(netTotal / paymentSpan);
  }

  const grossPremiumPerYear = grossPremiumUSD / paymentSpan;
  const spanTable = (planConfig.discountTable && planConfig.discountTable[paymentSpan]) || {};
  const netPerYear = [];
  for (let year = 1; year <= paymentSpan; year++) {
    const discountRate = spanTable[year] || 0;
    netPerYear.push(grossPremiumPerYear * (1 - discountRate));
  }
  return netPerYear;
}

/**
 * Total net premium paid across the whole payment span.
 */
function totalNetPremium(grossPremiumUSD, paymentSpan, planConfig, discountOverridePercents) {
  const netPerYear = applyDiscounts(grossPremiumUSD, paymentSpan, planConfig, discountOverridePercents);
  return netPerYear.reduce((sum, v) => sum + v, 0);
}

/**
 * Bisection-method IRR solver.
 * @param {number[]} cashFlows - cashFlows[t] = net cash flow at year t (index 0 = year 0)
 * @returns {number|null} IRR as a percentage (e.g. 4.2345), or null if it can't be solved
 */
function calculateIRR(cashFlows) {
  // An all-zero cash flow (e.g. a broken/empty premium schedule) has NPV=0
  // at every rate — there's no meaningful IRR to report, not "-50%" as a
  // side effect of the low end of the search bracket.
  if (cashFlows.every((cf) => cf === 0)) return null;

  const npv = (rate) =>
    cashFlows.reduce((sum, cf, t) => sum + cf / Math.pow(1 + rate, t), 0);

  // Low end is -0.99 (not -0.5): early-exit years on a whole-life plan can
  // legitimately lose more than 50% (e.g. surrendering in year 1-2, before
  // the surrender value has caught up to premiums paid) — a -50% floor was
  // silently returning null for those years instead of the real, very
  // negative IRR. -0.99 stays short of the 1/(1+rate) singularity at -1.0.
  let low = -0.99;
  let high = 2.0;
  let npvLow = npv(low);
  let npvHigh = npv(high);

  // No sign change across the bracket means bisection can't isolate a root.
  if (npvLow === 0) return round4(low * 100);
  if (npvHigh === 0) return round4(high * 100);
  if ((npvLow > 0 && npvHigh > 0) || (npvLow < 0 && npvHigh < 0)) return null;

  let mid = 0;
  for (let i = 0; i < 100; i++) {
    mid = (low + high) / 2;
    const npvMid = npv(mid);
    if (npvMid === 0) break;
    if ((npvMid > 0) === (npvLow > 0)) {
      low = mid;
      npvLow = npvMid;
    } else {
      high = mid;
    }
  }
  return round4(mid * 100);
}

function round4(n) {
  return Math.round(n * 10000) / 10000;
}

/**
 * Some proposals only disclose milestone policy years (e.g. 1-5, then every
 * 5th year) rather than a full year-by-year table. Per explicit user
 * decision, gap years between two disclosed milestones are now filled with
 * a LINEAR interpolation between the nearest disclosed year below and above
 * (not extrapolated beyond the last disclosed year — there's no upper bound
 * to interpolate toward). Every interpolated entry is flagged
 * `isEstimated: true` so every downstream consumer (results table, charts,
 * PDF) can render it visibly differently from real, sourced data — this is
 * a deliberate estimate, not a proposal figure, and must never be
 * presented as if it were one.
 *
 * Linear (not curve-fit) is a deliberate choice: real bonus/terminal-
 * dividend schedules often step sharply at specific anniversaries (e.g.
 * terminal dividend jumping 20x in a single year in some real proposals
 * already in plans.js), so a fancier curve would falsely imply more
 * precision than a straight line between two known points actually has.
 * @param {object} returnTable - planConfig.returnTable (sparse or dense)
 * @returns {object} same shape as returnTable, gaps filled in, every entry
 *   carrying `isEstimated` (false for real disclosed years, true for filled ones)
 */
function expandReturnTableWithEstimates(returnTable) {
  const years = Object.keys(returnTable).map(Number).sort((a, b) => a - b);
  const expanded = {};
  for (let i = 0; i < years.length; i++) {
    const y = years[i];
    expanded[y] = { ...returnTable[y], isEstimated: false };
    if (i === years.length - 1) continue;
    const yNext = years[i + 1];
    if (yNext - y <= 1) continue;
    const r0 = returnTable[y];
    const r1 = returnTable[yNext];
    for (let gapYear = y + 1; gapYear < yNext; gapYear++) {
      const frac = (gapYear - y) / (yNext - y);
      expanded[gapYear] = {
        guaranteedCVRatio: r0.guaranteedCVRatio + (r1.guaranteedCVRatio - r0.guaranteedCVRatio) * frac,
        accumulatedDivRatio: r0.accumulatedDivRatio + (r1.accumulatedDivRatio - r0.accumulatedDivRatio) * frac,
        terminalDivRatio: r0.terminalDivRatio + (r1.terminalDivRatio - r0.terminalDivRatio) * frac,
        isEstimated: true,
      };
    }
  }
  return expanded;
}

/**
 * Year-by-year returns for a single plan, no premium financing.
 *
 * NOTE: guaranteedCV/accumulatedDiv/terminalDiv ratios in returnTable are
 * relative to GROSS premium (confirmed against the insurer's own workbook —
 * cash values are computed off the stated/gross premium, unaffected by any
 * agent discount). Net premium (after discount) is only used as the client's
 * actual cash outflow for IRR.
 *
 * @param {object} planConfig - one entry from PLANS
 * @param {number} grossPremiumUSD - total gross premium the client is paying
 * @param {number} paymentSpan - years premium is spread over
 * @param {number[]} [discountOverridePercents] - see applyDiscounts()
 * @returns {Array<{year:number, guaranteedCV:number, accumulatedDiv:number, terminalDiv:number, totalSV:number, irrPercent:number|null, isEstimated:boolean}>}
 */
function calculatePlan(planConfig, grossPremiumUSD, paymentSpan, discountOverridePercents) {
  const netPremiumPerYear = applyDiscounts(grossPremiumUSD, paymentSpan, planConfig, discountOverridePercents);
  const terminalRate = planConfig.terminalDivRealizationRate ?? 1;

  const expandedTable = expandReturnTableWithEstimates(planConfig.returnTable);
  const years = Object.keys(expandedTable)
    .map(Number)
    .sort((a, b) => a - b);

  const results = [];
  for (const year of years) {
    const ratios = expandedTable[year];
    const guaranteedCV = ratios.guaranteedCVRatio * grossPremiumUSD;
    const accumulatedDiv = ratios.accumulatedDivRatio * grossPremiumUSD;
    const terminalDiv = ratios.terminalDivRatio * grossPremiumUSD * terminalRate;
    const totalSV = guaranteedCV + accumulatedDiv + terminalDiv;

    // Cash flows for IRR: premium for payment-year k is paid at the START
    // of that year (t = k-1) — a single premium is paid at t=0, matching
    // the insurer's own IRR convention (confirmed against the workbook:
    // outflow at t=0, inflow at t=exitYear). Total surrender value is
    // received at this exit year.
    //
    // Only count premiums for years that have actually elapsed by the exit
    // year (t < year), not the full paymentSpan — otherwise exiting before
    // all installments are due (e.g. surrendering in year 1 of a 2-year
    // pay plan) would wrongly charge a premium payment that was never made.
    const paidThrough = Math.min(paymentSpan, year);
    const cashFlows = [];
    for (let t = 0; t <= year; t++) {
      let cf = 0;
      if (t < paidThrough) cf -= netPremiumPerYear[t];
      if (t === year) cf += totalSV;
      cashFlows.push(cf);
    }
    const irrPercent = calculateIRR(cashFlows);

    results.push({ year, guaranteedCV, accumulatedDiv, terminalDiv, totalSV, irrPercent, isEstimated: ratios.isEstimated });
  }
  return results;
}

/**
 * "What if I'd just put this money in a bank instead" reference line — a
 * pure compound-interest projection using the EXACT SAME cash-flow timing
 * as the plan's own IRR calculation (net premium for payment-year k
 * deposited at the start of that year, t = k-1), so it's a fair
 * apples-to-apples comparison against the plan's own IRR: if the bank rate
 * entered equals the plan's IRR at some exit year, this line and the
 * plan's totalSV line cross exactly at that year.
 * @param {number[]} netPremiumPerYear - output of applyDiscounts()
 * @param {number} paymentSpan
 * @param {number} bankRate - decimal, e.g. 0.035 for 3.5%
 * @param {number[]} years - which policy years to compute a value for
 * @returns {{[year: number]: number}}
 */
function calculateBankLine(netPremiumPerYear, paymentSpan, bankRate, years) {
  const result = {};
  for (const year of years) {
    const paidThrough = Math.min(paymentSpan, year);
    let value = 0;
    for (let t = 0; t < paidThrough; t++) {
      value += netPremiumPerYear[t] * Math.pow(1 + bankRate, year - t);
    }
    result[year] = value;
  }
  return result;
}

/**
 * Break a total surrender value down into stacked chart segments
 * (bottom to top): principal, loan, interest, return-above-cost.
 * Segments are clamped sequentially so they always sum exactly to
 * totalSV, even in early years where totalSV hasn't yet covered the
 * principal/loan/interest already paid in (no negative bar segments).
 * @param {number} totalSV
 * @param {number} principal - net premium paid (no PF), or self-pay amount (PF on)
 * @param {number} [loanAmount]
 * @param {number} [cumulativeInterest]
 * @returns {{principal:number, loan:number, interest:number, returnAboveCost:number}}
 */
function getChartSegments(totalSV, principal, loanAmount = 0, cumulativeInterest = 0) {
  let remaining = totalSV;
  const principalSeg = Math.min(principal, remaining);
  remaining -= principalSeg;
  const loanSeg = Math.min(loanAmount, remaining);
  remaining -= loanSeg;
  const interestSeg = Math.min(cumulativeInterest, remaining);
  remaining -= interestSeg;
  const returnSeg = remaining;
  return { principal: principalSeg, loan: loanSeg, interest: interestSeg, returnAboveCost: returnSeg };
}

/**
 * Resolve the loan basis (day1SV or netPremium) and LTV ratio for a given
 * PF mode and premium size. Some modes have a flat ltvRatio; others step
 * down by premium tier (planConfig.pf.modes.financing.ltvTiers).
 * @param {object} mode - one entry from planConfig.pf.modes
 * @param {number} grossPremiumUSD
 * @param {number} day1SV
 * @param {number} netPremiumUSD
 * @returns {{basisAmount:number, ltvRatio:number}}
 */
function resolveLoanBasis(mode, grossPremiumUSD, day1SV, netPremiumUSD) {
  let ltvRatio, loanBasis;
  if (mode.ltvTiers) {
    const sorted = [...mode.ltvTiers].sort((a, b) => a.minPremium - b.minPremium);
    let match = sorted[0];
    for (const tier of sorted) {
      if (grossPremiumUSD >= tier.minPremium) match = tier;
    }
    ltvRatio = match.ltvRatio;
    loanBasis = match.loanBasis;
  } else {
    ltvRatio = mode.ltvRatio;
    loanBasis = mode.loanBasis;
  }
  const basisAmount = loanBasis === "day1SV" ? day1SV : netPremiumUSD;
  return { basisAmount, ltvRatio };
}

/**
 * Premium financing overlay on top of a base plan's year-by-year results.
 *
 * Formulas confirmed against the insurer's own workbook (薪火抵押/薪火保融
 * x 中銀香港), columns J:R and the IRR-with-PF helper table (T59:AJ90):
 *   Loan Amount        = loanBasis (Day-1 SV or net premium) x LTV%
 *   Self-Pay Amount     = netPremium - Loan + processingFee
 *   Annual Interest[t]  = Loan x loanRate[t]  (rate may vary by year for stress test)
 *   Cumulative Interest = sum of annual interest up to year N
 *   Net Return[N]       = Total SV[N] - Loan - Cumulative Interest
 *   IRR-with-PF cash flow: -SelfPay at t=0, -Interest[t] for 1<=t<N,
 *     (TotalSV[N] - Loan - Interest[N]) at t=N (loan + final interest repaid,
 *     SV received, at exit).
 *
 * @param {object} planConfig
 * @param {Array} planResults - output of calculatePlan()
 * @param {number} grossPremiumUSD
 * @param {number} netPremiumUSD
 * @param {string} modeKey - key into planConfig.pf.modes (e.g. "pledge")
 * @param {number|number[]} loanRate - flat annual rate, or one rate per policy year (index 0 = year 1) for stress testing
 * @param {number} [ltvOverride] - override the mode's LTV ratio (advisor-editable in UI)
 * @returns {Array<{year:number, ..., loanAmount:number, cumulativeInterest:number, netReturn:number, irrWithPFPercent:number|null}>}
 */
function calculatePF(planConfig, planResults, grossPremiumUSD, netPremiumUSD, modeKey, loanRate, ltvOverride) {
  const mode = planConfig.pf.modes[modeKey];
  const day1SV = planConfig.day1SVRatio * grossPremiumUSD;
  const { basisAmount, ltvRatio } = resolveLoanBasis(mode, grossPremiumUSD, day1SV, netPremiumUSD);
  const effectiveLtv = ltvOverride ?? ltvRatio;

  const loanAmount = basisAmount * effectiveLtv;
  const fee = loanAmount * (planConfig.pf.processingFeeRate || 0) + (planConfig.pf.processingFeeFixed || 0);
  const selfPayAmount = netPremiumUSD - loanAmount + fee;

  const rateForYear = (y) => (Array.isArray(loanRate) ? loanRate[y - 1] : loanRate);
  const annualInterest = (y) => loanAmount * rateForYear(y);

  return planResults.map((row) => {
    let cumulativeInterest = 0;
    for (let y = 1; y <= row.year; y++) cumulativeInterest += annualInterest(y);
    // Value after just repaying the loan principal (interest not yet deducted) —
    // an intermediate figure PortfoPlus shows as "還款後價值".
    const valueAfterLoanRepayment = row.totalSV - loanAmount;
    const netReturn = valueAfterLoanRepayment - cumulativeInterest;

    const cashFlows = [];
    for (let t = 0; t <= row.year; t++) {
      let cf = 0;
      if (t === 0) cf -= selfPayAmount;
      else if (t < row.year) cf -= annualInterest(t);
      else if (t === row.year) cf += row.totalSV - loanAmount - annualInterest(row.year);
      cashFlows.push(cf);
    }
    const irrWithPFPercent = calculateIRR(cashFlows);

    return { ...row, loanAmount, selfPayAmount, cumulativeInterest, valueAfterLoanRepayment, netReturn, irrWithPFPercent };
  });
}

/**
 * Re-run the PF overlay with a different (stress-tested) loan interest rate.
 * @param {object} planConfig
 * @param {Array} planResults - output of calculatePlan()
 * @param {number} grossPremiumUSD
 * @param {number} netPremiumUSD
 * @param {string} modeKey
 * @param {number|number[]} stressRate
 * @param {number} [ltvOverride]
 */
function stressTest(planConfig, planResults, grossPremiumUSD, netPremiumUSD, modeKey, stressRate, ltvOverride) {
  return calculatePF(planConfig, planResults, grossPremiumUSD, netPremiumUSD, modeKey, stressRate, ltvOverride);
}

/**
 * Sanity checks against the known 1,000,000 USD BOC Life GGG WL proposal.
 * Run manually from the browser console: runTests()
 */
function runTests() {
  const plan = resolvePlanForSpan(PLANS["boclife_ggg_wl"], 1);

  // 1. Exact match against the real 1M proposal (PDF page 10, "說明摘要" table).
  const expected1M = {
    1: 809110, 5: 1126484, 10: 1363155, 20: 2406804, 30: 4221364, 40: 7505582,
  };
  const results1M = calculatePlan(plan, 1000000, 1);
  const byYear1M = Object.fromEntries(results1M.map((r) => [r.year, r]));
  let matchOk = true;
  for (const [year, expectedTotal] of Object.entries(expected1M)) {
    const actual = byYear1M[year].totalSV;
    if (Math.abs(actual - expectedTotal) > 0.5) {
      matchOk = false;
      console.error(`Year ${year}: expected totalSV ${expectedTotal}, got ${actual}`);
    }
  }
  console.log(matchOk ? "PASS: 1M proposal matches exactly" : "FAIL: 1M proposal mismatch");

  // 2. Cross-check against the other three premium tiers from the Excel workbook
  //    (same ratio table applied to a different gross premium).
  const tierChecks = [
    { premium: 200000, year: 1, expectedTotal: 161822 },   // 200000*(0.808+0.0001+0.00101)
    { premium: 600000, year: 5, expectedTotal: 675890.4 },  // 600000*(0.8505+0.000544+0.27544)
    { premium: 1500000, year: 30, expectedTotal: 6332046 }, // 1500000*(1.13698+0.007984+3.0764)
  ];
  let tierOk = true;
  for (const check of tierChecks) {
    const results = calculatePlan(plan, check.premium, 1);
    const row = results.find((r) => r.year === check.year);
    if (Math.abs(row.totalSV - check.expectedTotal) > 1) {
      tierOk = false;
      console.error(`Premium ${check.premium}, year ${check.year}: expected ${check.expectedTotal}, got ${row.totalSV}`);
    }
  }
  console.log(tierOk ? "PASS: cross-tier linear scaling matches Excel" : "FAIL: cross-tier scaling mismatch");

  // 2b. Independent cross-check against a SEPARATE real proposal for the same
  // plan at 5,000,000 gross premium (BOCLIFEGGGWLIP-1-USD-FN-60-HONGKONG-
  // (5000000)-HK.pdf) — confirms linear scaling holds 5x out, not just a
  // synthetic multiple of the 1M sample.
  const expected5M = {
    1: 4045550, 5: 5632422, 10: 6815773, 20: 12034018, 30: 21106820, 40: 37527910,
  };
  const results5M = calculatePlan(plan, 5000000, 1);
  const byYear5M = Object.fromEntries(results5M.map((r) => [r.year, r]));
  let match5MOk = true;
  for (const [year, expectedTotal] of Object.entries(expected5M)) {
    const actual = byYear5M[year].totalSV;
    if (Math.abs(actual - expectedTotal) > 5) {
      match5MOk = false;
      console.error(`5M Year ${year}: expected totalSV ${expectedTotal}, got ${actual}`);
    }
  }
  console.log(match5MOk ? "PASS: 5M proposal matches (independent cross-check)" : "FAIL: 5M proposal mismatch");

  // 3. Net premium after discount for the 1M tier should be 900,000 (8.5% + 1.5%).
  // NOTE: the official 5M proposal PDF only discloses an 8.5% promo discount
  // (5,000,000 -> 4,575,000, promo code 3GSPUS2512) with no extra "bonus"
  // stacked on top — unlike the Excel's premiumDiscountTiers, which add a
  // bonusDiscount (e.g. +1.5% at 1M) on top of the base rate. The bonus
  // appears to be an advisor-side rebate the official company illustration
  // doesn't show, so it can't be confirmed or refuted by this 5M PDF alone.
  const net1M = totalNetPremium(1000000, 1, plan);
  console.log(Math.abs(net1M - 900000) < 0.01 ? "PASS: 1M net premium = 900,000" : `FAIL: 1M net premium = ${net1M}`);

  // 3b. Discount tier boundaries confirmed against the official Q3 2026 BOC
  // Life partner rate card (150,000 / 600,000 / 1,000,000 USD breakpoints).
  const tierChecksBoundary = [
    { premium: 100000, expectedRate: 0.055 },  // below 150,000 -> 5.5%, no bonus known
    { premium: 150000, expectedRate: 0.075 },  // exactly at boundary -> 6.7% + 0.8% bonus
    { premium: 600000, expectedRate: 0.085 },  // exactly at boundary -> 7.5% + 1.0% bonus
  ];
  let tierBoundaryOk = true;
  for (const { premium, expectedRate } of tierChecksBoundary) {
    const net = totalNetPremium(premium, 1, plan);
    const actualRate = 1 - net / premium;
    if (Math.abs(actualRate - expectedRate) > 0.0001) {
      tierBoundaryOk = false;
      console.error(`Premium ${premium}: expected combined discount ${expectedRate * 100}%, got ${(actualRate * 100).toFixed(2)}%`);
    }
  }
  console.log(tierBoundaryOk ? "PASS: discount tier boundaries match official rate card" : "FAIL: discount tier boundary mismatch");

  // 4. IRR% must match the workbook's own IRR column exactly (F26:F37, 1M sheet).
  const expectedIRR = {
    1: -10.098889, 2: -3.950013, 3: 1.305584, 4: 2.983932, 5: 4.591527,
    6: 4.517125, 7: 4.421698, 8: 4.351475, 9: 4.289645, 10: 4.239009,
    20: 5.041257, 30: 5.286739,
  };
  let irrOk = true;
  for (const [year, expected] of Object.entries(expectedIRR)) {
    const actual = byYear1M[year].irrPercent;
    if (actual === null || Math.abs(actual - expected) > 0.01) {
      irrOk = false;
      console.error(`Year ${year}: expected IRR ${expected}%, got ${actual}%`);
    }
  }
  console.log(irrOk ? "PASS: IRR matches workbook exactly" : "FAIL: IRR mismatch");

  // 5. Premium financing (pledge mode, 1M tier, flat 2.5% loan rate) must
  // match 薪火抵押GGG SP x 中銀香港 (072026).xlsx exactly: loan=686,800,
  // selfPay=213,200, and per-year netReturn (O column) / IRR-with-PF (N column).
  const pfResults = calculatePF(plan, results1M, 1000000, net1M, "pledge", 0.025);
  const byYearPF = Object.fromEntries(pfResults.map((r) => [r.year, r]));
  let pfOk = true;
  if (Math.abs(byYearPF[1].loanAmount - 686800) > 1) {
    pfOk = false;
    console.error(`Loan amount: expected 686800, got ${byYearPF[1].loanAmount}`);
  }
  if (Math.abs(byYearPF[1].selfPayAmount - 213200) > 1) {
    pfOk = false;
    console.error(`Self-pay amount: expected 213200, got ${byYearPF[1].selfPayAmount}`);
  }
  const expectedNetReturn = { 3: 197403, 4: 256846, 5: 353834, 10: 504655 }; // O column
  for (const [year, expected] of Object.entries(expectedNetReturn)) {
    const actual = byYearPF[year].netReturn;
    if (Math.abs(actual - expected) > 1) {
      pfOk = false;
      console.error(`Year ${year} net return: expected ${expected}, got ${actual}`);
    }
  }
  const expectedIRRWithPF = { 3: -2.3372629621, 4: 4.298477839776, 5: 9.515531467691, 10: 7.38566877110 }; // N column
  for (const [year, expected] of Object.entries(expectedIRRWithPF)) {
    const actual = byYearPF[year].irrWithPFPercent;
    if (actual === null || Math.abs(actual - expected) > 0.01) {
      pfOk = false;
      console.error(`Year ${year} IRR-with-PF: expected ${expected}%, got ${actual}%`);
    }
  }
  console.log(pfOk ? "PASS: premium financing (pledge) matches workbook exactly" : "FAIL: premium financing mismatch");

  // 6. Chart segments (year 10, pledge, 1M): principal+loan+interest+return
  // must sum exactly to totalSV and match the manually derived breakdown.
  const seg10 = getChartSegments(byYearPF[10].totalSV, byYearPF[10].selfPayAmount, byYearPF[10].loanAmount, byYearPF[10].cumulativeInterest);
  const segSum = seg10.principal + seg10.loan + seg10.interest + seg10.returnAboveCost;
  const segOk =
    Math.abs(seg10.principal - 213200) < 1 &&
    Math.abs(seg10.loan - 686800) < 1 &&
    Math.abs(seg10.interest - 171700) < 1 &&
    Math.abs(seg10.returnAboveCost - 291455) < 1 &&
    Math.abs(segSum - byYearPF[10].totalSV) < 0.01;
  console.log(segOk ? "PASS: chart segments sum to totalSV and match expected breakdown" : "FAIL: chart segments mismatch");

  // 7. Generic-plan checks — BOC Life only exercises single-premium
  // (premiumDiscountTiers, span=1) plans. These use a synthetic plan config
  // to verify the code paths every OTHER company's plan will actually need:
  // multi-year payment spans with a discountTable[span][year] schedule, and
  // IRR cash-flow timing when premiums are still being paid partway through
  // the exit year range (t=0..paymentSpan-1 outflows, not just t=0).
  const testPlan = {
    returnTable: {
      3: { guaranteedCVRatio: 0.9, accumulatedDivRatio: 0, terminalDivRatio: 0 },
      5: { guaranteedCVRatio: 1.05, accumulatedDivRatio: 0, terminalDivRatio: 0 },
    },
    discountTable: { 3: { 1: 0.05, 2: 0.03, 3: 0.02 } },
    availableSpans: [3],
    day1SVRatio: 0.85,
    pf: {
      enabled: true,
      processingFeeRate: 0,
      processingFeeFixed: 0,
      // Flat (non-tiered) LTV on net premium — the one PF shape BOC Life's
      // two modes (day1SV-based, tiered) never exercises.
      modes: { flatLoan: { label: "Flat LTV on Net Premium", ltvRatio: 0.6, loanBasis: "netPremium" } },
    },
  };
  const testResults = calculatePlan(testPlan, 300000, 3);
  const byYearTest = Object.fromEntries(testResults.map((r) => [r.year, r]));

  let multiSpanOk = true;
  const netTest = totalNetPremium(300000, 3, testPlan);
  if (Math.abs(netTest - 290000) > 0.01) {
    multiSpanOk = false;
    console.error(`Multi-span net premium: expected 290000, got ${netTest}`);
  }
  if (Math.abs(byYearTest[3].totalSV - 270000) > 0.01) {
    multiSpanOk = false;
    console.error(`Multi-span year3 totalSV: expected 270000, got ${byYearTest[3].totalSV}`);
  }
  if (byYearTest[3].irrPercent === null || Math.abs(byYearTest[3].irrPercent - -3.5488) > 0.01) {
    multiSpanOk = false;
    console.error(`Multi-span year3 IRR: expected -3.5488%, got ${byYearTest[3].irrPercent}%`);
  }
  if (byYearTest[5].irrPercent === null || Math.abs(byYearTest[5].irrPercent - 2.0906) > 0.01) {
    multiSpanOk = false;
    console.error(`Multi-span year5 IRR: expected 2.0906%, got ${byYearTest[5].irrPercent}%`);
  }
  console.log(multiSpanOk ? "PASS: multi-year payment span (discountTable schedule) works generically" : "FAIL: multi-span plan mismatch");

  let flatPFOk = true;
  const testPF = calculatePF(testPlan, testResults, 300000, netTest, "flatLoan", 0.03);
  const byYearTestPF = Object.fromEntries(testPF.map((r) => [r.year, r]));
  if (Math.abs(byYearTestPF[3].loanAmount - 174000) > 0.01) {
    flatPFOk = false;
    console.error(`Flat-LTV loan amount: expected 174000, got ${byYearTestPF[3].loanAmount}`);
  }
  if (Math.abs(byYearTestPF[3].selfPayAmount - 116000) > 0.01) {
    flatPFOk = false;
    console.error(`Flat-LTV self-pay: expected 116000, got ${byYearTestPF[3].selfPayAmount}`);
  }
  if (byYearTestPF[3].irrWithPFPercent === null || Math.abs(byYearTestPF[3].irrWithPFPercent - -10.9232) > 0.01) {
    flatPFOk = false;
    console.error(`Flat-LTV IRR-with-PF: expected -10.9232%, got ${byYearTestPF[3].irrWithPFPercent}%`);
  }
  console.log(flatPFOk ? "PASS: flat (non-tiered) LTV-on-net-premium PF mode works generically" : "FAIL: flat-LTV PF mismatch");

  // 8. AXA 盛利 II (2-year span, $1M total) must match the proposal exactly.
  const axaPlan = resolvePlanForSpan(PLANS["axa_shengli2_supreme"], 2);
  const expectedAXA = {
    2: 152768, 5: 1002384, 10: 1563880, 20: 3241040, 30: 6409936,
  };
  const axaResults = calculatePlan(axaPlan, 1000000, 2);
  const byYearAXA = Object.fromEntries(axaResults.map((r) => [r.year, r]));
  let axaOk = true;
  for (const [year, expectedTotal] of Object.entries(expectedAXA)) {
    const actual = byYearAXA[year].totalSV;
    if (Math.abs(actual - expectedTotal) > 0.5) {
      axaOk = false;
      console.error(`AXA year ${year}: expected totalSV ${expectedTotal}, got ${actual}`);
    }
  }
  console.log(axaOk ? "PASS: AXA 盛利 II proposal matches exactly" : "FAIL: AXA proposal mismatch");

  // 9. Exiting BEFORE all installments are paid (AXA year 1 of a 2-year
  // span) must only charge the premium actually paid so far (1 payment),
  // not the full paymentSpan. totalSV is 0 here (per the proposal), so the
  // correct cash flow [-500000, 0] has no finite IRR (total loss, no
  // recovery) — calculateIRR should return null, not a misleading number.
  const year1CashFlow = byYearAXA[1];
  const earlyExitOk = year1CashFlow.totalSV === 0 && year1CashFlow.irrPercent === null;
  console.log(earlyExitOk ? "PASS: early-exit-before-fully-paid cash flow is correct" : `FAIL: year1 (span 2) totalSV=${year1CashFlow.totalSV}, irrPercent=${year1CashFlow.irrPercent}`);

  // 10. BOC Life GGG 2-year span must match its proposal exactly, including
  // the confirmed 7%-year-1-only discount (net premium = 465,000 + 500,000).
  const bocPlan2yr = resolvePlanForSpan(PLANS["boclife_ggg_wl"], 2);
  const expectedBoc2yr = {
    1: 306000, 5: 983263, 10: 1452090, 20: 2541992, 30: 4326819, 40: 7682489,
  };
  const bocResults2yr = calculatePlan(bocPlan2yr, 1000000, 2);
  const byYearBoc2yr = Object.fromEntries(bocResults2yr.map((r) => [r.year, r]));
  let boc2yrOk = true;
  for (const [year, expectedTotal] of Object.entries(expectedBoc2yr)) {
    const actual = byYearBoc2yr[year].totalSV;
    if (Math.abs(actual - expectedTotal) > 0.5) {
      boc2yrOk = false;
      console.error(`BOC 2yr year ${year}: expected totalSV ${expectedTotal}, got ${actual}`);
    }
  }
  const netBoc2yr = totalNetPremium(1000000, 2, bocPlan2yr);
  if (Math.abs(netBoc2yr - 965000) > 0.01) {
    boc2yrOk = false;
    console.error(`BOC 2yr net premium: expected 965000 (465000+500000), got ${netBoc2yr}`);
  }
  console.log(boc2yrOk ? "PASS: BOC Life GGG 2-year span matches proposal exactly" : "FAIL: BOC 2yr mismatch");

  // 11. AXA 盛利 II 5-year and 10-year spans must match their proposals exactly.
  const axa5yr = resolvePlanForSpan(PLANS["axa_shengli2_supreme"], 5);
  const axa10yr = resolvePlanForSpan(PLANS["axa_shengli2_supreme"], 10);
  const expectedAxa5yr = { 5: 732840, 10: 1320680, 20: 2775944, 30: 5851200 };
  const expectedAxa10yr = { 5: 106035, 10: 1080224, 20: 2360139, 30: 4810944 };
  const results5yr = Object.fromEntries(calculatePlan(axa5yr, 1000000, 5).map((r) => [r.year, r]));
  const results10yr = Object.fromEntries(calculatePlan(axa10yr, 1000000, 10).map((r) => [r.year, r]));
  let axaSpansOk = true;
  for (const [year, expectedTotal] of Object.entries(expectedAxa5yr)) {
    if (Math.abs(results5yr[year].totalSV - expectedTotal) > 0.5) {
      axaSpansOk = false;
      console.error(`AXA 5yr year ${year}: expected totalSV ${expectedTotal}, got ${results5yr[year].totalSV}`);
    }
  }
  for (const [year, expectedTotal] of Object.entries(expectedAxa10yr)) {
    if (Math.abs(results10yr[year].totalSV - expectedTotal) > 0.5) {
      axaSpansOk = false;
      console.error(`AXA 10yr year ${year}: expected totalSV ${expectedTotal}, got ${results10yr[year].totalSV}`);
    }
  }
  console.log(axaSpansOk ? "PASS: AXA 盛利 II 5-year and 10-year spans match proposals exactly" : "FAIL: AXA 5yr/10yr mismatch");

  // 12. An all-zero cash flow (e.g. paymentSpan=0 from a UI state bug) must
  // not produce a misleading IRR — this exact scenario surfaced as -50%
  // when switching between plans with different availableSpans left the
  // span dropdown empty. calculateIRR must return null, not exploit the
  // degenerate "NPV=0 at every rate" condition.
  const zeroIRR = calculateIRR([0, 0, 0]);
  console.log(zeroIRR === null ? "PASS: all-zero cash flow returns null IRR, not -50%" : `FAIL: expected null, got ${zeroIRR}`);

  // 13. resolvePlanForSpan: valid span returns a flat plan config with the
  // right returnTable; a span the product doesn't offer returns null.
  const resolvedOk =
    resolvePlanForSpan(PLANS["boclife_ggg_wl"], 1).returnTable[1].guaranteedCVRatio === 0.808 &&
    resolvePlanForSpan(PLANS["boclife_ggg_wl"], 2).returnTable[1].guaranteedCVRatio === 0.306 &&
    resolvePlanForSpan(PLANS["boclife_ggg_wl"], 99) === null;
  console.log(resolvedOk ? "PASS: resolvePlanForSpan picks the right span data, null for unavailable spans" : "FAIL: resolvePlanForSpan mismatch");

  // 14. BOC Life GGG 3/5/10-year spans must match their proposals exactly,
  // including each span's confirmed first-year-only discount. These source
  // proposals only give milestone years (not every year 1-40), so we check
  // against the same milestone years that are actually present.
  const bocPlan3yr = resolvePlanForSpan(PLANS["boclife_ggg_wl"], 3);
  const bocPlan5yr = resolvePlanForSpan(PLANS["boclife_ggg_wl"], 5);
  const bocPlan10yr = resolvePlanForSpan(PLANS["boclife_ggg_wl"], 10);
  const expectedBoc3yr = { 1: 168330, 3: 935160, 10: 1362350, 30: 4264859, 50: 13222739 };
  const expectedBoc5yr = { 1: 0, 5: 815803, 10: 1375360, 30: 3812289, 50: 11415239 };
  const expectedBoc10yr = { 1: 0, 8: 696557, 10: 1042090, 30: 3388259, 50: 10129439 };
  const results3yr = Object.fromEntries(calculatePlan(bocPlan3yr, 999990, 3).map((r) => [r.year, r]));
  const results5yrBoc = Object.fromEntries(calculatePlan(bocPlan5yr, 1000000, 5).map((r) => [r.year, r]));
  const results10yrBoc = Object.fromEntries(calculatePlan(bocPlan10yr, 1000000, 10).map((r) => [r.year, r]));
  let bocNewSpansOk = true;
  for (const [year, expectedTotal] of Object.entries(expectedBoc3yr)) {
    if (Math.abs(results3yr[year].totalSV - expectedTotal) > 0.5) {
      bocNewSpansOk = false;
      console.error(`BOC 3yr year ${year}: expected totalSV ${expectedTotal}, got ${results3yr[year].totalSV}`);
    }
  }
  for (const [year, expectedTotal] of Object.entries(expectedBoc5yr)) {
    if (Math.abs(results5yrBoc[year].totalSV - expectedTotal) > 0.5) {
      bocNewSpansOk = false;
      console.error(`BOC 5yr year ${year}: expected totalSV ${expectedTotal}, got ${results5yrBoc[year].totalSV}`);
    }
  }
  for (const [year, expectedTotal] of Object.entries(expectedBoc10yr)) {
    if (Math.abs(results10yrBoc[year].totalSV - expectedTotal) > 0.5) {
      bocNewSpansOk = false;
      console.error(`BOC 10yr year ${year}: expected totalSV ${expectedTotal}, got ${results10yrBoc[year].totalSV}`);
    }
  }
  const netBoc3yr = totalNetPremium(999990, 3, bocPlan3yr);
  const netBoc5yr = totalNetPremium(1000000, 5, bocPlan5yr);
  const netBoc10yr = totalNetPremium(1000000, 10, bocPlan10yr);
  if (Math.abs(netBoc3yr - 979990.2) > 0.01) { bocNewSpansOk = false; console.error(`BOC 3yr net premium: expected 979990.2, got ${netBoc3yr}`); }
  if (Math.abs(netBoc5yr - 984000) > 0.01) { bocNewSpansOk = false; console.error(`BOC 5yr net premium: expected 984000, got ${netBoc5yr}`); }
  if (Math.abs(netBoc10yr - 990000) > 0.01) { bocNewSpansOk = false; console.error(`BOC 10yr net premium: expected 990000, got ${netBoc10yr}`); }
  console.log(bocNewSpansOk ? "PASS: BOC Life GGG 3/5/10-year spans match proposals exactly" : "FAIL: BOC 3/5/10yr mismatch");

  // 15. BOC Life 寰御安心環球終身保險計劃 (huanyu) 2/5-year spans must match
  // their proposals exactly. Unlike 薪火傳承, these proposals give every
  // policy year 1-70 (not just milestones), so this checks a wider sample.
  const huanyuPlan2 = resolvePlanForSpan(PLANS["boclife_huanyu"], 2);
  const huanyuPlan5 = resolvePlanForSpan(PLANS["boclife_huanyu"], 5);
  const expectedHuanyu2 = { 1: 0, 7: 1006227, 15: 2000093, 30: 6409080, 50: 22570706, 70: 79495054 };
  const expectedHuanyu5 = { 1: 0, 7: 1000277, 15: 1844753, 30: 5851780, 50: 20608186, 70: 72582974 };
  const resultsHuanyu2 = Object.fromEntries(calculatePlan(huanyuPlan2, 1000000, 2).map((r) => [r.year, r]));
  const resultsHuanyu5 = Object.fromEntries(calculatePlan(huanyuPlan5, 1000000, 5).map((r) => [r.year, r]));
  let huanyuOk = true;
  for (const [year, expectedTotal] of Object.entries(expectedHuanyu2)) {
    if (Math.abs(resultsHuanyu2[year].totalSV - expectedTotal) > 0.5) {
      huanyuOk = false;
      console.error(`寰御 2yr year ${year}: expected totalSV ${expectedTotal}, got ${resultsHuanyu2[year].totalSV}`);
    }
  }
  for (const [year, expectedTotal] of Object.entries(expectedHuanyu5)) {
    if (Math.abs(resultsHuanyu5[year].totalSV - expectedTotal) > 0.5) {
      huanyuOk = false;
      console.error(`寰御 5yr year ${year}: expected totalSV ${expectedTotal}, got ${resultsHuanyu5[year].totalSV}`);
    }
  }
  const netHuanyu2 = totalNetPremium(1000000, 2, huanyuPlan2);
  const netHuanyu5 = totalNetPremium(1000000, 5, huanyuPlan5);
  if (Math.abs(netHuanyu2 - 976000) > 0.01) { huanyuOk = false; console.error(`寰御 2yr net premium: expected 976000, got ${netHuanyu2}`); }
  if (Math.abs(netHuanyu5 - 976000) > 0.01) { huanyuOk = false; console.error(`寰御 5yr net premium: expected 976000, got ${netHuanyu5}`); }
  console.log(huanyuOk ? "PASS: BOC Life 寰御安心環球 2/5-year spans match proposals exactly" : "FAIL: 寰御 2/5yr mismatch");

  // 16. CTF Life 匠心飛越 (1/5yr) and 榮耀世代 (1yr, day1SVRatio) must match
  // their proposals exactly.
  const ctfJx1 = resolvePlanForSpan(PLANS["ctf_jiangxin"], 1);
  const ctfJx5 = resolvePlanForSpan(PLANS["ctf_jiangxin"], 5);
  const ctfRy1 = resolvePlanForSpan(PLANS["ctf_rongyao"], 1);
  const expectedJx1 = { 10: 1660023, 30: 6614366, 78: 135915631 };
  const expectedJx5 = { 10: 1322943, 30: 5854729, 78: 120307042 };
  const expectedRy1 = { 1: 836000, 10: 1650000, 30: 5717948 };
  const resultsJx1 = Object.fromEntries(calculatePlan(ctfJx1, 1000000, 1).map((r) => [r.year, r]));
  const resultsJx5 = Object.fromEntries(calculatePlan(ctfJx5, 1000000, 5).map((r) => [r.year, r]));
  const resultsRy1 = Object.fromEntries(calculatePlan(ctfRy1, 1000000, 1).map((r) => [r.year, r]));
  let ctfOk = true;
  for (const [year, expectedTotal] of Object.entries(expectedJx1)) {
    if (Math.abs(resultsJx1[year].totalSV - expectedTotal) > 0.5) { ctfOk = false; console.error(`CTF 匠心飛越 1yr year ${year}: expected ${expectedTotal}, got ${resultsJx1[year].totalSV}`); }
  }
  for (const [year, expectedTotal] of Object.entries(expectedJx5)) {
    if (Math.abs(resultsJx5[year].totalSV - expectedTotal) > 0.5) { ctfOk = false; console.error(`CTF 匠心飛越 5yr year ${year}: expected ${expectedTotal}, got ${resultsJx5[year].totalSV}`); }
  }
  for (const [year, expectedTotal] of Object.entries(expectedRy1)) {
    if (Math.abs(resultsRy1[year].totalSV - expectedTotal) > 0.5) { ctfOk = false; console.error(`CTF 榮耀世代 1yr year ${year}: expected ${expectedTotal}, got ${resultsRy1[year].totalSV}`); }
  }
  if (ctfRy1.day1SVRatio !== 0.83) { ctfOk = false; console.error(`CTF 榮耀世代 day1SVRatio: expected 0.83, got ${ctfRy1.day1SVRatio}`); }
  console.log(ctfOk ? "PASS: CTF Life 匠心飛越/榮耀世代 match proposals exactly" : "FAIL: CTF mismatch");

  // 17. FWD 盈聚‧天下 II (1/2/3/5yr) must match its proposals exactly.
  const fwd1 = resolvePlanForSpan(PLANS["fwd_yingju2"], 1);
  const fwd2 = resolvePlanForSpan(PLANS["fwd_yingju2"], 2);
  const fwd3 = resolvePlanForSpan(PLANS["fwd_yingju2"], 3);
  const fwd5 = resolvePlanForSpan(PLANS["fwd_yingju2"], 5);
  const expectedFwd1 = { 1: 600000, 10: 1628674, 30: 6614366, 87: 239560866 };
  const expectedFwd2 = { 1: 250000, 10: 1491924, 30: 6412062, 87: 232249935 };
  const expectedFwd3 = { 4: 1859120, 10: 4228321, 30: 18656160, 87: 675710811 };
  const expectedFwd5 = { 3: 1287412, 10: 6607084, 30: 29273206, 87: 1060248132 };
  const resultsFwd1 = Object.fromEntries(calculatePlan(fwd1, 1000000, 1).map((r) => [r.year, r]));
  const resultsFwd2 = Object.fromEntries(calculatePlan(fwd2, 1000000, 2).map((r) => [r.year, r]));
  const resultsFwd3 = Object.fromEntries(calculatePlan(fwd3, 3000000, 3).map((r) => [r.year, r]));
  const resultsFwd5 = Object.fromEntries(calculatePlan(fwd5, 5000000, 5).map((r) => [r.year, r]));
  let fwdOk = true;
  for (const [results, expected, label] of [
    [resultsFwd1, expectedFwd1, "1yr"], [resultsFwd2, expectedFwd2, "2yr"],
    [resultsFwd3, expectedFwd3, "3yr"], [resultsFwd5, expectedFwd5, "5yr"],
  ]) {
    for (const [year, expectedTotal] of Object.entries(expected)) {
      if (Math.abs(results[year].totalSV - expectedTotal) > 0.5) {
        fwdOk = false;
        console.error(`FWD ${label} year ${year}: expected ${expectedTotal}, got ${results[year].totalSV}`);
      }
    }
  }
  if (fwd1.day1SVRatio !== 0.6) { fwdOk = false; console.error(`FWD 1yr day1SVRatio: expected 0.6, got ${fwd1.day1SVRatio}`); }
  if (fwd1.pf !== null || fwd2.pf !== null || fwd3.pf !== null || fwd5.pf !== null) {
    fwdOk = false;
    console.error("FWD 盈聚‧天下 II: expected pf:null on all spans (confirmed non-PF), found a non-null pf config");
  }
  console.log(fwdOk ? "PASS: FWD 盈聚‧天下 II 1/2/3/5-year spans match proposals exactly" : "FAIL: FWD mismatch");

  // 18. FWD 智盈匯聚（優越版）III (1yr, PF-enabled) must match its proposal.
  const zhiying1 = resolvePlanForSpan(PLANS["fwd_zhiying3"], 1);
  const expectedZhiying1 = { 1: 800000, 10: 1553432, 30: 3868551, 87: 65687661 };
  const resultsZhiying1 = Object.fromEntries(calculatePlan(zhiying1, 1000000, 1).map((r) => [r.year, r]));
  let zhiyingOk = true;
  for (const [year, expectedTotal] of Object.entries(expectedZhiying1)) {
    if (Math.abs(resultsZhiying1[year].totalSV - expectedTotal) > 0.5) {
      zhiyingOk = false;
      console.error(`FWD 智盈匯聚 III year ${year}: expected ${expectedTotal}, got ${resultsZhiying1[year].totalSV}`);
    }
  }
  if (zhiying1.day1SVRatio !== 0.8) { zhiyingOk = false; console.error(`FWD 智盈匯聚 III day1SVRatio: expected 0.8, got ${zhiying1.day1SVRatio}`); }
  if (!zhiying1.pf) { zhiyingOk = false; console.error("FWD 智盈匯聚 III: expected pf to be enabled"); }
  console.log(zhiyingOk ? "PASS: FWD 智盈匯聚（優越版）III matches proposal exactly" : "FAIL: FWD 智盈匯聚 III mismatch");

  console.log("1M results:", results1M);
  console.log("1M PF (pledge) results:", pfResults);
}
