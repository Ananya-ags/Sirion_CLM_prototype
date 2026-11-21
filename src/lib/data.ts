/**
 * Server-side loaders for docket_data/data. Never import from client components.
 * Missing or invalid files never crash: they log one warning and return a fallback,
 * because the data arrives in a later phase.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import Papa from "papaparse";
import type { z } from "zod";
import { CPI_INDIA_YOY_PCT, DEFAULT_GLOBAL_POLICY, FX } from "./config";
import {
  BenchmarksSchema,
  CpiSchema,
  DevGoldFileSchema,
  DocumentSchema,
  ExtractionOutputSchema,
  FxSchema,
  HeldoutGoldFileSchema,
  HolidaysFileSchema,
  LedgerRowSchema,
  PersonasFileSchema,
  PolicySchema,
  TrackerRowSchema,
  VendorMasterRowSchema,
  type ExtractionOutput,
} from "./types";

/** Case data lives in docket_data/data (see CLAUDE.md); DOCKET_DATA_DIR overrides it (e.g. to test a new data pack). */
export const DATA_DIR = process.env.DOCKET_DATA_DIR
  ? path.resolve(process.env.DOCKET_DATA_DIR)
  : path.join(process.cwd(), "docket_data", "data");

const warned = new Set<string>();
function warnOnce(key: string, msg: string) {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[docket:data] ${msg}`);
}

async function readText(rel: string): Promise<string | null> {
  try {
    return await fs.readFile(path.join(DATA_DIR, rel), "utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    warnOnce(rel, code === "ENOENT" ? `${rel} not found, using fallback` : `${rel} unreadable (${code})`);
    return null;
  }
}

async function loadJson<S extends z.ZodType>(rel: string, schema: S, fallback: z.output<S>): Promise<z.output<S>> {
  const text = await readText(rel);
  if (text === null) return fallback;
  try {
    const parsed = schema.safeParse(JSON.parse(text));
    if (parsed.success) return parsed.data;
    warnOnce(`${rel}:schema`, `${rel} failed validation: ${parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
  } catch {
    warnOnce(`${rel}:json`, `${rel} is not valid JSON`);
  }
  return fallback;
}

async function loadCsv<S extends z.ZodType>(rel: string, rowSchema: S): Promise<z.output<S>[]> {
  const text = await readText(rel);
  if (text === null) return [];
  const { data } = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  const rows: z.output<S>[] = [];
  let bad = 0;
  for (const raw of data) {
    const r = rowSchema.safeParse(raw);
    if (r.success) rows.push(r.data);
    else bad++;
  }
  if (bad) warnOnce(`${rel}:rows`, `${rel}: skipped ${bad} invalid row(s)`);
  return rows;
}

/** Reads a markdown file from a folder under /data, refusing paths that escape it. */
async function readDoc(folder: string, file: string): Promise<string | null> {
  return readText(path.join(folder, path.basename(file)));
}

export const loadDocuments = () => loadJson("documents.json", DocumentSchema.array(), []);
export const loadDocText = (file: string) => readDoc("docs", file);
export const loadTracker = () => loadCsv("tracker.csv", TrackerRowSchema);
export const loadLedger = () => loadCsv("ledger.csv", LedgerRowSchema);
export const loadVendorMaster = () => loadCsv("vendor_master.csv", VendorMasterRowSchema);
export const loadPolicy = () => loadJson("policy.json", PolicySchema, { categories: {}, global: DEFAULT_GLOBAL_POLICY });
export const loadBenchmarks = () => loadJson("benchmarks.json", BenchmarksSchema, []);
export const loadHolidaysFile = () => loadJson("holidays.json", HolidaysFileSchema, { calendar: "", business_day_rule: "", holidays: [] });
export const loadHolidays = async () => (await loadHolidaysFile()).holidays;
export const loadFx = () => loadJson("fx.json", FxSchema, { USD_INR: FX.USD_INR });
export const loadCpi = () => loadJson("cpi.json", CpiSchema, { india_cpi_yoy_pct: CPI_INDIA_YOY_PCT });
export const loadPersonas = () => loadJson("personas.json", PersonasFileSchema, []);
export const loadDevGold = () => loadJson("gold/dev_gold.json", DevGoldFileSchema, { meta: {}, suppliers: [] });
export const loadHeldoutGold = () => loadJson("gold/heldout_gold.json", HeldoutGoldFileSchema, { meta: {}, items: [] });
export const loadHeldoutDoc = (file: string) => readDoc("gold/heldout", file);

/** Cached AI output, e.g. loadCache("extraction", ExtractionOutputSchema.array(), []). */
export function loadCache<S extends z.ZodType>(name: string, schema: S, fallback: z.output<S>) {
  return loadJson(`cache/${path.basename(name, ".json")}.json`, schema, fallback);
}

export const loadCachedExtractions = (): Promise<ExtractionOutput[]> =>
  loadCache("extraction", ExtractionOutputSchema.array(), []);
