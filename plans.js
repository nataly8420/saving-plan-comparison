// plans.js — single source of truth for all plan configs.
//
// Each plan is ONE PRODUCT (e.g. "BOC Life GGG"), not one product+span
// combination — payment span is a real input (see #span in index.html),
// not a separate plan selection. A product's span-dependent data (cash
// value schedule, discount, PF terms) lives under plan.spans[N]; fields
// that don't vary by span (id/name/company/currency/disclaimer) sit at the
// top level. resolvePlanForSpan() in calculator.js flattens plan+span into
// the shape calculatePlan/calculatePF expect.
//
// Death benefit columns are intentionally excluded everywhere — only cash
// value matters here.

const PLANS = {
  "boclife_ggg_wl": {
    id: "boclife_ggg_wl",
    name: "薪火傳承環球終身壽險計劃",
    company: "BOC Life 中銀人壽",
    hasRealData: true,
    currency: "USD",
    availableSpans: [1, 2, 3, 5, 10],

    // Shared across spans (identical text in both source proposals).
    disclaimer: "現金價值總額之非保證部分（累積週年紅利及終期紅利）並非保證，實際金額可能較高或較低。以上資料不構成保單條款之一部分，並不包括身故賠償部分。",

    spans: {
      // --- 躉繳 (single premium) ---
      // Data source: female, age 60, non-smoker — 1,000,000 USD proposal
      // (BOCLIFEGGGWLIP-1-USD-FN-60-HONGKONG-(1000000)-HK.pdf), cross-checked
      // against a 5,000,000 USD proposal (same profile) and 薪火抵押/薪火保融
      // GGG SP x 中銀香港 (072026).xlsx workbooks.
      1: {
        // Ratios are relative to GROSS premium (before discount) — confirmed
        // against the Excel: the AX/AY/AZ ratio columns are IDENTICAL across
        // all four premium tiers (0.2M/0.6M/1M/1.5M) sampled, and
        // Total SV = ratio x grossPremium reproduces both real proposals
        // exactly for every policy year 1-40.
        returnTable: {
          1:  { guaranteedCVRatio: 0.80800000, accumulatedDivRatio: 0.00010000, terminalDivRatio: 0.00101000 },
          2:  { guaranteedCVRatio: 0.82808000, accumulatedDivRatio: 0.00020400, terminalDivRatio: 0.00202000 },
          3:  { guaranteedCVRatio: 0.85050000, accumulatedDivRatio: 0.00031300, terminalDivRatio: 0.08490000 },
          4:  { guaranteedCVRatio: 0.85050000, accumulatedDivRatio: 0.00042600, terminalDivRatio: 0.16140000 },
          5:  { guaranteedCVRatio: 0.85050000, accumulatedDivRatio: 0.00054400, terminalDivRatio: 0.27544000 },
          6:  { guaranteedCVRatio: 0.85050000, accumulatedDivRatio: 0.00066700, terminalDivRatio: 0.32202000 },
          7:  { guaranteedCVRatio: 0.85050000, accumulatedDivRatio: 0.00079600, terminalDivRatio: 0.36707000 },
          8:  { guaranteedCVRatio: 0.85050000, accumulatedDivRatio: 0.00093000, terminalDivRatio: 0.41398000 },
          9:  { guaranteedCVRatio: 0.85050000, accumulatedDivRatio: 0.00106900, terminalDivRatio: 0.46188000 },
          10: { guaranteedCVRatio: 0.85050000, accumulatedDivRatio: 0.00121500, terminalDivRatio: 0.51144000 },
          11: { guaranteedCVRatio: 0.85889000, accumulatedDivRatio: 0.00141600, terminalDivRatio: 0.57541000 },
          12: { guaranteedCVRatio: 0.86050000, accumulatedDivRatio: 0.00162600, terminalDivRatio: 0.63671000 },
          13: { guaranteedCVRatio: 0.86071000, accumulatedDivRatio: 0.00184600, terminalDivRatio: 0.71742000 },
          14: { guaranteedCVRatio: 0.86143000, accumulatedDivRatio: 0.00207400, terminalDivRatio: 0.80534000 },
          15: { guaranteedCVRatio: 0.86469000, accumulatedDivRatio: 0.00231200, terminalDivRatio: 0.89921000 },
          16: { guaranteedCVRatio: 0.87621000, accumulatedDivRatio: 0.00256000, terminalDivRatio: 0.99421000 },
          17: { guaranteedCVRatio: 0.89486000, accumulatedDivRatio: 0.00281900, terminalDivRatio: 1.09247000 },
          18: { guaranteedCVRatio: 0.90447000, accumulatedDivRatio: 0.00308900, terminalDivRatio: 1.21127000 },
          19: { guaranteedCVRatio: 0.91945000, accumulatedDivRatio: 0.00337000, terminalDivRatio: 1.33748000 },
          20: { guaranteedCVRatio: 0.93504000, accumulatedDivRatio: 0.00366400, terminalDivRatio: 1.46810000 },
          21: { guaranteedCVRatio: 0.96559000, accumulatedDivRatio: 0.00401900, terminalDivRatio: 1.58468000 },
          22: { guaranteedCVRatio: 1.00110000, accumulatedDivRatio: 0.00439000, terminalDivRatio: 1.70843000 },
          23: { guaranteedCVRatio: 1.01808000, accumulatedDivRatio: 0.00477700, terminalDivRatio: 1.86393000 },
          24: { guaranteedCVRatio: 1.03550000, accumulatedDivRatio: 0.00518000, terminalDivRatio: 2.03348000 },
          25: { guaranteedCVRatio: 1.05337000, accumulatedDivRatio: 0.00560000, terminalDivRatio: 2.18269000 },
          26: { guaranteedCVRatio: 1.07171000, accumulatedDivRatio: 0.00603800, terminalDivRatio: 2.34025000 },
          27: { guaranteedCVRatio: 1.09054000, accumulatedDivRatio: 0.00649400, terminalDivRatio: 2.50663000 },
          28: { guaranteedCVRatio: 1.10985000, accumulatedDivRatio: 0.00697000, terminalDivRatio: 2.68230000 },
          29: { guaranteedCVRatio: 1.12295000, accumulatedDivRatio: 0.00746700, terminalDivRatio: 2.87447000 },
          30: { guaranteedCVRatio: 1.13698000, accumulatedDivRatio: 0.00798400, terminalDivRatio: 3.07640000 },
          31: { guaranteedCVRatio: 1.13799000, accumulatedDivRatio: 0.00857300, terminalDivRatio: 3.32216000 },
          32: { guaranteedCVRatio: 1.13891000, accumulatedDivRatio: 0.00918800, terminalDivRatio: 3.58316000 },
          33: { guaranteedCVRatio: 1.13971000, accumulatedDivRatio: 0.00982800, terminalDivRatio: 3.86039000 },
          34: { guaranteedCVRatio: 1.14039000, accumulatedDivRatio: 0.01049600, terminalDivRatio: 4.15484000 },
          35: { guaranteedCVRatio: 1.14097000, accumulatedDivRatio: 0.01119200, terminalDivRatio: 4.46758000 },
          36: { guaranteedCVRatio: 1.14144000, accumulatedDivRatio: 0.01191800, terminalDivRatio: 4.79976000 },
          37: { guaranteedCVRatio: 1.14180000, accumulatedDivRatio: 0.01267400, terminalDivRatio: 5.15258000 },
          38: { guaranteedCVRatio: 1.14206000, accumulatedDivRatio: 0.01346300, terminalDivRatio: 5.52733000 },
          39: { guaranteedCVRatio: 1.14220000, accumulatedDivRatio: 0.01428500, terminalDivRatio: 5.92539000 },
          40: { guaranteedCVRatio: 1.14224000, accumulatedDivRatio: 0.01514200, terminalDivRatio: 6.34820000 },
        },

        // Excel cell K3 ("終期紅利實現率") — a stress-test multiplier applied
        // to terminalDivRatio. 1.0 = full non-guaranteed terminal dividend.
        terminalDivRealizationRate: 1.0,

        // Premium-tiered discount (躉繳 has no payment-span schedule — the
        // discount depends on GROSS PREMIUM SIZE instead). Tier boundaries
        // confirmed against BOC Life's official Q3 2026 partner rate card
        // (BOCLife_2026年第三季推廣優惠_TC&EN.pdf, p.5, "三年繳/躉繳美元保單"
        // table — supersedes the earlier 4-anchor-point Excel estimate):
        //   <150,000 USD -> 5.5%, 150,000-600,000 -> 6.7%,
        //   600,000-1,000,000 -> 7.5%, >=1,000,000 -> 8.5%
        // bonusDiscount is a separate line NOT shown in the official rate
        // card at all — still only known from the 薪火抵押/薪火保融 Excel
        // workbooks' 4 sample tiers, likely an advisor-side top-up rather
        // than a house rate. The <150,000 bracket has no known bonus sample.
        premiumDiscountTiers: [
          { minPremium: 0,       firstYearDiscount: 0.055, bonusDiscount: 0.000 },
          { minPremium: 150000,  firstYearDiscount: 0.067, bonusDiscount: 0.008 },
          { minPremium: 600000,  firstYearDiscount: 0.075, bonusDiscount: 0.010 },
          { minPremium: 1000000, firstYearDiscount: 0.085, bonusDiscount: 0.015 },
          { minPremium: 1500000, firstYearDiscount: 0.085, bonusDiscount: 0.025 },
        ],

        // Two PF routes exist for this plan, confirmed from the two
        // workbooks. Loan = loanBasisRatio(day1SV or netPremium) x ltvRatio.
        day1SVRatio: 0.8080, // Day-1 surrender value as ratio of GROSS premium (constant across tiers)
        pf: {
          enabled: true,
          defaultLoanRate: 0.025, // 2.5% p.a. flat ("P-2.5%" scenario), editable per year for stress test
          processingFeeRate: 0.000,
          processingFeeFixed: 0,
          modes: {
            pledge: {
              label: "薪火抵押 (Policy Pledge)",
              ltvRatio: 0.85,      // flat 85% across all tiers
              loanBasis: "day1SV", // Loan = Day-1 SV x LTV
            },
            financing: {
              label: "薪火保融 (Bank Financing)",
              // LTV steps down as premium size increases (confirmed 0.2M
              // tier still uses day1SV basis, 0.6M+ tiers switch to netPremium)
              ltvTiers: [
                { minPremium: 0,      ltvRatio: 0.80, loanBasis: "day1SV" },
                { minPremium: 600000, ltvRatio: 0.70, loanBasis: "netPremium" },
              ],
            },
          },
        },

        maxYearsToShow: 40,
        defaultCompareYears: [7, 8, 9],
      },

      // --- 2年繳 (2-year installment) ---
      // Data source: male, age 50, non-smoker ("boc non vip 2yr 1M.pdf"),
      // $500,000/year x 2 = $1,000,000 total. NOTE: different insured
      // profile (age/gender) than the 躉繳 span above — each span is
      // self-contained and correct for its own case, not directly
      // comparable client-for-client without a matching-profile proposal.
      2: {
        returnTable: {
          1: { guaranteedCVRatio: 0.306000, accumulatedDivRatio: 0.000000, terminalDivRatio: 0.000000 },
          2: { guaranteedCVRatio: 0.806000, accumulatedDivRatio: 0.000000, terminalDivRatio: 0.000000 },
          3: { guaranteedCVRatio: 0.872950, accumulatedDivRatio: 0.000100, terminalDivRatio: 0.000000 },
          4: { guaranteedCVRatio: 0.872950, accumulatedDivRatio: 0.000204, terminalDivRatio: 0.000000 },
          5: { guaranteedCVRatio: 0.872950, accumulatedDivRatio: 0.000313, terminalDivRatio: 0.110000 },
          6: { guaranteedCVRatio: 0.872950, accumulatedDivRatio: 0.000426, terminalDivRatio: 0.173500 },
          7: { guaranteedCVRatio: 0.980000, accumulatedDivRatio: 0.000544, terminalDivRatio: 0.221190 },
          8: { guaranteedCVRatio: 0.992010, accumulatedDivRatio: 0.000667, terminalDivRatio: 0.272340 },
          9: { guaranteedCVRatio: 1.003520, accumulatedDivRatio: 0.000796, terminalDivRatio: 0.365900 },
          10: { guaranteedCVRatio: 1.022440, accumulatedDivRatio: 0.000930, terminalDivRatio: 0.428720 },
          11: { guaranteedCVRatio: 1.028220, accumulatedDivRatio: 0.001119, terminalDivRatio: 0.505790 },
          12: { guaranteedCVRatio: 1.034000, accumulatedDivRatio: 0.001317, terminalDivRatio: 0.588280 },
          13: { guaranteedCVRatio: 1.039770, accumulatedDivRatio: 0.001523, terminalDivRatio: 0.676580 },
          14: { guaranteedCVRatio: 1.045550, accumulatedDivRatio: 0.001737, terminalDivRatio: 0.771060 },
          15: { guaranteedCVRatio: 1.055440, accumulatedDivRatio: 0.001961, terminalDivRatio: 0.868290 },
          16: { guaranteedCVRatio: 1.065440, accumulatedDivRatio: 0.002195, terminalDivRatio: 0.967900 },
          17: { guaranteedCVRatio: 1.075440, accumulatedDivRatio: 0.002438, terminalDivRatio: 1.073820 },
          18: { guaranteedCVRatio: 1.085440, accumulatedDivRatio: 0.002692, terminalDivRatio: 1.186440 },
          19: { guaranteedCVRatio: 1.095440, accumulatedDivRatio: 0.002956, terminalDivRatio: 1.306130 },
          20: { guaranteedCVRatio: 1.105440, accumulatedDivRatio: 0.003232, terminalDivRatio: 1.433320 },
          21: { guaranteedCVRatio: 1.115440, accumulatedDivRatio: 0.003569, terminalDivRatio: 1.563170 },
          22: { guaranteedCVRatio: 1.125440, accumulatedDivRatio: 0.003921, terminalDivRatio: 1.700400 },
          23: { guaranteedCVRatio: 1.135440, accumulatedDivRatio: 0.004287, terminalDivRatio: 1.845380 },
          24: { guaranteedCVRatio: 1.145440, accumulatedDivRatio: 0.004669, terminalDivRatio: 1.998530 },
          25: { guaranteedCVRatio: 1.155440, accumulatedDivRatio: 0.005068, terminalDivRatio: 2.160280 },
          26: { guaranteedCVRatio: 1.165440, accumulatedDivRatio: 0.005483, terminalDivRatio: 2.331050 },
          27: { guaranteedCVRatio: 1.175440, accumulatedDivRatio: 0.005916, terminalDivRatio: 2.511320 },
          28: { guaranteedCVRatio: 1.185440, accumulatedDivRatio: 0.006368, terminalDivRatio: 2.701570 },
          29: { guaranteedCVRatio: 1.195440, accumulatedDivRatio: 0.006838, terminalDivRatio: 2.902300 },
          30: { guaranteedCVRatio: 1.205440, accumulatedDivRatio: 0.007329, terminalDivRatio: 3.114050 },
          31: { guaranteedCVRatio: 1.215440, accumulatedDivRatio: 0.007890, terminalDivRatio: 3.356930 },
          32: { guaranteedCVRatio: 1.225440, accumulatedDivRatio: 0.008476, terminalDivRatio: 3.615190 },
          33: { guaranteedCVRatio: 1.235440, accumulatedDivRatio: 0.009086, terminalDivRatio: 3.889810 },
          34: { guaranteedCVRatio: 1.245440, accumulatedDivRatio: 0.009722, terminalDivRatio: 4.181790 },
          35: { guaranteedCVRatio: 1.255440, accumulatedDivRatio: 0.010385, terminalDivRatio: 4.492190 },
          36: { guaranteedCVRatio: 1.265440, accumulatedDivRatio: 0.011077, terminalDivRatio: 4.822160 },
          37: { guaranteedCVRatio: 1.275440, accumulatedDivRatio: 0.011797, terminalDivRatio: 5.172890 },
          38: { guaranteedCVRatio: 1.285440, accumulatedDivRatio: 0.012549, terminalDivRatio: 5.545680 },
          39: { guaranteedCVRatio: 1.295440, accumulatedDivRatio: 0.013332, terminalDivRatio: 5.941860 },
          40: { guaranteedCVRatio: 1.305440, accumulatedDivRatio: 0.014149, terminalDivRatio: 6.362900 },
        },

        terminalDivRealizationRate: 1.0,

        // Installment plans use a flat SPAN-based discount, NOT the
        // premium-size tiers used by 躉繳 — confirmed both by this proposal
        // (500,000 gross -> 465,000 net in year 1 = exactly 7%) and the
        // official Q3 2026 rate card ("2年" row: 7% for HKD/USD). The promo
        // is explicitly named "首年保費折扣優惠" (FIRST YEAR premium
        // discount only) — year 2 is full price, confirmed by no
        // second-year discount appearing anywhere in this proposal.
        discountTable: {
          2: { 1: 0.07, 2: 0 },
        },

        // day1SVRatio here is real (returnTable[1].guaranteedCVRatio for
        // this span, i.e. the CV after only the first of two premiums has
        // been paid) — not a guess. The LTV ratios below ARE guesses,
        // though: 薪火抵押/薪火保融 are BOC-wide loan products so it's
        // reasonable the same two modes exist for this span, but their LTV%
        // has never been confirmed against a real 2-year-pay rate card —
        // copied from span 1 purely as a starting default. Per instruction,
        // discount/LTV are now expected to be hand-entered per case anyway
        // (see #pf-ltv / discount override inputs in app.js), so this only
        // needs to be a reasonable starting point, not sourced fact.
        day1SVRatio: 0.306,
        pf: {
          enabled: true,
          defaultLoanRate: 0.025,
          processingFeeRate: 0.000,
          processingFeeFixed: 0,
          modes: {
            pledge: {
              label: "薪火抵押 (Policy Pledge)",
              ltvRatio: 0.85,
              loanBasis: "day1SV",
            },
            financing: {
              label: "薪火保融 (Bank Financing)",
              ltvTiers: [
                { minPremium: 0,      ltvRatio: 0.80, loanBasis: "day1SV" },
                { minPremium: 600000, ltvRatio: 0.70, loanBasis: "netPremium" },
              ],
            },
          },
        },

        maxYearsToShow: 40,
        defaultCompareYears: [7, 8, 9],
      },

      // --- 3年繳 (3-year installment) ---
      // Data source: male, age 50, non-smoker ("boc 3 yr xinhuo 1M.pdf"),
      // $333,330/year x 3 = $999,990 total. This proposal's "說明摘要" table
      // only lists milestone years (1-10, then every 5, then by round ages
      // 55-100) rather than every year 1-40 — calculatePlan() iterates
      // Object.keys(returnTable), so a sparse table is safe; the Results
      // table/chart simply show only the years with real data rather than
      // interpolating years we were never given.
      3: {
        returnTable: {
          1:  { guaranteedCVRatio: 0.16833168, accumulatedDivRatio: 0.00000000, terminalDivRatio: 0.00000000 },
          2:  { guaranteedCVRatio: 0.49490495, accumulatedDivRatio: 0.00000000, terminalDivRatio: 0.00000000 },
          3:  { guaranteedCVRatio: 0.85000850, accumulatedDivRatio: 0.00010000, terminalDivRatio: 0.08506085 },
          4:  { guaranteedCVRatio: 0.85000850, accumulatedDivRatio: 0.00020400, terminalDivRatio: 0.16152162 },
          5:  { guaranteedCVRatio: 0.85000850, accumulatedDivRatio: 0.00031300, terminalDivRatio: 0.27551276 },
          6:  { guaranteedCVRatio: 0.85000850, accumulatedDivRatio: 0.00042600, terminalDivRatio: 0.32207322 },
          7:  { guaranteedCVRatio: 0.85000850, accumulatedDivRatio: 0.00054401, terminalDivRatio: 0.36710367 },
          8:  { guaranteedCVRatio: 0.85000850, accumulatedDivRatio: 0.00066701, terminalDivRatio: 0.41400414 },
          9:  { guaranteedCVRatio: 0.85000850, accumulatedDivRatio: 0.00079601, terminalDivRatio: 0.46188462 },
          10: { guaranteedCVRatio: 0.85000850, accumulatedDivRatio: 0.00093001, terminalDivRatio: 0.51142511 },
          15: { guaranteedCVRatio: 0.85456855, accumulatedDivRatio: 0.00196102, terminalDivRatio: 0.86592866 },
          20: { guaranteedCVRatio: 0.92291923, accumulatedDivRatio: 0.00323203, terminalDivRatio: 1.34697347 },
          25: { guaranteedCVRatio: 0.99672997, accumulatedDivRatio: 0.00506805, terminalDivRatio: 2.05689057 },
          30: { guaranteedCVRatio: 1.06425064, accumulatedDivRatio: 0.00732907, terminalDivRatio: 3.19332193 },
          35: { guaranteedCVRatio: 1.07535075, accumulatedDivRatio: 0.01038510, terminalDivRatio: 4.58994590 }, // age 85
          40: { guaranteedCVRatio: 1.08657087, accumulatedDivRatio: 0.01414914, terminalDivRatio: 6.47199472 }, // age 90
          45: { guaranteedCVRatio: 1.09790098, accumulatedDivRatio: 0.01878319, terminalDivRatio: 8.89034890 }, // age 95
          50: { guaranteedCVRatio: 1.10935109, accumulatedDivRatio: 0.02448924, terminalDivRatio: 12.08903089 }, // age 100
        },

        terminalDivRealizationRate: 1.0,

        // 6.0% first-year-only discount, confirmed exactly: 333,330 gross ->
        // 313,330.20 net = 19,999.80 discount = 333,330 x 6.00000...%. This
        // proposal has NO 優選客戶 (VIP/preferred-customer) variant — unlike
        // spans 2/5/10, 3-year-pay doesn't offer that selection at all.
        discountTable: {
          3: { 1: 0.06, 2: 0, 3: 0 },
        },

        day1SVRatio: 0,
        pf: null,

        maxYearsToShow: 50,
        defaultCompareYears: [7, 8, 9],
      },

      // --- 5年繳 (5-year installment) ---
      // Data source: male, age 50, non-smoker, $200,000/year x 5 = $1,000,000
      // total ("boc 5yr 1M non vip.pdf"). Cross-checked against the 優選客戶
      // (VIP/preferred-customer) variant of the SAME proposal ("boc 5yr vip
      // 1M.pdf") — the cash-value/dividend table is byte-for-byte IDENTICAL
      // between VIP and non-VIP; only the first-year discount differs
      // (10.0% VIP vs 8.0% non-VIP here). Storing the non-VIP (standard)
      // rate below since that's the default path; the VIP rate is a simple
      // swap if/when the app needs to support that selection.
      5: {
        returnTable: {
          1:  { guaranteedCVRatio: 0.00000000, accumulatedDivRatio: 0.00000000, terminalDivRatio: 0.00000000 },
          2:  { guaranteedCVRatio: 0.00000000, accumulatedDivRatio: 0.00000000, terminalDivRatio: 0.00000000 },
          3:  { guaranteedCVRatio: 0.40600000, accumulatedDivRatio: 0.00010000, terminalDivRatio: 0.00000000 },
          4:  { guaranteedCVRatio: 0.60200000, accumulatedDivRatio: 0.00020400, terminalDivRatio: 0.00000000 },
          5:  { guaranteedCVRatio: 0.80200000, accumulatedDivRatio: 0.00031300, terminalDivRatio: 0.01349000 },
          6:  { guaranteedCVRatio: 0.84700000, accumulatedDivRatio: 0.00042600, terminalDivRatio: 0.15612000 },
          7:  { guaranteedCVRatio: 0.88700000, accumulatedDivRatio: 0.00054400, terminalDivRatio: 0.24259000 },
          8:  { guaranteedCVRatio: 0.93800000, accumulatedDivRatio: 0.00066700, terminalDivRatio: 0.27118000 },
          9:  { guaranteedCVRatio: 0.96700000, accumulatedDivRatio: 0.00079600, terminalDivRatio: 0.34548000 },
          10: { guaranteedCVRatio: 0.98200000, accumulatedDivRatio: 0.00093000, terminalDivRatio: 0.39243000 },
          15: { guaranteedCVRatio: 1.04200000, accumulatedDivRatio: 0.00196100, terminalDivRatio: 0.70177000 },
          20: { guaranteedCVRatio: 1.10200000, accumulatedDivRatio: 0.00323200, terminalDivRatio: 1.16475000 },
          25: { guaranteedCVRatio: 1.15185000, accumulatedDivRatio: 0.00506800, terminalDivRatio: 1.79018000 },
          30: { guaranteedCVRatio: 1.20170000, accumulatedDivRatio: 0.00732900, terminalDivRatio: 2.60326000 },
          35: { guaranteedCVRatio: 1.25155000, accumulatedDivRatio: 0.01038500, terminalDivRatio: 3.75150000 }, // age 85
          40: { guaranteedCVRatio: 1.30140000, accumulatedDivRatio: 0.01414900, terminalDivRatio: 5.28773000 }, // age 90
          45: { guaranteedCVRatio: 1.35125000, accumulatedDivRatio: 0.01878300, terminalDivRatio: 7.31113000 }, // age 95
          50: { guaranteedCVRatio: 1.40110000, accumulatedDivRatio: 0.02448900, terminalDivRatio: 9.98965000 }, // age 100
        },

        terminalDivRealizationRate: 1.0,

        // 8.0% first-year-only discount (non-VIP/standard): 200,000 gross ->
        // 184,000 net = 16,000 = exactly 8.00%. VIP variant confirmed at
        // 10.0% (200,000 -> 180,000) with an IDENTICAL return table — see
        // comment above.
        discountTable: {
          5: { 1: 0.08, 2: 0, 3: 0, 4: 0, 5: 0 },
        },

        day1SVRatio: 0,
        pf: null,

        maxYearsToShow: 50,
        defaultCompareYears: [7, 8, 9],
      },

      // --- 10年繳 (10-year installment) ---
      // Data source: male, age 50, non-smoker, $100,000/year x 10 =
      // $1,000,000 total ("boc 10yr non vip 1M.pdf"). No VIP variant of
      // this span has been provided/cross-checked yet (only 5-year's VIP
      // variant has been confirmed so far).
      10: {
        returnTable: {
          1:  { guaranteedCVRatio: 0.00000000, accumulatedDivRatio: 0.00000000, terminalDivRatio: 0.00000000 },
          2:  { guaranteedCVRatio: 0.00000000, accumulatedDivRatio: 0.00000000, terminalDivRatio: 0.00000000 },
          3:  { guaranteedCVRatio: 0.04000000, accumulatedDivRatio: 0.00010000, terminalDivRatio: 0.00000000 },
          4:  { guaranteedCVRatio: 0.11000000, accumulatedDivRatio: 0.00020400, terminalDivRatio: 0.00000000 },
          5:  { guaranteedCVRatio: 0.18000000, accumulatedDivRatio: 0.00031300, terminalDivRatio: 0.00000000 },
          6:  { guaranteedCVRatio: 0.25000000, accumulatedDivRatio: 0.00042600, terminalDivRatio: 0.00000000 },
          7:  { guaranteedCVRatio: 0.32000000, accumulatedDivRatio: 0.00054400, terminalDivRatio: 0.00000000 },
          8:  { guaranteedCVRatio: 0.41333000, accumulatedDivRatio: 0.00066700, terminalDivRatio: 0.28256000 },
          9:  { guaranteedCVRatio: 0.50667000, accumulatedDivRatio: 0.00079600, terminalDivRatio: 0.35344000 },
          10: { guaranteedCVRatio: 0.60000000, accumulatedDivRatio: 0.00093000, terminalDivRatio: 0.44116000 },
          15: { guaranteedCVRatio: 0.80000000, accumulatedDivRatio: 0.00196100, terminalDivRatio: 0.65638000 },
          20: { guaranteedCVRatio: 1.00000000, accumulatedDivRatio: 0.00323200, terminalDivRatio: 1.00475000 },
          25: { guaranteedCVRatio: 1.04450000, accumulatedDivRatio: 0.00506800, terminalDivRatio: 1.56928000 },
          30: { guaranteedCVRatio: 1.09325000, accumulatedDivRatio: 0.00732900, terminalDivRatio: 2.28768000 },
          35: { guaranteedCVRatio: 1.14200000, accumulatedDivRatio: 0.01038500, terminalDivRatio: 3.33700000 }, // age 85
          40: { guaranteedCVRatio: 1.19075000, accumulatedDivRatio: 0.01414900, terminalDivRatio: 4.74938000 }, // age 90
          45: { guaranteedCVRatio: 1.23950000, accumulatedDivRatio: 0.01878300, terminalDivRatio: 6.51746000 }, // age 95
          50: { guaranteedCVRatio: 1.28825000, accumulatedDivRatio: 0.02448900, terminalDivRatio: 8.81670000 }, // age 100
        },

        terminalDivRealizationRate: 1.0,

        // 10.0% first-year-only discount: 100,000 gross -> 90,000 net =
        // exactly 10.00%.
        discountTable: {
          10: { 1: 0.10, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 },
        },

        day1SVRatio: 0,
        pf: null,

        maxYearsToShow: 50,
        defaultCompareYears: [7, 8, 9],
      },
    },
  },

  "boclife_huanyu": {
    id: "boclife_huanyu",
    name: "寰御安心環球終身保險計劃",
    company: "BOC Life 中銀人壽",
    hasRealData: true,
    currency: "USD",
    availableSpans: [2, 5],

    disclaimer: "現金價值總額包括保證現金價值、累積週年紅利(非保證)(如有)及其累積利息(非保證)(如有)及終期紅利(非保證)(如有)。",

    spans: {
      // --- 2年繳 (2-year installment) ---
      // Data source: male, age 50, non-smoker, $500,000/year x 2 = $1,000,000
      // total ("boc huanyu 2yr 1M.pdf" / "boc huan yu 2yr PF 1M total.pdf" —
      // both proposals have an IDENTICAL cash-value/dividend table; only one
      // of the two had the discount promo applied at quote time, see below).
      // Unlike 薪火傳承, this proposal's "說明摘要" table gives EVERY policy
      // year 1-70 (not just milestones) — insured is age 50, illustration
      // runs to age 120, so all 70 years are real transcribed data, not
      // interpolated.
      2: {
        returnTable: {
           1: { guaranteedCVRatio: 0.00000000, accumulatedDivRatio: 0.00000000, terminalDivRatio: 0.00000000 },
           2: { guaranteedCVRatio: 0.00156000, accumulatedDivRatio: 0.00010000, terminalDivRatio: 0.00500000 },
           3: { guaranteedCVRatio: 0.05767000, accumulatedDivRatio: 0.00020400, terminalDivRatio: 0.19194000 },
           4: { guaranteedCVRatio: 0.10945000, accumulatedDivRatio: 0.00031300, terminalDivRatio: 0.22318000 },
           5: { guaranteedCVRatio: 0.20692000, accumulatedDivRatio: 0.00042600, terminalDivRatio: 0.31735000 },
           6: { guaranteedCVRatio: 0.27089000, accumulatedDivRatio: 0.00054400, terminalDivRatio: 0.55767000 },
           7: { guaranteedCVRatio: 0.35475000, accumulatedDivRatio: 0.00066700, terminalDivRatio: 0.65081000 },
           8: { guaranteedCVRatio: 0.43189000, accumulatedDivRatio: 0.00079600, terminalDivRatio: 0.69798000 },
           9: { guaranteedCVRatio: 0.45663000, accumulatedDivRatio: 0.00093000, terminalDivRatio: 0.77863000 },
          10: { guaranteedCVRatio: 0.53689000, accumulatedDivRatio: 0.00106900, terminalDivRatio: 0.81377000 },
          11: { guaranteedCVRatio: 0.58922000, accumulatedDivRatio: 0.00126500, terminalDivRatio: 0.84891000 },
          12: { guaranteedCVRatio: 0.67368000, accumulatedDivRatio: 0.00146800, terminalDivRatio: 0.88405000 },
          13: { guaranteedCVRatio: 0.77643000, accumulatedDivRatio: 0.00168100, terminalDivRatio: 0.91919000 },
          14: { guaranteedCVRatio: 0.88649000, accumulatedDivRatio: 0.00190200, terminalDivRatio: 0.95433000 },
          15: { guaranteedCVRatio: 1.00000000, accumulatedDivRatio: 0.00213300, terminalDivRatio: 0.99796000 },
          16: { guaranteedCVRatio: 1.00306000, accumulatedDivRatio: 0.00237400, terminalDivRatio: 1.13853000 },
          17: { guaranteedCVRatio: 1.00613000, accumulatedDivRatio: 0.00262500, terminalDivRatio: 1.30672000 },
          18: { guaranteedCVRatio: 1.00919000, accumulatedDivRatio: 0.00288600, terminalDivRatio: 1.49704000 },
          19: { guaranteedCVRatio: 1.01399000, accumulatedDivRatio: 0.00315900, terminalDivRatio: 1.71078000 },
          20: { guaranteedCVRatio: 1.01875000, accumulatedDivRatio: 0.00344300, terminalDivRatio: 2.00974000 },
          21: { guaranteedCVRatio: 1.02349000, accumulatedDivRatio: 0.00378900, terminalDivRatio: 2.25712000 },
          22: { guaranteedCVRatio: 1.02819000, accumulatedDivRatio: 0.00415000, terminalDivRatio: 2.58153000 },
          23: { guaranteedCVRatio: 1.03287000, accumulatedDivRatio: 0.00452700, terminalDivRatio: 2.96267000 },
          24: { guaranteedCVRatio: 1.03754000, accumulatedDivRatio: 0.00491900, terminalDivRatio: 3.22550000 },
          25: { guaranteedCVRatio: 1.04218000, accumulatedDivRatio: 0.00532800, terminalDivRatio: 3.53281000 },
          26: { guaranteedCVRatio: 1.04681000, accumulatedDivRatio: 0.00575500, terminalDivRatio: 3.92549000 },
          27: { guaranteedCVRatio: 1.05143000, accumulatedDivRatio: 0.00619900, terminalDivRatio: 4.24372000 },
          28: { guaranteedCVRatio: 1.05603000, accumulatedDivRatio: 0.00666300, terminalDivRatio: 4.58825000 },
          29: { guaranteedCVRatio: 1.06063000, accumulatedDivRatio: 0.00714600, terminalDivRatio: 4.95032000 },
          30: { guaranteedCVRatio: 1.06521000, accumulatedDivRatio: 0.00765000, terminalDivRatio: 5.33622000 },
          31: { guaranteedCVRatio: 1.06979000, accumulatedDivRatio: 0.00822500, terminalDivRatio: 5.74747000 },
          32: { guaranteedCVRatio: 1.07436000, accumulatedDivRatio: 0.00882400, terminalDivRatio: 6.18576000 },
          33: { guaranteedCVRatio: 1.07892000, accumulatedDivRatio: 0.00944900, terminalDivRatio: 6.65283000 },
          34: { guaranteedCVRatio: 1.08348000, accumulatedDivRatio: 0.01010100, terminalDivRatio: 7.15056000 },
          35: { guaranteedCVRatio: 1.08803000, accumulatedDivRatio: 0.01078000, terminalDivRatio: 7.68095000 },
          36: { guaranteedCVRatio: 1.09257000, accumulatedDivRatio: 0.01148800, terminalDivRatio: 8.24611000 },
          37: { guaranteedCVRatio: 1.09711000, accumulatedDivRatio: 0.01222700, terminalDivRatio: 8.84831000 },
          38: { guaranteedCVRatio: 1.10165000, accumulatedDivRatio: 0.01299600, terminalDivRatio: 9.48994000 },
          39: { guaranteedCVRatio: 1.10618000, accumulatedDivRatio: 0.01379900, terminalDivRatio: 10.17359000 },
          40: { guaranteedCVRatio: 1.11071000, accumulatedDivRatio: 0.01463500, terminalDivRatio: 10.90195000 },
          41: { guaranteedCVRatio: 1.11524000, accumulatedDivRatio: 0.01550700, terminalDivRatio: 11.67797000 },
          42: { guaranteedCVRatio: 1.11976000, accumulatedDivRatio: 0.01641600, terminalDivRatio: 12.50471000 },
          43: { guaranteedCVRatio: 1.12428000, accumulatedDivRatio: 0.01736400, terminalDivRatio: 13.38550000 },
          44: { guaranteedCVRatio: 1.12880000, accumulatedDivRatio: 0.01835200, terminalDivRatio: 14.32383000 },
          45: { guaranteedCVRatio: 1.13331000, accumulatedDivRatio: 0.01938200, terminalDivRatio: 15.32344000 },
          46: { guaranteedCVRatio: 1.13783000, accumulatedDivRatio: 0.02045500, terminalDivRatio: 16.38832000 },
          47: { guaranteedCVRatio: 1.14234000, accumulatedDivRatio: 0.02157500, terminalDivRatio: 17.52271000 },
          48: { guaranteedCVRatio: 1.14684000, accumulatedDivRatio: 0.02274200, terminalDivRatio: 18.73114000 },
          49: { guaranteedCVRatio: 1.15135000, accumulatedDivRatio: 0.02395800, terminalDivRatio: 20.01840000 },
          50: { guaranteedCVRatio: 1.15585000, accumulatedDivRatio: 0.02522600, terminalDivRatio: 21.38963000 },
          51: { guaranteedCVRatio: 1.16036000, accumulatedDivRatio: 0.02654900, terminalDivRatio: 22.85027000 },
          52: { guaranteedCVRatio: 1.16486000, accumulatedDivRatio: 0.02792700, terminalDivRatio: 24.40615000 },
          53: { guaranteedCVRatio: 1.16936000, accumulatedDivRatio: 0.02936400, terminalDivRatio: 26.06346000 },
          54: { guaranteedCVRatio: 1.17385000, accumulatedDivRatio: 0.03086200, terminalDivRatio: 27.82878000 },
          55: { guaranteedCVRatio: 1.17835000, accumulatedDivRatio: 0.03242300, terminalDivRatio: 29.70914000 },
          56: { guaranteedCVRatio: 1.18285000, accumulatedDivRatio: 0.03405100, terminalDivRatio: 31.71201000 },
          57: { guaranteedCVRatio: 1.18734000, accumulatedDivRatio: 0.03574900, terminalDivRatio: 33.84536000 },
          58: { guaranteedCVRatio: 1.19183000, accumulatedDivRatio: 0.03751800, terminalDivRatio: 36.11767000 },
          59: { guaranteedCVRatio: 1.19633000, accumulatedDivRatio: 0.03936200, terminalDivRatio: 38.53795000 },
          60: { guaranteedCVRatio: 1.20082000, accumulatedDivRatio: 0.04128500, terminalDivRatio: 41.11586000 },
          61: { guaranteedCVRatio: 1.20531000, accumulatedDivRatio: 0.04329000, terminalDivRatio: 43.86161000 },
          62: { guaranteedCVRatio: 1.20980000, accumulatedDivRatio: 0.04538000, terminalDivRatio: 46.78613000 },
          63: { guaranteedCVRatio: 1.21428000, accumulatedDivRatio: 0.04755800, terminalDivRatio: 49.90104000 },
          64: { guaranteedCVRatio: 1.21877000, accumulatedDivRatio: 0.04983000, terminalDivRatio: 53.21870000 },
          65: { guaranteedCVRatio: 1.22326000, accumulatedDivRatio: 0.05219700, terminalDivRatio: 56.75229000 },
          66: { guaranteedCVRatio: 1.22774000, accumulatedDivRatio: 0.05466600, terminalDivRatio: 60.51586000 },
          67: { guaranteedCVRatio: 1.23223000, accumulatedDivRatio: 0.05723900, terminalDivRatio: 64.52434000 },
          68: { guaranteedCVRatio: 1.23671000, accumulatedDivRatio: 0.05992200, terminalDivRatio: 68.79366000 },
          69: { guaranteedCVRatio: 1.24120000, accumulatedDivRatio: 0.06271800, terminalDivRatio: 73.34078000 },
          70: { guaranteedCVRatio: 1.24568000, accumulatedDivRatio: 0.06563400, terminalDivRatio: 78.18374000 },
        },

        terminalDivRealizationRate: 1.0,

        // Confirmed from "boc huanyu 2yr 1M.pdf": 500,000 -> 480,000 (Y1,
        // 4.0%) and 500,000 -> 496,000 (Y2, 0.8%), promo code ATG2511. The
        // "PF"-named proposal for this same span had the promo NOT applied
        // (quoted at full 500,000/500,000) — the two files are otherwise
        // identical, so this looks like whether the promo was toggled on at
        // quote time, not a different product/tier. Using the discounted
        // (promo-applied) figures here since that reflects the achievable rate.
        discountTable: {
          2: { 1: 0.04, 2: 0.008 },
        },

        // No premium-financing/loan illustration in any of the 4 huanyu
        // proposals provided (despite two being filename-flagged "PF") —
        // same as BOC GGG spans 2/3/5/10.
        day1SVRatio: 0,
        pf: null,

        maxYearsToShow: 70,
        defaultCompareYears: [7, 8, 9],
      },

      // --- 5年繳 (5-year installment) ---
      // Data source: male, age 50, non-smoker, $200,000/year x 5 = $1,000,000
      // total ("boc huanyu 5yr 1M.pdf" / "boc huanyu 5yr PF 1M (total).pdf" —
      // again an IDENTICAL cash-value/dividend table between the two; only
      // the "PF"-named one had the discount promo applied).
      5: {
        returnTable: {
           1: { guaranteedCVRatio: 0.00000000, accumulatedDivRatio: 0.00000000, terminalDivRatio: 0.00000000 },
           2: { guaranteedCVRatio: 0.00110000, accumulatedDivRatio: 0.00010000, terminalDivRatio: 0.00340000 },
           3: { guaranteedCVRatio: 0.03860000, accumulatedDivRatio: 0.00020400, terminalDivRatio: 0.15710000 },
           4: { guaranteedCVRatio: 0.10837000, accumulatedDivRatio: 0.00031300, terminalDivRatio: 0.20743000 },
           5: { guaranteedCVRatio: 0.20487000, accumulatedDivRatio: 0.00042600, terminalDivRatio: 0.22052000 },
           6: { guaranteedCVRatio: 0.27019000, accumulatedDivRatio: 0.00054400, terminalDivRatio: 0.55763000 },
           7: { guaranteedCVRatio: 0.35124000, accumulatedDivRatio: 0.00066700, terminalDivRatio: 0.64837000 },
           8: { guaranteedCVRatio: 0.42761000, accumulatedDivRatio: 0.00079600, terminalDivRatio: 0.67052000 },
           9: { guaranteedCVRatio: 0.45211000, accumulatedDivRatio: 0.00093000, terminalDivRatio: 0.73351000 },
          10: { guaranteedCVRatio: 0.49111000, accumulatedDivRatio: 0.00106900, terminalDivRatio: 0.78785000 },
          11: { guaranteedCVRatio: 0.50911000, accumulatedDivRatio: 0.00126500, terminalDivRatio: 0.84579000 },
          12: { guaranteedCVRatio: 0.53611000, accumulatedDivRatio: 0.00146800, terminalDivRatio: 0.92210000 },
          13: { guaranteedCVRatio: 0.57211000, accumulatedDivRatio: 0.00168100, terminalDivRatio: 1.00569000 },
          14: { guaranteedCVRatio: 0.61711000, accumulatedDivRatio: 0.00190200, terminalDivRatio: 1.08746000 },
          15: { guaranteedCVRatio: 0.67111000, accumulatedDivRatio: 0.00213300, terminalDivRatio: 1.17151000 },
          16: { guaranteedCVRatio: 0.73411000, accumulatedDivRatio: 0.00237400, terminalDivRatio: 1.26356000 },
          17: { guaranteedCVRatio: 0.83611000, accumulatedDivRatio: 0.00262500, terminalDivRatio: 1.29082000 },
          18: { guaranteedCVRatio: 1.00840000, accumulatedDivRatio: 0.00288600, terminalDivRatio: 1.29998000 },
          19: { guaranteedCVRatio: 1.01285000, accumulatedDivRatio: 0.00315900, terminalDivRatio: 1.48855000 },
          20: { guaranteedCVRatio: 1.01730000, accumulatedDivRatio: 0.00344300, terminalDivRatio: 1.73447000 },
          21: { guaranteedCVRatio: 1.02175000, accumulatedDivRatio: 0.00378900, terminalDivRatio: 1.98867000 },
          22: { guaranteedCVRatio: 1.02620000, accumulatedDivRatio: 0.00415000, terminalDivRatio: 2.27783000 },
          23: { guaranteedCVRatio: 1.03065000, accumulatedDivRatio: 0.00452700, terminalDivRatio: 2.60732000 },
          24: { guaranteedCVRatio: 1.03510000, accumulatedDivRatio: 0.00491900, terminalDivRatio: 2.85536000 },
          25: { guaranteedCVRatio: 1.03955000, accumulatedDivRatio: 0.00532800, terminalDivRatio: 3.13309000 },
          26: { guaranteedCVRatio: 1.04400000, accumulatedDivRatio: 0.00575500, terminalDivRatio: 3.45664000 },
          27: { guaranteedCVRatio: 1.04845000, accumulatedDivRatio: 0.00619900, terminalDivRatio: 3.77454000 },
          28: { guaranteedCVRatio: 1.05290000, accumulatedDivRatio: 0.00666300, terminalDivRatio: 4.10000000 },
          29: { guaranteedCVRatio: 1.05735000, accumulatedDivRatio: 0.00714600, terminalDivRatio: 4.43029000 },
          30: { guaranteedCVRatio: 1.06180000, accumulatedDivRatio: 0.00765000, terminalDivRatio: 4.78233000 },
          31: { guaranteedCVRatio: 1.06625000, accumulatedDivRatio: 0.00822500, terminalDivRatio: 5.15750000 },
          32: { guaranteedCVRatio: 1.07070000, accumulatedDivRatio: 0.00882400, terminalDivRatio: 5.55735000 },
          33: { guaranteedCVRatio: 1.07515000, accumulatedDivRatio: 0.00944900, terminalDivRatio: 5.98347000 },
          34: { guaranteedCVRatio: 1.07960000, accumulatedDivRatio: 0.01010100, terminalDivRatio: 6.43758000 },
          35: { guaranteedCVRatio: 1.08405000, accumulatedDivRatio: 0.01078000, terminalDivRatio: 6.92150000 },
          36: { guaranteedCVRatio: 1.08850000, accumulatedDivRatio: 0.01148800, terminalDivRatio: 7.43716000 },
          37: { guaranteedCVRatio: 1.09295000, accumulatedDivRatio: 0.01222700, terminalDivRatio: 7.98663000 },
          38: { guaranteedCVRatio: 1.09740000, accumulatedDivRatio: 0.01299600, terminalDivRatio: 8.57210000 },
          39: { guaranteedCVRatio: 1.10185000, accumulatedDivRatio: 0.01379900, terminalDivRatio: 9.19592000 },
          40: { guaranteedCVRatio: 1.10630000, accumulatedDivRatio: 0.01463500, terminalDivRatio: 9.86057000 },
          41: { guaranteedCVRatio: 1.11075000, accumulatedDivRatio: 0.01550700, terminalDivRatio: 10.56872000 },
          42: { guaranteedCVRatio: 1.11520000, accumulatedDivRatio: 0.01641600, terminalDivRatio: 11.32318000 },
          43: { guaranteedCVRatio: 1.11965000, accumulatedDivRatio: 0.01736400, terminalDivRatio: 12.12698000 },
          44: { guaranteedCVRatio: 1.12410000, accumulatedDivRatio: 0.01835200, terminalDivRatio: 12.98331000 },
          45: { guaranteedCVRatio: 1.12855000, accumulatedDivRatio: 0.01938200, terminalDivRatio: 13.89559000 },
          46: { guaranteedCVRatio: 1.13300000, accumulatedDivRatio: 0.02045500, terminalDivRatio: 14.86746000 },
          47: { guaranteedCVRatio: 1.13745000, accumulatedDivRatio: 0.02157500, terminalDivRatio: 15.90279000 },
          48: { guaranteedCVRatio: 1.14190000, accumulatedDivRatio: 0.02274200, terminalDivRatio: 17.00571000 },
          49: { guaranteedCVRatio: 1.14635000, accumulatedDivRatio: 0.02395800, terminalDivRatio: 18.18060000 },
          50: { guaranteedCVRatio: 1.15080000, accumulatedDivRatio: 0.02522600, terminalDivRatio: 19.43216000 },
          51: { guaranteedCVRatio: 1.15525000, accumulatedDivRatio: 0.02654900, terminalDivRatio: 20.76535000 },
          52: { guaranteedCVRatio: 1.15970000, accumulatedDivRatio: 0.02792700, terminalDivRatio: 22.18549000 },
          53: { guaranteedCVRatio: 1.16415000, accumulatedDivRatio: 0.02936400, terminalDivRatio: 23.69823000 },
          54: { guaranteedCVRatio: 1.16860000, accumulatedDivRatio: 0.03086200, terminalDivRatio: 25.30958000 },
          55: { guaranteedCVRatio: 1.17305000, accumulatedDivRatio: 0.03242300, terminalDivRatio: 27.02596000 },
          56: { guaranteedCVRatio: 1.17750000, accumulatedDivRatio: 0.03405100, terminalDivRatio: 28.85420000 },
          57: { guaranteedCVRatio: 1.18195000, accumulatedDivRatio: 0.03574900, terminalDivRatio: 30.80156000 },
          58: { guaranteedCVRatio: 1.18640000, accumulatedDivRatio: 0.03751800, terminalDivRatio: 32.87579000 },
          59: { guaranteedCVRatio: 1.19085000, accumulatedDivRatio: 0.03936200, terminalDivRatio: 35.08513000 },
          60: { guaranteedCVRatio: 1.19530000, accumulatedDivRatio: 0.04128500, terminalDivRatio: 37.43837000 },
          61: { guaranteedCVRatio: 1.19975000, accumulatedDivRatio: 0.04329000, terminalDivRatio: 39.94486000 },
          62: { guaranteedCVRatio: 1.20420000, accumulatedDivRatio: 0.04538000, terminalDivRatio: 42.61456000 },
          63: { guaranteedCVRatio: 1.20865000, accumulatedDivRatio: 0.04755800, terminalDivRatio: 45.45808000 },
          64: { guaranteedCVRatio: 1.21310000, accumulatedDivRatio: 0.04983000, terminalDivRatio: 48.48672000 },
          65: { guaranteedCVRatio: 1.21755000, accumulatedDivRatio: 0.05219700, terminalDivRatio: 51.71251000 },
          66: { guaranteedCVRatio: 1.22200000, accumulatedDivRatio: 0.05466600, terminalDivRatio: 55.14826000 },
          67: { guaranteedCVRatio: 1.22645000, accumulatedDivRatio: 0.05723900, terminalDivRatio: 58.80763000 },
          68: { guaranteedCVRatio: 1.23090000, accumulatedDivRatio: 0.05992200, terminalDivRatio: 62.70514000 },
          69: { guaranteedCVRatio: 1.23535000, accumulatedDivRatio: 0.06271800, terminalDivRatio: 66.85628000 },
          70: { guaranteedCVRatio: 1.23980000, accumulatedDivRatio: 0.06563400, terminalDivRatio: 71.27754000 },
        },

        terminalDivRealizationRate: 1.0,

        // Confirmed from "boc huanyu 5yr PF 1M (total).pdf": 200,000 ->
        // 180,000 (Y1, 10.0%) and 200,000 -> 196,000 (Y2, 2.0%), same promo
        // code ATG2511. The plain "5yr" proposal had no discount applied at
        // quote time (200,000/200,000 flat, no discount) — see note on span 2.
        discountTable: {
          5: { 1: 0.10, 2: 0.02, 3: 0, 4: 0, 5: 0 },
        },

        day1SVRatio: 0,
        pf: null,

        maxYearsToShow: 70,
        defaultCompareYears: [7, 8, 9],
      },
    },
  },

  "ctf_jiangxin": {
    id: "ctf_jiangxin",
    name: "「匠心‧飛越」儲蓄保險計劃",
    company: "CTF Life 富通保險",
    hasRealData: true,
    currency: "USD",
    availableSpans: [1, 5],

    disclaimer: "此文件僅概括說明閣下保單的預計退保發還金額及身故賠償額，旨在顯示任何非保證金額的比重，並闡述在指定情景下非保證金額的變動的影響，而絕不影響保單文件內所訂明的條款及細則。",

    spans: {
      // --- 躉繳 (single premium, product code MW3SPU) ---
      // Data source: male, age 50, non-smoker, $1,000,000 single premium
      // ("ctf jiangxin 1yr 1M.pdf"). Table gives milestone years only (1-5,
      // then every 5, then by round ages 65-128) — same sparse-table pattern
      // as BOC's 3/5/10yr proposals, not every year 1-78.
      1: {
        returnTable: {
           1: { guaranteedCVRatio: 0.11107000, accumulatedDivRatio: 0.05800000, terminalDivRatio: 0.03890000 },
           2: { guaranteedCVRatio: 0.13324000, accumulatedDivRatio: 0.11936400, terminalDivRatio: 0.11408000 },
           3: { guaranteedCVRatio: 0.15539000, accumulatedDivRatio: 0.18428700, terminalDivRatio: 0.18654000 },
           4: { guaranteedCVRatio: 0.44737000, accumulatedDivRatio: 0.19968300, terminalDivRatio: 0.35295000 },
           5: { guaranteedCVRatio: 0.47944000, accumulatedDivRatio: 0.21527900, terminalDivRatio: 0.35415000 },
          10: { guaranteedCVRatio: 1.00003000, accumulatedDivRatio: 0.29635300, terminalDivRatio: 0.36364000 },
          15: { guaranteedCVRatio: 1.00253000, accumulatedDivRatio: 0.38283500, terminalDivRatio: 0.98968000 },
          20: { guaranteedCVRatio: 1.00503000, accumulatedDivRatio: 0.47508700, terminalDivRatio: 2.04352800 },
          25: { guaranteedCVRatio: 1.00753000, accumulatedDivRatio: 0.57349300, terminalDivRatio: 3.24667600 },
          30: { guaranteedCVRatio: 1.01003000, accumulatedDivRatio: 0.67846400, terminalDivRatio: 4.92587200 },
          35: { guaranteedCVRatio: 1.01993000, accumulatedDivRatio: 0.79043800, terminalDivRatio: 7.25188600 },
          40: { guaranteedCVRatio: 1.06166000, accumulatedDivRatio: 0.90988200, terminalDivRatio: 10.44453200 },
          45: { guaranteedCVRatio: 1.10480000, accumulatedDivRatio: 1.03729400, terminalDivRatio: 14.86900400 },
          50: { guaranteedCVRatio: 1.14938000, accumulatedDivRatio: 1.17320600, terminalDivRatio: 20.98409200 },
          55: { guaranteedCVRatio: 1.19540000, accumulatedDivRatio: 1.31818500, terminalDivRatio: 29.41858400 },
          60: { guaranteedCVRatio: 1.24287000, accumulatedDivRatio: 1.47283600, terminalDivRatio: 41.03413300 },
          65: { guaranteedCVRatio: 1.29181000, accumulatedDivRatio: 1.63780500, terminalDivRatio: 57.01145600 },
          70: { guaranteedCVRatio: 1.34226000, accumulatedDivRatio: 1.81377800, terminalDivRatio: 78.96842500 },
          75: { guaranteedCVRatio: 1.39429000, accumulatedDivRatio: 2.00149100, terminalDivRatio: 109.12185000 },
          78: { guaranteedCVRatio: 1.42636000, accumulatedDivRatio: 2.12007800, terminalDivRatio: 132.36919300 },
        },

        terminalDivRealizationRate: 1.0,

        // No discount/promo shown anywhere in this proposal.
        discountTable: {
          1: { 1: 0 },
        },

        // No premium-financing illustration in this proposal — per user,
        // this product is non-PF.
        day1SVRatio: 0,
        pf: null,

        maxYearsToShow: 78,
        defaultCompareYears: [10, 15, 20],
      },

      // --- 5年繳 (5-year installment, product code MW3U) ---
      // Data source: male, age 50, non-smoker, $200,000/year x 5 =
      // $1,000,000 total ("ctf jiangxin 5yr.pdf"). Same milestone-only
      // table granularity as the span above.
      5: {
        returnTable: {
           1: { guaranteedCVRatio: 0.00000000, accumulatedDivRatio: 0.00200000, terminalDivRatio: 0.00110000 },
           2: { guaranteedCVRatio: 0.00172000, accumulatedDivRatio: 0.00600400, terminalDivRatio: 0.00172000 },
           3: { guaranteedCVRatio: 0.00704000, accumulatedDivRatio: 0.01001600, terminalDivRatio: 0.00732000 },
           4: { guaranteedCVRatio: 0.01074000, accumulatedDivRatio: 0.01805600, terminalDivRatio: 0.02898000 },
           5: { guaranteedCVRatio: 0.01310000, accumulatedDivRatio: 0.07658000, terminalDivRatio: 0.18866000 },
          10: { guaranteedCVRatio: 0.79172000, accumulatedDivRatio: 0.26788300, terminalDivRatio: 0.26334000 },
          15: { guaranteedCVRatio: 1.00200000, accumulatedDivRatio: 0.40725600, terminalDivRatio: 0.48864000 },
          20: { guaranteedCVRatio: 1.00700000, accumulatedDivRatio: 0.52004600, terminalDivRatio: 1.34010000 },
          25: { guaranteedCVRatio: 1.01200000, accumulatedDivRatio: 0.63550700, terminalDivRatio: 2.62577700 },
          30: { guaranteedCVRatio: 1.01700000, accumulatedDivRatio: 0.74534900, terminalDivRatio: 4.09238000 },
          35: { guaranteedCVRatio: 1.02200000, accumulatedDivRatio: 0.85693400, terminalDivRatio: 6.14260800 },
          40: { guaranteedCVRatio: 1.02700000, accumulatedDivRatio: 0.97305400, terminalDivRatio: 8.99015500 },
          45: { guaranteedCVRatio: 1.03200000, accumulatedDivRatio: 1.09389500, terminalDivRatio: 12.93164300 },
          50: { guaranteedCVRatio: 1.03700000, accumulatedDivRatio: 1.21964600, terminalDivRatio: 18.37348700 },
          55: { guaranteedCVRatio: 1.04200000, accumulatedDivRatio: 1.35050900, terminalDivRatio: 25.87256100 },
          60: { guaranteedCVRatio: 1.06748000, accumulatedDivRatio: 1.48669100, terminalDivRatio: 36.17142400 },
          65: { guaranteedCVRatio: 1.11068000, accumulatedDivRatio: 1.62840800, terminalDivRatio: 50.31833400 },
          70: { guaranteedCVRatio: 1.15544000, accumulatedDivRatio: 1.77588500, terminalDivRatio: 69.76194100 },
          75: { guaranteedCVRatio: 1.20186000, accumulatedDivRatio: 1.92935700, terminalDivRatio: 96.46485800 },
          78: { guaranteedCVRatio: 1.23062000, accumulatedDivRatio: 2.02441800, terminalDivRatio: 117.05200400 },
        },

        terminalDivRealizationRate: 1.0,

        discountTable: {
          5: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        },

        day1SVRatio: 0,
        pf: null,

        maxYearsToShow: 78,
        defaultCompareYears: [10, 15, 20],
      },
    },
  },

  "ctf_rongyao": {
    id: "ctf_rongyao",
    name: "「榮耀世代」儲蓄壽險計劃",
    company: "CTF Life 富通保險",
    hasRealData: true,
    currency: "USD",
    availableSpans: [1],

    disclaimer: "此文件僅概括說明閣下保單的預計退保發還金額及身故賠償額，旨在顯示任何非保證金額的比重，並闡述在指定情景下非保證金額的變動的影響，而絕不影響保單文件內所訂明的條款及細則。",

    spans: {
      // --- 躉繳 (single premium, product code NSPU) ---
      // Data source: male, age 50, non-smoker, $1,000,000 single premium
      // ("ctf rongyao 1yr 1M.pdf"). Milestone years only, same pattern as
      // 匠心飛越 above.
      1: {
        returnTable: {
           1: { guaranteedCVRatio: 0.83000000, accumulatedDivRatio: 0.00000000, terminalDivRatio: 0.00600000 },
           2: { guaranteedCVRatio: 0.83000000, accumulatedDivRatio: 0.00000000, terminalDivRatio: 0.02595000 },
           3: { guaranteedCVRatio: 0.83000000, accumulatedDivRatio: 0.00000000, terminalDivRatio: 0.15170000 },
           4: { guaranteedCVRatio: 0.86000000, accumulatedDivRatio: 0.00000000, terminalDivRatio: 0.15427000 },
           5: { guaranteedCVRatio: 0.90700000, accumulatedDivRatio: 0.00000000, terminalDivRatio: 0.26504000 },
          10: { guaranteedCVRatio: 1.00714000, accumulatedDivRatio: 0.00000000, terminalDivRatio: 0.64286000 },
          15: { guaranteedCVRatio: 1.01493000, accumulatedDivRatio: 0.00443000, terminalDivRatio: 1.21395000 },
          20: { guaranteedCVRatio: 1.02218000, accumulatedDivRatio: 0.03500000, terminalDivRatio: 2.10666000 },
          25: { guaranteedCVRatio: 1.02890000, accumulatedDivRatio: 0.10170000, terminalDivRatio: 3.09188000 },
          30: { guaranteedCVRatio: 1.03507000, accumulatedDivRatio: 0.20626800, terminalDivRatio: 4.47661000 },
          35: { guaranteedCVRatio: 1.04577000, accumulatedDivRatio: 0.36443400, terminalDivRatio: 6.48044000 },
          40: { guaranteedCVRatio: 1.05611000, accumulatedDivRatio: 0.60070300, terminalDivRatio: 9.22700000 },
          45: { guaranteedCVRatio: 1.08781000, accumulatedDivRatio: 0.94850000, terminalDivRatio: 12.97218000 },
          50: { guaranteedCVRatio: 1.12036000, accumulatedDivRatio: 1.45466800, terminalDivRatio: 18.10785000 },
          55: { guaranteedCVRatio: 1.15378000, accumulatedDivRatio: 2.18486900, terminalDivRatio: 25.15408000 },
          60: { guaranteedCVRatio: 1.18808000, accumulatedDivRatio: 3.23092100, terminalDivRatio: 34.82553000 },
          65: { guaranteedCVRatio: 1.22327000, accumulatedDivRatio: 4.72134200, terminalDivRatio: 48.11266000 },
          70: { guaranteedCVRatio: 1.25934000, accumulatedDivRatio: 6.83651700, terminalDivRatio: 66.40274000 },
          75: { guaranteedCVRatio: 1.29631000, accumulatedDivRatio: 9.83215700, terminalDivRatio: 91.68498000 },
          78: { guaranteedCVRatio: 1.31892000, accumulatedDivRatio: 12.20029800, terminalDivRatio: 111.40420000 },
        },

        terminalDivRealizationRate: 1.0,

        discountTable: {
          1: { 1: 0 },
        },

        // day1SVRatio = 0.83 IS real — the proposal states it explicitly
        // ("於保單生效日之保證現金價值: 830,000.00" on $1,000,000 premium),
        // confirmed by returnTable[1].guaranteedCVRatio matching exactly.
        //
        // Per user: this product is "PF only" but no loan/LTV table exists
        // in the proposal (same as every other PF-flagged product so far —
        // no insurer has actually sent a loan rate card). ltvRatio and
        // defaultLoanRate below are PLACEHOLDER defaults only, not sourced
        // from any document — per instruction, discount% and LTV% are now
        // meant to be hand-entered/adjusted per case via the UI's editable
        // #pf-ltv / discount-override inputs, not pinned to "confirmed"
        // data the way span 1 of 薪火傳承 was.
        day1SVRatio: 0.83,
        pf: {
          enabled: true,
          defaultLoanRate: 0.025,
          processingFeeRate: 0.000,
          processingFeeFixed: 0,
          modes: {
            general: {
              label: "保單貸款 (Policy Loan)",
              ltvRatio: 0.70,
              loanBasis: "day1SV",
            },
          },
        },

        maxYearsToShow: 78,
        defaultCompareYears: [10, 15, 20],
      },
    },
  },

  // NOTE: the proposals provided for this are titled "盈聚‧天下 II 保險計劃"
  // (product code GFC1/GFB2/GFB3/GFB5), NOT "盈聚天下 智盈匯聚（優越版）III壽險計劃"
  // as originally specified — flagged to the user, using the name actually
  // printed on the documents rather than silently renaming it to match.
  "fwd_yingju2": {
    id: "fwd_yingju2",
    name: "盈聚‧天下 II 保險計劃",
    company: "FWD 富衛",
    hasRealData: true,
    currency: "USD",
    availableSpans: [1, 2, 3, 5],

    disclaimer: "此文件僅概括說明閣下保單的預計退保價值及身故權益，旨在顯示任何非保證金額的比重，並闡述在指定情景下非保證金額的變動的影響，而絕不影響保單文件內所訂明的條款及細則。",

    spans: {
      // --- 躉繳 (single premium, GFC1) ---
      // Data source: male, age 51, non-smoker, $1,000,000 single premium
      // ("fwd yingju 1yr 1M.pdf"). Milestone years only (1-5, then every 5,
      // then by round ages 66-138 — insured age 51, table runs to age 138).
      1: {
        returnTable: {
            1: { guaranteedCVRatio: 0.60000000, accumulatedDivRatio: 0.00000000, terminalDivRatio: 0.00000000 },
            2: { guaranteedCVRatio: 0.62400000, accumulatedDivRatio: 0.01400000, terminalDivRatio: 0.00000000 },
            3: { guaranteedCVRatio: 0.64452000, accumulatedDivRatio: 0.04211200, terminalDivRatio: 0.19800000 },
            4: { guaranteedCVRatio: 0.75613000, accumulatedDivRatio: 0.07044800, terminalDivRatio: 0.20800000 },
            5: { guaranteedCVRatio: 0.78196000, accumulatedDivRatio: 0.09901200, terminalDivRatio: 0.25100000 },
           10: { guaranteedCVRatio: 0.80338000, accumulatedDivRatio: 0.24529400, terminalDivRatio: 0.58000000 },
           15: { guaranteedCVRatio: 0.96855000, accumulatedDivRatio: 0.39752200, terminalDivRatio: 0.86600000 },
           20: { guaranteedCVRatio: 1.00564000, accumulatedDivRatio: 0.55593800, terminalDivRatio: 1.73800000 },
           25: { guaranteedCVRatio: 1.01502000, accumulatedDivRatio: 0.72079200, terminalDivRatio: 3.09100000 },
           30: { guaranteedCVRatio: 1.06177000, accumulatedDivRatio: 0.89234700, terminalDivRatio: 4.66024900 },
           35: { guaranteedCVRatio: 1.07995000, accumulatedDivRatio: 1.07087400, terminalDivRatio: 6.91143000 },
           40: { guaranteedCVRatio: 1.10063000, accumulatedDivRatio: 1.25665800, terminalDivRatio: 10.05878500 },
           45: { guaranteedCVRatio: 1.12395000, accumulatedDivRatio: 1.44999300, terminalDivRatio: 14.43715400 },
           50: { guaranteedCVRatio: 1.15005000, accumulatedDivRatio: 1.65118600, terminalDivRatio: 20.50544100 },
           55: { guaranteedCVRatio: 1.16944000, accumulatedDivRatio: 1.86055700, terminalDivRatio: 28.90217200 },
           60: { guaranteedCVRatio: 1.18976000, accumulatedDivRatio: 2.07843800, terminalDivRatio: 40.48164100 },
           65: { guaranteedCVRatio: 1.21103000, accumulatedDivRatio: 2.30517400, terminalDivRatio: 56.42486700 },
           70: { guaranteedCVRatio: 1.23329000, accumulatedDivRatio: 2.54112600, terminalDivRatio: 78.35004600 },
           75: { guaranteedCVRatio: 1.25659000, accumulatedDivRatio: 2.78666900, terminalDivRatio: 108.47437200 },
           80: { guaranteedCVRatio: 1.28097000, accumulatedDivRatio: 3.04219100, terminalDivRatio: 149.83574500 },
           85: { guaranteedCVRatio: 1.30647000, accumulatedDivRatio: 3.30809900, terminalDivRatio: 206.59649200 },
           87: { guaranteedCVRatio: 1.31700000, accumulatedDivRatio: 3.41746500, terminalDivRatio: 234.82640100 },
        },

        terminalDivRealizationRate: 1.0,

        // No discount/promo shown anywhere in this proposal.
        discountTable: {
          1: { 1: 0 },
        },

        // day1SVRatio = 0.6 IS real — the proposal states "保單繕發日之退保
        //價值：600,000" explicitly, matching returnTable[1].guaranteedCVRatio
        // exactly. Confirmed by user: 盈聚‧天下 II is non-PF (the separate
        // 智盈匯聚（優越版）III product below is the PF-enabled one).
        day1SVRatio: 0.6,
        pf: null,

        maxYearsToShow: 87,
        defaultCompareYears: [10, 15, 20],
      },

      // --- 2年供 (2-year installment, GFB2) ---
      // Data source: male, age 51, non-smoker, $500,000/year x 2 =
      // $1,000,000 total ("fwd yingju 2yr 5M.pdf" — filename says "5M" but
      // the proposal itself is actually $500,000/year x 2yr = $1,000,000
      // total, not $5,000,000; flagged, using the real data from the PDF).
      2: {
        returnTable: {
            1: { guaranteedCVRatio: 0.25000000, accumulatedDivRatio: 0.00000000, terminalDivRatio: 0.00000000 },
            2: { guaranteedCVRatio: 0.50000000, accumulatedDivRatio: 0.01400000, terminalDivRatio: 0.00000000 },
            3: { guaranteedCVRatio: 0.58250000, accumulatedDivRatio: 0.04211200, terminalDivRatio: 0.16000000 },
            4: { guaranteedCVRatio: 0.61500000, accumulatedDivRatio: 0.07044800, terminalDivRatio: 0.19000000 },
            5: { guaranteedCVRatio: 0.64750000, accumulatedDivRatio: 0.09901200, terminalDivRatio: 0.29950000 },
           10: { guaranteedCVRatio: 0.72713000, accumulatedDivRatio: 0.24529400, terminalDivRatio: 0.51950000 },
           15: { guaranteedCVRatio: 0.92427000, accumulatedDivRatio: 0.39752200, terminalDivRatio: 0.82300000 },
           20: { guaranteedCVRatio: 1.00783000, accumulatedDivRatio: 0.55593800, terminalDivRatio: 1.59900000 },
           25: { guaranteedCVRatio: 1.02982000, accumulatedDivRatio: 0.72079200, terminalDivRatio: 2.76250000 },
           30: { guaranteedCVRatio: 1.06071500, accumulatedDivRatio: 0.89234700, terminalDivRatio: 4.45900000 },
           35: { guaranteedCVRatio: 1.07783500, accumulatedDivRatio: 1.07087400, terminalDivRatio: 6.63650000 },
           40: { guaranteedCVRatio: 1.09715000, accumulatedDivRatio: 1.25665800, terminalDivRatio: 9.68300000 },
           45: { guaranteedCVRatio: 1.11876000, accumulatedDivRatio: 1.44999300, terminalDivRatio: 13.92300000 },
           50: { guaranteedCVRatio: 1.14279000, accumulatedDivRatio: 1.65118600, terminalDivRatio: 19.80100000 },
           55: { guaranteedCVRatio: 1.16208500, accumulatedDivRatio: 1.86055700, terminalDivRatio: 27.93500000 },
           60: { guaranteedCVRatio: 1.18241000, accumulatedDivRatio: 2.07843800, terminalDivRatio: 39.15350000 },
           65: { guaranteedCVRatio: 1.20381500, accumulatedDivRatio: 2.30517400, terminalDivRatio: 54.60250000 },
           70: { guaranteedCVRatio: 1.22633500, accumulatedDivRatio: 2.54112600, terminalDivRatio: 75.85050000 },
           75: { guaranteedCVRatio: 1.25003000, accumulatedDivRatio: 2.78666900, terminalDivRatio: 105.04700000 },
           80: { guaranteedCVRatio: 1.27494000, accumulatedDivRatio: 3.04219100, terminalDivRatio: 145.13700000 },
           85: { guaranteedCVRatio: 1.30112500, accumulatedDivRatio: 3.30809900, terminalDivRatio: 200.15600000 },
           87: { guaranteedCVRatio: 1.31197000, accumulatedDivRatio: 3.41746500, terminalDivRatio: 227.52050000 },
        },

        terminalDivRealizationRate: 1.0,

        discountTable: {
          2: { 1: 0, 2: 0 },
        },

        // day1SVRatio here = returnTable[1].guaranteedCVRatio (real, not a
        // guess). Non-PF product — see span 1's comment.
        day1SVRatio: 0.25,
        pf: null,

        maxYearsToShow: 87,
        defaultCompareYears: [10, 15, 20],
      },

      // --- 3年供 (3-year installment, GFB3) ---
      // Data source: male, age 51, non-smoker, $1,000,000/year x 3 =
      // $3,000,000 total ("fwd yingju 3yr 3M.pdf").
      3: {
        returnTable: {
            1: { guaranteedCVRatio: 0.00000000, accumulatedDivRatio: 0.00000000, terminalDivRatio: 0.00000000 },
            2: { guaranteedCVRatio: 0.00000000, accumulatedDivRatio: 0.00000000, terminalDivRatio: 0.00000000 },
            3: { guaranteedCVRatio: 0.00000000, accumulatedDivRatio: 0.00000000, terminalDivRatio: 0.00000000 },
            4: { guaranteedCVRatio: 0.16137333, accumulatedDivRatio: 0.02800000, terminalDivRatio: 0.43033333 },
            5: { guaranteedCVRatio: 0.29343667, accumulatedDivRatio: 0.05622400, terminalDivRatio: 0.43200000 },
           10: { guaranteedCVRatio: 0.68600667, accumulatedDivRatio: 0.20076700, terminalDivRatio: 0.52266667 },
           15: { guaranteedCVRatio: 0.88693000, accumulatedDivRatio: 0.35118533, terminalDivRatio: 0.74600000 },
           20: { guaranteedCVRatio: 1.00571667, accumulatedDivRatio: 0.50771733, terminalDivRatio: 1.52100000 },
           25: { guaranteedCVRatio: 1.02728667, accumulatedDivRatio: 0.67061133, terminalDivRatio: 2.55266667 },
           30: { guaranteedCVRatio: 1.05659333, accumulatedDivRatio: 0.84012667, terminalDivRatio: 4.32200000 },
           35: { guaranteedCVRatio: 1.07480333, accumulatedDivRatio: 1.01653167, terminalDivRatio: 6.42900000 },
           40: { guaranteedCVRatio: 1.09577000, accumulatedDivRatio: 1.20010667, terminalDivRatio: 9.37733333 },
           45: { guaranteedCVRatio: 1.11607333, accumulatedDivRatio: 1.39114333, terminalDivRatio: 13.48633333 },
           50: { guaranteedCVRatio: 1.13846333, accumulatedDivRatio: 1.58994433, terminalDivRatio: 19.18466667 },
           55: { guaranteedCVRatio: 1.15739333, accumulatedDivRatio: 1.79682600, terminalDivRatio: 27.06833333 },
           60: { guaranteedCVRatio: 1.17734667, accumulatedDivRatio: 2.01211600, terminalDivRatio: 37.94400000 },
           65: { guaranteedCVRatio: 1.19836667, accumulatedDivRatio: 2.23615700, terminalDivRatio: 52.92200000 },
           70: { guaranteedCVRatio: 1.22049667, accumulatedDivRatio: 2.46930367, terminalDivRatio: 73.52400000 },
           75: { guaranteedCVRatio: 1.24378667, accumulatedDivRatio: 2.71192700, terminalDivRatio: 101.83400000 },
           80: { guaranteedCVRatio: 1.26828333, accumulatedDivRatio: 2.96441167, terminalDivRatio: 140.70866667 },
           85: { guaranteedCVRatio: 1.29404333, accumulatedDivRatio: 3.22715867, terminalDivRatio: 194.06100000 },
           87: { guaranteedCVRatio: 1.30471333, accumulatedDivRatio: 3.33522367, terminalDivRatio: 220.59700000 },
        },

        terminalDivRealizationRate: 1.0,

        discountTable: {
          3: { 1: 0, 2: 0, 3: 0 },
        },

        // Non-PF product — see span 1's comment.
        day1SVRatio: 0,
        pf: null,

        maxYearsToShow: 87,
        defaultCompareYears: [10, 15, 20],
      },

      // --- 5年供 (5-year installment, GFB5) ---
      // Data source: male, age 51, non-smoker, $1,000,000/year x 5 =
      // $5,000,000 total ("fwd yingju 5yr 5M.pdf").
      5: {
        returnTable: {
            1: { guaranteedCVRatio: 0.00000000, accumulatedDivRatio: 0.00000000, terminalDivRatio: 0.00000000 },
            2: { guaranteedCVRatio: 0.00000000, accumulatedDivRatio: 0.00480000, terminalDivRatio: 0.00000000 },
            3: { guaranteedCVRatio: 0.05344400, accumulatedDivRatio: 0.02883840, terminalDivRatio: 0.17520000 },
            4: { guaranteedCVRatio: 0.15005200, accumulatedDivRatio: 0.05306900, terminalDivRatio: 0.18500000 },
            5: { guaranteedCVRatio: 0.28366000, accumulatedDivRatio: 0.07749360, terminalDivRatio: 0.23340000 },
           10: { guaranteedCVRatio: 0.63103800, accumulatedDivRatio: 0.20257880, terminalDivRatio: 0.48780000 },
           15: { guaranteedCVRatio: 0.78259400, accumulatedDivRatio: 0.33274800, terminalDivRatio: 0.77480000 },
           20: { guaranteedCVRatio: 1.00274800, accumulatedDivRatio: 0.46820800, terminalDivRatio: 1.39300000 },
           25: { guaranteedCVRatio: 1.01156400, accumulatedDivRatio: 0.60917380, terminalDivRatio: 2.65240000 },
           30: { guaranteedCVRatio: 1.03597200, accumulatedDivRatio: 0.75586920, terminalDivRatio: 4.06280000 },
           35: { guaranteedCVRatio: 1.05858200, accumulatedDivRatio: 0.90852700, terminalDivRatio: 6.05440000 },
           40: { guaranteedCVRatio: 1.09311400, accumulatedDivRatio: 1.06738960, terminalDivRatio: 8.82960000 },
           45: { guaranteedCVRatio: 1.10647600, accumulatedDivRatio: 1.23270920, terminalDivRatio: 12.71820000 },
           50: { guaranteedCVRatio: 1.12230400, accumulatedDivRatio: 1.40474840, terminalDivRatio: 18.10300000 },
           55: { guaranteedCVRatio: 1.13977400, accumulatedDivRatio: 1.58378000, terminalDivRatio: 25.54140000 },
           60: { guaranteedCVRatio: 1.15519200, accumulatedDivRatio: 1.77008840, terminalDivRatio: 35.80020000 },
           65: { guaranteedCVRatio: 1.17369000, accumulatedDivRatio: 1.96396920, terminalDivRatio: 49.91960000 },
           70: { guaranteedCVRatio: 1.19630200, accumulatedDivRatio: 2.16573060, terminalDivRatio: 69.33120000 },
           75: { guaranteedCVRatio: 1.22096800, accumulatedDivRatio: 2.37569240, terminalDivRatio: 95.99940000 },
           80: { guaranteedCVRatio: 1.24768800, accumulatedDivRatio: 2.59418820, terminalDivRatio: 132.61320000 },
           85: { guaranteedCVRatio: 1.27441000, accumulatedDivRatio: 2.82156460, terminalDivRatio: 182.85940000 },
           87: { guaranteedCVRatio: 1.28674400, accumulatedDivRatio: 2.91508240, terminalDivRatio: 207.84780000 },
        },

        terminalDivRealizationRate: 1.0,

        discountTable: {
          5: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        },

        // Non-PF product — see span 1's comment.
        day1SVRatio: 0,
        pf: null,

        maxYearsToShow: 87,
        defaultCompareYears: [10, 15, 20],
      },
    },
  },

  // 智盈匯聚（優越版）III壽險計劃 — confirmed by user as the actual PF-only
  // product from the original spec (separate from 盈聚‧天下 II above, which
  // is non-PF). Data source: male, age 51, non-smoker, $1,000,000 single
  // premium ("fwd zhiying 1yr 1M.pdf"). Only 1yr (躉繳) provided so far.
  "fwd_zhiying3": {
    id: "fwd_zhiying3",
    name: "智盈匯聚（優越版）III壽險計劃",
    company: "FWD 富衛",
    hasRealData: true,
    currency: "USD",
    availableSpans: [1],

    disclaimer: "此文件僅概括說明閣下保單的預計退保價值及身故權益，旨在顯示任何非保證金額的比重，並闡述在指定情景下非保證金額的變動的影響，而絕不影響保單文件內所訂明的條款及細則。",

    spans: {
      1: {
        returnTable: {
            1: { guaranteedCVRatio: 0.80000000, accumulatedDivRatio: 0.00000000, terminalDivRatio: 0.00000000 },
            2: { guaranteedCVRatio: 0.80000000, accumulatedDivRatio: 0.00000000, terminalDivRatio: 0.00000000 },
            3: { guaranteedCVRatio: 0.86500000, accumulatedDivRatio: 0.00050000, terminalDivRatio: 0.09600000 },
            4: { guaranteedCVRatio: 0.92100000, accumulatedDivRatio: 0.00121800, terminalDivRatio: 0.10900000 },
            5: { guaranteedCVRatio: 0.98000000, accumulatedDivRatio: 0.00216400, terminalDivRatio: 0.13400000 },
           10: { guaranteedCVRatio: 1.06700000, accumulatedDivRatio: 0.00943200, terminalDivRatio: 0.47700000 },
           15: { guaranteedCVRatio: 1.12100000, accumulatedDivRatio: 0.02100700, terminalDivRatio: 0.80200000 },
           20: { guaranteedCVRatio: 1.19100000, accumulatedDivRatio: 0.03665500, terminalDivRatio: 1.21100000 },
           25: { guaranteedCVRatio: 1.27900000, accumulatedDivRatio: 0.05835900, terminalDivRatio: 1.73000000 },
           30: { guaranteedCVRatio: 1.38900000, accumulatedDivRatio: 0.08755100, terminalDivRatio: 2.39200000 },
           35: { guaranteedCVRatio: 1.46900000, accumulatedDivRatio: 0.13016100, terminalDivRatio: 3.29200000 },
           40: { guaranteedCVRatio: 1.55500000, accumulatedDivRatio: 0.18804000, terminalDivRatio: 4.45800000 },
           45: { guaranteedCVRatio: 1.64600000, accumulatedDivRatio: 0.26674400, terminalDivRatio: 5.96900000 },
           50: { guaranteedCVRatio: 1.74300000, accumulatedDivRatio: 0.37454400, terminalDivRatio: 7.92800000 },
           55: { guaranteedCVRatio: 1.84700000, accumulatedDivRatio: 0.52244700, terminalDivRatio: 10.46900000 },
           60: { guaranteedCVRatio: 1.95800000, accumulatedDivRatio: 0.72004100, terminalDivRatio: 13.77300000 },
           65: { guaranteedCVRatio: 2.07700000, accumulatedDivRatio: 0.97535300, terminalDivRatio: 18.08300000 },
           70: { guaranteedCVRatio: 2.20300000, accumulatedDivRatio: 1.29993700, terminalDivRatio: 23.72300000 },
           75: { guaranteedCVRatio: 2.33800000, accumulatedDivRatio: 1.70780100, terminalDivRatio: 31.11800000 },
           80: { guaranteedCVRatio: 2.48300000, accumulatedDivRatio: 2.21587800, terminalDivRatio: 40.83900000 },
           85: { guaranteedCVRatio: 2.63800000, accumulatedDivRatio: 2.84430700, terminalDivRatio: 53.64600000 },
           87: { guaranteedCVRatio: 2.70300000, accumulatedDivRatio: 3.13466100, terminalDivRatio: 59.85000000 },
        },

        terminalDivRealizationRate: 1.0,

        // No discount/promo shown in this proposal.
        discountTable: {
          1: { 1: 0 },
        },

        // day1SVRatio = 0.8 IS real — proposal states "保單繕發日之退保價值：
        // 800,000" explicitly, matching returnTable[1].guaranteedCVRatio.
        // No loan/LTV table in this proposal (same as every other insurer) —
        // ltvRatio/defaultLoanRate below are PLACEHOLDER defaults, meant to
        // be hand-adjusted per case (see #pf-ltv/#pf-rate).
        day1SVRatio: 0.8,
        pf: {
          enabled: true,
          defaultLoanRate: 0.025,
          processingFeeRate: 0.000,
          processingFeeFixed: 0,
          modes: {
            general: {
              label: "保單貸款 (Policy Loan)",
              ltvRatio: 0.70,
              loanBasis: "day1SV",
            },
          },
        },

        maxYearsToShow: 87,
        defaultCompareYears: [10, 15, 20],
      },
    },
  },

  "axa_shengli2_supreme": {
    id: "axa_shengli2_supreme",
    name: "盛利 II 儲蓄保險 – 至尊",
    company: "AXA 安盛",
    hasRealData: true,
    currency: "USD",
    availableSpans: [2, 5, 10],

    // Shared across spans (identical text in all three source proposals).
    disclaimer: "現金價值總額之非保證部分（保額增值紅利及終期紅利之現金價值）並非保證，實際金額可能較高或較低。以上資料不構成保單條款之一部分，並不包括身故保險賠償部分。只包含已披露之保單年度（第1-5、10、15、20、25、30年），並非完整逐年數據。",

    spans: {
      // Data source: male, age 50, non-smoker, $500,000/year x 2 = $1,000,000
      // total. Only milestone policy years disclosed (1-5, 10, 15, 20, 25,
      // 30) — NOT a full year-by-year table like BOC Life's.
      2: {
        returnTable: {
          1: { guaranteedCVRatio: 0.000000, accumulatedDivRatio: 0.000000, terminalDivRatio: 0.000000 },
          2: { guaranteedCVRatio: 0.096000, accumulatedDivRatio: 0.032000, terminalDivRatio: 0.024768 },
          3: { guaranteedCVRatio: 0.115000, accumulatedDivRatio: 0.064000, terminalDivRatio: 0.038304 },
          4: { guaranteedCVRatio: 0.138000, accumulatedDivRatio: 0.096000, terminalDivRatio: 0.040552 },
          5: { guaranteedCVRatio: 0.166000, accumulatedDivRatio: 0.128000, terminalDivRatio: 0.708384 },
          10: { guaranteedCVRatio: 0.297000, accumulatedDivRatio: 0.288000, terminalDivRatio: 0.978880 },
          15: { guaranteedCVRatio: 0.550000, accumulatedDivRatio: 0.368000, terminalDivRatio: 1.265400 },
          20: { guaranteedCVRatio: 1.012000, accumulatedDivRatio: 0.448000, terminalDivRatio: 1.781040 },
          25: { guaranteedCVRatio: 1.019000, accumulatedDivRatio: 0.528000, terminalDivRatio: 3.091144 },
          30: { guaranteedCVRatio: 1.031000, accumulatedDivRatio: 0.608000, terminalDivRatio: 4.770936 },
        },
        terminalDivRealizationRate: 1.0,
        // No discount/rebate is disclosed anywhere in the source proposal,
        // and confirmed by AXA's own Q3 2026 promo ("2026盛夏豐盛賞"): its
        // rebate table for 盛利 II explicitly requires a 5-year or 10-year
        // payment span — 2-year is not eligible for any promotional discount.
        premiumDiscountTiers: [{ minPremium: 0, firstYearDiscount: 0, bonusDiscount: 0 }],
        // PF NOT configured yet. The proposal only discloses an in-built
        // POLICY loan (90% of current CV, available progressively as CV
        // grows, not a fixed day-1 basis) — a different mechanism than the
        // day1SV x LTV% bank-financing model used elsewhere in this app.
        day1SVRatio: 0,
        pf: null,
        maxYearsToShow: 30,
        defaultCompareYears: [5, 10, 20],
      },

      // Data source: male, age 50, non-smoker, $200,000/year x 5 = $1,000,000
      // total. Same milestone-years-only disclosure pattern.
      5: {
        returnTable: {
          1: { guaranteedCVRatio: 0.000000, accumulatedDivRatio: 0.000000, terminalDivRatio: 0.000000 },
          2: { guaranteedCVRatio: 0.000000, accumulatedDivRatio: 0.000000, terminalDivRatio: 0.000000 },
          3: { guaranteedCVRatio: 0.009000, accumulatedDivRatio: 0.032000, terminalDivRatio: 0.020640 },
          4: { guaranteedCVRatio: 0.020000, accumulatedDivRatio: 0.064000, terminalDivRatio: 0.030856 },
          5: { guaranteedCVRatio: 0.045000, accumulatedDivRatio: 0.096000, terminalDivRatio: 0.591840 },
          10: { guaranteedCVRatio: 0.242000, accumulatedDivRatio: 0.256000, terminalDivRatio: 0.822680 },
          15: { guaranteedCVRatio: 0.415000, accumulatedDivRatio: 0.336000, terminalDivRatio: 1.142280 },
          20: { guaranteedCVRatio: 0.648000, accumulatedDivRatio: 0.416000, terminalDivRatio: 1.711944 },
          25: { guaranteedCVRatio: 1.010000, accumulatedDivRatio: 0.496000, terminalDivRatio: 2.389112 },
          30: { guaranteedCVRatio: 1.020000, accumulatedDivRatio: 0.576000, terminalDivRatio: 4.255200 },
        },
        terminalDivRealizationRate: 1.0,
        // No discount shown in the proposal itself. AXA's Q3 2026
        // "2026盛夏豐盛賞" promo DOES offer a tiered rebate for 5-year spans
        // of 盛利 II — up to 27% base + 3-6% bonus (bundled with a
        // medical/life rider), tiered by total first-year annualized
        // premium and currency, valid for policies issued 2026-07-01 to
        // 2026-11-30. NOT applied here yet: the tier table is dense/
        // multi-currency and risks a transcription error on something this
        // size — flag if you want it added and I'll re-verify carefully.
        premiumDiscountTiers: [{ minPremium: 0, firstYearDiscount: 0, bonusDiscount: 0 }],
        day1SVRatio: 0,
        pf: null,
        maxYearsToShow: 30,
        defaultCompareYears: [5, 10, 20],
      },

      // Data source: male, age 50, non-smoker, $100,000/year x 10 = $1,000,000
      // total. Same milestone-years-only disclosure pattern.
      10: {
        returnTable: {
          1: { guaranteedCVRatio: 0.000000, accumulatedDivRatio: 0.000000, terminalDivRatio: 0.000000 },
          2: { guaranteedCVRatio: 0.000000, accumulatedDivRatio: 0.000000, terminalDivRatio: 0.000000 },
          3: { guaranteedCVRatio: 0.003000, accumulatedDivRatio: 0.023000, terminalDivRatio: 0.001023 },
          4: { guaranteedCVRatio: 0.009000, accumulatedDivRatio: 0.046000, terminalDivRatio: 0.002092 },
          5: { guaranteedCVRatio: 0.021000, accumulatedDivRatio: 0.069000, terminalDivRatio: 0.016035 },
          10: { guaranteedCVRatio: 0.232000, accumulatedDivRatio: 0.184000, terminalDivRatio: 0.664224 },
          15: { guaranteedCVRatio: 0.381000, accumulatedDivRatio: 0.241500, terminalDivRatio: 0.948506 },
          20: { guaranteedCVRatio: 0.553000, accumulatedDivRatio: 0.299000, terminalDivRatio: 1.508139 },
          25: { guaranteedCVRatio: 0.804000, accumulatedDivRatio: 0.356500, terminalDivRatio: 2.188035 },
          30: { guaranteedCVRatio: 1.009000, accumulatedDivRatio: 0.414000, terminalDivRatio: 3.387944 },
        },
        terminalDivRealizationRate: 1.0,
        // Same situation as the 5-year span: no discount in the proposal
        // itself, but the Q3 2026 promo has a tiered rebate for 10-year
        // spans too — not applied here yet.
        premiumDiscountTiers: [{ minPremium: 0, firstYearDiscount: 0, bonusDiscount: 0 }],
        day1SVRatio: 0,
        pf: null,
        maxYearsToShow: 30,
        defaultCompareYears: [5, 10, 20],
      },
    },
  },
};

