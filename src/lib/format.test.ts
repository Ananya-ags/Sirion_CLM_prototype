import { describe, expect, it } from "vitest";
import { formatDate, formatINR, formatINRShort } from "./format";

describe("format", () => {
  it("uses Indian grouping", () => {
    expect(formatINR(6200000)).toBe("₹62,00,000");
  });
  it("shortens to lakh and crore", () => {
    expect(formatINRShort(434000)).toBe("₹4.34L");
    expect(formatINRShort(6200000)).toBe("₹62L");
    expect(formatINRShort(125000000)).toBe("₹12.5Cr");
    expect(formatINRShort(85000)).toBe("₹85,000");
  });
  it("formats dates", () => {
    expect(formatDate("2026-11-25")).toBe("25 Nov 2026");
  });
});
