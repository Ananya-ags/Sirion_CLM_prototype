import { describe, expect, it } from "vitest";
import { applyQuoteCheck, boundaryCheck, extractNumericTokens, numericFidelity, verifyQuote } from "./guardrails";
import { mimeTypeFor } from "./documents";

const DOC = `3.2 Renewal. Each Subscription Term shall automatically renew for successive periods of
twelve (12) months unless either Party gives written notice of non-renewal at least ninety (90) days before the end.`;

describe("verifyQuote", () => {
  it("finds quotes across line breaks, case and curly quotes", () => {
    expect(verifyQuote(DOC, "successive periods of twelve (12) months")).toBe(true);
    expect(verifyQuote(DOC, "EACH SUBSCRIPTION TERM   shall automatically renew")).toBe(true);
    expect(verifyQuote("the Customer’s notice", "the Customer's notice")).toBe(true);
  });
  it("rejects paraphrases, fabrications and empty quotes", () => {
    expect(verifyQuote(DOC, "renews automatically every 12 months")).toBe(false);
    expect(verifyQuote(DOC, "")).toBe(false);
  });
  it("unfound quote → unclear with confidence 0", () => {
    const f = { value: 90, confidence: 0.97, citation: { doc_id: "D", section: "3.2", quote: "ninety (90) business days" } };
    expect(applyQuoteCheck(f, DOC)).toMatchObject({ value: "unclear", confidence: 0 });
    const ok = { ...f, citation: { ...f.citation, quote: "at least ninety (90) days before" } };
    expect(applyQuoteCheck(ok, DOC)).toEqual(ok);
  });
});

describe("numericFidelity", () => {
  const allowed = ["2026-12-31", 90, 6200000, 434000, 7, "2027-03-31", "3.2"];
  it("passes when every value is allowed, in any format", () => {
    const draft = "Notice of non-renewal under clause 3.2: served 31 December 2026, at least 90 days before 31-Mar-2027. Fees ₹62,00,000; uplift 7% (₹4.34L).";
    const r = numericFidelity(draft, allowed);
    expect(r.violations).toEqual([]);
    expect(r.ok).toBe(true);
  });
  it("fails on a changed number, amount or date", () => {
    expect(numericFidelity("Fees ₹62,50,000.", allowed).ok).toBe(false);
    expect(numericFidelity("Served by 30 December 2026.", allowed).violations.map((v) => v.value)).toEqual(["2026-12-30"]);
    expect(numericFidelity("an uplift of 9%", allowed).ok).toBe(false);
  });
  it("parses Indian units and date formats", () => {
    expect(extractNumericTokens("₹1.2 Cr and 62 lakh on 25/11/2026 or November 25, 2026").map((t) => t.value)).toEqual([
      "2026-11-25",
      "2026-11-25",
      12000000,
      6200000,
    ]);
  });
  it("ignores reference identifiers", () => {
    expect(numericFidelity("Ref PO-2025-0587 and DOC-11", []).ok).toBe(true);
  });
});

describe("boundaryCheck", () => {
  it.each([
    "We can offer a discount if you renew early.",
    "Please reduce the price to last year's level.",
    "Kindly lower your rates.",
    "We propose a new fee.",
    "Your revised rate is acceptable.",
    "This is our counter-offer.",
    "We expect better terms.",
    "We would like to renegotiate the price.",
  ])("blocks: %s", (s) => {
    expect(boundaryCheck(s).ok).toBe(false);
  });
  it("allows a notice that only uses existing contractual rights", () => {
    const notice = "Pursuant to clause 3.2, Velora gives notice of non-renewal. Under clause 4.3 the renewal price may not exceed the 5% cap.";
    expect(boundaryCheck(notice)).toEqual({ ok: true, violations: [] });
  });
});

describe("documents", () => {
  it("MIME types are format-neutral", () => {
    expect(mimeTypeFor("DOC-01.md")).toBe("text/markdown");
    expect(mimeTypeFor("scan.PDF")).toBe("application/pdf");
  });
  it("quote check ignores Markdown punctuation (table pipes, bold) that a PDF never contains", () => {
    expect(verifyQuote("Jr. React.js Developer 1 1,200", "| Jr. React.js Developer | 1 | 1,200 |")).toBe(true);
    expect(verifyQuote("annual fee of USD 45,000 payable", "**USD 45,000**")).toBe(true);
  });
});
