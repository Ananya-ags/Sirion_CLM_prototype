# CHANGES — data pack v1 → v2 (for the app-building chat)

The truth hasn't changed: §11 flags and lanes, supplier and doc IDs, act-by dates, ₹ figures, and tracker.csv / ledger.csv / vendor_master.csv / policy.json are identical to v1. What changed is how the documents arrive and what the pipeline has to work out for itself.

## Breaking contract changes

| # | Change | What the app must do |
|---|---|---|
| 1 | **`documents.json` lost `supplier_id`.** Items are now `{doc_id, filename, source, source_path, received_date, file}`. | Group documents to suppliers with AI, using CIN/GSTIN/LLPIN, legal name, DocuSign envelope ID, cross-references to a parent agreement, and email domain/thread. **Never use folder paths or filenames as evidence.** 14 of 28 supplier documents have non-revealing names, and DOC-05 is filed in the Nimbus folder although it belongs to PeopleGrid. |
| 2 | **Docs are now PDFs.** `file` is `docs/DOC-xx.pdf`. | Extract text from the PDF. Strip running headers and footers (`DocuSign Envelope ID: …`, title + `CONFIDENTIAL` / `DRAFT — NOT FOR SIGNATURE`, `Page x of y`) before clause extraction, otherwise quotes that cross a page break get broken up. |
| 3 | **DOC-12 (CleanSphere) and held-out HO-18 are image-only PDFs** with no text layer. | Run OCR (e.g. send the page images to Gemini as images). If OCR isn't wired up, route to **human review**; never guess. |
| 4 | **`data/docs_src/DOC-xx.md` exists**: the Markdown source each PDF was rendered from. | **For evals and quote verification only. The pipeline must NOT read `docs_src/`.** Read only `docs/*.pdf`. |
| 5 | **DOC-29 added**, a decoy: a one-off quotation from **Nimbus Analytics LLP** (look-alike name, its own LLPIN/GSTIN, filed in `/Procurement/IT/Nimbus/`). No tracker row, no ledger entries. | Expected result: **unmatched → human review**. It must not join SUP-01's family. |
| 6 | **`dev_gold.json` gained `doc_supplier_map`**: `[{doc_id, supplier_id \| null, evidence: [string]}]`, plus `grouping_eval` (metric, target, decoys). | Use it as grouping truth in `evals.ts`. |
| 7 | **New eval: grouping accuracy** = documents assigned to the correct supplier ÷ all documents. The decoy must be predicted `null`. Target **100% on dev**; anything uncertain goes to review, not a guess. A wrong assignment is worse than a review. | Add to the Evals tab next to extraction accuracy. Report accuracy, wrong assignments (should be none) and the review list. The reference grouper in `check_data.py` scores 29/29 on source text and 28/29 on PDF text alone (scan + decoy → review, 0 wrong). |
| 8 | **Held-out contracts HO-16/17/18 are now PDFs** (`heldout_gold.json`: `file` → `.pdf`, plus `source_md`, `pdf_kind`). HO-18 is image-only. Snippets HO-01…HO-15 stay `.md`. | Evals read the PDFs. |

## Document content changes (no truth value changed)

- **Three long contracts (6,400–7,000 words, 15–17 pages):** DOC-01 Nimbus MSA, DOC-08 CodeCraft executed MSA and DOC-16 BrightLoop retainer, generated from a clause library in `build_data.py`. Key clauses now sit deep in the document:

| Doc | Renewal | Notice | Uplift | Payment | SLA | Termination | Notices | Law |
|---|---|---|---|---|---|---|---|---|
| DOC-01 | 14.2 | **1.21 "Notice Period"** (+1.33 calendar days) | 15.3 | 16.2 | 17.2 | 19.2 | 29.1–29.2 | 31.1 |
| DOC-08 | 19.3 | 19.3 (amended by DOC-11) | 18.2 | 18.3 | 17.2 | 20.2 | 29.1 | 31.1 |
| DOC-16 | 18.2 | **Schedule 1 "Renewal Notice Deadline"** (via 1.23) | 19.3 | 20.1 | 21.1 | 22.2 | 32.1 | 34.1 |

