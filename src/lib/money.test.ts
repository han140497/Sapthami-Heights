import { describe, it, expect } from "vitest";
import { formatPaise, rupeesToPaise, paiseToRupeeInput } from "./money";

describe("formatPaise", () => {
  it("formats with Indian grouping and two decimals", () => {
    expect(formatPaise(123456)).toBe("₹1,234.56");
    expect(formatPaise(100)).toBe("₹1.00");
    expect(formatPaise(5)).toBe("₹0.05");
    expect(formatPaise(0)).toBe("₹0.00");
    expect(formatPaise(250000000)).toBe("₹25,00,000.00"); // 25 lakh, Indian grouping
  });

  it("handles negatives (a flat in advance)", () => {
    expect(formatPaise(-123456)).toBe("-₹1,234.56");
  });
});

describe("rupeesToPaise", () => {
  it("parses rupee strings exactly, without float error", () => {
    expect(rupeesToPaise("1234.56")).toBe(123456);
    expect(rupeesToPaise("0.1")).toBe(10);
    expect(rupeesToPaise("0.01")).toBe(1);
    expect(rupeesToPaise("100")).toBe(10000);
    expect(rupeesToPaise("1,234.56")).toBe(123456);
    // The classic float trap: 0.1 + 0.2 must be exact here.
    expect(rupeesToPaise("0.1") + rupeesToPaise("0.2")).toBe(30);
  });

  it("rejects malformed amounts rather than guessing", () => {
    expect(() => rupeesToPaise("abc")).toThrow();
    expect(() => rupeesToPaise("1.234")).toThrow(); // 3 decimals — sub-paisa
    expect(() => rupeesToPaise("")).toThrow();
  });
});

describe("round-trip", () => {
  it("paise -> input -> paise is identity", () => {
    for (const p of [0, 1, 99, 100, 123456, 25000000]) {
      expect(rupeesToPaise(paiseToRupeeInput(p))).toBe(p);
    }
  });
});
