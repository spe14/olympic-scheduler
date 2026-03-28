// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import MobileWarning from "@/components/mobile-warning";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

const STORAGE_KEY = "mobile-warning-dismissed";

// Helper to set window.innerWidth
function setWindowWidth(width: number) {
  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: width,
  });
}

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
  };
})();

beforeEach(() => {
  Object.defineProperty(window, "localStorage", {
    value: localStorageMock,
    writable: true,
    configurable: true,
  });
  localStorageMock.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("MobileWarning", () => {
  it("shows the warning on mobile-sized screens", () => {
    setWindowWidth(375);
    render(<MobileWarning />);
    expect(screen.getByText("Mobile Experience")).toBeDefined();
    expect(
      screen.getByText(/best experienced on a desktop or laptop/)
    ).toBeDefined();
    expect(screen.getByText("Continue on Mobile")).toBeDefined();
  });

  it("does not show the warning on desktop-sized screens", () => {
    setWindowWidth(1024);
    render(<MobileWarning />);
    expect(screen.queryByText("Mobile Experience")).toBeNull();
  });

  it("does not show the warning at exactly 768px (md breakpoint)", () => {
    setWindowWidth(768);
    render(<MobileWarning />);
    expect(screen.queryByText("Mobile Experience")).toBeNull();
  });

  it("shows the warning at 767px", () => {
    setWindowWidth(767);
    render(<MobileWarning />);
    expect(screen.getByText("Mobile Experience")).toBeDefined();
  });

  it("dismisses the warning and sets localStorage when Continue is clicked", () => {
    setWindowWidth(375);
    render(<MobileWarning />);
    expect(screen.getByText("Mobile Experience")).toBeDefined();

    fireEvent.click(screen.getByText("Continue on Mobile"));

    expect(screen.queryByText("Mobile Experience")).toBeNull();
    expect(localStorageMock.setItem).toHaveBeenCalledWith(STORAGE_KEY, "1");
  });

  it("does not show the warning if it was previously dismissed", () => {
    setWindowWidth(375);
    localStorageMock.setItem(STORAGE_KEY, "1");
    vi.clearAllMocks(); // clear the setItem call from setup
    render(<MobileWarning />);
    expect(screen.queryByText("Mobile Experience")).toBeNull();
    expect(localStorageMock.getItem).toHaveBeenCalledWith(STORAGE_KEY);
  });

  it("shows the warning again after localStorage is cleared (simulates logout)", () => {
    setWindowWidth(375);

    // Dismiss it first
    const { unmount } = render(<MobileWarning />);
    fireEvent.click(screen.getByText("Continue on Mobile"));
    expect(localStorageMock.setItem).toHaveBeenCalledWith(STORAGE_KEY, "1");
    unmount();

    // Clear localStorage (simulates logout clearing the flag)
    localStorageMock.removeItem(STORAGE_KEY);

    // Re-render — warning should appear again
    render(<MobileWarning />);
    expect(screen.getByText("Mobile Experience")).toBeDefined();
  });
});
