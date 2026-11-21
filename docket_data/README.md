# Docket — demo data pack v2 (Chat A output, spec v1)

Everything in `data/` follows docket-spec.md §10 and the §11 truth table. DEMO_TODAY = 2026-11-25. **v2 changes are listed in `CHANGES.md`**: no `supplier_id` in documents.json, PDFs instead of Markdown, the DOC-29 decoy, `doc_supplier_map`, the grouping eval, and long contracts.

```
data/docs/DOC-xx.pdf      what the app ingests (29 PDFs; DOC-12 is image-only)
data/docs_src/DOC-xx.md   source text — evals/quote checks ONLY, never read by the pipeline
data/*.json, *.csv        tracker, ledger, vendor master, policy, benchmarks, holidays, fx, cpi, personas, documents index
data/gold/                dev_gold.json (+ doc_supplier_map, grouping_eval), heldout_gold.json, heldout/ (15 snippets .md, 3 contracts .pdf + .md)
scripts/build_data.py     clause library → long contracts; all CSV/JSON; computed act-by dates; gold
scripts/render_pdfs.py    docs_src → PDFs (contract / DocuSign / draft / email / image-only scan)
scripts/check_data.py     independent rules engine + grouping eval + PDF checks (2,650 checks, exit 0)
```

Rebuild: `python3 scripts/build_data.py && python3 scripts/render_pdfs.py && python3 scripts/check_data.py`

## Computed act-by dates (unchanged from v1)

| Supplier | Rule | Act-by | Days | Lane |
|---|---|---|---|---|
| SUP-01 Nimbus | 90 cal ("Notice Period", cl. 1.21) before 2027-03-31 | 2026-12-31 | 36 | Red |
| SUP-02 PeopleGrid | 60 cal before 2027-02-28 | 2026-12-30 | 35 | Red |
| SUP-03 CodeCraft | 60 cal (Amendment 1 → MSA cl. 19.3) before 2027-01-31 | 2026-12-02 | 7 | Red |
| SUP-04 CleanSphere | evergreen, no deadline | — | — | Amber |
| SUP-05 SwiftMove | 45 cal before 2027-03-15 | 2027-01-29 | 65 | Green |
| SUP-06 BrightLoop | 60 business days (Schedule 1) before 2027-02-26 | 2026-11-30 | 5 | Red |
| SUP-07 Stratus | 30 cal before 2027-04-30 | 2027-03-31 | 126 | Green |
| SUP-08 Sentinel | unclear (provisional 2026-12-01) | — | — | Needs review |
| SUP-09 TalkWave | 90 cal before 2027-02-28 | 2026-11-30 | 5 | Red |
| SUP-10 LearnLeap | fixed term ended 2026-06-30 | — | — | Red |

## Planted traps

**Extraction traps (v1, still present)**
1. SUP-03: the draft MSA `CodeCraft_MSA_v3_FINAL_final.docx` (DOC-07) is unsigned. It has a DRAFT watermark, empty signature blocks and highlighted comments, and says 45 days / 8% / Net-30. The executed DocuSign MSA (DOC-08) says 30 days and fixed rates.
2. SUP-03: Amendment 1 (DOC-11, email) changes MSA cl. 19.3 from 30 to 60 calendar days and the Sr React rate from ₹2,400 to ₹2,250. The tracker still says 30 (T1).
3. SUP-03: F4 is +15.4% against a ₹1,950 median from 3 comparables. DevOps has only 2 comparables and must not be flagged.
4. SUP-01: the vendor's +9% email has no contract basis (cl. 15.2), giving L3 drift. Uplift is the greater of 7% or CPI with no cap → F2 ₹4,34,000.
5. SUP-02: the quote is +11% against a 5% cap (F3).
6. SUP-04: image-only scan. Evergreen, but the tracker says Expired / N (2 field conflicts). Notice only by registered post (X2).
7. SUP-06: the unsigned "FINAL" redline (DOC-17) is dated after the signed retainer. It adds TfC and changes the Schedule 1 notice deadline to calendar days.
8. SUP-08: cl. 3.2 vs 3.3 are genuinely ambiguous → `unclear` (X1).
9. SUP-09: the contract exists only as an email attachment (`Agreement_executed.pdf`) and is missing from the tracker (L4, T1). It contains the exact injection line in Annexure 3.
10. SUP-10: paid after expiry, Jul–Oct 2026 (L2).

**Long-document traps (v2)**
11. Cross-references: Nimbus notice lives in a defined term ("Notice Period", cl. 1.21) and BrightLoop's in Schedule 1 ("Renewal Notice Deadline").
12. Distractor periods: 90-day deletion and 120-day pricing notice (Nimbus), 45-day Key Resource notice (CodeCraft), 60 *calendar*-day Account Lead notice (BrightLoop), and "headings are for convenience only".
13. Key clauses sit at clause 14 or later, past page 2 of a 15–17-page PDF. A quote can run across a page break with running headers in between.

**Grouping traps (v2)** — truth and evidence in `dev_gold.json → doc_supplier_map`
14. 14 supplier documents have names that don't reveal the supplier: `Completed_7F3A2C19.pdf`, `Scan_20231204_0012.pdf`, `Agreement_executed.pdf`, `Schedule2.pdf`, `Annexure_B.pdf`, and so on.
15. DOC-05 (PeopleGrid order form) is filed in `/Procurement/IT/Nimbus/`.
16. DOC-10 and DOC-11 say only "CodeCraft" and "the MSA dated 29 January 2024". That date matches the executed MSA, not the undated draft.
17. DOC-29 is a decoy: "Nimbus Analytics LLP" with a different LLPIN/GSTIN, filed in the Nimbus folder. Correct result: unmatched → review.
18. Stratus has no GSTIN, so legal name is the only match. GSTINs appear in only 7 of 29 documents.

## Conventions (unchanged from v1)

policy.json `categories` + `global` thresholds; notice-method vocabulary `email | email_or_physical | email_and_physical | registered_post | physical_only`; gold leaves use the extraction shape (confidence 0.5 = model should abstain); "4 tracker conflicts" = field-level conflicts; holidays.json is a fictional corporate list with approximate festival dates.
