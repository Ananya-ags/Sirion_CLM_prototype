import { describe, expect, it, vi } from "vitest";
import * as data from "./data";

describe("data loaders", () => {
  it("return fallbacks instead of crashing when /data is missing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await data.loadDocuments()).toEqual([]);
    expect(await data.loadTracker()).toEqual([]);
    expect(await data.loadLedger()).toEqual([]);
    expect(await data.loadPolicy()).toEqual({});
    expect(await data.loadFx()).toEqual({ USD_INR: 84 });
    expect(await data.loadDocText("../../package.json")).toBeNull();
    warn.mockRestore();
  });
});
