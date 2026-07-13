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

// Chart.js sizes a canvas off its on-screen container's current CSS pixel
// dimensions. If someone exports a PDF from a narrow phone screen, the live
// chart itself renders cramped (axis titles clipped, legend/labels
// crowded) BEFORE it's ever captured — that cramped bitmap then gets baked
// permanently into the PDF, so even opening the PDF later on a full-size
// desktop shows the same squeeze. Forcing a fixed, generous size just for
// the capture (then restoring the real on-screen size right after) makes
// exported charts consistent regardless of what device triggered the
// export.
const CHART_CAPTURE_WIDTH = 900;
const CHART_CAPTURE_HEIGHT = 400;

async function captureChartFixedSize(chart, width, height) {
  const canvas = chart.canvas;
  const prevWidth = canvas.style.width;
  const prevHeight = canvas.style.height;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  chart.resize(width, height);
  // resize() alone only recalculates layout — it doesn't repaint the canvas
  // until the next animation frame, so capturing immediately after grabs a
  // stale (near-blank) bitmap. update("none") forces an immediate, non-
  // animated repaint at the new size before we capture it.
  chart.update("none");
  const imgData = chart.toBase64Image("image/jpeg", 0.92);
  canvas.style.width = prevWidth;
  canvas.style.height = prevHeight;
  chart.resize();
  chart.update("none");
  return imgData;
}

