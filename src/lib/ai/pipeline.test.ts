import { describe, expect, it } from "vitest";
import type { PipelineDoc } from "./documents";
import { postCheckGrouping } from "./grouping";
import { cleanPages, stripFooter } from "./pdfText";
import { coerceValue, ExtractionLlmSchema, mergeExtraction, OCR_CONFIDENCE_CAP, precedenceOrder, type DocText, type ExtractionLlm } from "./precedence";
import { ocrTextForVerification, formatOcr } from "./ocr";

describe("pdfText cleaning", () => {
  it("strips the running footer (envelope, title + marker, page x of y) and keeps metadata", () => {
    const f = stripFooter(["clause text", "DocuSign Envelope ID: 7F3A2C19-4B8E-4D21-9A6F-0C5E8B1D2F47", "MASTER SUBSCRIPTION AGREEMENT CONFIDENTIAL", "Page 1 of 17"]);
    expect(f.body).toEqual(["clause text"]);
    expect(f).toMatchObject({ title: "MASTER SUBSCRIPTION AGREEMENT", marker: "CONFIDENTIAL", envelope: "7F3A2C19-4B8E-4D21-9A6F-0C5E8B1D2F47" });
  });
  it("drafts: removes the DRAFT watermark and the DRAFT — NOT FOR SIGNATURE footer", () => {
    const f = stripFooter(["7. GOVERNING LAW", "DRAFT", "MASTER SERVICES AGREEMENT DRAFT — NOT FOR SIGNATURE", "Page 1 of 3"]);
    expect(f.body).toEqual(["7. GOVERNING LAW"]);
    expect(f.marker).toBe("DRAFT");
  });
  it("joins a clause across a page break and flags pages without a text layer", () => {
    const t = cleanPages([
      "including business plans, know-how and the\nTITLE CONFIDENTIAL\nPage 1 of 2",
      "terms of this Agreement.\nTITLE CONFIDENTIAL\nPage 2 of 2",
    ]);
    expect(t.text).toContain("know-how and the\nterms of this Agreement.");
    expect(t.hasTextLayer).toBe(true);
    expect(cleanPages(["", " "]).hasTextLayer).toBe(false);
  });
  it("re-joins line-break hyphens without inventing spaces", () => {
    expect(cleanPages(["customer-relationship-\nmanagement platform " + "x".repeat(40)]).text).toContain("customer-relationship-management platform");
  });
});

describe("OCR cache format", () => {
  it("page markers are for humans only; verification text drops them", () => {
    const c = formatOcr([{ page: 1, text: "Clause 2.2 month to month" }, { page: 2, text: "Registered Post" }]);
    expect(c).toContain("--- Page 2 ---");
    expect(ocrTextForVerification(c)).toBe("Clause 2.2 month to month\nRegistered Post");
  });
});

const cite = (doc_id: string, quote: string, section = "1") => ({ doc_id, section, quote });
const base = (over: Partial<ExtractionLlm> = {}): ExtractionLlm =>
  ExtractionLlmSchema.parse({
    family: [
      { doc_id: "MSA", doc_role: "msa", executed: true, execution_evidence: ["signed"], references: [], signed_date: "2024-01-29" },
      { doc_id: "AMD", doc_role: "amendment", executed: true, execution_evidence: ["countersigned"], references: ["MSA"], signed_date: "2026-04-10" },
      { doc_id: "DRAFT", doc_role: "msa", executed: false, execution_evidence: ["blank signature blocks"], references: [], signed_date: null },
    ],
    documents: [
      {
        doc_id: "MSA",
        fields: [
          { key: "notice_days", value: 30, confidence: 0.95, citation: cite("MSA", "at least thirty (30) days") },
          { key: "governing_law", value: "India", confidence: 0.95, citation: cite("MSA", "governed by the laws of India") },
          { key: "renewal_type", value: "auto", confidence: 0.95, citation: cite("MSA", "renew automatically") },
        ],
        rate_lines: [{ role_in_contract: "Sr. Dev", benchmark_role: "Senior Developer", count: 3, rate_inr_per_hr: 2400, citation: cite("MSA", "Sr. Dev 3 2,400") }],
      },
      {
        doc_id: "AMD",
        fields: [{ key: "notice_days", value: 60, confidence: 0.95, citation: cite("AMD", "sixty (60) days") }],
        rate_lines: [{ role_in_contract: "Sr. Dev", benchmark_role: "Senior Developer", count: null, rate_inr_per_hr: 2250, citation: cite("AMD", "revised from ₹2,400 to ₹2,250") }],
      },
      { doc_id: "DRAFT", fields: [{ key: "notice_days", value: 15, confidence: 0.9, citation: cite("DRAFT", "fifteen (15) days") }] },
    ],
    not_stated: [{ key: "uplift.cap_pct", confidence: 0.9, reason: "no cap" }],
    ...over,
  });
const docs = new Map<string, DocText>([
  ["MSA", { text: "Notice: at least thirty (30) days. This Agreement is governed by the laws of India. It will renew automatically. Sr. Dev 3 2,400", ocr: false }],
  ["AMD", { text: "Notice period changed to sixty (60) days. Rate is revised from ₹2,400 to ₹2,250.", ocr: false }],
  ["DRAFT", { text: "fifteen (15) days", ocr: false }],
]);

