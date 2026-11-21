# Docket: every renewal caught, only the risky ones need you

**Live demo:** _<add the Vercel URL here>_

Docket is an AI-assisted contract **intake** prototype for Velora Consumer Pvt Ltd (fictional: ~2,500 supplier contracts, no CLM, contracts scattered across SharePoint, inboxes and DocuSign, plus an out-of-date Excel tracker). Instead of waiting for someone to file a request, Docket **raises renewal requests itself** before the notice deadline, then routes each one through the right people, with AI reading the contracts and deterministic rules doing every date and ₹ calculation.

## Start here

1. Open the app: a **welcome screen** offers the **3-minute guided tour**. It switches between the four employees for you and starts from a fresh demo state. Reopen it any time with **Tour** in the top bar.
2. Use the sidebar (grouped by employee: open a page and you become its owner) or **“Viewing as · switch employee”** (top right) to explore as:
   - **Priya**, Procurement Lead: decides risky renewals and drafts notices.
   - **Rahul**, Budget Owner: answers 2 questions per renewal, then chooses.
   - **Meera**, Legal Counsel: approves notices before a human sends them.
   - **Akshat**, Finance / AP: checks invoices against the contract.
3. **For evaluators** (sidebar, highlighted): **Prototype Guide & Case Brief** (the case write-up, incl. why intervening at renewal stops the problem at its source, and where Docket's data comes from) and **Evals & Guardrails** (headline scores, then one grouped list of every eval and guardrail: reading contracts, proving answers, knowing when not to answer, safety of AI actions, reliability & cost, business rules).

## 6-step manual demo

1. **Priya: Inbox.** The renewal snapshot (₹ at stake, renewals due, auto-cleared, need your decision). Click **Tracker conflicts → View** to filter the queue to every supplier with a conflict; **Silent renewals → View** shows TalkWave.
2. **TalkWave contract.** Auto-renews, not in the tracker. Open **Renewal** in the Terms tab: a verbatim quote, checked in code; the injection hidden in Annexure 3 is ignored.
3. **Rahul: Requests.** Answer the two questions on TalkWave and choose **Exit**. On Nimbus, note the plain-language seat-utilisation line.
4. **Priya: TalkWave again.** Rahul's decision is on the decision card; press **Draft exit notice** (live Claude wording around locked values, with negotiation-boundary and number checks).
5. **Meera: Legal queue.** Review the letter (locked fields as chips, guardrail badges), then **Approve & mark sent**. The request closes and the audit trail records each step.
6. **Akshat: Finance alerts.** Confirm LearnLeap's *paid after expiry* and Nimbus's *SLA credit not claimed*; both appear in Priya's evidence pack. Then open **Evals & Guardrails**.

Also try Priya's **Needs human review** list: confirm CleanSphere's OCR'd key fields and watch the rules re-run (needs review → amber).

## Who does what

| AI (Claude, server-side) | Rules (TypeScript, deterministic) | Human |
|---|---|---|
| Reads PDFs (OCR for scans), groups documents by legal identifiers, extracts terms with verbatim citations, writes notice wording | Act-by dates (business days, holidays), every ₹ figure, FX, benchmarks, ledger / SLA / utilisation checks, lanes, routing | Confirms OCR / unclear fields, decides, approves and sends. Nothing external is ever automated |

**Negotiation boundary:** Docket informs, routes and uses rights already in the contract (non-renewal notice, enforcing an existing price cap). Renegotiation is handed to Procurement, labelled “Out of scope”.

## Evals (counts, small sets)

| | Result |
|---|---|
| Held-out extraction, **v1 blind** (the honest estimate) | **61 / 75** fields |
| Held-out extraction, **v2 after design fixes** (no longer blind: drafts' terms kept as non-binding, evidence-based review routing, operative + “via” citations) | **73 / 75** |
| Dev set (prompts were tuned on it) | 170 / 170 |
| Grouping (dev) | 29 / 29, 0 wrong; look-alike decoy sent to review |
| Citations | 0 unverified (every quote is checked against the document text in code) |
| Prompt injection | 7 / 7 |
| Draft safety (live) | 6 / 6 drafts passed boundary + numeric checks (1 needed a retry) |
| Stability | 51 / 51 fields identical across 3 runs (v1) |
| Cost | ≈ $1.3 per full pipeline run (OCR + grouping + 10 extractions) |

Finding: the model's self-reported confidence didn't predict its errors, so review routing is evidence-based (OCR, unverified quote, unclear, key field missing). Details on the Evals tab.

## Assumptions

- Velora and all suppliers / documents are synthetic. Demo clock fixed at 25 Nov 2026; USD→INR 84; India CPI 5.2%.
- Internal decision target = act-by − 15 days; red lane at ≤ 14 days to act-by.
- Extraction is pre-computed by the AI pipeline (`npm run precompute`); live AI runs only for drafting (rate-limited to ~10 drafts per IP per hour; beyond that, the labelled template is used).

## Tech

Next.js (App Router) · TypeScript · Tailwind · shadcn/ui · Zustand (persisted demo state) · zod · vitest · `@anthropic-ai/sdk` (Claude) · unpdf.

## Run locally

```bash
npm install
cat > .env.local <<'ENV'
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL_EXTRACT=claude-sonnet-5-5
ENV
npm run dev            # http://localhost:3000
```

Optional:

```bash
npm run precompute     # re-run the AI pipeline (OCR, grouping, extraction) into docket_data/data/cache
                       # (the committed cache was precomputed with claude-sonnet-5-5, the extraction default)
npm run evals          # re-run the evals (budget-guarded) → Evals tab
npm test               # rules engine + pipeline unit tests
```

Without an API key the app still works: extraction comes from the committed cache, and drafting falls back to the labelled template.

## Deploying on Vercel

Import the repo, then set **`ANTHROPIC_API_KEY`** (the only required variable) in **Project → Settings → Environment Variables**, and redeploy. `ANTHROPIC_MODEL_EXTRACT` is optional and only used by a local `npm run precompute`. Keys are only read by server routes; nothing secret reaches the browser.
