// app.js — DOM wiring. Phase 1-4: form in, base + PF-overlaid table + chart out.
// No PDF, no multi-plan comparison yet — those come in later phases.
// UI chrome strings come from i18n.js's t() helper; plan data (name/company/
// disclaimer) is left in its original source language regardless of UI lang.
//
// Payment span is a real input (#span), not a plan selection — each PLANS
// entry is one product with data for possibly several spans under
// plan.spans[N] (see plans.js). getCurrentPlan() below resolves the
// selected plan + span into the flat shape calculatePlan/calculatePF expect.

const STORAGE_KEY = "savingsAppState";
const ADVISOR_STORAGE_KEY = "savingsAppAdvisor";
const PF_RECENT_STORAGE_KEY = "savingsAppPfRecent";

const state = {
  grossPremium: 1000000,
  paymentSpan: 1,
  selectedCompany: null,
  selectedPlanId: Object.keys(PLANS)[0],
  pfEnabled: false,
  pfMode: null,
  pfLtvPercent: null, // null = use the mode's default LTV
  pfLoanRatePercent: 2.5,
  pfStressRatePercent: null,
  chartYears: [null, null, null],
  // Optional "what if I just banked this instead" reference rate — shared
  // across the single-plan line chart AND the comparison line chart (one
  // input, applies everywhere a full-range line chart is shown).
  bankRatePercent: null,
  // Advisor-entered per-year discount rates (0-1, index 0 = year 1),
  // length === paymentSpan. Discount/LTV data is unreliable across most
  // plans (few insurers actually confirm it in writing), so both are
  // treated as hand-entered-per-case inputs rather than sourced facts —
  // null means "use the plan's built-in discountTable/premiumDiscountTiers
  // as a starting point", which populateDiscountOverrideInputs() reads out
  // into editable fields the first time a plan/span is shown.
  discountOverridePercents: null,
  // Snapshots added via "Add to Comparison" — not persisted to localStorage
  // (session-only), since these are meant for a single side-by-side
  // discussion with a client, not a saved artifact. See addToComparison().
  // Comparison years are 3 manually-typed policy years (#comparison-year-1/
  // 2/3 in the DOM), not tracked in state — see readComparisonYears().
  comparisonSlots: [],
};

// Cached from the last calculate() call so the chart can re-render when the
// year pickers change without re-running the whole calculation.
let lastResults = null;
let lastPFResults = null;
let chartInstance = null;

// Resolves state.selectedPlanId + state.paymentSpan into a flat plan config
// (returnTable/discountTable/pf directly on it — see resolvePlanForSpan in
// calculator.js). Falls back to the plan's first available span if the held
// span doesn't exist on this plan (e.g. stale localStorage, or just switched
// to a plan that doesn't offer the previous span).
function getCurrentPlan() {
  const plan = PLANS[state.selectedPlanId];
  let resolved = resolvePlanForSpan(plan, state.paymentSpan);
  if (!resolved) {
    state.paymentSpan = plan.availableSpans[0];
    resolved = resolvePlanForSpan(plan, state.paymentSpan);
  }
  return resolved;
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved) Object.assign(state, saved);
  } catch (e) {
    // ignore corrupt/missing localStorage data
  }
  // A saved plan id from a previous session/build may no longer exist
  // (e.g. plans.js was updated) — fall back to the first available plan.
  if (!PLANS[state.selectedPlanId]) {
    state.selectedPlanId = Object.keys(PLANS)[0];
  }
  // Keep selectedCompany consistent with selectedPlanId — also backfills
  // old saved state from before the two-step company/plan picker existed.
  state.selectedCompany = PLANS[state.selectedPlanId].company;
  const plan = PLANS[state.selectedPlanId];
  if (!plan.availableSpans.includes(state.paymentSpan)) {
    state.paymentSpan = plan.availableSpans[0];
  }
  const resolvedPlan = getCurrentPlan();
  if (!resolvedPlan.pf || !resolvedPlan.pf.modes[state.pfMode]) {
    state.pfMode = resolvedPlan.pf ? Object.keys(resolvedPlan.pf.modes)[0] : null;
  }
}

function saveState() {
  // comparisonSlots is deliberately session-only (see the comment on
  // state.comparisonSlots) — a stale slot snapshotting an old plans.js
  // shape could otherwise resurrect broken data on next load.
  const { comparisonSlots, ...persisted } = state;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
}

function formatMoney(n) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatPercent(n) {
  return n === null || n === undefined ? "—" : n.toFixed(2) + "%";
}

// All plans in this app are currently USD, but this keeps the axis label
// driven by the actual plan data instead of a hardcoded string.
function currencyLabel(code) {
  return code === "USD" ? t("currencyUSD") : code;
}

// Chart y-axes were showing full numbers like "13,222,739" — hard to read
// at a glance and prone to crowding/overlapping each other. Scales ticks
// down to millions or thousands (based on the chart's own max value) and
// states the unit in the axis title instead, e.g. "13.2" with a title of
// "Total Cash Value (USD, millions)".
function pickValueScale(maxValue) {
  if (maxValue >= 1000000) return { divisor: 1000000, unitKey: "unitMillions" };
  if (maxValue >= 1000) return { divisor: 1000, unitKey: "unitThousands" };
  return { divisor: 1, unitKey: null };
}

function scaledAxisTitle(currency, unitKey) {
  return unitKey ? t("chartAxisValue", currencyLabel(currency), t(unitKey)) : t("chartAxisValueNoUnit", currencyLabel(currency));
}

function scaledTickCallback(divisor) {
  return (v) => (v / divisor).toLocaleString(undefined, { maximumFractionDigits: divisor === 1 ? 0 : 1 });
}

function applyTranslations() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.getElementById("lang-en").classList.toggle("active", currentLang === "en");
  document.getElementById("lang-zh").classList.toggle("active", currentLang === "zh");
}

function switchLang(lang) {
  setLang(lang);
  applyTranslations();
  // Static labels are handled by data-i18n above; everything below is
  // rebuilt from JS templates, so it needs an explicit re-render.
  populateCompanySelect();
  populatePlanSelect();
  populateSpanSelect();
  populatePFModeSelect();
  populateDiscountOverrideInputs();
  renderPfRecentRow();
  if (lastResults) {
    renderResultsTable(lastResults, lastPFResults);
    renderSummary(lastPFResults);
    populateChartYearSelects();
    renderChart(lastResults, lastPFResults);
    renderPlanLineChart(lastResults, lastPFResults);
  }
  if (state.comparisonSlots.length > 0) {
    populateComparisonYears();
    renderComparisonTable();
    renderComparisonBarChart();
    renderComparisonChart();
  }
}

// Companies with at least one real-data plan sort first, then alphabetical —
// keeps the working companies easy to find as more get added.
function getCompanies() {
  const companies = [...new Set(Object.values(PLANS).map((p) => p.company))];
  const hasRealData = (company) => Object.values(PLANS).some((p) => p.company === company && p.hasRealData);
  return companies.sort((a, b) => {
    if (hasRealData(a) !== hasRealData(b)) return hasRealData(a) ? -1 : 1;
    return a.localeCompare(b);
  });
}

