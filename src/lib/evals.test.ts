import { describe, expect, it } from "vitest";
import { outcome, percentile, score, sectionMatches } from "./evals";

describe("eval scoring", () => {
  it("separates correct abstention, wrong abstention and missed abstention", () => {
    expect(outcome("unclear", "unclear")).toBe("correct_abstention");
    expect(outcome("auto", "unclear")).toBe("missed_abstention");
    expect(outcome("unclear", "auto")).toBe("wrong_abstention");
    expect(outcome("Auto", "auto")).toBe("correct");
    expect(outcome("60", 60)).toBe("correct");
    expect(outcome(null, null)).toBe("correct");
    expect(outcome(5, null)).toBe("wrong");
    expect(score(["correct", "correct_abstention", "wrong"]).accuracy).toBeCloseTo(2 / 3);
  });
  it("section matching normalises clause / schedule labels", () => {
    expect(sectionMatches("cl. 14.2", "14.2")).toBe(true);
    expect(sectionMatches("1.21", "1.21 (via 'Notice Period' in 14.2)")).toBe(true);
    expect(sectionMatches("Annexure C", "Annexure C (Key Commercial Terms) — Non-renewal Notice Period (via 12.2)")).toBe(true);
    expect(sectionMatches("Annex 1", "Schedule 1")).toBe(true);
    expect(sectionMatches("13.3", "13.2–13.3")).toBe(true);
    expect(sectionMatches("1", "Amendment No. 1, para 1")).toBe(true);
    expect(sectionMatches("1.33", "11.2")).toBe(false);
    expect(sectionMatches("Fee table", "Order Schedule — Total annual committed Fee")).toBe(false);
  });
  it("percentiles", () => {
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 50)).toBe(5);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 95)).toBe(10);
  });
});