- **Cross-references the model must follow:** DOC-01 says notice must be given "at least the Notice Period before" the term ends, with Notice Period defined in Clause 1.21. DOC-16 says "no later than the Renewal Notice Deadline", defined in a Schedule 1 table row.
- **Distractor numbers:** DOC-01 has 90 days for backup deletion and TfC, a 120-day pricing notice and a 60-day suspension. DOC-08 has a 45-day Key Resource withdrawal notice (the draft's number). DOC-16 has a 60 *calendar*-day notice for replacing the Account Lead (its real notice is 60 *business* days). All three contain "headings are for convenience only", which is not a termination-for-convenience right.
- **Cross-references renumbered:** DOC-02 (→ 14.2, 15.3), DOC-09/10/11 (→ 19.3), and the DOC-17 redline (→ 18.2, 19.3, 22.2, Schedule 1).
- **Grouping traps:** DOC-10 and DOC-11 name the supplier only as "CodeCraft" / "the Supplier" and link to the MSA only by its date ("Master Services Agreement dated 29 January 2024" = the executed DOC-08; the draft DOC-07 is undated). Stratus has no GSTIN anywhere and matches only by legal name (`Stratus Cloud Pte. Ltd.` ↔ `STRATUS CLOUD PTE LTD`). GSTINs appear in only 7 documents (DOC-04, 08, 14, 25, 26, 28 and the decoy).
- DocuSign documents (DOC-14, 19, 20, 21) now carry full Certificate of Completion blocks.
- **All gold citations** (`section`, `quote`) were updated to the new clause numbers. Every quote is verbatim in `docs_src` and extractable from the PDF.
- L3 detail text for SUP-01 now cites MSA cl. 15.2 (previously 4.2).

## New and changed scripts

`scripts/build_data.py` (clause library + long docs + gold) → `scripts/render_pdfs.py` (reportlab, pdftoppm, Pillow, numpy; nothing new installed) → `scripts/check_data.py` (2,650 checks).


# CHANGES — data pack v2 → v3 (for the app-building chat)

No truth value changed. All §11 flags, lanes, act-by dates and ₹ figures, the tracker, vendor master, documents.json, the held-out set and `doc_supplier_map` are identical to v2. `check_data.py` runs 3,297 checks with exit 0. The v2 data is backed up in `../docket_data_v2_backup/data`.

## 1. Five agreements lengthened → **re-run precompute for SUP-02, SUP-05, SUP-07, SUP-08, SUP-09**

| Doc | Supplier | Words | Pages | Renewal | Notice | Uplift / cap | Payment | TfC | SLA credits | Notices | Law |
|---|---|---|---|---|---|---|---|---|---|---|---|
| DOC-04 | SUP-02 PeopleGrid | 4,395 | 11 | 11.2 | **1.20 "Non-Renewal Notice Period"** | 12.2 | 13.2 | 15.1 | 14.2 + Annexure 1 | 18.1–18.2 | 19.1 |
| DOC-14 | SUP-05 SwiftMove | 4,286 | 11 | 12.2 | **Annexure C table** | 13.2 (fuel index only) | 14.2 | 16.1 | 15.2 | 18.1 | 19.1 |
| DOC-19 | SUP-07 Stratus | 4,262 | 11 | 11.2 | 11.2 | 12.2 + **1.24 "Price Increase Cap"** | 13.1 | 15.1 | 14.2 + Schedule A | 17.1 | 18.1 |
| DOC-22 | SUP-08 Sentinel | 4,261 | 10 | **13.2 vs 13.3 (ambiguous)** | 13.3 | 5.3 | 5.2 | 15.1 | 14.1 | 17.1 + **1.3 "Agency Notice Address"** | 18.1 |
| DOC-25 | SUP-09 TalkWave | 4,177 | 10 | 12.2 | 12.2 | 13.3 | **1.24 "Payment Period"** | 16.1 | 15.2 + Annexure 2 | 18.1 | 19.1 |

- All gold citations (`section`, `quote`) for these docs were updated. Every quote is verbatim in `docs_src` and extractable from the PDF.
- **Kept on purpose.** Sentinel's two conflicting renewal provisions are unchanged (gold `unclear` → X1), and no new text resolves them. TalkWave's injection line is verbatim at Annexure 3, item 3 (gold still auto, 24 months).
- **DOC-05** (PeopleGrid order form) now cites "Clause 11.2 of the Master Agreement" (was 2.2). This is the only change to a short document.
- Only these 6 PDFs were re-rendered: `python3 scripts/render_pdfs.py DOC-04 DOC-05 DOC-14 DOC-19 DOC-22 DOC-25`.

## 2. New files

**`data/sla_performance.csv`** — `report_id,vendor_id,erp_vendor_name,month,metric,target,actual,unit,source,reported_date`
- 84 rows, Nov-2025 → Oct-2026. These are the last 12 *fully reported* months: on DEMO_TODAY (25 Nov) the November report doesn't exist yet. `reported_date` is 5–10 days after month end.
- Covers only suppliers whose executed contract states a % service level: SUP-01 `uptime_pct`, SUP-02 `availability_pct`, SUP-05 `on_time_delivery_pct`, SUP-07 `control_plane_availability_pct`, SUP-08 `guard_shift_coverage_pct`, SUP-09 `ill_uptime_pct:<circuit id>` (one row per ILL circuit).
- All metrics are higher-is-better. `source` ∈ `vendor_monthly_report | admin_console | internal_audit`.
- Not tracked: SUP-03, 04, 06, 10. The reason is in `dev_gold.json → suppliers[].performance.reason`.

**`data/usage.csv`** — `usage_id,vendor_id,erp_vendor_name,month,metric,licensed_units,active_units,source`
- 36 rows, Nov-2025 → Oct-2026, `source = admin_console`.
- Nimbus: `named_users_sales_cloud` (450) and `agents_service_desk` (120), from order form DOC-02.
- PeopleGrid: `active_employees` (3,200), from order form DOC-05.

## 3. ledger.csv — one row appended, no existing row changed

`AP-2026-00146, STRATUS CLOUD PTE LTD, CN-SC-2026-0007, invoice_date 2026-08-18, service_period 2026-07, −31,500 INR, GST 0, USD −375`
- Credit notes are identified by the **`CN-` prefix on `invoice_no`** and carry **negative amounts**. They are appended at the end of the file, not in date order.
- Make sure the ledger rules handle a negative row:
  - L1 totals net it off.
  - L3 ignores it.
  - L4 "recurring months" shouldn't count it as a separate month.
  - "Most common monthly amount" should exclude it.
- L1–L4 results are unchanged for every supplier.

## 4. policy.json → `global` (keys added; nothing existing changed)

`sla_breach_months_red: 3`, `utilisation_flag_pct: 80`, `utilisation_min_months: 3`. `minor_flags` now includes `S1` and `U1`.

## 5. New flags (Rules)

**S1 SLA_CREDIT_UNCLAIMED**
- Fires for a month where actual < target, the executed contract has a credit table, and there is no `CN-` ledger row for that vendor + service period.
- `impact_inr` = credits due on the CONTRACTED monthly fee (not the billed amount; Nimbus is drifting), with USD converted at fx.json.
- Minor: Finance alert, plus evidence on the Procurement card.
- Escalation: ≥ 3 breach months in 12 on a high-criticality vendor → Red. Nobody reaches this.

**U1 LOW_UTILISATION**
- Fires when active/licensed < 80% for ≥ 3 consecutive latest months.
- `impact_inr` = avg unused units over the last 3 months × (annual value ÷ total licensed units on the order form). The order forms don't price lines separately, so this is an implied per-unit cost.
- Minor: a plain-language line for the budget owner next to "Same scope or seats?". Docket only informs.

| Supplier | Result | ₹ |
|---|---|---|
| SUP-01 Nimbus | **S1**: Aug-26 98.72% (10%) + Sep-26 99.31% (5%) of ₹5,16,667, unclaimed | **₹77,500** |
| SUP-01 Nimbus | **U1**: Sales Cloud 316/450 = 70.2%, below 80% for 5 months; avg 134 unused × ₹10,877 | **₹14,57,544** |
| SUP-07 Stratus | Jul-26 99.81%, 10% of USD 3,750, **claimed** via CN → no S1, stays Green | ₹31,500 claimed |
| Others | all months met; PeopleGrid usage ~94% | — |

Note: the U1 plant sits on Nimbus, not PeopleGrid. PeopleGrid licenses 3,200 employees and Velora has about 3,000, so 70% utilisation there wouldn't be credible. Nimbus is already Red, so no lane moves.

## 6. Gold (`dev_gold.json`) — new keys

- **`suppliers[].performance`** = `{sla_terms: {metric, target, currency, credit_rule, fee_basis_monthly, citation}, metrics, months_reported, breach_months: [{month, metric, target, actual, credit_pct, credit_due_inr, credit_due_original, currency, claimed}], credits_due_inr, credits_claimed_inr, unclaimed_inr}`. For untracked suppliers: `{tracked: false, reason}`.
- **`suppliers[].utilisation`** = `{order_form, latest_pct, months_below, unused_value_inr, lines: [...]}` for SUP-01 and SUP-02.
- **`expected_flags`** for SUP-01 now include `S1` and `U1`, each with `detail` and `impact_inr`. `expected_lane` is unchanged for all 10.
- **`meta.v3_flags`** holds the S1/U1 rule text.

## 7. Scripts

- `build_data.py`: 5 new contract configs on the clause library; optional ANNEXURE/lettered schedule labels; `build_performance()`; credit-note append.
- `render_pdfs.py`: optional doc-ID arguments.
- `check_data.py`: section 12, which recomputes S1/U1 independently from the CSVs and contract tables, checks lengths, cross-references, distractors and must-preserve traps, compares against the v2 backup ledger and lanes, and checks every gold quote is verbatim in `docs_src`.
