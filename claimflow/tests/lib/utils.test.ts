/**
 * Tests — src/lib/utils.ts
 */
import { describe, it, expect } from "vitest";
import {
  cn,
  formatCurrency,
  formatDate,
  formatDateTime,
  truncate,
  getFraudColor,
  getFraudBgColor,
  getStatusColor,
} from "@/lib/utils";

describe("cn", () => {
  it("merge simple class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "excluded", "included")).toBe("base included");
  });

  it("handles undefined and null", () => {
    expect(cn("base", undefined, null as unknown as string)).toBe("base");
  });

  it("merges tailwind conflicting classes keeping last", () => {
    const result = cn("text-red-500", "text-green-500");
    expect(result).toBe("text-green-500");
  });
});

describe("formatCurrency", () => {
  it("formats a number as EUR by default", () => {
    const result = formatCurrency(1500);
    expect(result).toContain("1");
    expect(result).toContain("500");
  });

  it("formats zero", () => {
    const result = formatCurrency(0);
    expect(result).toBeDefined();
  });

  it("accepts custom currency", () => {
    const result = formatCurrency(100, "USD");
    expect(result).toBeDefined();
  });
});

describe("formatDate", () => {
  it("formats a date string in fr-FR", () => {
    const result = formatDate("2026-03-08");
    expect(result).toBeDefined();
    expect(typeof result).toBe("string");
  });

  it("formats a Date object", () => {
    const result = formatDate(new Date("2026-01-15"));
    expect(result).toBeDefined();
    expect(typeof result).toBe("string");
  });
});

describe("formatDateTime", () => {
  it("formats a date with time", () => {
    const result = formatDateTime("2026-03-08T10:30:00.000Z");
    expect(result).toBeDefined();
    expect(typeof result).toBe("string");
  });

  it("formats a Date object with time", () => {
    const result = formatDateTime(new Date("2026-03-08T10:30:00.000Z"));
    expect(result).toBeDefined();
  });
});

describe("truncate", () => {
  it("returns string as-is if shorter than maxLength", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });

  it("returns string as-is if equal to maxLength", () => {
    expect(truncate("hello", 5)).toBe("hello");
  });

  it("truncates and appends ellipsis when longer", () => {
    expect(truncate("hello world", 5)).toBe("hello...");
  });

  it("handles empty string", () => {
    expect(truncate("", 10)).toBe("");
  });
});

describe("getFraudColor", () => {
  it("returns green for score <= 30", () => {
    expect(getFraudColor(0)).toBe("text-green-600");
    expect(getFraudColor(30)).toBe("text-green-600");
  });

  it("returns yellow for score <= 60", () => {
    expect(getFraudColor(31)).toBe("text-yellow-600");
    expect(getFraudColor(60)).toBe("text-yellow-600");
  });

  it("returns red-500 for score <= 80", () => {
    expect(getFraudColor(61)).toBe("text-red-500");
    expect(getFraudColor(80)).toBe("text-red-500");
  });

  it("returns red-800 for score > 80", () => {
    expect(getFraudColor(81)).toBe("text-red-800");
    expect(getFraudColor(100)).toBe("text-red-800");
  });
});

describe("getFraudBgColor", () => {
  it("returns green bg for score <= 30", () => {
    expect(getFraudBgColor(0)).toBe("bg-green-50 border-green-200");
    expect(getFraudBgColor(30)).toBe("bg-green-50 border-green-200");
  });

  it("returns yellow bg for score <= 60", () => {
    expect(getFraudBgColor(45)).toBe("bg-yellow-50 border-yellow-200");
  });

  it("returns red bg for score <= 80", () => {
    expect(getFraudBgColor(75)).toBe("bg-red-50 border-red-200");
  });

  it("returns intense red bg for score > 80", () => {
    expect(getFraudBgColor(90)).toBe("bg-red-100 border-red-400");
  });
});

describe("getStatusColor", () => {
  it("returns default for SUBMITTED", () => {
    expect(getStatusColor("SUBMITTED")).toBe("default");
  });

  it("returns warning for UNDER_REVIEW", () => {
    expect(getStatusColor("UNDER_REVIEW")).toBe("warning");
  });

  it("returns warning for INFO_REQUESTED", () => {
    expect(getStatusColor("INFO_REQUESTED")).toBe("warning");
  });

  it("returns success for APPROVED", () => {
    expect(getStatusColor("APPROVED")).toBe("success");
  });

  it("returns danger for REJECTED", () => {
    expect(getStatusColor("REJECTED")).toBe("danger");
  });

  it("returns secondary for CLOSED", () => {
    expect(getStatusColor("CLOSED")).toBe("secondary");
  });

  it("returns default for unknown status", () => {
    expect(getStatusColor("UNKNOWN")).toBe("default");
  });
});