function plansForCompany(company) {
  return Object.entries(PLANS)
    .filter(([, plan]) => plan.company === company)
    .sort(([, a], [, b]) => {
      if (a.hasRealData !== b.hasRealData) return a.hasRealData ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

// Step 1 of the plan picker: choose a company. Each company can hold many
// plans (they get added/updated frequently), so the plan list itself is
// filtered down in populatePlanSelect() once a company is chosen.
function populateCompanySelect() {
  const select = document.getElementById("company");
  select.innerHTML = "";
  for (const company of getCompanies()) {
    const opt = document.createElement("option");
    opt.value = company;
    opt.textContent = company;
    select.appendChild(opt);
  }
  select.value = state.selectedCompany;
}

// Step 2 of the plan picker: choose a plan (product) within the selected
// company. Payment span is a separate input (#span), not part of this list.
function populatePlanSelect() {
  const select = document.getElementById("plan");
  select.innerHTML = "";
  const plans = plansForCompany(state.selectedCompany);
  for (const [planId, plan] of plans) {
    const opt = document.createElement("option");
    opt.value = planId;
    opt.textContent = plan.hasRealData ? plan.name : `${plan.name} ${t("noDataSuffix")}`;
    select.appendChild(opt);
  }
  if (!plans.some(([id]) => id === state.selectedPlanId)) {
    state.selectedPlanId = plans[0][0];
  }
  select.value = state.selectedPlanId;
  updatePlanStatus();
}

function updatePlanStatus() {
  const plan = PLANS[state.selectedPlanId];
  const status = document.getElementById("plan-status");
  status.textContent = plan.hasRealData ? "" : t("planStatusNoData");
  status.hidden = plan.hasRealData;
}

function populateSpanSelect() {
  const select = document.getElementById("span");
  const plan = PLANS[state.selectedPlanId];
  select.innerHTML = "";
  for (const span of plan.availableSpans) {
    const opt = document.createElement("option");
    opt.value = span;
    opt.textContent = span === 1 ? t("yearSingular") : t("yearsPlural", span);
    select.appendChild(opt);
  }
  // The held payment span may not exist on the newly selected plan (e.g.
  // switching from a span-2 plan to a span-10-only plan) — fall back to the
  // plan's first available span rather than leaving the dropdown empty.
  if (!plan.availableSpans.includes(state.paymentSpan)) {
    state.paymentSpan = plan.availableSpans[0];
  }
  select.value = state.paymentSpan;
}

// Renders one editable "Year N discount %" input per payment-span year.
// Seeded from the plan's built-in discount schedule as a starting point
// (so switching plans still shows something sensible), but every value is
// freely editable and calculate() always reads back whatever is currently
// in these fields rather than trusting plans.js — discount rates are
// treated as advisor-entered-per-case, not sourced/confirmed data.
function populateDiscountOverrideInputs() {
  const container = document.getElementById("discount-override-inputs");
  const plan = getCurrentPlan();
  const span = state.paymentSpan;

  const seed =
    state.discountOverridePercents && state.discountOverridePercents.length === span
      ? state.discountOverridePercents
      : applyDiscounts(state.grossPremium || 1, span, plan).map((net, i) => {
          const grossPerYear = (state.grossPremium || 1) / span;
          return grossPerYear > 0 ? 1 - net / grossPerYear : 0;
        });

  container.innerHTML = "";
  for (let i = 0; i < span; i++) {
    const wrap = document.createElement("div");
    const label = document.createElement("label");
    label.textContent = t("yearLabel", i + 1);
    const input = document.createElement("input");
    input.type = "number";
    input.inputMode = "decimal";
    input.step = "0.1";
    input.className = "discount-override-input";
    input.value = (seed[i] * 100).toFixed(2);
    input.addEventListener("input", updateDiscountDisclosureSummary);
    wrap.appendChild(label);
    wrap.appendChild(input);
    container.appendChild(wrap);
  }
  state.discountOverridePercents = seed;
  updateDiscountDisclosureSummary();
}

function readDiscountOverridePercents() {
  return Array.from(document.querySelectorAll(".discount-override-input")).map(
    (input) => (Number(input.value) || 0) / 100
  );
}

// Keeps the collapsed <details> summary showing current values (e.g. "Y1
// 10.0%, Y2 2.0%") so the discount grid's state is visible without opening
// it — the grid itself defaults closed to keep the input stage uncluttered.
function updateDiscountDisclosureSummary() {
  const values = Array.from(document.querySelectorAll(".discount-override-input")).map(
    (input, i) => `Y${i + 1} ${(Number(input.value) || 0).toFixed(1)}%`
  );
  const el = document.getElementById("discount-disclosure-summary");
  if (el) el.textContent = values.join(", ");
}

// --- Plan-summary collapse: after Calculate, the Company/Plan/Inputs form
// collapses into a compact one-line summary so it stops competing with
// Results for attention — tap Edit to bring the full form back.
function collapsePlanForm() {
  const plan = getCurrentPlan();
  const spanLabel = state.paymentSpan === 1 ? t("yearSingular") : t("yearsPlural", state.paymentSpan);
  document.getElementById("plan-summary-text").textContent = `${plan.company} — ${plan.name}`;
  document.getElementById("plan-summary-subtext").textContent = `${spanLabel} · ${formatMoney(state.grossPremium)}`;
  document.getElementById("plan-form-wrap").hidden = true;
  document.getElementById("plan-summary-bar").hidden = false;
}

function expandPlanForm() {
  document.getElementById("plan-form-wrap").hidden = false;
  document.getElementById("plan-summary-bar").hidden = true;
}

// --- Sticky step nav: click-to-scroll + scroll-spy via IntersectionObserver.
function initStepNav() {
  const items = document.querySelectorAll(".step-nav-item");
  items.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = document.getElementById(btn.dataset.target);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          items.forEach((btn) => btn.classList.toggle("active", btn.dataset.target === entry.target.id));
        }
      });
    },
    { rootMargin: "-20% 0px -70% 0px" }
  );
  document.querySelectorAll(".zone").forEach((zone) => observer.observe(zone));
}

function populatePFModeSelect() {
  const select = document.getElementById("pf-mode");
  const plan = getCurrentPlan();
  select.innerHTML = "";
  updatePFAvailabilityNote(plan);
  if (!plan.pf) return;
  for (const modeKey of Object.keys(plan.pf.modes)) {
    const opt = document.createElement("option");
    opt.value = modeKey;
    opt.textContent = plan.pf.modes[modeKey].label || modeKey;
    select.appendChild(opt);
  }
  if (!plan.pf.modes[state.pfMode]) {
    state.pfMode = Object.keys(plan.pf.modes)[0];
  }
  select.value = state.pfMode;
  updateDefaultLTV();
}

// Surfaces whether the currently-selected plan+span supports premium
// financing at all — per-span, not per-plan, since e.g. BOC 薪火傳承 offers
// PF on some spans (1/2) but not others (3/5/10). Also disables the PF
// toggle entirely when unavailable, rather than leaving it clickable with
// no visible effect.
function updatePFAvailabilityNote(plan) {
  const note = document.getElementById("pf-availability-note");
  const toggle = document.getElementById("pf-enabled");
  const available = !!plan.pf;
  note.textContent = available ? t("pfAvailableNote") : t("pfUnavailableNote");
  note.classList.toggle("pf-available", available);
  note.classList.toggle("pf-unavailable", !available);
  toggle.disabled = !available;
  if (!available && toggle.checked) {
    toggle.checked = false;
    syncPFVisibility();
  }
}

