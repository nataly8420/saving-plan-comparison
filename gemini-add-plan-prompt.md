# Prompt for Gemini — adding or removing a plan in this app

Copy everything below into Gemini, then attach the insurer's proposal PDF(s) in the same message.

---

I maintain a client-side savings/insurance plan comparison web app (plain HTML/CSS/JS, no backend, no build step). All plan data lives in one file, `plans.js`, as a JS object literal called `PLANS`. I need you to read an insurer's proposal PDF and produce a ready-to-paste JS object for a new plan (or tell me which block to delete for a removed plan). Follow this exactly — this data feeds real financial numbers shown to real clients, so precision matters more than speed.

## The schema

Each plan is one entry in `PLANS`, keyed by a short id (e.g. `"boclife_ggg_wl"`):

```js
"<plan_id>": {
  id: "<plan_id>",                    // same string as the key
  name: "<exact product name as printed on the proposal>",
  company: "<Insurer name in the format \"English Name 中文名\", e.g. \"BOC Life 中銀人壽\">",
  hasRealData: true,
  currency: "USD",                    // or whatever the proposal's policy currency is
  availableSpans: [1],                // list every payment span you're given data for, e.g. [1, 5]

  disclaimer: "<the insurer's own disclaimer/notes text about non-guaranteed values, copied verbatim from the proposal>",

  spans: {
    // one entry per payment span (key = number of years premium is paid over)
    1: {
      returnTable: {
        // KEY = policy year number. ONLY include years that are ACTUALLY
        // shown in the proposal's table — do not interpolate, estimate, or
        // invent values for years not shown. Milestone-only tables (e.g.
        // years 1-5, then every 5th year) are normal and expected.
        1: { guaranteedCVRatio: 0.83000000, accumulatedDivRatio: 0.00000000, terminalDivRatio: 0.00600000 },
        2: { guaranteedCVRatio: 0.83000000, accumulatedDivRatio: 0.00000000, terminalDivRatio: 0.02595000 },
        // ...every disclosed year goes here, 8 decimal places
      },

      terminalDivRealizationRate: 1.0,   // leave at 1.0 unless the proposal states a different assumed realization %

      discountTable: {
        // KEY = the payment span number again (matches the outer span key).
        // VALUE = one discount rate (0-1) per PAYMENT year (not policy year).
        // If the proposal shows NO discount/promo applied, use 0 for every
        // payment year — do not guess a discount that isn't explicitly shown.
        1: { 1: 0 },
      },

      // day1SVRatio: ONLY set this to a non-zero number if the proposal
      // EXPLICITLY states a "day 1" / "policy inception" surrender value
      // (e.g. a line like "於保單生效日之保證現金價值: 830,000" on a
      // $1,000,000 premium → day1SVRatio = 0.83). If it's not explicitly
      // stated, set it to 0. Do not infer it from year-1 guaranteedCVRatio
      // unless that IS what the explicit statement matches.
      day1SVRatio: 0,

      // pf: set to null unless I've told you this specific plan/span
      // should have premium financing enabled. If enabled, and no LTV/loan
      // rate table exists in the proposal (this is normal — almost none of
      // them include one), use this placeholder shape — ltvRatio and
      // defaultLoanRate are NOT sourced from the document, they're
      // starting defaults the advisor edits per case in the app's UI:
      pf: null,
      // OR, if I say this plan should be PF-enabled:
      // pf: {
      //   enabled: true,
      //   defaultLoanRate: 0.025,
      //   processingFeeRate: 0.000,
      //   processingFeeFixed: 0,
      //   modes: {
      //     general: {
      //       label: "保單貸款 (Policy Loan)",
      //       ltvRatio: 0.70,
      //       // "day1SV" if day1SVRatio above is non-zero, otherwise "netPremium"
      //       loanBasis: "day1SV",
      //     },
      //   },
      // },

      maxYearsToShow: 78,              // the highest policy year number that appears in returnTable
      defaultCompareYears: [10, 15, 20], // 3 reasonable default years for the single-plan chart (pick from years that exist in returnTable)
    },
  },
},
```

### What `guaranteedCVRatio` / `accumulatedDivRatio` / `terminalDivRatio` mean

For every disclosed policy year, the proposal's table shows a breakdown of the surrender/cash value, usually split into 3 columns (naming varies by insurer):
- **保證現�價值 / 保證金額** (guaranteed cash value) → `guaranteedCVRatio`
- **累積週年紅利(及利息) / 歸原紅利** (accumulated/reversionary bonus, non-guaranteed) → `accumulatedDivRatio`
- **終期紅利 / 特別紅利** (terminal/special bonus, non-guaranteed) → `terminalDivRatio`