async function exportPDF() {
  if (!lastResults || !chartInstance || !planLineChartInstance) return;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const plan = PLANS[state.selectedPlanId];
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
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
  // Captured at a fixed size (see captureChartFixedSize) so it looks the
  // same in the PDF whether exported from a desktop or a narrow phone
  // screen — JPEG, not PNG: jsPDF embeds PNGs without recompressing them,
  // which balloons the PDF to several MB for a chart-sized image (bad for
  // emailing/WhatsApp-ing to a client) — the identical chart as JPEG comes
  // out roughly 75x smaller with no visible quality loss on a flat-color bar chart.
  const imgData = await captureChartFixedSize(chartInstance, CHART_CAPTURE_WIDTH, CHART_CAPTURE_HEIGHT);
  const imgWidth = pageWidth - margin * 2;
  const imgHeight = imgWidth * (CHART_CAPTURE_HEIGHT / CHART_CAPTURE_WIDTH);
  doc.addImage(imgData, "JPEG", margin, y, imgWidth, imgHeight);
  y += imgHeight + 16;

  // --- Line chart: full-range growth trajectory (0 to last policy year),
  // not just the 3 snapshot years the bar chart above shows — includes the
  // bank-rate reference line too, if the advisor entered one.
  if (y + 200 > pageHeight - margin) {
    doc.addPage();
    y = margin;
  }
  const lineImgData = await captureChartFixedSize(planLineChartInstance, CHART_CAPTURE_WIDTH, CHART_CAPTURE_HEIGHT);
  const lineImgWidth = pageWidth - margin * 2;
  const lineImgHeight = lineImgWidth * (CHART_CAPTURE_HEIGHT / CHART_CAPTURE_WIDTH);
  doc.addImage(lineImgData, "JPEG", margin, y, lineImgWidth, lineImgHeight);

  const filenameBase = (clientName || plan.name).replace(/[^a-zA-Z0-9一-鿿]+/g, "_");
  doc.save(`${filenameBase}_${dateStr.replace(/\//g, "-")}.pdf`);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Client-facing side-by-side comparison PDF — same CJK-safe html2canvas
// header technique as exportPDF(), plus both comparison charts (bar at the
// 3 typed years, then the supplementary full-range line chart). Per user
// request, this no longer includes a per-year numbers table — a per-plan
// name/premium/span block (mirroring the single-plan PDF's own layout)
// plus the two charts already carries every number that matters, and a
// wide table was the whole reason this export kept ballooning in length.
async function exportComparisonPDF() {
  if (!state.comparisonSlots || state.comparisonSlots.length === 0 || !comparisonChartInstance || !comparisonBarChartInstance) return;

  const { jsPDF } = window.jspdf;
  // Portrait, not landscape — landscape only made sense when this export
  // included a wide per-year table (removed per user request). A landscape
  // A4 page renders unusably cramped when opened on a phone (the common
  // case for this app — advisors previewing/sending on mobile), since the
  // page gets scaled down to fit a narrow portrait screen width.
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
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

  const planDetailsHtml = state.comparisonSlots
    .map(
      (slot) => `
    <div style="margin-top:14px;">
      <h2 style="font-size:16px;margin:0 0 6px;">${escapeHtml(slot.company)} — ${escapeHtml(slot.planName)}${slot.hasPF ? " (PF)" : ""}</h2>
      <div style="font-size:13px;line-height:1.6;">
        <div>${escapeHtml(t("premiumLabel"))}: ${escapeHtml(formatMoney(slot.grossPremium))}</div>
        <div>${escapeHtml(t("spanLabel"))}: ${escapeHtml(slot.span === 1 ? t("yearSingular") : t("yearsPlural", slot.span))}</div>
      </div>
    </div>`
    )
    .join("");

  const headerContainer = document.createElement("div");
  headerContainer.style.cssText =
    "position:absolute;left:-9999px;top:0;width:760px;padding:24px;background:#ffffff;" +
    "font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang HK','Microsoft YaHei',Roboto,sans-serif;color:#3d3a35;";
  headerContainer.innerHTML = `
    <h1 style="font-size:22px;margin:0 0 12px;">${escapeHtml(t("comparisonCardTitle"))}</h1>
    <div style="font-size:13px;line-height:1.6;">
      <div>${escapeHtml(t("pdfDate"))}: ${escapeHtml(dateStr)}</div>
      ${clientName ? `<div>${escapeHtml(t("pdfClient"))}: ${escapeHtml(clientName)}</div>` : ""}
      ${advisorParts.length ? `<div>${escapeHtml(t("pdfAdvisor"))}: ${escapeHtml(advisorParts.join(" / "))}</div>` : ""}
    </div>
    ${planDetailsHtml}
  `;
  document.body.appendChild(headerContainer);
  let headerHeight;
  try {
    const headerCanvas = await html2canvas(headerContainer, { scale: 2, backgroundColor: "#ffffff" });
    const headerImgData = headerCanvas.toDataURL("image/jpeg", 0.92);
    const headerWidth = pageWidth - margin * 2;
    headerHeight = headerWidth * (headerCanvas.height / headerCanvas.width);
    doc.addImage(headerImgData, "JPEG", margin, y, headerWidth, headerHeight);
  } finally {
    document.body.removeChild(headerContainer);
  }
  y += headerHeight + 16;

  // Bar chart — the primary comparison output, at exactly the 3 typed years
  // (same as the on-screen layout).
  if (y + 200 > pageHeight - margin) {
    doc.addPage();
    y = margin;
  }
  const barImgData = await captureChartFixedSize(comparisonBarChartInstance, CHART_CAPTURE_WIDTH, CHART_CAPTURE_HEIGHT);
  const barImgWidth = pageWidth - margin * 2;
  const barImgHeight = barImgWidth * (CHART_CAPTURE_HEIGHT / CHART_CAPTURE_WIDTH);
  doc.addImage(barImgData, "JPEG", margin, y, barImgWidth, barImgHeight);
  y += barImgHeight + 16;

  // Supplementary line chart below it, covering the full year-0-to-max range.
  if (y + 200 > pageHeight - margin) {
    doc.addPage();
    y = margin;
  }
  const lineImgData = await captureChartFixedSize(comparisonChartInstance, CHART_CAPTURE_WIDTH, CHART_CAPTURE_HEIGHT);
  const lineImgWidth = pageWidth - margin * 2;
  const lineImgHeight = lineImgWidth * (CHART_CAPTURE_HEIGHT / CHART_CAPTURE_WIDTH);
  doc.addImage(lineImgData, "JPEG", margin, y, lineImgWidth, lineImgHeight);
  y += lineImgHeight + 16;

  const disclaimers = [...new Set(state.comparisonSlots.map((s) => PLANS[s.planId].disclaimer).filter(Boolean))];
  const anyEstimated = state.comparisonSlots.some((s) => Object.values(s.resultsByYear).some((r) => r.isEstimated));
  if (disclaimers.length || anyEstimated) {
    const disclaimerContainer = document.createElement("div");
    disclaimerContainer.style.cssText =
      "position:absolute;left:-9999px;top:0;width:760px;padding:24px;background:#ffffff;" +
      "font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang HK','Microsoft YaHei',Roboto,sans-serif;color:#3d3a35;";
    disclaimerContainer.innerHTML = `
      ${anyEstimated ? `<div style="font-size:9px;color:#b0aa9e;margin-bottom:8px;">${escapeHtml(t("comparisonChartNote"))}</div>` : ""}
      ${
        disclaimers.length
          ? `<div style="font-size:9px;color:#b0aa9e;">
               <strong>${escapeHtml(t("pdfDisclaimerTitle"))}:</strong> ${disclaimers.map(escapeHtml).join(" ")}
             </div>`
          : ""
      }
    `;
    document.body.appendChild(disclaimerContainer);
    try {
      const disclaimerCanvas = await html2canvas(disclaimerContainer, { scale: 2, backgroundColor: "#ffffff" });
      const disclaimerImgData = disclaimerCanvas.toDataURL("image/jpeg", 0.92);
      const disclaimerWidth = pageWidth - margin * 2;
      const disclaimerHeight = disclaimerWidth * (disclaimerCanvas.height / disclaimerCanvas.width);
      if (y + disclaimerHeight > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      doc.addImage(disclaimerImgData, "JPEG", margin, y, disclaimerWidth, disclaimerHeight);
    } finally {
      document.body.removeChild(disclaimerContainer);
    }
  }

  const filenameBase = (clientName || "comparison").replace(/[^a-zA-Z0-9一-鿿]+/g, "_");
  doc.save(`${filenameBase}_comparison_${dateStr.replace(/\//g, "-")}.pdf`);
}
