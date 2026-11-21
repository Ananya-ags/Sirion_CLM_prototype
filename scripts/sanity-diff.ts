/* eslint-disable @typescript-eslint/no-explicit-any -- dev script over untyped gold/cache JSON */
/**
 * SANITY DIFF (dev only, not the eval): cached AI output vs dev_gold.json.
 * Reads gold — allowed here because this is an evaluation script, never part of the pipeline.
 *   npm run sanity [-- --only SUP-01,SUP-03]
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const DATA = path.join(process.cwd(), "docket_data", "data");
const gold = JSON.parse(readFileSync(path.join(DATA, "gold", "dev_gold.json"), "utf8"));
const args = process.argv.slice(2);
const oi = args.indexOf("--only");
const only = oi >= 0 ? new Set(args[oi + 1].split(",")) : null;
const LEAVES = ["renewal_type", "initial_term_end", "renewal_term_months", "notice_days", "notice_day_type", "notice_method", "notice_address", "uplift.type", "uplift.value_pct", "uplift.cap_pct", "tfc", "tfc_notice_days", "payment_terms_days", "sla_credits", "currency", "governing_law", "annual_value"];
const get = (t: any, k: string) => k.split(".").reduce((o, p) => o?.[p], t);
const norm = (v: unknown) => (typeof v === "string" ? v.trim().toLowerCase().replace(/\s+/g, " ") : v);
const same = (a: unknown, b: unknown) => JSON.stringify(norm(a)) === JSON.stringify(norm(b));

// Grouping
const gpath = path.join(DATA, "cache", "grouping.json");
if (existsSync(gpath)) {
  const g = JSON.parse(readFileSync(gpath, "utf8"));
  let correct = 0, wrong = 0, review = 0, missedReview = 0;
  const lines: string[] = [];
  for (const m of gold.doc_supplier_map) {
    const a = g.assignments.find((x: any) => x.doc_id === m.doc_id);
    const pred = a?.status === "assigned" ? a.supplier_id : null;
    if (pred === m.supplier_id) { correct++; lines.push(`  ✓ ${m.doc_id} → ${pred ?? "null (review)"}`); }
    else if (pred === null) { review++; lines.push(`  ~ ${m.doc_id} → review (gold ${m.supplier_id}) · ${a?.review_reason}`); }
    else { wrong++; lines.push(`  ✗ ${m.doc_id} → ${pred} (gold ${m.supplier_id ?? "null"}) WRONG`); }
    if (m.supplier_id === null && pred !== null) missedReview++;
  }
  console.log(`GROUPING: ${correct}/${gold.doc_supplier_map.length} correct · ${wrong} wrong · ${review} sent to review (gold had a supplier)${missedReview ? ` · ${missedReview} decoy assigned!` : ""}`);
  if (!only) console.log(lines.join("\n"));
}

// Extraction
let tot = 0, ok = 0;
for (const s of gold.suppliers) {
  if (only && !only.has(s.supplier_id)) continue;
  const f = path.join(DATA, "cache", `extraction_${s.supplier_id}.json`);
  if (!existsSync(f)) { console.log(`\n${s.supplier_id} ${s.contract_name}: no cache (seed fallback)`); continue; }
  const e = JSON.parse(readFileSync(f, "utf8"));
  const rows: string[] = [];
  let sOk = 0;
  for (const k of LEAVES) {
    const gv = get(s.effective_terms, k), ev = get(e.effective_terms, k);
    const good = same(gv.value, ev?.value);
    if (good) sOk++;
    const cite = ev?.citation ? `${ev.citation.doc_id} §${ev.citation.section}` : "—";
    const gcite = gv.citation ? `${gv.citation.doc_id} §${gv.citation.section}` : "—";
    rows.push(`  ${good ? "✓" : "✗"} ${k.padEnd(18)} ${JSON.stringify(ev?.value)}${good ? "" : ` (gold ${JSON.stringify(gv.value)})`} · conf ${ev?.confidence ?? "?"} · ${cite}${!good ? ` [gold ${gcite}]` : ""}${ev?.overridden_by ? ` · overridden_by ${ev.overridden_by}` : ""}${ev?.note && !good ? ` · note: ${ev.note}` : ""}`);
  }
  // family roles / executed
  const fam = s.family.map((gf: any) => {
    const ef = e.family.find((x: any) => x.doc_id === gf.doc_id);
    const good = ef && ef.doc_role === gf.doc_role && ef.executed === gf.executed;
    return `${good ? "✓" : "✗"}${gf.doc_id}:${ef?.doc_role ?? "missing"}/${ef?.executed}${good ? "" : ` (gold ${gf.doc_role}/${gf.executed})`}`;
  });
  // extras: quote, rate card, SLA, licensed units
  const extras: string[] = [];
  if (s.quote) extras.push(`${e.quote && e.quote.proposed_uplift_pct === s.quote.proposed_uplift_pct && e.quote.proposed_annual_inr === s.quote.proposed_annual_inr ? "✓" : "✗"} quote ${JSON.stringify(e.quote ? [e.quote.proposed_uplift_pct, e.quote.proposed_annual_inr] : null)} (gold ${JSON.stringify([s.quote.proposed_uplift_pct, s.quote.proposed_annual_inr])})`);
  else if (e.quote) extras.push(`✗ quote extracted but gold has none: ${JSON.stringify(e.quote)}`);
  if (s.rate_card) {
    const want = s.rate_card.map((r: any) => `${r.benchmark_role}:${r.count}@${r.rate_inr_per_hr}`).sort();
    const got = (e.rate_card ?? []).map((r: any) => `${r.benchmark_role}:${r.count}@${r.rate_inr_per_hr}`).sort();
    extras.push(`${same(want, got) ? "✓" : "✗"} rate card ${got.join(", ")}${same(want, got) ? "" : ` (gold ${want.join(", ")})`}`);
  }
  const gp = s.performance;
  if (gp && gp.sla_terms) {
    const t = e.sla_terms;
    const sortBands = (r: any) => (Array.isArray(r) ? [...r].sort((a, b) => a.from_incl - b.from_incl) : typeof r === "string" ? "text" : r);
    const bandsOk = t && same(sortBands(gp.sla_terms.credit_rule), sortBands(t.credit_rule));
    const good = t && t.target === gp.sla_terms.target && t.metric === gp.sla_terms.metric && bandsOk && t.currency === gp.sla_terms.currency;
    extras.push(`${good ? "✓" : "✗"} sla_terms ${t ? `${t.metric} ≥${t.target} ${t.currency} basis:${t.credit_basis} bands:${JSON.stringify(t.credit_rule).slice(0, 120)}` : "null"}${good ? "" : ` (gold ${gp.sla_terms.metric} ≥${gp.sla_terms.target} ${gp.sla_terms.currency} fee ${gp.sla_terms.fee_basis_monthly} rule ${JSON.stringify(gp.sla_terms.credit_rule).slice(0, 120)})`}`);
  } else if (e.sla_terms) extras.push(`· sla_terms extracted (gold: not tracked — ${gp?.reason}): ${e.sla_terms.metric}`);
  if (s.utilisation) {
    const want = s.utilisation.lines.map((l: any) => `${l.metric}:${l.licensed_units}`).sort();
    const got = (e.licensed_units ?? []).map((l: any) => `${l.metric}:${l.licensed_units}`).sort();
    extras.push(`${same(want, got) ? "✓" : "✗"} licensed ${got.join(", ")}${same(want, got) ? "" : ` (gold ${want.join(", ")})`}`);
  }
  tot += LEAVES.length; ok += sOk;
  const vf = e.pipeline?.verification_failures ?? 0;
  console.log(`\n${s.supplier_id} ${s.contract_name}: ${sOk}/${LEAVES.length} fields · verification failures ${vf}`);
  console.log(`  family: ${fam.join(" ")}`);
  console.log(rows.filter((r) => only || r.startsWith("  ✗")).join("\n") || "  (all fields ✓)");
  extras.forEach((x) => console.log(`  ${x}`));
}
if (tot) console.log(`\nFIELDS: ${ok}/${tot} (${((ok / tot) * 100).toFixed(1)}%)`);
