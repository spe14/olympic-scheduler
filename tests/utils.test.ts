import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  formatSessionTime,
  formatSessionDate,
  formatSessionDateHeader,
  formatTimeslotDateTime,
  formatActionTimestamp,
  groupBy,
  parseOrError,
  getDateDisplay,
  parseFieldErrors,
} from "@/lib/utils";

// ── formatSessionTime ───────────────────────────────────────────────────────

describe("formatSessionTime", () => {
  it("formats morning time as AM", () => {
    expect(formatSessionTime("09:30")).toBe("9:30 AM");
  });

  it("formats afternoon time as PM", () => {
    expect(formatSessionTime("14:00")).toBe("2:00 PM");
  });

  it("formats noon as 12 PM", () => {
    expect(formatSessionTime("12:00")).toBe("12:00 PM");
  });

  it("formats midnight as 12 AM", () => {
    expect(formatSessionTime("00:00")).toBe("12:00 AM");
  });

  it("handles HH:MM:SS format", () => {
    expect(formatSessionTime("16:45:00")).toBe("4:45 PM");
  });
});

// ── formatSessionDate ───────────────────────────────────────────────────────

describe("formatSessionDate", () => {
  it("formats a YYYY-MM-DD date string", () => {
    const result = formatSessionDate("2028-07-15");
    // Should contain day of week and month/day
    expect(result).toMatch(/\w+, \w+ \d+/);
  });

  it("handles ISO date strings with T", () => {
    const result = formatSessionDate("2028-07-15T14:00:00");
    expect(result).toMatch(/\w+, \w+ \d+/);
  });

  it("returns raw string for invalid dates", () => {
    expect(formatSessionDate("not-a-date")).toBe("not-a-date");
  });
});

// ── formatSessionDateHeader ─────────────────────────────────────────────────

describe("formatSessionDateHeader", () => {
  it("returns weekday and monthDay", () => {
    const result = formatSessionDateHeader("2028-07-15");
    expect(result).toHaveProperty("weekday");
    expect(result).toHaveProperty("monthDay");
    expect(typeof result.weekday).toBe("string");
    expect(typeof result.monthDay).toBe("string");
  });
});

// ── formatTimeslotDateTime ──────────────────────────────────────────────────

describe("formatTimeslotDateTime", () => {
  it("formats a Date object with PT suffix", () => {
    const date = new Date("2028-07-15T20:00:00Z");
    const result = formatTimeslotDateTime(date);
    expect(result).toContain("PT");
  });

  it("formats a date string with PT suffix", () => {
    const result = formatTimeslotDateTime("2028-07-15T20:00:00Z");
    expect(result).toContain("PT");
  });

  it("includes month, day, year, and time", () => {
    const result = formatTimeslotDateTime(new Date("2028-07-15T20:00:00Z"));
    // Should have month name, day number, year, and time components
    expect(result).toMatch(/\w+ \d+, \d{4}/);
  });
});

// ── formatActionTimestamp ────────────────────────────────────────────────────

describe("formatActionTimestamp", () => {
  it("formats a Date object", () => {
    const date = new Date("2028-07-15T14:30:00Z");
    const result = formatActionTimestamp(date);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("formats a date string", () => {
    const result = formatActionTimestamp("2028-07-15T14:30:00Z");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});

// ── groupBy ─────────────────────────────────────────────────────────────────

describe("groupBy", () => {
  it("groups items by key function", () => {
    const items = [
      { team: "A", name: "Alice" },
      { team: "B", name: "Bob" },
      { team: "A", name: "Carol" },
    ];
    const result = groupBy(items, (i) => i.team);
    expect(result.get("A")).toHaveLength(2);
    expect(result.get("B")).toHaveLength(1);
  });

  it("applies value transform function", () => {
    const items = [
      { team: "A", name: "Alice" },
      { team: "A", name: "Carol" },
    ];
    const result = groupBy(
      items,
      (i) => i.team,
      (i) => i.name
    );
    expect(result.get("A")).toEqual(["Alice", "Carol"]);
  });

  it("returns empty map for empty input", () => {
    const result = groupBy([], (i: { key: string }) => i.key);
    expect(result.size).toBe(0);
  });

  it("handles numeric keys", () => {
    const items = [
      { score: 10, val: "a" },
      { score: 10, val: "b" },
      { score: 20, val: "c" },
    ];
    const result = groupBy(items, (i) => i.score);
    expect(result.get(10)).toHaveLength(2);
    expect(result.get(20)).toHaveLength(1);
  });
});

// ── parseOrError ────────────────────────────────────────────────────────────

describe("parseOrError", () => {
  const schema = z.object({
    name: z.string().min(1, "Name is required"),
    age: z.number().min(0, "Age must be non-negative"),
  });

  it("returns parsed data on valid input", () => {
    const result = parseOrError(schema, { name: "Alice", age: 30 });
    expect("data" in result).toBe(true);
    if ("data" in result) {
      expect(result.data).toEqual({ name: "Alice", age: 30 });
    }
  });

  it("returns error on invalid input", () => {
    const result = parseOrError(schema, { name: "", age: -1 });
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toHaveProperty("error");
      expect(typeof result.error.error).toBe("string");
    }
  });

  it("returns first error message from issues", () => {
    const result = parseOrError(schema, { name: "", age: 30 });
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error.error).toBe("Name is required");
    }
  });
});

// ── getDateDisplay ──────────────────────────────────────────────────────────

describe("getDateDisplay", () => {
  it("returns consecutive days description", () => {
    const result = getDateDisplay({
      dateMode: "consecutive",
      consecutiveDays: 5,
      startDate: null,
      endDate: null,
    });
    expect(result).toBe("5 consecutive days");
  });

  it("returns specific date range", () => {
    const result = getDateDisplay({
      dateMode: "specific",
      consecutiveDays: null,
      startDate: "2028-07-12",
      endDate: "2028-07-15",
    });
    expect(result).toContain("Jul");
    expect(result).toContain("2028");
  });

  it("returns fallback when dates not set", () => {
    const result = getDateDisplay({
      dateMode: null,
      consecutiveDays: null,
      startDate: null,
      endDate: null,
    });
    expect(result).toBe("Dates not set");
  });

  it("returns fallback for consecutive mode without days", () => {
    const result = getDateDisplay({
      dateMode: "consecutive",
      consecutiveDays: null,
      startDate: null,
      endDate: null,
    });
    expect(result).toBe("Dates not set");
  });

  it("returns fallback for specific mode without dates", () => {
    const result = getDateDisplay({
      dateMode: "specific",
      consecutiveDays: null,
      startDate: null,
      endDate: null,
    });
    expect(result).toBe("Dates not set");
  });
});

// ── parseFieldErrors ────────────────────────────────────────────────────────

describe("parseFieldErrors", () => {
  it("extracts field errors from ZodError", () => {
    const schema = z.object({
      email: z.string().email("Invalid email"),
      password: z.string().min(8, "Too short"),
    });
    const result = schema.safeParse({ email: "bad", password: "ab" });
    if (!result.success) {
      const errors = parseFieldErrors(result.error);
      expect(errors.email).toBeDefined();
      expect(errors.password).toBeDefined();
    }
  });

  it("returns empty object for no field errors", () => {
    const schema = z.string().min(1, "Required");
    const result = schema.safeParse("");
    if (!result.success) {
      const errors = parseFieldErrors(result.error);
      // Root-level errors don't have field keys
      expect(Object.keys(errors).length).toBe(0);
    }
  });
});
