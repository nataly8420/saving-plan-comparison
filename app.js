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
const PF_PRESET_STORAGE_KEY = "savingsAppPfPresets";

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
  comparisonSlots: [],
  comparisonYears: [null, null, null],
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
  // comparisonSlots/comparisonYears are deliberately session-only (see the
  // comment on state.comparisonSlots) — a stale slot snapshotting an old
  // plans.js shape could otherwise resurrect broken data on next load.
  const { comparisonSlots, comparisonYears, ...persisted } = state;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
}

function formatMoney(n) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatPercent(n) {
  return n === null || n === undefined ? "—" : n.toFixed(2) + "%";
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
  populatePfPresetSelect();
  if (lastResults) {
    renderResultsTable(lastResults, lastPFResults);
    renderSummary(lastPFResults);
    populateChartYearSelects();
    renderChart(lastResults, lastPFResults);
  }
  if (state.comparisonSlots.length > 0) {
    populateComparisonYearSelects();
    renderComparisonTable();
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
  for (const row of rows) {
    const tr = document.createElement("tr");
    let html = `
      <td>${row.year}</td>
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
  const years = Object.keys(plan.returnTable).map(Number).sort((a, b) => a - b);
  const defaults = plan.defaultCompareYears || years.slice(0, 3);

  ["chart-year-1", "chart-year-2", "chart-year-3"].forEach((id, i) => {
    const select = document.getElementById(id);
    select.innerHTML = "";
    for (const year of years) {
      const opt = document.createElement("option");
      opt.value = year;
      opt.textContent = t("yearLabel", year);
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

  const labels = [t("yearLabel", 0), ...chartYears.map((y) => t("yearLabel", y))];
  const rows = [null, ...chartYears.map((y) => (byYearPF ? byYearPF[y] : byYear[y]))];
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
      scales: {
        x: { stacked: true },
        y: { stacked: true, ticks: { callback: (v) => formatMoney(v) } },
      },
      plugins: {
        tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatMoney(ctx.parsed.y)}` } },
        datalabels: {
          formatter: (value) => (value > 0 ? formatMoney(value) : ""),
          display: (ctx) => ctx.dataset.data[ctx.dataIndex] > labelThreshold,
          font: { size: 10 },
        },
      },
    },
  });

  renderChartCaption(segments, labels, rows, !!byYearPF);
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

function addToComparison() {
  if (!lastResults) return;
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
    resultsByYear,
    availableYears: years,
    breakEvenYear,
    hasPF: !!lastPFResults,
  };

  state.comparisonSlots.push(slot);
  if (state.comparisonSlots.length > 3) state.comparisonSlots.shift(); // FIFO cap at 3
  document.getElementById("comparison-card").hidden = false;
  populateComparisonYearSelects();
  renderComparisonTable();
  renderComparisonChart();
}

function removeComparisonSlot(id) {
  state.comparisonSlots = state.comparisonSlots.filter((s) => s.id !== id);
  if (state.comparisonSlots.length === 0) {
    document.getElementById("comparison-card").hidden = true;
    return;
  }
  populateComparisonYearSelects();
  renderComparisonTable();
  renderComparisonChart();
}

// Different plans/spans rarely share the exact same set of policy years
// (some are sparse-milestone tables, some are dense 1-40/1-70) — this finds
// the closest year at-or-below a target so every slot can still be shown
// against a common set of comparison years, flagged with "~" when it's not
// an exact match rather than silently presenting an approximation as exact.
function nearestYearAtOrBelow(availableYears, target) {
  let best = null;
  for (const y of availableYears) {
    if (y <= target && (best === null || y > best)) best = y;
  }
  return best !== null ? best : availableYears[0];
}

function readComparisonYears() {
  return ["comparison-year-1", "comparison-year-2", "comparison-year-3"].map(
    (id) => Number(document.getElementById(id).value)
  );
}

function populateComparisonYearSelects() {
  const allYears = new Set();
  state.comparisonSlots.forEach((s) => s.availableYears.forEach((y) => allYears.add(y)));
  const years = [...allYears].sort((a, b) => a - b);
  const defaults =
    years.length >= 3
      ? [years[Math.floor(years.length * 0.25)], years[Math.floor(years.length * 0.5)], years[years.length - 1]]
      : years;

  ["comparison-year-1", "comparison-year-2", "comparison-year-3"].forEach((id, i) => {
    const select = document.getElementById(id);
    const prevValue = state.comparisonYears[i];
    select.innerHTML = "";
    for (const year of years) {
      const opt = document.createElement("option");
      opt.value = year;
      opt.textContent = t("yearLabel", year);
      select.appendChild(opt);
    }
    const chosen = prevValue && years.includes(prevValue) ? prevValue : defaults[i] || years[0];
    select.value = chosen;
    state.comparisonYears[i] = chosen;
  });
}

