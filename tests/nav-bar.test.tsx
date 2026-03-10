// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import NavBar from "@/components/nav-bar";
import { setGlobalGuard } from "@/lib/navigation-guard-store";

// ─── Mocks ──────────────────────────────────────────────────────────

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    onClick,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLAnchorElement>;
    className?: string;
  }) => (
    <a href={href} onClick={onClick} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("@/app/(auth)/actions", () => ({
  logout: vi.fn(),
}));

vi.mock("@/components/user-avatar", () => ({
  default: () => <div data-testid="user-avatar" />,
}));

const defaultProps = {
  firstName: "Jane",
  lastName: "Doe",
  username: "janedoe",
  avatarColor: "blue" as const,
};

// ─── Tests ──────────────────────────────────────────────────────────

describe("NavBar — home link navigation guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setGlobalGuard(null);
  });

  afterEach(() => {
    cleanup();
    setGlobalGuard(null);
  });

  it("navigates to home when no guard is registered", () => {
    render(<NavBar {...defaultProps} />);

    const homeLink = screen.getByText("LA 2028 Scheduler").closest("a")!;
    const clickEvent = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    homeLink.dispatchEvent(clickEvent);

    // No guard registered — default browser navigation should NOT be prevented
    expect(clickEvent.defaultPrevented).toBe(false);
  });

  it("navigates to home when guard is registered but no dirty steps", () => {
    setGlobalGuard(() => true); // clean — allow navigation

    render(<NavBar {...defaultProps} />);

    const homeLink = screen.getByText("LA 2028 Scheduler").closest("a")!;
    const clickEvent = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    homeLink.dispatchEvent(clickEvent);

    expect(clickEvent.defaultPrevented).toBe(false);
  });

  it("prevents navigation when guard returns false (unsaved changes)", () => {
    const mockGuard = vi.fn(() => false); // dirty — block navigation
    setGlobalGuard(mockGuard);

    render(<NavBar {...defaultProps} />);

    const homeLink = screen.getByText("LA 2028 Scheduler").closest("a")!;
    fireEvent.click(homeLink);

    expect(mockGuard).toHaveBeenCalledWith("/");
  });

  it("calls the guard with '/' as the href", () => {
    const mockGuard = vi.fn(() => true);
    setGlobalGuard(mockGuard);

    render(<NavBar {...defaultProps} />);

    const homeLink = screen.getByText("LA 2028 Scheduler").closest("a")!;
    fireEvent.click(homeLink);

    expect(mockGuard).toHaveBeenCalledWith("/");
  });

  it("allows navigation when guard is registered and returns true", () => {
    setGlobalGuard(() => true);

    render(<NavBar {...defaultProps} />);

    const homeLink = screen.getByText("LA 2028 Scheduler").closest("a")!;
    const clickEvent = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    homeLink.dispatchEvent(clickEvent);

    expect(clickEvent.defaultPrevented).toBe(false);
  });
});
