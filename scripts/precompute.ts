/**
 * AI pipeline precompute (npm run precompute [-- --only SUP-01,SUP-03] [--force]).
 * Reads ONLY docket_data/data/docs/*.pdf + documents.json (+ vendor master and operational CSVs as trusted
 * reference data). Never docs_src/ and never gold (those are evals-only).
 *   1. PDF text (unpdf, cleaned)      2. OCR for scans (Claude, cached ocr_DOC-xx.txt)
 *   3. Grouping (one Claude call)     4. Extraction per family (Claude, PDFs + text)
 *   5. Quote verification + precedence in code
 * Writes cache/grouping.json, cache/extraction_SUP-xx.json, cache/ocr_*.txt, cache/pipeline_log.json.
 * Unchanged inputs are skipped (sha256 of PDFs + prompt version + model); at most 3 concurrent calls.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

type Json = Record<string, unknown>;

async function main() {
  const { DATA_DIR, loadBenchmarks, loadDocuments, loadSlaPerformance, loadUsage, loadVendorMaster } = await import("../src/lib/data");
  const { MODELS } = await import("../src/lib/config");
  const { hasClaudeKey } = await import("../src/lib/ai/claude");
  const { pdfText } = await import("../src/lib/ai/pdfText");
  const { sha256 } = await import("../src/lib/ai/documents");
  const { ocrPdf, ocrTextForVerification } = await import("../src/lib/ai/ocr");
  const { groupDocuments } = await import("../src/lib/ai/grouping");
  const { extractFamily } = await import("../src/lib/ai/extraction");
  const { mergeExtraction } = await import("../src/lib/ai/precedence");
  const { PROMPT_VERSION } = await import("../src/lib/ai/prompts");
  const { estimateCostUsd } = await import("../src/lib/ai/pricing");
  const { SUPPLIER_REGISTER } = await import("../src/lib/suppliers");
  type CallMeta = import("../src/lib/ai/claude").CallMeta;
  type PipelineDoc = import("../src/lib/ai/documents").PipelineDoc;

  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const onlyIdx = args.indexOf("--only");
  const only = onlyIdx >= 0 ? new Set((args[onlyIdx + 1] ?? "").split(",").map((s) => s.trim()).filter(Boolean)) : null;
  if (!hasClaudeKey()) throw new Error("ANTHROPIC_API_KEY is not set (.env.local)");
  const model = MODELS.extract;
  const CACHE = path.join(DATA_DIR, "cache");
  await mkdir(CACHE, { recursive: true });
  const readJson = async <T,>(f: string, fb: T): Promise<T> => (existsSync(path.join(CACHE, f)) ? JSON.parse(await readFile(path.join(CACHE, f), "utf8")) : fb);
  const writeJson = (f: string, v: unknown) => writeFile(path.join(CACHE, f), JSON.stringify(v, null, 2) + "\n");
  const manifest = await readJson<{ ocr: Json; grouping?: string; extraction: Json }>("pipeline_manifest.json", { ocr: {}, extraction: {} });

  const calls: (CallMeta & { scope: string })[] = [];
  const meta = (scope: string) => (m: CallMeta) => {
    calls.push({ ...m, scope });
    console.log(`  ${m.ok ? "✓" : "✗"} ${m.label}: ${m.inputTokens.toLocaleString()} in / ${m.outputTokens.toLocaleString()} out · ${(m.latencyMs / 1000).toFixed(1)}s · attempts ${m.attempts}${m.errors.length ? ` · ${m.errors.join(" | ").slice(0, 200)}` : ""}`);
  };
  /** Runs jobs with at most n in flight. */
  const limit = async (n: number, jobs: (() => Promise<void>)[]) => {
    let i = 0;
    await Promise.all(Array.from({ length: Math.min(n, jobs.length) }, async () => {
      while (i < jobs.length) await jobs[i++]();
    }));
  };
  const started = new Date().toISOString();
  console.log(`Docket precompute · model ${model}${force ? " · --force" : ""}${only ? ` · --only ${[...only].join(",")}` : ""}`);

  // 1. PDF text
  const metas = await loadDocuments();
  const docs: PipelineDoc[] = [];
  for (const m of metas) {
    const bytes = await readFile(path.join(DATA_DIR, "docs", path.basename(m.file)));
    const pdf = await pdfText(new Uint8Array(bytes));
    docs.push({ meta: m, hash: sha256(bytes), base64: bytes.toString("base64"), pdf, text: pdf.text, textSource: pdf.hasTextLayer ? "pdf" : "none" });
  }
  console.log(`1. PDF text: ${docs.length} documents · ${docs.filter((d) => d.textSource === "pdf").length} with a text layer · scans: ${docs.filter((d) => d.textSource === "none").map((d) => d.meta.doc_id).join(", ") || "none"}`);

  // 2. OCR
  const scans = docs.filter((d) => d.textSource === "none");
  await limit(3, scans.map((d) => async () => {
    const id = d.meta.doc_id;
    const file = `ocr_${id}.txt`;
    const key = sha256(`${d.hash}|${PROMPT_VERSION.ocr}|${model}`);
    if (!force && manifest.ocr[id] === key && existsSync(path.join(CACHE, file))) {
      d.text = ocrTextForVerification(await readFile(path.join(CACHE, file), "utf8"));
      d.textSource = "ocr";
      console.log(`2. OCR ${id}: cached`);
      return;
    }
    try {
      const t = await ocrPdf(id, d.base64, model, meta(`ocr:${id}`));
      await writeFile(path.join(CACHE, file), t + "\n");
      manifest.ocr[id] = key;
      d.text = ocrTextForVerification(t);
      d.textSource = "ocr";
      console.log(`2. OCR ${id}: ${d.text.length} chars`);
    } catch (e) {
      console.log(`2. OCR ${id}: FAILED → human review (${(e as Error).message})`);
    }
  }));

  // 3. Grouping
  const vendors = await loadVendorMaster();
  const groupKey = sha256([PROMPT_VERSION.grouping, model, ...docs.map((d) => `${d.meta.doc_id}:${d.hash}:${sha256(d.text)}`), JSON.stringify(vendors)].join("|"));
  let grouping = await readJson<{ input_key?: string; assignments: import("../src/lib/ai/grouping").GroupAssignment[] }>("grouping.json", { assignments: [] });
  if (force || grouping.input_key !== groupKey || !grouping.assignments.length) {
    console.log("3. Grouping: calling Claude");
    const assignments = await groupDocuments(docs, vendors, model, meta("grouping"));
    grouping = { input_key: groupKey, assignments };
    await writeJson("grouping.json", { generated_at: new Date().toISOString(), model, prompt_version: PROMPT_VERSION.grouping, ...grouping });
    manifest.grouping = groupKey;
  } else console.log("3. Grouping: cached");
  const a = grouping.assignments;
  console.log(`   assigned ${a.filter((x) => x.status === "assigned").length} · review ${a.filter((x) => x.status === "review").map((x) => `${x.doc_id} (${x.review_reason})`).join("; ") || "none"}`);

  // 4 + 5. Extraction per family, verification + precedence
  const [sla, usage, bench] = await Promise.all([loadSlaPerformance(), loadUsage(), loadBenchmarks()]);
  const benchmarkRoles = [...new Set(bench.map((b) => b.role))];
  const failures: Json[] = [];
  const targets = SUPPLIER_REGISTER.filter((s) => !only || only.has(s.supplier_id));
  await limit(3, targets.map((s) => async () => {
    const vendor = vendors.find((v) => v.vendor_id === s.vendor_id);
    const fam = docs.filter((d) => a.find((x) => x.doc_id === d.meta.doc_id && x.supplier_id === s.supplier_id));
    if (!vendor || !fam.length) {
      console.log(`4. ${s.supplier_id}: no documents grouped → seed fallback`);
      return;
    }
    const vocab = {
      slaMetrics: [...new Set(sla.filter((r) => r.vendor_id === s.vendor_id).map((r) => r.metric))],
      usageMetrics: [...new Set(usage.filter((r) => r.vendor_id === s.vendor_id).map((r) => r.metric))],
      benchmarkRoles,
    };
    const key = sha256([PROMPT_VERSION.extraction, model, ...fam.map((d) => `${d.meta.doc_id}:${d.hash}:${sha256(d.text)}`), JSON.stringify(vocab)].join("|"));
    const file = `extraction_${s.supplier_id}.json`;
    if (!force && manifest.extraction[s.supplier_id] === key && existsSync(path.join(CACHE, file))) {
      console.log(`4. ${s.supplier_id}: cached (${fam.map((d) => d.meta.doc_id).join(", ")})`);
      return;
    }
    try {
      const llm = await extractFamily(vendor.legal_name, fam, vocab, model, `extract ${s.supplier_id}`, meta(`extract:${s.supplier_id}`));
      const texts = new Map(fam.map((d) => [d.meta.doc_id, { text: d.text, ocr: d.textSource === "ocr" }]));
      const m = mergeExtraction(llm, texts, fam.map((d) => d.meta.doc_id));
      const bad = m.verification.filter((v) => !v.ok);
      bad.forEach((v) => failures.push({ supplier_id: s.supplier_id, ...v }));
      const { verification, ocrFields, ...out } = m;
      await writeJson(file, {
        supplier_id: s.supplier_id,
        ...out,
        pipeline: {
          source: "ai",
          model,
          prompt_version: PROMPT_VERSION.extraction,
          generated_at: new Date().toISOString(),
          input_key: key,
          docs: fam.map((d) => ({ doc_id: d.meta.doc_id, sha256: d.hash, text_source: d.textSource })),
          ocr_fields: ocrFields,
          verification,
          verification_failures: bad.length,
          grouping: a.filter((x) => x.supplier_id === s.supplier_id).map((x) => ({ doc_id: x.doc_id, confidence: x.confidence, evidence: x.evidence })),
          raw: llm,
        },
      });
      manifest.extraction[s.supplier_id] = key;
      console.log(`4. ${s.supplier_id}: ${fam.map((d) => d.meta.doc_id).join(", ")} · ${verification.length} quotes checked · ${bad.length} failed`);
    } catch (e) {
      console.log(`4. ${s.supplier_id}: FAILED → seed fallback (${(e as Error).message})`);
    }
  }));

  // Log + totals
  await writeJson("pipeline_manifest.json", manifest);
  const inTok = calls.reduce((n, c) => n + c.inputTokens, 0);
  const outTok = calls.reduce((n, c) => n + c.outputTokens, 0);
  const cost = calls.reduce((n, c) => n + (estimateCostUsd(c.model, c.inputTokens, c.outputTokens) ?? 0), 0);
  const log = await readJson<{ runs: Json[] }>("pipeline_log.json", { runs: [] });
  log.runs.push({
    started_at: started,
    finished_at: new Date().toISOString(),
    model,
    args,
    calls: calls.map((c) => ({ scope: c.scope, model: c.model, input_tokens: c.inputTokens, output_tokens: c.outputTokens, latency_ms: c.latencyMs, attempts: c.attempts, retries: c.attempts - 1, ok: c.ok, errors: c.errors })),
    verification_failures: failures,
    totals: { calls: calls.length, input_tokens: inTok, output_tokens: outTok, est_cost_usd: Math.round(cost * 1000) / 1000 },
  });
  await writeJson("pipeline_log.json", log);
  console.log(`\nTotal: ${calls.length} calls · ${inTok.toLocaleString()} input + ${outTok.toLocaleString()} output tokens · est. $${cost.toFixed(3)} · ${failures.length} verification failures`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
