import { describe, expect, it } from "vitest";
import { displayRole } from "./family";
import { getSupplierView } from "./seed";

const d = (doc_id: string, doc_role: string, executed: boolean | "unknown", references: string[] = []) => ({ doc_id, doc_role, executed, references });

describe("displayRole", () => {
  it("a standalone executed 'other' document with no MSA is the Agreement", () => {
    const fam = [d("DOC-12", "other", true), d("DOC-13", "email", false, ["DOC-12"])];
    expect(displayRole(fam[0], fam)).toBe("Agreement");
    expect(displayRole(fam[1], fam)).toBe("Email");
  });
  it("stays 'Other' when it has a parent, is a parent, or an executed MSA exists", () => {
    const annex = [d("DOC-14", "msa", true), d("DOC-15", "other", true, ["DOC-14"])];
    expect(displayRole(annex[1], annex)).toBe("Other");
    const nda = [d("DOC-16", "msa", true), d("DOC-18", "other", true)];
    expect(displayRole(nda[1], nda)).toBe("Other");
    const parent = [d("A", "other", true), d("B", "sow", true, ["A"])];
    expect(displayRole(parent[0], parent)).toBe("Other");
    expect(displayRole(d("X", "other", false), [d("X", "other", false)])).toBe("Other");
  });
  it("real cache: CleanSphere DOC-12 and LearnLeap DOC-26 show as Agreement", async () => {
    for (const [sup, doc] of [["SUP-04", "DOC-12"], ["SUP-10", "DOC-26"]]) {
      const v = (await getSupplierView(sup))!;
      const f = v.family.find((x) => x.doc_id === doc)!;
      expect(["Agreement", "MSA"]).toContain(displayRole(f, v.family));
    }
  });
});