function updateDefaultLTV() {
  const plan = getCurrentPlan();
  if (!plan.pf || !state.pfMode) return;
  const mode = plan.pf.modes[state.pfMode];
  const { ltvRatio } = resolveLoanBasis(mode, state.grossPremium, 0, 0);
  if (state.pfLtvPercent === null) {
    document.getElementById("pf-ltv").value = (ltvRatio * 100).toFixed(1);
  }
}

function renderResultsTable(results, pfResults) {
  const tbody = document.querySelector("#results-table tbody");
  tbody.innerHTML = "";
  const pfCols = document.querySelectorAll("#results-table .pf-col");
  pfCols.forEach((th) => (th.hidden = !pfResults));

  const rows = pfResults || results;
  let anyEstimated = false;
  for (const row of rows) {
    if (row.isEstimated) anyEstimated = true;
    const tr = document.createElement("tr");
    if (row.isEstimated) tr.className = "estimated-row";
    let html = `
      <td>${row.year}${row.isEstimated ? ` <span class="estimated-tag">${t("estimatedTag")}</span>` : ""}</td>
      <td>${formatMoney(row.guaranteedCV)}</td>
      <td>${formatMoney(row.accumulatedDiv)}</td>
      <td>${formatMoney(row.terminalDiv)}</td>
      <td>${formatMoney(row.totalSV)}</td>
      <td>${formatPercent(row.irrPercent)}</td>
    `;
    if (pfResults) {
      html += `
        <td class="pf-col">${formatMoney(row.loanAmount)}</td>
        <td class="pf-col">${formatMoney(row.cumulativeInterest)}</td>
        <td class="pf-col">${formatMoney(row.valueAfterLoanRepayment)}</td>
        <td class="pf-col">${formatMoney(row.netReturn)}</td>
        <td class="pf-col">${formatPercent(row.irrWithPFPercent)}</td>
      `;
    }
    tr.innerHTML = html;
    tbody.appendChild(tr);
  }
  document.getElementById("results").hidden = false;

  const estimatedNote = document.getElementById("results-estimated-note");
  estimatedNote.textContent = anyEstimated ? t("estimatedRowsNote") : "";
  estimatedNote.hidden = !anyEstimated;

  // disclaimer is product-level (not span-specific), so plain PLANS lookup is fine.
  const plan = PLANS[state.selectedPlanId];
  const disclaimer = document.getElementById("plan-disclaimer");
  if (plan.disclaimer) {
    disclaimer.textContent = plan.disclaimer;
    disclaimer.hidden = false;
  } else {
    disclaimer.hidden = true;
  }
}

// Gross premium, discount, and net premium always show; loan/self-pay/
// leverage/monthly-interest only show when Premium Financing is on —
// mirrors the PortfoPlus summary bar (保費總額/首年優惠/本金/貸款比率).
function renderSummary(pfResults) {
  const plan = getCurrentPlan();
  const netPremium = totalNetPremium(state.grossPremium, state.paymentSpan, plan, state.discountOverridePercents);
  const discountAmount = state.grossPremium - netPremium;
  const discountPct = state.grossPremium > 0 ? (discountAmount / state.grossPremium) * 100 : 0;

  document.getElementById("sum-gross").textContent = formatMoney(state.grossPremium);
  // When the discount rate differs by payment year (e.g. BOC's 2-year span:
  // 7% year 1, 0% year 2), a single blended % (here, 3.5%) doesn't match any
  // published rate and looks like an error — show the per-year breakdown
  // instead of just the blended figure whenever it isn't uniform.
  const grossPerYear = state.grossPremium / state.paymentSpan;
  const netPerYear = applyDiscounts(state.grossPremium, state.paymentSpan, plan, state.discountOverridePercents);
  const ratesPerYear = netPerYear.map((net) => (grossPerYear > 0 ? 1 - net / grossPerYear : 0));
  const isUniform = ratesPerYear.every((r) => Math.abs(r - ratesPerYear[0]) < 0.0001);
  const discountDetail = isUniform
    ? `${discountPct.toFixed(1)}%`
    : ratesPerYear.map((r, i) => `Y${i + 1}: ${(r * 100).toFixed(1)}%`).join(", ");
  document.getElementById("sum-discount").textContent = `${formatMoney(discountAmount)} (${discountDetail})`;
  document.getElementById("sum-net").textContent = formatMoney(netPremium);

  const extra = document.getElementById("pf-summary-extra");
  if (pfResults && pfResults.length > 0) {
    const { loanAmount, selfPayAmount } = pfResults[0];
    const ratio = selfPayAmount / netPremium;
    const monthlyInterest = (loanAmount * state.pfLoanRatePercent) / 100 / 12;
    document.getElementById("sum-ltv").textContent = document.getElementById("pf-ltv").value + "%";
    document.getElementById("sum-loan").textContent = formatMoney(loanAmount);
    document.getElementById("sum-selfpay").textContent = formatMoney(selfPayAmount);
    document.getElementById("sum-selfpay-ratio").textContent = (ratio * 100).toFixed(1) + "%";
    document.getElementById("sum-leverage").textContent = (1 / ratio).toFixed(2) + "x";
    document.getElementById("sum-monthly-interest").textContent = formatMoney(monthlyInterest) + " " + t("perMonth");
    extra.hidden = false;
  } else {
    extra.hidden = true;
  }

  document.getElementById("summary").hidden = false;
}