function renderComparisonTable() {
  const tbody = document.querySelector("#comparison-table tbody");
  tbody.innerHTML = "";
  const compYears = readComparisonYears();

  for (const slot of state.comparisonSlots) {
    const tr = document.createElement("tr");
    let html = `
      <td>${slot.company} — ${slot.planName}${slot.hasPF ? " (PF)" : ""}</td>
      <td>${slot.span === 1 ? t("yearSingular") : t("yearsPlural", slot.span)}</td>
      <td>${formatMoney(slot.netPremium)}</td>
    `;
    for (const target of compYears) {
      const y = nearestYearAtOrBelow(slot.availableYears, target);
      const r = slot.resultsByYear[y];
      const approx = y !== target ? "~" : "";
      html += `<td>${approx}${formatMoney(r.totalSV)}</td><td>${approx}${formatPercent(r.irrPercent)}</td>`;
    }
    html += `
      <td>${slot.breakEvenYear !== null ? t("yearLabel", slot.breakEvenYear) : t("comparisonNoBreakeven")}</td>
      <td><button class="comparison-remove-btn" type="button" data-id="${slot.id}">${t("comparisonRemoveBtn")}</button></td>
    `;
    tr.innerHTML = html;
    tbody.appendChild(tr);
  }

  tbody.querySelectorAll(".comparison-remove-btn").forEach((btn) => {
    btn.addEventListener("click", () => removeComparisonSlot(Number(btn.dataset.id)));
  });
}

