// pdf.js — Phase 6: client-facing PDF export.
// Reads the same globals app.js/plans.js/i18n.js/calculator.js already
// expose (state, lastResults, lastPFResults, chartInstance, PLANS, t(),
// formatMoney, formatPercent, getCurrentPlan) — no module system in this
// project, so plain script-tag globals are the established pattern.
//
// The header/inputs/table/disclaimer are built as an offscreen HTML block
// and rasterized via html2canvas rather than drawn with jsPDF's native
// doc.text(). jsPDF's built-in fonts (Helvetica/Times/Courier) only cover
// WinAnsiEncoding (Latin-1) — any Chinese character (company/plan names,
// PF mode labels like 薪火抵押, disclaimers, or 中文-mode UI labels) drawn
// with doc.text() comes out as corrupted glyphs in the actual PDF, since
// no CJK font is embedded. html2canvas rasterizes through the browser's
// own font stack, which has full CJK coverage, so this is the simplest
// fix that doesn't require bundling a CJK font file.
//
// The chart image still goes through chartInstance.toBase64Image() (higher
// quality than screenshotting the canvas via html2canvas).

async function exportPDF() {
  if (!lastResults || !chartInstance) return;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const plan = PLANS[state.selectedPlanId];
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  let y = margin;

  const clientName = document.getElementById("client-name").value.trim();
  let advisor = {};
  try {
    advisor = JSON.parse(localStorage.getItem(ADVISOR_STORAGE_KEY)) || {};
  } catch (e) {
    // ignore corrupt/missing localStorage data
  }
  const dateStr = new Date().toLocaleDateString();

  // Per user: keep the client-facing PDF to just the plan/premium/span
  // basics + chart + disclaimer — no PF configuration detail line, and no
  // curated numbers table (the chart's own data labels already carry the
  // actual figures for the selected years, so the table was redundant).
  const advisorParts = [advisor.name, advisor.phone, advisor.email].filter(Boolean);

  const container = document.createElement("div");
  container.style.cssText =
    "position:absolute;left:-9999px;top:0;width:760px;padding:24px;background:#ffffff;" +
    "font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang HK','Microsoft YaHei',Roboto,sans-serif;color:#3d3a35;";
  container.innerHTML = `
    <h1 style="font-size:22px;margin:0 0 12px;">${escapeHtml(t("pdfTitle"))}</h1>
    <div style="font-size:13px;line-height:1.6;">
      <div>${escapeHtml(t("pdfDate"))}: ${escapeHtml(dateStr)}</div>
      ${clientName ? `<div>${escapeHtml(t("pdfClient"))}: ${escapeHtml(clientName)}</div>` : ""}
      ${advisorParts.length ? `<div>${escapeHtml(t("pdfAdvisor"))}: ${escapeHtml(advisorParts.join(" / "))}</div>` : ""}
    </div>
    <h2 style="font-size:16px;margin:16px 0 8px;">${escapeHtml(plan.company)} — ${escapeHtml(plan.name)}</h2>
    <div style="font-size:13px;line-height:1.6;">
      <div>${escapeHtml(t("premiumLabel"))}: ${escapeHtml(formatMoney(state.grossPremium))}</div>
      <div>${escapeHtml(t("spanLabel"))}: ${escapeHtml(state.paymentSpan === 1 ? t("yearSingular") : t("yearsPlural", state.paymentSpan))}</div>
    </div>
    ${
      plan.disclaimer
        ? `<div style="font-size:9px;color:#b0aa9e;margin-top:16px;">
             <strong>${escapeHtml(t("pdfDisclaimerTitle"))}:</strong> ${escapeHtml(plan.disclaimer)}
           </div>`
        : ""
    }
  `;
  document.body.appendChild(container);

  let headerHeight;
  try {
    const headerCanvas = await html2canvas(container, { scale: 2, backgroundColor: "#ffffff" });
    const headerImgData = headerCanvas.toDataURL("image/jpeg", 0.92);
    const headerWidth = pageWidth - margin * 2;
    headerHeight = headerWidth * (headerCanvas.height / headerCanvas.width);
    doc.addImage(headerImgData, "JPEG", margin, y, headerWidth, headerHeight);
  } finally {
    document.body.removeChild(container);
  }
  y += headerHeight + 16;

  // --- Chart image (Chart.js's own export, sharper than a DOM screenshot) ---
  // Defensive resize: guards against the canvas still reporting 0x0 if this
  // is called in the same tick as the chart's first render (its container
  // was hidden at construction time — see renderChart()'s comment).
  chartInstance.resize();
  // JPEG, not PNG: jsPDF embeds PNGs without recompressing them, which
  // balloons the PDF to several MB for a chart-sized image (bad for
  // emailing/WhatsApp-ing to a client) — the identical chart as JPEG comes
  // out roughly 75x smaller with no visible quality loss on a flat-color bar chart.
  const imgData = chartInstance.toBase64Image("image/jpeg", 0.92);
  const imgWidth = pageWidth - margin * 2;
  const imgHeight = imgWidth * (chartInstance.height / chartInstance.width);
  doc.addImage(imgData, "JPEG", margin, y, imgWidth, imgHeight);

  const filenameBase = (clientName || plan.name).replace(/[^a-zA-Z0-9一-鿿]+/g, "_");
  doc.save(`${filenameBase}_${dateStr.replace(/\//g, "-")}.pdf`);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Evenly samples down to maxCount years, always keeping the first and last
// of the range so the printed table still spans the full picture even
// though it can't show every single year like the on-screen table can.
function sampleYearsForPdf(years, maxCount) {
  if (years.length <= maxCount) return years;
  const picked = [];
  for (let i = 0; i < maxCount; i++) {
    const idx = Math.round((i * (years.length - 1)) / (maxCount - 1));
    picked.push(years[idx]);
  }
  return [...new Set(picked)];
}

// Client-facing side-by-side comparison PDF — same CJK-safe html2canvas
// header technique as exportPDF(), plus the comparison chart and a wide
// table with one column-group per slot (rather than per-year, since the
// whole point of this export is comparing plans against each other, not
// showing one plan's own breakdown).
async function exportComparisonPDF() {
  if (!state.comparisonSlots || state.comparisonSlots.length === 0 || !comparisonChartInstance) return;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 32;
  let y = margin;

  const clientName = document.getElementById("client-name").value.trim();
  let advisor = {};
  try {
    advisor = JSON.parse(localStorage.getItem(ADVISOR_STORAGE_KEY)) || {};
  } catch (e) {
    // ignore corrupt/missing localStorage data
  }
  const dateStr = new Date().toLocaleDateString();
  const advisorParts = [advisor.name, advisor.phone, advisor.email].filter(Boolean);
  // The on-screen table can show a whole typed year range (could be dozens
  // of columns); a fixed-width printable PDF page can't, so cap it to an
  // evenly-sampled subset (always including the first and last year) —
  // the chart image below still shows the full range as a continuous line.
  const compYears = sampleYearsForPdf(getComparisonYears(), 6);

  const rowsHtml = state.comparisonSlots
    .map((slot) => {
      const yearCells = compYears
        .map((target) => {
          const y2 = nearestYearAtOrBelow(slot.availableYears, target);
          const r = slot.resultsByYear[y2];
          const approx = y2 !== target ? "~" : "";
          return `<td style="padding:5px 8px;border-bottom:1px solid #f0ece4;text-align:right;">${approx}${escapeHtml(formatMoney(r.totalSV))}</td>
                  <td style="padding:5px 8px;border-bottom:1px solid #f0ece4;text-align:right;">${approx}${escapeHtml(formatPercent(r.irrPercent))}</td>`;
        })
        .join("");
      return `<tr>
        <td style="padding:5px 8px;border-bottom:1px solid #f0ece4;">${escapeHtml(slot.company)} — ${escapeHtml(slot.planName)}${slot.hasPF ? " (PF)" : ""}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #f0ece4;">${slot.span === 1 ? escapeHtml(t("yearSingular")) : escapeHtml(t("yearsPlural", slot.span))}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #f0ece4;text-align:right;">${escapeHtml(formatMoney(slot.netPremium))}</td>
        ${yearCells}
        <td style="padding:5px 8px;border-bottom:1px solid #f0ece4;">${slot.breakEvenYear !== null ? escapeHtml(t("yearLabel", slot.breakEvenYear)) : escapeHtml(t("comparisonNoBreakeven"))}</td>
      </tr>`;
    })
    .join("");

  const yearHeaderCells = compYears
    .map((yr) => `<th colspan="2" style="text-align:center;padding:5px 8px;border-bottom:2px solid #3d3a35;">${escapeHtml(t("yearLabel", yr))}</th>`)
    .join("");
  const subHeaderCells = compYears
    .map(
      () =>
        `<th style="text-align:right;padding:0 8px 4px;font-weight:400;color:#b0aa9e;">${escapeHtml(t("colTotalSV"))}</th>
         <th style="text-align:right;padding:0 8px 4px;font-weight:400;color:#b0aa9e;">${escapeHtml(t("colIRR"))}</th>`
    )
    .join("");

  const disclaimers = [...new Set(state.comparisonSlots.map((s) => PLANS[s.planId].disclaimer).filter(Boolean))];

  const container = document.createElement("div");
  container.style.cssText =
    "position:absolute;left:-9999px;top:0;width:1120px;padding:24px;background:#ffffff;" +
    "font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang HK','Microsoft YaHei',Roboto,sans-serif;color:#3d3a35;";
  container.innerHTML = `
    <h1 style="font-size:22px;margin:0 0 12px;">${escapeHtml(t("comparisonCardTitle"))}</h1>
    <div style="font-size:13px;line-height:1.6;">
      <div>${escapeHtml(t("pdfDate"))}: ${escapeHtml(dateStr)}</div>
      ${clientName ? `<div>${escapeHtml(t("pdfClient"))}: ${escapeHtml(clientName)}</div>` : ""}
      ${advisorParts.length ? `<div>${escapeHtml(t("pdfAdvisor"))}: ${escapeHtml(advisorParts.join(" / "))}</div>` : ""}
    </div>
    <table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:12px;">
      <thead>
        <tr>
          <th rowspan="2" style="text-align:left;padding:5px 8px;border-bottom:2px solid #3d3a35;vertical-align:bottom;">${escapeHtml(t("colPlan"))}</th>
          <th rowspan="2" style="text-align:left;padding:5px 8px;border-bottom:2px solid #3d3a35;vertical-align:bottom;">${escapeHtml(t("spanLabel"))}</th>
          <th rowspan="2" style="text-align:right;padding:5px 8px;border-bottom:2px solid #3d3a35;vertical-align:bottom;">${escapeHtml(t("colNetPremium"))}</th>
          ${yearHeaderCells}
          <th rowspan="2" style="text-align:left;padding:5px 8px;border-bottom:2px solid #3d3a35;vertical-align:bottom;">${escapeHtml(t("colBreakeven"))}</th>
        </tr>
        <tr>${subHeaderCells}</tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    ${
      disclaimers.length
        ? `<div style="font-size:8px;color:#b0aa9e;margin-top:16px;">
             <strong>${escapeHtml(t("pdfDisclaimerTitle"))}:</strong> ${disclaimers.map(escapeHtml).join(" ")}
           </div>`
        : ""
    }
  `;
  document.body.appendChild(container);

  let headerHeight;
  try {
    const headerCanvas = await html2canvas(container, { scale: 2, backgroundColor: "#ffffff" });
    const headerImgData = headerCanvas.toDataURL("image/jpeg", 0.92);
    const headerWidth = pageWidth - margin * 2;
    headerHeight = headerWidth * (headerCanvas.height / headerCanvas.width);
    doc.addImage(headerImgData, "JPEG", margin, y, headerWidth, headerHeight);
  } finally {
    document.body.removeChild(container);
  }
  y += headerHeight + 16;

  comparisonChartInstance.resize();
  const imgData = comparisonChartInstance.toBase64Image("image/jpeg", 0.92);
  const imgWidth = pageWidth - margin * 2;
  const imgHeight = imgWidth * (comparisonChartInstance.height / comparisonChartInstance.width);
  doc.addImage(imgData, "JPEG", margin, y, imgWidth, imgHeight);

  const filenameBase = (clientName || "comparison").replace(/[^a-zA-Z0-9一-鿿]+/g, "_");
  doc.save(`${filenameBase}_comparison_${dateStr.replace(/\//g, "-")}.pdf`);
}
