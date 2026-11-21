/**
 * Rules fed by the AI pipeline cache (cache/extraction_SUP-xx.json) must reproduce gold lanes, flags, act-by and ₹.
 * One intended difference: SUP-04 CleanSphere's only contract is a scan, so every field comes from OCR and is
 * capped at confidence 0.8 → X1 → needs_review (a human confirms the scan) instead of gold's amber.
 * Skips suppliers without a cache file (seed fallback is covered by rules.gold.test.ts).
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { DATA_DIR, loadDevGold } from "../data";
import { getSupplierView, type SupplierView } from "../seed";
import type { DevGoldSupplier } from "../types";

const IDS = Array.from({ length: 10 }, (_, i) => `SUP-${String(i + 1).padStart(2, "0")}`);
const cached = IDS.filter((id) => existsSync(path.join(DATA_DIR, "cache", `extraction_${id}.json`)));
const OCR_REVIEW = new Set(["SUP-04"]);

let gold: DevGoldSupplier[];
const views = new Map<string, SupplierView>();
beforeAll(async () => {
  gold = (await loadDevGold()).suppliers;
  for (const id of cached) views.set(id, (await getSupplierView(id))!);
});
const G = (id: string) => gold.find((g) => g.supplier_id === id)!;

describe.skipIf(!cached.length)("rules fed by the AI cache", () => {
  it.each(cached)("%s: source is the AI cache with verified quotes", (id) => {
    const v = views.get(id)!;
    expect(v.source).toBe("cache");
    expect(v.pipeline?.quotesFailed).toBe(0);
  });

  it.each(cached)("%s: act-by, annual ₹, flag ₹ impacts match gold", (id) => {
    const v = views.get(id)!;
    expect(v.actBy?.actBy ?? null).toBe(G(id).computed.act_by_date);
    expect(v.money.annualInr).toBe(G(id).computed.annual_value_inr);
    for (const gf of G(id).expected_flags.filter((f) => f.impact_inr != null)) expect(v.flags.find((f) => f.code === gf.code)?.impactInr, `${id} ${gf.code}`).toBe(gf.impact_inr);
  });

  it.each(cached)("%s: flags and lane match gold (OCR-only suppliers add X1 → needs_review)", (id) => {
    const v = views.get(id)!;
    const want = G(id).expected_flags.map((f) => f.code);
    if (OCR_REVIEW.has(id)) {
      expect(v.flags.map((f) => f.code).sort()).toEqual([...want, "X1"].sort());
      expect(v.lane).toBe("needs_review");
      expect(v.reviewFields.every((f) => f.ocr && f.confidence <= 0.8)).toBe(true);
    } else {
      expect(v.flags.map((f) => f.code).sort()).toEqual([...want].sort());
      expect(v.lane).toBe(G(id).expected_lane);
    }
  });
});