function renderComparisonChart() {
  const compYears = readComparisonYears();
  const labels = compYears.map((y) => t("yearLabel", y));
  const colors = ["#e08a72", "#8aa8c2", "#8fbfa8"];

  const datasets = state.comparisonSlots.map((slot, i) => ({
    label: `${slot.company} ${slot.planName}`,
    data: compYears.map((target) => {
      const y = nearestYearAtOrBelow(slot.availableYears, target);
      return slot.resultsByYear[y].totalSV;
    }),
    backgroundColor: colors[i % colors.length],
    datalabels: { color: "#fff" },
  }));

  if (comparisonChartInstance) comparisonChartInstance.destroy();
  const card = document.getElementById("comparison-card");
  card.hidden = false;
  void card.offsetWidth; // forces synchronous reflow — see renderChart()'s comment on the same pattern
  const ctx = document.getElementById("comparison-chart").getContext("2d");
  comparisonChartInstance = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets },
    plugins: [ChartDataLabels, chartWhiteBackgroundPlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { ticks: { callback: (v) => formatMoney(v) } } },
      plugins: {
        tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatMoney(ctx.parsed.y)}` } },
        datalabels: {
          formatter: (value) => formatMoney(value),
          font: { size: 9 },
          anchor: "end",
          align: "top",
        },
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

  state.grossPremium = Number(premiumInput.value) || 0;
  state.paymentSpan = Number(spanSelect.value);
  state.selectedPlanId = planSelect.value;
  state.pfEnabled = pfEnabledInput.checked;
  state.pfMode = pfModeSelect.value || null;
  state.pfLtvPercent = pfLtvInput.value ? Number(pfLtvInput.value) : null;
  state.pfLoanRatePercent = Number(pfRateInput.value) || 0;
  state.pfStressRatePercent = pfStressInput.value ? Number(pfStressInput.value) : null;
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

  renderResultsTable(results, pfResults);
  renderSummary(pfResults);
  renderStressTable(pfResults, stressResults);
  populateChartYearSelects();
  renderChart(results, pfResults);
  document.getElementById("export-card").hidden = false;
  collapsePlanForm();
}

function syncPFVisibility() {
  const enabled = document.getElementById("pf-enabled").checked;
  document.getElementById("pf-inputs").hidden = !enabled;
}

// --- PF presets: named, saved bundles of {LTV%, loan rate%, discount%/yr}.
// Scoped per (plan, span) — presets for BOC 薪火傳承 2yr are irrelevant to
// BOC 薪火傳承 5yr, so they're kept separate. Only offered for plans that
// have PF enabled at all (pf-inputs section), since LTV/rate only mean
// anything there; discount-only plans don't need a named-preset system —
// their single set of values already round-trips via the normal
// save/loadState() localStorage persistence.
function pfPresetKey() {
  return `${state.selectedPlanId}::${state.paymentSpan}`;
}

function loadAllPfPresets() {
  try {
    return JSON.parse(localStorage.getItem(PF_PRESET_STORAGE_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function saveAllPfPresets(all) {
  localStorage.setItem(PF_PRESET_STORAGE_KEY, JSON.stringify(all));
}

function populatePfPresetSelect() {
  const select = document.getElementById("pf-preset-select");
  select.innerHTML = "";
  const presets = loadAllPfPresets()[pfPresetKey()] || {};
  const names = Object.keys(presets);
  if (names.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = t("pfPresetNoneOption");
    select.appendChild(opt);
    select.disabled = true;
    return;
  }
  select.disabled = false;
  for (const name of names) {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    select.appendChild(opt);
  }
}

function savePfPresetCurrent() {
  const nameInput = document.getElementById("pf-preset-name");
  const name = nameInput.value.trim();
  if (!name) return;
  const all = loadAllPfPresets();
  const key = pfPresetKey();
  all[key] = all[key] || {};
  all[key][name] = {
    ltv: document.getElementById("pf-ltv").value,
    rate: document.getElementById("pf-rate").value,
    discountPercents: readDiscountOverridePercents().map((r) => r * 100),
  };
  saveAllPfPresets(all);
  nameInput.value = "";
  populatePfPresetSelect();
  document.getElementById("pf-preset-select").value = name;
}

function loadPfPresetSelected() {
  const select = document.getElementById("pf-preset-select");
  const name = select.value;
  if (!name) return;
  const presets = loadAllPfPresets()[pfPresetKey()] || {};
  const preset = presets[name];
  if (!preset) return;

  document.getElementById("pf-ltv").value = preset.ltv;
  document.getElementById("pf-rate").value = preset.rate;
  state.pfLtvPercent = preset.ltv ? Number(preset.ltv) : null;

  const inputs = document.querySelectorAll(".discount-override-input");
  preset.discountPercents.forEach((pct, i) => {
    if (inputs[i]) inputs[i].value = pct.toFixed(2);
  });

  if (lastResults) calculate();
}

function deletePfPresetSelected() {
  const select = document.getElementById("pf-preset-select");
  const name = select.value;
  if (!name) return;
  const all = loadAllPfPresets();
  const key = pfPresetKey();
  if (all[key]) {
    delete all[key][name];
    if (Object.keys(all[key]).length === 0) delete all[key];
  }
  saveAllPfPresets(all);
  populatePfPresetSelect();
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
  populatePfPresetSelect();
  loadAdvisorInfo();

  document.getElementById("premium").value = state.grossPremium;
  document.getElementById("pf-enabled").checked = state.pfEnabled;
  document.getElementById("pf-rate").value = state.pfLoanRatePercent;
  if (state.pfLtvPercent !== null) document.getElementById("pf-ltv").value = state.pfLtvPercent;
  if (state.pfStressRatePercent !== null) document.getElementById("pf-stress-rate").value = state.pfStressRatePercent;
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
    populatePfPresetSelect();
  });

  document.getElementById("plan").addEventListener("change", (e) => {
    state.selectedPlanId = e.target.value;
    updatePlanStatus();
    populateSpanSelect();
    populatePFModeSelect();
    state.discountOverridePercents = null;
    populateDiscountOverrideInputs();
    populatePfPresetSelect();
  });

  // Span is now a real input independent of plan selection — changing it
  // can change which PF modes/terms are available (they're span-specific),
  // so it needs the same follow-up as switching plans.
  document.getElementById("span").addEventListener("change", (e) => {
    state.paymentSpan = Number(e.target.value);
    populatePFModeSelect();
    state.discountOverridePercents = null;
    populateDiscountOverrideInputs();
    populatePfPresetSelect();
  });

  document.getElementById("premium").addEventListener("input", updateDefaultLTV);
  document.getElementById("pf-mode").addEventListener("change", (e) => {
    state.pfMode = e.target.value;
    state.pfLtvPercent = null; // reset to mode default
    updateDefaultLTV();
  });
  document.getElementById("pf-enabled").addEventListener("change", syncPFVisibility);

  document.getElementById("pf-preset-save").addEventListener("click", savePfPresetCurrent);
  document.getElementById("pf-preset-load").addEventListener("click", loadPfPresetSelected);
  document.getElementById("pf-preset-delete").addEventListener("click", deletePfPresetSelected);

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
    document.getElementById(id).addEventListener("change", () => {
      if (state.comparisonSlots.length > 0) {
        renderComparisonTable();
        renderComparisonChart();
      }
    });
  });
}

document.addEventListener("DOMContentLoaded", init);
