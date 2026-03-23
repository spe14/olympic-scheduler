import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { z } from "zod";
import type { ActionResult } from "@/lib/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseFieldErrors(error: z.ZodError): Record<string, string[]> {
  const tree = z.treeifyError(error) as {
    errors: string[];
    properties?: Record<string, { errors?: string[] }>;
  };
  const fieldErrors: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(tree.properties ?? {})) {
    if (value?.errors) {
      fieldErrors[key] = value.errors;
    }
  }
  return fieldErrors;
}

export function getDateDisplay(group: {
  dateMode: string | null;
  consecutiveDays: number | null;
  startDate: string | null;
  endDate: string | null;
}): string {
  if (group.dateMode === "consecutive" && group.consecutiveDays) {
    return `${group.consecutiveDays} consecutive days`;
  }
  if (group.dateMode === "specific" && group.startDate && group.endDate) {
    const fmt = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    });
    const start = new Date(group.startDate + "T12:00:00");
    const end = new Date(group.endDate + "T12:00:00");
    return `${fmt.format(start)} - ${fmt.format(end)}, 2028`;
  }
  return "Dates not set";
}

// ── Shared time/date formatters ─────────────────────────────────────────────
// Session times and dates display in Pacific Time (LA 2028 Olympics).
// User action timestamps (purchase recordings, price reports) display in
// the user's browser local time.

const PT_TIMEZONE = "America/Los_Angeles";

/**
 * Formats a time string "HH:MM" or "HH:MM:SS" to "H:MM AM/PM".
 * Pure string parsing — no Date object or timezone needed.
 */
export function formatSessionTime(timeStr: string): string {
  const [hours, minutes] = timeStr.split(":");
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${minutes} ${ampm}`;
}

/**
 * Formats a date string "YYYY-MM-DD" to "Wed, Jul 12" in Pacific Time.
 */
export function formatSessionDate(dateStr: string): string {
  const normalized = dateStr.includes("T") ? dateStr : dateStr + "T12:00:00";
  const date = new Date(normalized);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: PT_TIMEZONE,
  });
}

/**
 * Formats a date string "YYYY-MM-DD" to { weekday: "Wed", monthDay: "Jul 12" }
 * for calendar column headers. Uses Pacific Time.
 */
export function formatSessionDateHeader(dateStr: string): {
  weekday: string;
  monthDay: string;
} {
  const date = new Date(dateStr + "T12:00:00");
  const weekday = date.toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: PT_TIMEZONE,
  });
  const month = date.toLocaleDateString("en-US", {
    month: "short",
    timeZone: PT_TIMEZONE,
  });
  const day = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    timeZone: PT_TIMEZONE,
  }).format(date);
  return { weekday, monthDay: `${month} ${day}` };
}

/**
 * Formats a UTC timestamp in Pacific Time with "PT" suffix.
 * Used for purchase timeslot display and other PT-anchored timestamps.
 */
export function formatTimeslotDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return (
    d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: PT_TIMEZONE,
    }) + " PT"
  );
}

/**
 * Formats a timestamp in the user's browser local time.
 * Used for user action timestamps (purchase recordings, price reports, notifications).
 */
export function formatActionTimestamp(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ── Shared collection helpers ───────────────────────────────────────────────

/**
 * Groups an array of items into a Map by a key extracted from each item.
 * Items with the same key are collected into an array.
 * An optional valueFn transforms each item before collecting.
 */
export function groupBy<T, K extends string | number, V>(
  items: T[],
  keyFn: (item: T) => K,
  valueFn: (item: T) => V
): Map<K, V[]>;
export function groupBy<T, K extends string | number>(
  items: T[],
  keyFn: (item: T) => K
): Map<K, T[]>;
export function groupBy<T, K extends string | number, V = T>(
  items: T[],
  keyFn: (item: T) => K,
  valueFn?: (item: T) => V
): Map<K, (T | V)[]> {
  const map = new Map<K, (T | V)[]>();
  for (const item of items) {
    const key = keyFn(item);
    const list = map.get(key) ?? [];
    list.push(valueFn ? valueFn(item) : item);
    map.set(key, list);
  }
  return map;
}

// ── Shared Zod validation helper ────────────────────────────────────────────

/**
 * Runs safeParse on a Zod schema and returns the first error message
 * as an ActionResult if validation fails.
 */
export function parseOrError<T>(
  schema: z.ZodType<T>,
  data: unknown
): { data: T } | { error: ActionResult } {
  const result = schema.safeParse(data);
  if (!result.success) {
    return { error: { error: result.error.issues[0].message } };
  }
  return { data: result.data };
}
