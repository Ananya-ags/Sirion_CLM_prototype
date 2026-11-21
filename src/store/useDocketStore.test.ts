import { beforeEach, describe, expect, it } from "vitest";
import type { Request } from "@/lib/types";
import { useDocketStore } from "./useDocketStore";

const req: Request = {
  id: "REQ-1",
  supplier_id: "SUP-1",
  supplier_name: "Acme",
  category: "saas",
  state: "raised",
  lane: null,
  flags: [],
  act_by: "2026-12-10",
  internal_by: "2026-11-25",
  annual_value_inr: 1000000,
  owner: "owner",
  raised_at: "2026-11-25T00:00:00Z",
  updated_at: "2026-11-25T00:00:00Z",
};

describe("store", () => {
  beforeEach(() => useDocketStore.getState().resetDemo());

  it("applies allowed transitions and audits them", () => {
    const s = useDocketStore.getState();
    s.seedRequests([req]);
    expect(s.transition("REQ-1", "owner_pending", "Rules", "Amber lane").ok).toBe(true);
    const after = useDocketStore.getState();
    expect(after.requests["REQ-1"].state).toBe("owner_pending");
    expect(after.audit.map((a) => a.action)).toEqual(["Raised (raised)", "raised → owner_pending"]);
  });

  it("rejects illegal transitions", () => {
    const s = useDocketStore.getState();
    s.seedRequests([req]);
    const r = s.transition("REQ-1", "sent", "legal", "skip ahead");
    expect(r.ok).toBe(false);
    expect(useDocketStore.getState().requests["REQ-1"].state).toBe("raised");
  });

  it("resets demo", () => {
    const s = useDocketStore.getState();
    s.setPersona("legal");
    s.seedRequests([req]);
    s.resetDemo();
    const after = useDocketStore.getState();
    expect(after.persona).toBe("procurement");
    expect(after.requests).toEqual({});
    expect(after.audit).toEqual([]);
  });
});