function renderStressTable(baseResults, stressResults) {
  const section = document.getElementById("stress-results");
  if (!stressResults) {
    section.hidden = true;
    return;
  }
  const tbody = document.querySelector("#stress-table tbody");
  tbody.innerHTML = "";
  const byYearBase = Object.fromEntries(baseResults.map((r) => [r.year, r]));
  for (const row of stressResults) {
    const base = byYearBase[row.year];
    const diff = row.netReturn - base.netReturn;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.year}</td>
      <td>${formatMoney(base.netReturn)}</td>
      <td>${formatMoney(row.netReturn)}</td>
      <td>${diff >= 0 ? "+" : ""}${formatMoney(diff)}</td>
    `;
    tbody.appendChild(tr);
  }
  section.hidden = false;
}

function populateChartYearSelects() {
  const plan = getCurrentPlan();
  const expandedTable = expandReturnTableWithEstimates(plan.returnTable);
  const years = Object.keys(expandedTable).map(Number).sort((a, b) => a - b);
  const defaults = plan.defaultCompareYears || years.slice(0, 3);

  ["chart-year-1", "chart-year-2", "chart-year-3"].forEach((id, i) => {
    const select = document.getElementById(id);
    select.innerHTML = "";
    for (const year of years) {
      const opt = document.createElement("option");
      opt.value = year;
      opt.textContent = expandedTable[year].isEstimated ? `${t("yearLabel", year)} (${t("estimatedTag")})` : t("yearLabel", year);
      select.appendChild(opt);
    }
    const chosen = state.chartYears[i] && years.includes(state.chartYears[i]) ? state.chartYears[i] : defaults[i] || years[0];
    select.value = chosen;
    state.chartYears[i] = chosen;
  });
}

function readChartYears() {
  return ["chart-year-1", "chart-year-2", "chart-year-3"].map((id) => Number(document.getElementById(id).value));
}

// Chart.js canvases are transparent by default. That's invisible on-screen
// (the card behind it is already white) but a real problem when exporting
// to JPEG for the PDF — JPEG has no alpha channel, so transparent pixels
// render as solid black. Paint white behind the chart on every draw so both
// the on-screen canvas and any exported image have a proper background.
const chartWhiteBackgroundPlugin = {
  id: "chartWhiteBackground",
  beforeDraw: (chart) => {
    const { ctx } = chart;
    ctx.save();
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, chart.width, chart.height);
    ctx.restore();
  },
};

function renderChart(results, pfResults) {
  const plan = getCurrentPlan();
  const chartYears = readChartYears();
  state.chartYears = chartYears;
  saveState();

  const byYear = Object.fromEntries(results.map((r) => [r.year, r]));
  const byYearPF = pfResults ? Object.fromEntries(pfResults.map((r) => [r.year, r])) : null;
  const netPremium = totalNetPremium(state.grossPremium, state.paymentSpan, plan);
  // Discount applied to the gross premium — shown as its own Year 0 segment,
  // same as PortfoPlus's "優惠" sliver on the day-0 bar.
  const discountAmount = state.grossPremium - netPremium;

  // Year 0 = the initial funding position, before any growth: principal,
  // loan (if PF is on), and discount, summing to the full gross premium.
  const year0Principal = byYearPF ? byYearPF[chartYears[0]].selfPayAmount : netPremium;
  const year0Loan = byYearPF ? byYearPF[chartYears[0]].loanAmount : 0;

  const rows = [null, ...chartYears.map((y) => (byYearPF ? byYearPF[y] : byYear[y]))];
  const labels = [
    t("yearLabel", 0),
    ...chartYears.map((y, i) => {
      const row = rows[i + 1];
      return row && row.isEstimated ? `${t("yearLabel", y)} (${t("estimatedTag")})` : t("yearLabel", y);
    }),
  ];
  const segments = [
    { principal: year0Principal, loan: year0Loan, discount: discountAmount, interest: 0, returnAboveCost: 0 },
    ...chartYears.map((y) => {
      const row = byYearPF ? byYearPF[y] : byYear[y];
      const principal = byYearPF ? row.selfPayAmount : netPremium;
      const loan = byYearPF ? row.loanAmount : 0;
      const interest = byYearPF ? row.cumulativeInterest : 0;
      return { ...getChartSegments(row.totalSV, principal, loan, interest), discount: 0 };
    }),
  ];

  // Palette: sage/blue/taupe/gold/coral — muted, distinguishable at a glance,
  // matches the app's ivory/coral design system rather than primary web colors.
  const datasets = [
    { label: t("datasetPrincipal"), backgroundColor: "#8fbfa8", data: segments.map((s) => s.principal), datalabels: { color: "#1f3a2d" } },
  ];
  if (byYearPF) {
    datasets.push({ label: t("datasetLoan"), backgroundColor: "#8aa8c2", data: segments.map((s) => s.loan), datalabels: { color: "#1f3040" } });
  }
  if (discountAmount > 0.01) {
    datasets.push({ label: t("datasetDiscount"), backgroundColor: "#c9beac", data: segments.map((s) => s.discount), datalabels: { color: "#4a4030" } });
  }
  if (byYearPF) {
    datasets.push({ label: t("datasetInterest"), backgroundColor: "#f0c265", data: segments.map((s) => s.interest), datalabels: { color: "#4a3510" } });
  }
  datasets.push({ label: t("datasetReturn"), backgroundColor: "#e08a72", data: segments.map((s) => s.returnAboveCost), datalabels: { color: "#fff" } });

  // Only label a segment if it's a large-enough slice of the tallest bar —
  // otherwise tiny slivers (e.g. a small Interest sliver) get an unreadable
  // squashed label that overlaps its neighbors.
  const barTotals = segments.map((s) => s.principal + s.loan + s.discount + s.interest + s.returnAboveCost);
  const labelThreshold = Math.max(...barTotals) * 0.03;

  if (chartInstance) chartInstance.destroy();
  // Reveal the container BEFORE constructing the chart — Chart.js sizes
  // its canvas off the container's layout at construction time, and a
  // hidden (0x0) container on first render leaves the chart permanently
  // sized 0x0 until some later resize event happens to fire. That's
  // invisible on-screen (nothing to look at yet) but crashes PDF export
  // if it's triggered right after the first Calculate. Setting `hidden`
  // alone isn't enough — the browser hasn't flushed layout yet at that
  // point, so force a synchronous reflow by reading offsetWidth before
  // Chart.js reads the container's size.
  const chartCard = document.getElementById("chart-card");
  chartCard.hidden = false;
  void chartCard.offsetWidth;
  const ctx = document.getElementById("results-chart").getContext("2d");
  chartInstance = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets },
    plugins: [ChartDataLabels, chartWhiteBackgroundPlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      // Top padding keeps the tallest bar's datalabel from colliding with
      // the legend sitting right above the chart — without this, a bar
      // reaching close to the chart's max value gets its label overlapped
      // by the legend text (very visible once the whole page is scaled
      // down, e.g. viewing an exported PDF on a phone screen).
      layout: { padding: { top: 24 } },
      scales: {
        x: {
          stacked: true,
          // The axis title already says "Policy Year" — repeating "Year"
          // on every single tick (Year 0, Year 10, Year 20...) is noise, so
          // ticks show the bare number. labels/datasets are left as "Year
          // N" since those still feed the caption list and tooltips, where
          // the word is useful context.
          ticks: { callback: function (value) { return this.getLabelForValue(value).replace(/\D/g, ""); } },
          title: { display: true, text: t("chartAxisYear") },
        },
        y: (() => {
          const { divisor, unitKey } = pickValueScale(Math.max(...barTotals));
          return {
            stacked: true,
            ticks: { callback: scaledTickCallback(divisor) },
            title: { display: true, text: scaledAxisTitle(plan.currency, unitKey) },
          };
        })(),
      },
      plugins: {
        tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatMoney(ctx.parsed.y)}` } },
        datalabels: {
          formatter: (value) => (value > 0 ? formatMoney(value) : ""),
          // "auto" (not just true/false) tells the datalabels plugin to hide
          // whichever of these labels would otherwise visually overlap —
          // segments in a stacked bar can end up close together in height,
          // which was causing numbers to render on top of each other.
          display: (ctx) => (ctx.dataset.data[ctx.dataIndex] > labelThreshold ? "auto" : false),
          font: { size: 10 },
        },
      },
    },
  });

  renderChartCaption(segments, labels, rows, !!byYearPF);
}

let planLineChartInstance = null;

