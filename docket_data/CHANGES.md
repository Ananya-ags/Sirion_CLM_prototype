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