Each ratio = **(that column's dollar value for that year) ÷ (total gross premium)**. Total gross premium = the full amount paid across the whole payment span (e.g. $500,000/year × 2 years = $1,000,000 total), not the per-year payment.

**Verify your own arithmetic before finalizing**: for at least 3 different years (an early one, a middle one, a late one), recompute `(guaranteedCVRatio + accumulatedDivRatio + terminalDivRatio) × total_premium` and confirm it matches the proposal's own "total" column for that year, to the dollar. If it doesn't match, find your error before outputting anything — do not round or fudge it into matching.

## Step-by-step process

1. **Identify the basics** from the proposal's summary page: exact product name (character-for-character, including any product code in parentheses), insurer name, payment span (躉繳/single premium = span `1`; otherwise the number of years), currency, insured age/gender (for your own reference, not part of the schema).
2. **Read the per-year premium literally, do not compute it.** Find the line that states the annual premium directly (e.g. "投保時之每年保費：333,330.00" or "每年保費"). Copy that exact printed number. Do NOT derive it by dividing a multi-year total premium by the number of payment years — that arithmetic can silently disagree with the real figure by a few cents to a few dollars per year, and this document is used for real client numbers where that matters. If you only see a total premium and no explicit per-year figure anywhere, say so explicitly instead of dividing.
3. **Find the ACTUAL year-by-year table**, not a summary/glossary/notes page. It's usually titled "基本計劃 – 說明摘要" and contains a dense grid with columns like 保單年度/已繳總保費/保證金額/累積週年紅利及利息/終期紅利/總額, typically spanning years 1-10 then every 5th year, sometimes repeated by 年齡 (age) further down the same page. Proposals often also contain shorter "摘要" pages (e.g. a 2-row day-1 or age-65/age-100-only summary) — those are NOT the table to extract from; they're only useful as a cross-check (see step 6). If a PDF has multiple pages that could be the table, check page by page — don't extract from the first plausible-looking page without confirming it has the full year list.
4. **Extract every row exactly as printed** from that table — do not skip rows, do not add rows that aren't there.
5. **Compute the three ratios** for every row per the formula above, to 8 decimal places, using the literal per-year premium × number of payment years as the total premium denominator (not a rounded or computed total).
6. **Check for a discount/promo section on EVERY page of the document, not just near the table.** Discounts are often shown on a separate early summary page (e.g. "保單簽發日期當天之退保價值摘要" or a page comparing "保費" vs a net/discounted figure), look for "推廣優惠", "折扣", "回贈", or any pairing of a gross premium figure with a smaller net premium figure. Do not conclude "no discount shown" until you have looked at every page — a page you skipped is not evidence of absence. If found, compute the exact discount rate per payment year. If the proposal shows a rebate/cashback mechanic instead of an instant discount (this happens — read carefully whether it reduces the premium immediately or is credited toward a future year), tell me which it is rather than assuming.
7. **Check for an explicit day-1 surrender value statement.** If present, set `day1SVRatio`; if absent, leave it 0.
8. **Ask me** whether this plan/span should have `pf` enabled before setting it — don't assume.
9. **Output the complete JS object**, formatted exactly like the schema above, with a short comment above `returnTable` noting the source filename and the premium/span/age/gender it was generated for.
10. **Flag anything unusual** explicitly in your reply (not just in code comments) — e.g. if the product name in the file doesn't match what I told you to expect, if the premium doesn't match what I told you, if there's a data gap, if you had to make any judgment call.

## Mandatory self-verification (do this before you output anything)

Past attempts at this task have produced numbers that looked plausible but didn't match the source. Before finalizing, for at least 5 different years spread across the full range (an early year, two middle years, a late year, and the final/max year) — and separately for any age-based milestone rows (e.g. 年齡 55/65/100) if the document has them — recompute:

`(guaranteedCVRatio + accumulatedDivRatio + terminalDivRatio) × (literal per-year premium × payment span years)`

...and confirm it matches the proposal's own printed "總額"/total column for that exact row, to the dollar (not "close enough" — exact, since the source is already rounded to whole dollars). If ANY of these checks fail to match exactly, do not output the data — go back and find your error (wrong page, wrong column, arithmetic slip, or misread digit) first. State in your reply which rows you checked and that they matched exactly — a vague claim like "verified" without showing the actual row-by-row numbers is not sufficient.

## What NOT to do

- Don't invent, interpolate, or smooth over missing years.
- Don't compute the per-year premium by dividing a total — read the literal printed figure.
- Don't guess a discount rate that isn't explicitly shown, and don't conclude "no discount" without checking every page.
- Don't extract from a summary/glossary page when a denser year-by-year table exists elsewhere in the same document.
- Don't assume `day1SVRatio` from context — it must be an explicit statement in the document.
- Don't touch any other file — I only need the `plans.js` object for this one plan.
- Don't average/round in a way that would make your recomputed total not match the source exactly.
- Don't claim self-verification passed without showing the actual per-row numbers you checked.

## Deleting a plan

If I ask you to remove a plan instead, just tell me the exact key name to delete (e.g. `"ctf_rongyao"`) and confirm nothing else references it — I'll remove the whole block myself.

## One more thing

Once you've given me the object, I'll paste it into the file myself and have it verified (either by re-running the app's automated tests, or by asking Claude to cross-check it against the same PDF) before it goes live — so don't worry about getting UI/formatting details perfect, just get the numbers exactly right.