// Full-range line chart (year 0 to the plan's own last policy year) showing
// how Total SV grows over time — the bar chart above only shows 3 chosen
// snapshot years, this fills in the trajectory between them. Same
// dashed-segment/hollow-point treatment for interpolated (isEstimated)
// years as the comparison line chart, plus an optional "Bank Rate" overlay
// (see calculateBankLine in calculator.js) when the advisor has entered a
// bank savings rate to compare against.
function renderPlanLineChart(results, pfResults) {
  const plan = getCurrentPlan();
  const rows = pfResults || results;
  const maxYear = Math.max(...rows.map((r) => r.year));

  const planPoints = rows.map((r) => ({ x: r.year, y: r.totalSV, isEstimated: r.isEstimated }));
  const datasets = [
    {
      label: `${plan.company} ${plan.name}`,
      data: planPoints,
      borderColor: "#e08a72",
      backgroundColor: "#e08a72",
      borderWidth: 2.5,
      pointRadius: (ctx) => (ctx.raw && ctx.raw.isEstimated ? 2 : 3),
      pointHoverRadius: 5,
      pointBackgroundColor: (ctx) => (ctx.raw && ctx.raw.isEstimated ? "#ffffff" : "#e08a72"),
      pointBorderColor: "#e08a72",
      segment: { borderDash: (ctx) => (ctx.p0.raw.isEstimated || ctx.p1.raw.isEstimated ? [5, 4] : undefined) },
      tension: 0.15,
      fill: false,
      datalabels: {
        color: "#e08a72",
        display: (ctx) => (ctx.dataIndex === ctx.dataset.data.length - 1 ? "auto" : false),
        formatter: (value) => (value.isEstimated ? `${formatMoney(value.y)}*` : formatMoney(value.y)),
        align: "right",
        anchor: "end",
        font: { size: 10, weight: "600" },
      },
    },
  ];

  if (state.bankRatePercent !== null) {
    const netPremiumPerYear = applyDiscounts(state.grossPremium, state.paymentSpan, plan, state.discountOverridePercents);
    const years = rows.map((r) => r.year);
    const bankValues = calculateBankLine(netPremiumPerYear, state.paymentSpan, state.bankRatePercent / 100, years);
    datasets.push({
      label: t("bankRateLegend", state.bankRatePercent),
      data: years.map((y) => ({ x: y, y: bankValues[y] })),
      borderColor: "#8a8578",
      backgroundColor: "#8a8578",
      borderWidth: 2,
      borderDash: [3, 3],
      pointRadius: 0,
      pointHoverRadius: 4,
      tension: 0,
      fill: false,
      datalabels: { display: false },
    });
  }

  if (planLineChartInstance) planLineChartInstance.destroy();
  const container = document.querySelector("#results-line-chart").closest(".chart-container");
  container.hidden = false;
  void container.offsetWidth; // forces synchronous reflow — see renderChart()'s comment on the same pattern
  const ctx = document.getElementById("results-line-chart").getContext("2d");
  planLineChartInstance = new Chart(ctx, {
    type: "line",
    data: { datasets },
    plugins: [ChartDataLabels, chartWhiteBackgroundPlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 24, right: 64 } },
      scales: {
        x: {
          type: "linear",
          min: 0,
          max: maxYear,
          ticks: { precision: 0 },
          title: { display: true, text: t("chartAxisYear") },
        },
        y: (() => {
          const maxVal = Math.max(...datasets.flatMap((d) => d.data.map((p) => p.y)));
          const { divisor, unitKey } = pickValueScale(maxVal);
          return {
            ticks: { callback: scaledTickCallback(divisor) },
            title: { display: true, text: scaledAxisTitle(plan.currency, unitKey) },
          };
        })(),
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) =>
              `${ctx.dataset.label}: ${formatMoney(ctx.parsed.y)}${ctx.raw && ctx.raw.isEstimated ? ` (${t("estimatedTag")})` : ""}`,
          },
        },
        datalabels: {},
      },
    },
  });
}

// Matches PortfoPlus's own definition: 回報% = 回報 ÷ 本金 (return as a % of
// the client's own cash principal — self-pay amount if PF is on, full net
// premium otherwise), paired with the annualized return (年化收益 = IRR).
function renderChartCaption(segments, labels, rows, hasPF) {
  const list = document.getElementById("chart-caption");
  list.innerHTML = "";
  segments.forEach((seg, i) => {
    const total = seg.principal + seg.loan + seg.discount + seg.interest + seg.returnAboveCost;
    const pct = seg.principal > 0 ? (seg.returnAboveCost / seg.principal) * 100 : 0;
    const pctClass = pct >= 0 ? "positive" : "negative";
    const row = rows[i];
    const irr = row ? (hasPF ? row.irrWithPFPercent : row.irrPercent) : null;

    const li = document.createElement("li");
    li.innerHTML = `
      <div class="caption-top"><span>${labels[i]}</span><span>${formatMoney(total)} ${t("captionTotal")}</span></div>
      <div class="caption-bottom">
        <span class="caption-pct ${pctClass}">${pct >= 0 ? "+" : ""}${pct.toFixed(1)}% ${t("captionReturnOnPrincipal")}</span>
        <span class="caption-irr">${irr === null || irr === undefined ? "" : `${t("captionAnnualized")}: ${formatPercent(irr)}`}</span>
      </div>
    `;
    list.appendChild(li);
  });
}

// --- Multi-plan comparison ---
// Deliberately snapshot-based: "Add to Comparison" captures the CURRENT
// calculate() result (whatever premium/discount/PF settings produced it)
// into state.comparisonSlots, rather than re-deriving live from state —
// this lets you compare e.g. plan A at $500k against plan B at $1M side by
// side if that's genuinely what's being discussed, and means changing the
// single-plan inputs afterward doesn't retroactively change an
// already-added comparison row.
let comparisonChartInstance = null;
let comparisonBarChartInstance = null;

function addToComparison() {
  if (!lastResults) return;
  const note = document.getElementById("comparison-add-note");

  const alreadyAdded = state.comparisonSlots.some(
    (s) => s.planId === state.selectedPlanId && s.span === state.paymentSpan
  );
  if (alreadyAdded) {
    note.textContent = t("comparisonDuplicateNote");
    note.hidden = false;
    return;
  }
  note.hidden = true;

  const plan = getCurrentPlan();
  const rows = lastPFResults || lastResults;
  const netPremium = totalNetPremium(state.grossPremium, state.paymentSpan, plan, state.discountOverridePercents);
  const netPerYear = applyDiscounts(state.grossPremium, state.paymentSpan, plan, state.discountOverridePercents);

  const years = rows.map((r) => r.year).sort((a, b) => a - b);
  const resultsByYear = {};
  for (const row of rows) {
    resultsByYear[row.year] = {
      totalSV: row.totalSV,
      irrPercent: lastPFResults ? row.irrWithPFPercent : row.irrPercent,
      isEstimated: row.isEstimated,
    };
  }

  // Breakeven = first year Total SV catches up to cumulative premium ACTUALLY
  // paid by that year (not the full span total if exiting before fully paid
  // — mirrors the same paidThrough logic calculatePlan() uses for IRR).
  let breakEvenYear = null;
  for (const year of years) {
    const paidThrough = Math.min(state.paymentSpan, year);
    let paid = 0;
    for (let i = 0; i < paidThrough; i++) paid += netPerYear[i];
    if (resultsByYear[year].totalSV >= paid) {
      breakEvenYear = year;
      break;
    }
  }

  const slot = {
    id: Date.now(),
    planId: state.selectedPlanId,
    planName: plan.name,
    company: plan.company,
    span: state.paymentSpan,
    grossPremium: state.grossPremium,
    netPremium,
    netPremiumPerYear: netPerYear,
    resultsByYear,
    availableYears: years,
    breakEvenYear,
    hasPF: !!lastPFResults,
  };

  state.comparisonSlots.push(slot);
  if (state.comparisonSlots.length > 3) state.comparisonSlots.shift(); // FIFO cap at 3
  document.getElementById("comparison-card").hidden = false;
  populateComparisonYears();
  renderComparisonTable();
  renderComparisonBarChart();
  renderComparisonChart();
}

function removeComparisonSlot(id) {
  state.comparisonSlots = state.comparisonSlots.filter((s) => s.id !== id);
  if (state.comparisonSlots.length === 0) {
    document.getElementById("comparison-card").hidden = true;
    return;
  }
  populateComparisonYears();
  renderComparisonTable();
  renderComparisonBarChart();
  renderComparisonChart();
}

