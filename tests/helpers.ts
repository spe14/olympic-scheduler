import { vi } from "vitest";

/**
 * Creates a FormData instance from a plain object.
 */
export function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    fd.set(key, value);
  }
  return fd;
}

/**
 * Returns an empty purchase data mock result, matching the shape of
 * getPurchaseDataForSessions return value.
 */
export function emptyPurchaseData() {
  return {
    planEntries: new Map(),
    purchases: new Map(),
    soldOutSessions: new Set<string>(),
    outOfBudgetSessions: new Set<string>(),
    reportedPrices: new Map(),
  };
}

/**
 * Creates a mock for getPurchaseDataForSessions that returns empty purchase data.
 */
export function createPurchaseDataMock() {
  return vi.fn().mockResolvedValue(emptyPurchaseData());
}