// --- Placeholder plans awaiting real proposal data ---
// One entry per company on the comparison shortlist. Each has the same
// shape as a real plan (zeroed returnTable, single 0% discount tier, no PF)
// so the UI and calculator work identically once real ratios are dropped in
// — just replace the span 1 data per the BOC Life example above.
// hasRealData:false flags these as "no data yet" in the plan picker.
const PLACEHOLDER_COMPANIES = [
  { id: "aia", company: "AIA" },
  { id: "pru", company: "Prudential 保誠" },
  { id: "manulife", company: "Manulife 宏利" },
  { id: "chubb", company: "Chubb 安達" },
  { id: "generali", company: "Generali 忠意" },
  { id: "chinalife", company: "China Life 中國人壽" },
  { id: "zurich", company: "Zurich 蘇黎世" },
];

for (const { id, company } of PLACEHOLDER_COMPANIES) {
  PLANS[id] = {
    id,
    name: "Plan TBD",
    company,
    hasRealData: false,
    currency: "USD",
    availableSpans: [1],
    disclaimer: `No proposal data on file yet for ${company} — send a 1M USD single-premium proposal to populate this plan.`,
    spans: {
      1: {
        returnTable: {
          1: { guaranteedCVRatio: 0, accumulatedDivRatio: 0, terminalDivRatio: 0 },
          5: { guaranteedCVRatio: 0, accumulatedDivRatio: 0, terminalDivRatio: 0 },
          10: { guaranteedCVRatio: 0, accumulatedDivRatio: 0, terminalDivRatio: 0 },
        },
        terminalDivRealizationRate: 1.0,
        premiumDiscountTiers: [{ minPremium: 0, firstYearDiscount: 0, bonusDiscount: 0 }],
        day1SVRatio: 0,
        pf: null,
        maxYearsToShow: 10,
        defaultCompareYears: [1, 5, 10],
      },
    },
  };
}