// The comparison years are 3 explicit, advisor-typed policy years (like the
// single-plan chart's Year A/B/C) rather than a From/To range — a typed
// range could span dozens of disclosed years across different plans, which
// made both the bar/line charts and the exported PDF table unreadably wide.
// Returns them sorted ascending, deduped, empty entries dropped.
function readComparisonYears() {
  const raw = ["comparison-year-1", "comparison-year-2", "comparison-year-3"]
    .map((id) => document.getElementById(id).value)
    .filter((v) => v !== "")
    .map(Number);
  return [...new Set(raw)].sort((a, b) => a - b);
}

// Only fills in defaults the first time (fields still empty) — once the
// advisor has typed years, later Add/Remove doesn't clobber them. Picks the
// first, middle, and last year from the union of every added slot's own
// disclosed years, so the defaults are always real data points somewhere.
function populateComparisonYears() {
  const allYears = new Set();
  state.comparisonSlots.forEach((s) => s.availableYears.forEach((y) => allYears.add(y)));
  const years = [...allYears].sort((a, b) => a - b);
  if (years.length === 0) return;
  const ids = ["comparison-year-1", "comparison-year-2", "comparison-year-3"];
  const defaults = [years[0], years[Math.floor((years.length - 1) / 2)], years[years.length - 1]];
  ids.forEach((id, i) => {
    const input = document.getElementById(id);
    if (!input.value) input.value = defaults[i];
  });
}