describe("precedence + verification", () => {
  it("only executed documents count; amendments win and are recorded as overridden_by", () => {
    expect(precedenceOrder(base().family)).toEqual(["MSA", "AMD"]);
    const m = mergeExtraction(base(), docs, ["MSA", "AMD", "DRAFT"]);
    expect(m.effective_terms.notice_days).toMatchObject({ value: 60, overridden_by: "AMD", verified: true });
    expect(m.effective_terms.governing_law).toMatchObject({ value: "India", citation: { doc_id: "MSA" } });
    expect(m.effective_terms.governing_law.overridden_by).toBeUndefined();
  });
  it("absent fields are null with the model's not-stated confidence; unknown absences get 0.5 (→ review)", () => {
    const m = mergeExtraction(base(), docs, ["MSA", "AMD", "DRAFT"]);
    expect(m.effective_terms.uplift.cap_pct).toMatchObject({ value: null, confidence: 0.9 });
    expect(m.effective_terms.tfc).toMatchObject({ value: null, confidence: 0.5 });
  });
  it("a quote that is not in the document makes the value unclear with confidence 0", () => {
    const llm = base();
    llm.documents[0].fields[1].citation = cite("MSA", "governed by the laws of Singapore");
    const m = mergeExtraction(llm, docs, ["MSA", "AMD"]);
    expect(m.effective_terms.governing_law).toMatchObject({ value: "unclear", confidence: 0, verified: false });
    expect(m.verification.find((v) => v.key === "governing_law")).toMatchObject({ ok: false });
  });
  it("citing a document outside the family fails verification", () => {
    const llm = base();
    llm.documents[0].fields[2].citation = cite("DOC-99", "renew automatically");
    expect(mergeExtraction(llm, docs, ["MSA", "AMD"]).effective_terms.renewal_type).toMatchObject({ value: "unclear", confidence: 0 });
  });
  it("OCR-sourced values are capped at 0.8", () => {
    const m = mergeExtraction(base(), new Map([...docs, ["MSA", { ...docs.get("MSA")!, ocr: true }]]), ["MSA", "AMD"]);
    expect(m.effective_terms.governing_law).toMatchObject({ value: "India", ocr: true, confidence: OCR_CONFIDENCE_CAP });
    expect(m.ocrFields).toContain("governing_law");
  });
  it("rate card: the amendment's revised rate wins, keeping the count from the SOW/MSA", () => {
    expect(mergeExtraction(base(), docs, ["MSA", "AMD"]).rate_card).toEqual([
      { role_in_contract: "Sr. Dev", benchmark_role: "Senior Developer", count: 3, rate_inr_per_hr: 2250, citation: cite("AMD", "revised from ₹2,400 to ₹2,250") },
    ]);
  });
  it("coerces types and never guesses", () => {
    expect(coerceValue("notice_days", "60")).toBe(60);
    expect(coerceValue("notice_days", "sixty")).toBe("unclear");
    expect(coerceValue("renewal_type", "Auto")).toBe("auto");
    expect(coerceValue("renewal_type", "rolling")).toBe("unclear");
    expect(coerceValue("initial_term_end", "31 March 2027")).toBe("unclear");
    expect(coerceValue("tfc", "yes")).toBe(true);
  });
});

const doc = (id: string, text: string): PipelineDoc => ({
  meta: { doc_id: id, filename: "x.pdf", source: "sharepoint", source_path: "/x/", received_date: "2026-01-01", file: `docs/${id}.pdf` },
  hash: "h",
  base64: "",
  pdf: { pages: [{ page: 1, raw: text, text, hasText: true }], text, hasTextLayer: true, footer: { title: null, marker: null, envelopeIds: [] } },
  text,
  textSource: "pdf",
});
const vendors = [{ vendor_id: "V-10041", legal_name: "Nimbus CRM Private Limited", erp_vendor_name: "NIMBUS CRM PRIVATE LIMITED", gstin: "29AADCN4417K1Z8", category: "saas" as const, owner_persona: "owner" as const, criticality: "high" as const }];

describe("grouping post-check", () => {
  const docsG = [doc("DOC-01", "NIMBUS CRM PRIVATE LIMITED, CIN U72900KA2016PTC094417"), doc("DOC-29", "Nimbus Analytics LLP, LLPIN AAB-1234")];
  it("assigns only with a known vendor, high confidence and a verified evidence quote", () => {
    const r = postCheckGrouping(
      {
        assignments: [
          { doc_id: "DOC-01", vendor_id: "V-10041", confidence: 0.97, evidence: ["CIN"], evidence_quotes: ["CIN U72900KA2016PTC094417"], linked_to: [] },
          { doc_id: "DOC-29", vendor_id: null, confidence: 0.2, evidence: ["different LLPIN"], evidence_quotes: [], linked_to: [] },
        ],
      },
      docsG,
      vendors,
    );
    expect(r.map((a) => [a.doc_id, a.supplier_id, a.status])).toEqual([["DOC-01", "SUP-01", "assigned"], ["DOC-29", null, "review"]]);
  });
  it("routes to review: low confidence, unverifiable quote, unknown vendor, missing doc", () => {
    const one = (a: object) => postCheckGrouping({ assignments: [{ doc_id: "DOC-01", vendor_id: "V-10041", confidence: 0.97, evidence: [], evidence_quotes: ["CIN U72900KA2016PTC094417"], linked_to: [], ...a }] }, [docsG[0]], vendors)[0];
    expect(one({ confidence: 0.7 }).status).toBe("review");
    expect(one({ evidence_quotes: ["GSTIN 29AADCN4417K1Z8"] }).review_reason).toMatch(/verbatim/);
    expect(one({ vendor_id: "V-99999" }).review_reason).toMatch(/Unknown vendor/);
    expect(postCheckGrouping({ assignments: [] }, [docsG[0]], vendors)[0].status).toBe("review");
  });
});
