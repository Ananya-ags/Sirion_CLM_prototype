import { describe, expect, it, vi } from "vitest";
import * as data from "./data";
import { ExtractionOutputSchema } from "./types";

describe("data loaders (docket_data/data)", () => {
  it("load every real file without validation warnings", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect((await data.loadDocuments()).length).toBeGreaterThan(0);
    expect((await data.loadTracker()).length).toBeGreaterThan(0);
    expect((await data.loadLedger()).length).toBeGreaterThan(0);
    expect((await data.loadVendorMaster()).length).toBeGreaterThan(0);
    expect(Object.keys(await data.loadPolicy()).length).toBe(9);
    expect((await data.loadBenchmarks()).length).toBeGreaterThan(0);
    expect((await data.loadHolidays()).length).toBeGreaterThan(0);
    expect((await data.loadFx()).USD_INR).toBe(84);
    expect((await data.loadCpi()).india_cpi_yoy_pct).toBe(5.2);
    expect((await data.loadPersonas()).map((p) => p.id)).toEqual(["procurement", "owner", "legal", "finance"]);
    expect((await data.loadDevGold()).suppliers.length).toBeGreaterThan(0);
    expect((await data.loadHeldoutGold()).items.length).toBeGreaterThan(0);
    const validationWarnings = warn.mock.calls.map((c) => String(c[0])).filter((m) => !m.includes("cache/"));
    expect(validationWarnings).toEqual([]);
    warn.mockRestore();
  });

  it("reads every document listed in documents.json", async () => {
    for (const doc of await data.loadDocuments()) {
      expect(await data.loadDocText(doc.file), doc.file).toBeTruthy();
    }
  });

  it("dev gold matches the extraction output schema", async () => {
    const { suppliers } = await data.loadDevGold();
    for (const s of suppliers) {
      const r = ExtractionOutputSchema.safeParse(s);
      expect(r.success, `${s.supplier_id}: ${r.success ? "" : JSON.stringify(r.error.issues.slice(0, 2))}`).toBe(true);
    }
  });

  it("falls back instead of crashing, and refuses path traversal", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await data.loadCachedExtractions()).toEqual([]);
    expect(await data.loadDocText("../../../package.json")).toBeNull();
    warn.mockRestore();
  });
});