// Deliberately minimal — just the plan name and a Remove button. The actual
// year-by-year numbers live in the chart (which has room to show the whole
// typed range without needing to scroll) and the plain-language delta note
// below it; a wide per-year table here just made "Remove" hard to reach.
function renderComparisonTable() {
  const thead = document.querySelector("#comparison-table thead");
  const tbody = document.querySelector("#comparison-table tbody");

  thead.innerHTML = `
    <tr>
      <th>${t("colPlan")}</th>
      <th></th>
    </tr>
  `;

  tbody.innerHTML = "";
  for (const slot of state.comparisonSlots) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${slot.company} — ${slot.planName}${slot.hasPF ? " (PF)" : ""}</td>
      <td><button class="comparison-remove-btn" type="button" data-id="${slot.id}">${t("comparisonRemoveBtn")}</button></td>
    `;
    tbody.appendChild(tr);
  }

  tbody.querySelectorAll(".comparison-remove-btn").forEach((btn) => {
    btn.addEventListener("click", () => removeComparisonSlot(Number(btn.dataset.id)));
  });
}

// Primary comparison output: a grouped bar chart at exactly the 3 typed
// policy years (same idea as the single-plan chart's Year A/B/C picker) —
// easier to read bar-to-bar at a handful of specific years than a dense
// multi-year table, which is what made both the on-screen table and the
// exported PDF unreadably wide before. If a slot doesn't disclose one of
// the 3 chosen years exactly, it just has no bar in that group (see
// comparisonChartNote below) rather than an approximated one.
function renderComparisonBarChart() {
  const years = readComparisonYears();
  const labels = years.map(String);
  const colors = ["#e08a72", "#8aa8c2", "#8fbfa8"];

  // Interpolated (isEstimated) years render as a lighter/hatched bar and get
  // an asterisk in the datalabel — visually distinct from real, sourced
  // years at a glance, per the "never present an estimate as if it were a
  // proposal figure" rule (see expandReturnTableWithEstimates in calculator.js).
  const datasets = state.comparisonSlots.map((slot, i) => ({
    label: `${slot.company} ${slot.planName}`,
    data: years.map((y) => (slot.resultsByYear[y] ? slot.resultsByYear[y].totalSV : null)),
    backgroundColor: years.map((y) =>
      slot.resultsByYear[y] && slot.resultsByYear[y].isEstimated ? `${colors[i % colors.length]}66` : colors[i % colors.length]
    ),
    borderRadius: 4,
    datalabels: {
      color: colors[i % colors.length],
      formatter: (value, ctx) => {
        if (value === null) return "";
        const y = years[ctx.dataIndex];
        const estimated = slot.resultsByYear[y] && slot.resultsByYear[y].isEstimated;
        return estimated ? `${formatMoney(value)}*` : formatMoney(value);
      },
      anchor: "end",
      align: "end",
      // "auto" hides whichever label would otherwise overlap a neighbor —
      // adjacent bars with close values were rendering numbers on top of
      // each other.
      display: (ctx) => (ctx.dataset.data[ctx.dataIndex] === null ? false : "auto"),
      font: { size: 10, weight: "600" },
    },
  }));

  if (comparisonBarChartInstance) comparisonBarChartInstance.destroy();
  const card = document.getElementById("comparison-card");
  card.hidden = false;
  void card.offsetWidth; // forces synchronous reflow — see renderChart()'s comment on the same pattern
  const ctx = document.getElementById("comparison-bar-chart").getContext("2d");
  comparisonBarChartInstance = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets },
    plugins: [ChartDataLabels, chartWhiteBackgroundPlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 24 } },
      scales: {
        x: { title: { display: true, text: t("chartAxisYear") } },
        y: (() => {
          const maxVal = Math.max(...datasets.flatMap((d) => d.data.filter((v) => v !== null)));
          const { divisor, unitKey } = pickValueScale(maxVal);
          return {
            ticks: { callback: scaledTickCallback(divisor) },
            title: { display: true, text: scaledAxisTitle(PLANS[state.comparisonSlots[0].planId].currency, unitKey) },
          };
        })(),
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) => {
              if (ctx.parsed.y === null) return `${ctx.dataset.label}: —`;
              const y = years[ctx.dataIndex];
              const slot = state.comparisonSlots[ctx.datasetIndex];
              const estimated = slot.resultsByYear[y] && slot.resultsByYear[y].isEstimated;
              return `${ctx.dataset.label}: ${formatMoney(ctx.parsed.y)}${estimated ? ` (${t("estimatedTag")})` : ""}`;
            },
          },
        },
        datalabels: {},
      },
    },
  });
}

// Supplementary line chart below the bar chart, covering the full range
// from year 0 to the largest of the 3 typed years (not just those 3 points)
// so the overall growth trajectory is still visible. Each line only plots
// the policy years THAT SPECIFIC PLAN actually discloses (its own
// returnTable years) — not a shared/union set of years filled in via
// approximation. A milestone-only proposal's line will visibly stop at its
// last disclosed year (e.g. AXA at year 30) rather than continuing flat
// forever, and won't show a point in the middle of a gap between milestones
// either. Uses a linear x-axis (not category) specifically so each dataset
// can carry its own real {x: year, y: value} points independent of others.
function renderComparisonChart() {
  const years = readComparisonYears();
  const maxYear = years.length ? Math.max(...years) : 1;
  const colors = ["#e08a72", "#8aa8c2", "#8fbfa8"];

  // Gap years between an insurer's disclosed milestones are now filled with
  // a linear-interpolated estimate (see expandReturnTableWithEstimates in
  // calculator.js) rather than left empty — but the line must still show
  // which stretches are real vs. estimated: dashed for any segment touching
  // an estimated point, solid otherwise, plus smaller/hollow points on
  // estimated years so they don't read as equally confident data.
  const slotPoints = state.comparisonSlots.map((slot) =>
    slot.availableYears.filter((y) => y <= maxYear).map((y) => ({ x: y, y: slot.resultsByYear[y].totalSV, isEstimated: slot.resultsByYear[y].isEstimated }))
  );
  // When two lines end at close values, the end-of-line labels overlap.
  // Rather than hiding one (losing a real number), nudge the labels'
  // placement angle apart — one tilts up-right, the other down-right —
  // so both stay visible and readable. Only kicks in when the end values
  // are genuinely close (within 4% of the chart's overall value range).
  const lastValues = slotPoints.map((pts) => (pts.length ? pts[pts.length - 1].y : 0));
  const allValues = slotPoints.flat().map((p) => p.y);
  const valueRange = allValues.length ? Math.max(...allValues) - Math.min(...allValues) || 1 : 1;
  const labelAligns = lastValues.map(() => "right");
  for (let i = 0; i < lastValues.length; i++) {
    for (let j = i + 1; j < lastValues.length; j++) {
      if (Math.abs(lastValues[i] - lastValues[j]) / valueRange < 0.04) {
        labelAligns[i] = 60;
        labelAligns[j] = 120;
      }
    }
  }

  const datasets = state.comparisonSlots.map((slot, i) => {
    const points = slotPoints[i];
    return {
      label: `${slot.company} ${slot.planName}`,
      data: points,
      borderColor: colors[i % colors.length],
      backgroundColor: colors[i % colors.length],
      borderWidth: 2.5,
      pointRadius: (ctx) => (ctx.raw && ctx.raw.isEstimated ? 2 : 3),
      pointHoverRadius: 5,
      pointBackgroundColor: (ctx) => (ctx.raw && ctx.raw.isEstimated ? "#ffffff" : colors[i % colors.length]),
      pointBorderColor: colors[i % colors.length],
      segment: {
        borderDash: (ctx) => (ctx.p0.raw.isEstimated || ctx.p1.raw.isEstimated ? [5, 4] : undefined),
      },
      tension: 0.15,
      fill: false,
      datalabels: {
        color: colors[i % colors.length],
        display: (ctx) => ctx.dataIndex === ctx.dataset.data.length - 1,
        formatter: (value) => (value.isEstimated ? `${formatMoney(value.y)}*` : formatMoney(value.y)),
        align: labelAligns[i],
        anchor: "end",
        font: { size: 10, weight: "600" },
      },
    };
  });

  // A single "Bank Rate" reference line (not one per slot — with similar
  // premiums across slots, per-slot lines were nearly identical and just
  // read as a rendering glitch rather than useful detail). Based on the
  // first added slot's premium/span schedule; the legend label says which
  // plan that is so it's never misread as applying equally to every plan
  // if premiums actually differ.
  if (state.bankRatePercent !== null && state.comparisonSlots.length > 0) {
    const baseSlot = state.comparisonSlots[0];
    const baseYears = baseSlot.availableYears.filter((y) => y <= maxYear);
    const bankValues = calculateBankLine(baseSlot.netPremiumPerYear, baseSlot.span, state.bankRatePercent / 100, baseYears);
    datasets.push({
      label: t("bankRateLegendFor", state.bankRatePercent, baseSlot.planName),
      data: baseYears.map((y) => ({ x: y, y: bankValues[y] })),
      borderColor: "#8a8578",
      backgroundColor: "#8a8578",
      borderWidth: 1.5,
      borderDash: [3, 3],
      pointRadius: 0,
      pointHoverRadius: 4,
      tension: 0,
      fill: false,
      datalabels: { display: false },
    });
  }

  if (comparisonChartInstance) comparisonChartInstance.destroy();
  const card = document.getElementById("comparison-card");
  card.hidden = false;
  void card.offsetWidth; // forces synchronous reflow — see renderChart()'s comment on the same pattern
  const ctx = document.getElementById("comparison-chart").getContext("2d");
  comparisonChartInstance = new Chart(ctx, {
    type: "line",
    data: { datasets },
    plugins: [ChartDataLabels, chartWhiteBackgroundPlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 24, right: 64 } },
      scales: {
        x: {
          type: "linear",
          min: 0,
          max: maxYear,
          ticks: { precision: 0 },
          title: { display: true, text: t("chartAxisYear") },
        },
        y: (() => {
          const maxVal = Math.max(...datasets.flatMap((d) => d.data.map((p) => p.y)));
          const { divisor, unitKey } = pickValueScale(maxVal);
          return {
            ticks: { callback: scaledTickCallback(divisor) },
            title: { display: true, text: scaledAxisTitle(PLANS[state.comparisonSlots[0].planId].currency, unitKey) },
          };
        })(),
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) =>
              `${ctx.dataset.label}: ${formatMoney(ctx.parsed.y)}${ctx.raw && ctx.raw.isEstimated ? ` (${t("estimatedTag")})` : ""}`,
          },
        },
        datalabels: {},
      },
    },
  });
}

function calculate() {
  const premiumInput = document.getElementById("premium");
  const spanSelect = document.getElementById("span");
  const planSelect = document.getElementById("plan");
  const pfEnabledInput = document.getElementById("pf-enabled");
  const pfModeSelect = document.getElementById("pf-mode");
  const pfLtvInput = document.getElementById("pf-ltv");
  const pfRateInput = document.getElementById("pf-rate");
  const pfStressInput = document.getElementById("pf-stress-rate");
  const bankRateInput = document.getElementById("bank-rate");

  state.grossPremium = Number(premiumInput.value) || 0;
  state.paymentSpan = Number(spanSelect.value);
  state.selectedPlanId = planSelect.value;
  state.pfEnabled = pfEnabledInput.checked;
  state.pfMode = pfModeSelect.value || null;
  state.pfLtvPercent = pfLtvInput.value ? Number(pfLtvInput.value) : null;
  state.pfLoanRatePercent = Number(pfRateInput.value) || 0;
  state.pfStressRatePercent = pfStressInput.value ? Number(pfStressInput.value) : null;
  state.bankRatePercent = bankRateInput.value ? Number(bankRateInput.value) : null;
  state.discountOverridePercents = readDiscountOverridePercents();
  saveState();

  const plan = getCurrentPlan();
  const results = calculatePlan(plan, state.grossPremium, state.paymentSpan, state.discountOverridePercents);

  let pfResults = null;
  let stressResults = null;
  if (state.pfEnabled && plan.pf) {
    const netPremium = totalNetPremium(state.grossPremium, state.paymentSpan, plan, state.discountOverridePercents);
    const ltvOverride = state.pfLtvPercent !== null ? state.pfLtvPercent / 100 : undefined;
    pfResults = calculatePF(
      plan, results, state.grossPremium, netPremium, state.pfMode,
      state.pfLoanRatePercent / 100, ltvOverride
    );
    if (state.pfStressRatePercent !== null) {
      stressResults = stressTest(
        plan, results, state.grossPremium, netPremium, state.pfMode,
        state.pfStressRatePercent / 100, ltvOverride
      );
    }
  }

  lastResults = results;
  lastPFResults = pfResults;

  if (state.pfEnabled && plan.pf) {
    savePfRecentCurrent();
    renderPfRecentRow();
  }

  renderResultsTable(results, pfResults);
  renderSummary(pfResults);
  renderStressTable(pfResults, stressResults);
  populateChartYearSelects();
  renderChart(results, pfResults);
  renderPlanLineChart(results, pfResults);
  document.getElementById("export-card").hidden = false;
  collapsePlanForm();
}

function syncPFVisibility() {
  const enabled = document.getElementById("pf-enabled").checked;
  document.getElementById("pf-inputs").hidden = !enabled;
}

// --- PF "recent input": auto-captures the last LTV/rate/stress-rate/discount
// combo used for this plan/span whenever Calculate runs with PF on, so the
// advisor can quickly revert to it after tweaking values — no manual
// save/load/delete step needed. Scoped per (plan, span), one entry each,
// always overwritten by the most recent calculation.
function pfPresetKey() {
  return `${state.selectedPlanId}::${state.paymentSpan}`;
}

function loadAllPfRecent() {
  try {
    return JSON.parse(localStorage.getItem(PF_RECENT_STORAGE_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function savePfRecentCurrent() {
  const all = loadAllPfRecent();
  all[pfPresetKey()] = {
    ltv: document.getElementById("pf-ltv").value,
    rate: document.getElementById("pf-rate").value,
    stressRate: document.getElementById("pf-stress-rate").value,
    discountPercents: readDiscountOverridePercents().map((r) => r * 100),
  };
  localStorage.setItem(PF_RECENT_STORAGE_KEY, JSON.stringify(all));
}

function renderPfRecentRow() {
  const row = document.getElementById("pf-recent-row");
  const recent = loadAllPfRecent()[pfPresetKey()];
  if (!recent) {
    row.hidden = true;
    return;
  }
  const parts = [];
  if (recent.ltv) parts.push(`${t("pfRecentLtvTag")} ${Number(recent.ltv).toFixed(1)}%`);
  if (recent.rate) parts.push(`${t("pfRecentRateTag")} ${Number(recent.rate).toFixed(2)}%`);
  if (recent.stressRate) parts.push(`${t("pfRecentStressTag")} ${Number(recent.stressRate).toFixed(1)}%`);
  document.getElementById("pf-recent-summary").textContent = parts.join(" · ");
  row.hidden = false;
}

function usePfRecent() {
  const recent = loadAllPfRecent()[pfPresetKey()];
  if (!recent) return;

  document.getElementById("pf-ltv").value = recent.ltv;
  document.getElementById("pf-rate").value = recent.rate;
  document.getElementById("pf-stress-rate").value = recent.stressRate || "";
  state.pfLtvPercent = recent.ltv ? Number(recent.ltv) : null;
  state.pfStressRatePercent = recent.stressRate ? Number(recent.stressRate) : null;

  const inputs = document.querySelectorAll(".discount-override-input");
  (recent.discountPercents || []).forEach((pct, i) => {
    if (inputs[i]) inputs[i].value = pct.toFixed(2);
  });

  if (lastResults) calculate();
}

function loadAdvisorInfo() {
  try {
    const saved = JSON.parse(localStorage.getItem(ADVISOR_STORAGE_KEY));
    if (!saved) return;
    document.getElementById("advisor-name").value = saved.name || "";
    document.getElementById("advisor-phone").value = saved.phone || "";
    document.getElementById("advisor-email").value = saved.email || "";
  } catch (e) {
    // ignore corrupt/missing localStorage data
  }
}

function saveAdvisorInfo() {
  localStorage.setItem(ADVISOR_STORAGE_KEY, JSON.stringify({
    name: document.getElementById("advisor-name").value,
    phone: document.getElementById("advisor-phone").value,
    email: document.getElementById("advisor-email").value,
  }));
}

function init() {
  loadState();
  applyTranslations();
  populateCompanySelect();
  populatePlanSelect();
  populateSpanSelect();
  populatePFModeSelect();
  populateDiscountOverrideInputs();
  renderPfRecentRow();
  loadAdvisorInfo();

  document.getElementById("premium").value = state.grossPremium;
  document.getElementById("pf-enabled").checked = state.pfEnabled;
  document.getElementById("pf-rate").value = state.pfLoanRatePercent;
  if (state.pfLtvPercent !== null) document.getElementById("pf-ltv").value = state.pfLtvPercent;
  if (state.pfStressRatePercent !== null) document.getElementById("pf-stress-rate").value = state.pfStressRatePercent;
  if (state.bankRatePercent !== null) document.getElementById("bank-rate").value = state.bankRatePercent;
  syncPFVisibility();
  initStepNav();
  document.getElementById("plan-summary-edit-btn").addEventListener("click", expandPlanForm);

  document.getElementById("lang-en").addEventListener("click", () => switchLang("en"));
  document.getElementById("lang-zh").addEventListener("click", () => switchLang("zh"));

  document.getElementById("company").addEventListener("change", (e) => {
    state.selectedCompany = e.target.value;
    populatePlanSelect();
    populateSpanSelect();
    populatePFModeSelect();
    state.discountOverridePercents = null;
    populateDiscountOverrideInputs();
    renderPfRecentRow();
  });

  document.getElementById("plan").addEventListener("change", (e) => {
    state.selectedPlanId = e.target.value;
    updatePlanStatus();
    populateSpanSelect();
    populatePFModeSelect();
    state.discountOverridePercents = null;
    populateDiscountOverrideInputs();
    renderPfRecentRow();
  });

  // Span is now a real input independent of plan selection — changing it
  // can change which PF modes/terms are available (they're span-specific),
  // so it needs the same follow-up as switching plans.
  document.getElementById("span").addEventListener("change", (e) => {
    state.paymentSpan = Number(e.target.value);
    populatePFModeSelect();
    state.discountOverridePercents = null;
    populateDiscountOverrideInputs();
    renderPfRecentRow();
  });

  document.getElementById("premium").addEventListener("input", updateDefaultLTV);
  document.getElementById("pf-mode").addEventListener("change", (e) => {
    state.pfMode = e.target.value;
    state.pfLtvPercent = null; // reset to mode default
    updateDefaultLTV();
  });
  document.getElementById("pf-enabled").addEventListener("change", syncPFVisibility);

  document.getElementById("pf-recent-use").addEventListener("click", usePfRecent);

  ["chart-year-1", "chart-year-2", "chart-year-3"].forEach((id) => {
    document.getElementById(id).addEventListener("change", () => {
      if (lastResults) renderChart(lastResults, lastPFResults);
    });
  });

  ["advisor-name", "advisor-phone", "advisor-email"].forEach((id) => {
    document.getElementById(id).addEventListener("input", saveAdvisorInfo);
  });

  document.getElementById("calculate-btn").addEventListener("click", calculate);
  document.getElementById("export-pdf-btn").addEventListener("click", exportPDF);
  document.getElementById("add-to-comparison-btn").addEventListener("click", addToComparison);
  document.getElementById("export-comparison-pdf-btn").addEventListener("click", exportComparisonPDF);

  ["comparison-year-1", "comparison-year-2", "comparison-year-3"].forEach((id) => {
    document.getElementById(id).addEventListener("input", () => {
      if (state.comparisonSlots.length > 0) {
        renderComparisonTable();
        renderComparisonBarChart();
        renderComparisonChart();
      }
    });
  });

  document.getElementById("bank-rate").addEventListener("input", (e) => {
    state.bankRatePercent = e.target.value ? Number(e.target.value) : null;
    saveState();
    if (lastResults) renderPlanLineChart(lastResults, lastPFResults);
    if (state.comparisonSlots.length > 0) renderComparisonChart();
  });
}

document.addEventListener("DOMContentLoaded", init);
