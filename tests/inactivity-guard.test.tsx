// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import InactivityGuard from "@/components/inactivity-guard";
import { INACTIVITY_TIMEOUT } from "@/lib/constants";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock logout action
const mockLogout = vi.fn(() => Promise.resolve());
vi.mock("@/app/(auth)/actions", () => ({
  logout: () => mockLogout(),
}));

describe("InactivityGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("renders nothing", () => {
    const { container } = render(<InactivityGuard />);
    expect(container.innerHTML).toBe("");
  });

  it("calls logout and redirects after inactivity timeout", async () => {
    render(<InactivityGuard />);

    // Fast-forward past the timeout
    vi.advanceTimersByTime(INACTIVITY_TIMEOUT * 1000 + 100);

    // Flush the async logout
    await vi.runAllTimersAsync();

    expect(mockLogout).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/login");
  });

  it("does NOT trigger before timeout expires", () => {
    render(<InactivityGuard />);

    vi.advanceTimersByTime(INACTIVITY_TIMEOUT * 1000 - 1000);

    expect(mockLogout).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("resets timer on user activity (mousedown)", async () => {
    render(<InactivityGuard />);

    // Advance almost to timeout
    vi.advanceTimersByTime(INACTIVITY_TIMEOUT * 1000 - 1000);

    // User interacts
    window.dispatchEvent(new Event("mousedown"));

    // Advance past original timeout time — should not fire
    vi.advanceTimersByTime(2000);
    expect(mockLogout).not.toHaveBeenCalled();

    // Advance to new timeout
    vi.advanceTimersByTime(INACTIVITY_TIMEOUT * 1000);
    await vi.runAllTimersAsync();

    expect(mockLogout).toHaveBeenCalled();
  });

  it("resets timer on keydown", () => {
    render(<InactivityGuard />);

    vi.advanceTimersByTime(INACTIVITY_TIMEOUT * 1000 - 1000);
    window.dispatchEvent(new Event("keydown"));
    vi.advanceTimersByTime(2000);

    expect(mockLogout).not.toHaveBeenCalled();
  });

  it("resets timer on scroll", () => {
    render(<InactivityGuard />);

    vi.advanceTimersByTime(INACTIVITY_TIMEOUT * 1000 - 1000);
    window.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(2000);

    expect(mockLogout).not.toHaveBeenCalled();
  });

  it("resets timer on touchstart", () => {
    render(<InactivityGuard />);

    vi.advanceTimersByTime(INACTIVITY_TIMEOUT * 1000 - 1000);
    window.dispatchEvent(new Event("touchstart"));
    vi.advanceTimersByTime(2000);

    expect(mockLogout).not.toHaveBeenCalled();
  });

  it("cleans up event listeners on unmount", () => {
    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(<InactivityGuard />);

    unmount();

    const removedEvents = removeEventListenerSpy.mock.calls.map((c) => c[0]);
    expect(removedEvents).toContain("mousedown");
    expect(removedEvents).toContain("keydown");
    expect(removedEvents).toContain("scroll");
    expect(removedEvents).toContain("touchstart");

    removeEventListenerSpy.mockRestore();
  });
});
