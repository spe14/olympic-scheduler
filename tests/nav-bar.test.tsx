// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  act,
} from "@testing-library/react";
import NavBar from "@/components/nav-bar";
import { setGlobalGuard } from "@/lib/navigation-guard-store";
import { logout as mockLogout } from "@/app/(auth)/actions";

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

// ─── Helpers ────────────────────────────────────────────────────────

function openDropdownAndGet(label: string) {
  const avatarButton = screen.getByText("@janedoe").closest("button")!;
  fireEvent.click(avatarButton);
  return screen.getByText(label);
}

// ─── Tests ──────────────────────────────────────────────────────────

describe("NavBar navigation guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setGlobalGuard(null);
  });

  afterEach(() => {
    cleanup();
    setGlobalGuard(null);
  });

  // ── Home link ───────────────────────────────────────────────────

  describe("home link", () => {
    it("navigates when no guard is registered", () => {
      render(<NavBar {...defaultProps} />);

      const homeLink = screen.getByText("LA 2028 Scheduler").closest("a")!;
      const clickEvent = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      });
      act(() => {
        homeLink.dispatchEvent(clickEvent);
      });

      expect(clickEvent.defaultPrevented).toBe(false);
    });

    it("navigates when guard allows (no dirty steps)", () => {
      setGlobalGuard(() => true);
      render(<NavBar {...defaultProps} />);

      const homeLink = screen.getByText("LA 2028 Scheduler").closest("a")!;
      const clickEvent = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      });
      act(() => {
        homeLink.dispatchEvent(clickEvent);
      });

      expect(clickEvent.defaultPrevented).toBe(false);
    });

    it("prevents navigation when guard blocks (unsaved changes)", () => {
      const mockGuard = vi.fn(() => false);
      setGlobalGuard(mockGuard);
      render(<NavBar {...defaultProps} />);

      const homeLink = screen.getByText("LA 2028 Scheduler").closest("a")!;
      fireEvent.click(homeLink);

      expect(mockGuard).toHaveBeenCalledWith("/", undefined);
    });
  });

  // ── Profile link ────────────────────────────────────────────────

  describe("profile link", () => {
    it("navigates when no guard is registered", () => {
      render(<NavBar {...defaultProps} />);
      const profileLink = openDropdownAndGet("Profile");

      const clickEvent = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      });
      act(() => {
        profileLink.dispatchEvent(clickEvent);
      });

      expect(clickEvent.defaultPrevented).toBe(false);
    });

    it("navigates when guard allows (no dirty steps)", () => {
      setGlobalGuard(() => true);
      render(<NavBar {...defaultProps} />);
      const profileLink = openDropdownAndGet("Profile");

      const clickEvent = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      });
      act(() => {
        profileLink.dispatchEvent(clickEvent);
      });

      expect(clickEvent.defaultPrevented).toBe(false);
    });

    it("prevents navigation when guard blocks (unsaved changes)", () => {
      const mockGuard = vi.fn(() => false);
      setGlobalGuard(mockGuard);
      render(<NavBar {...defaultProps} />);
      const profileLink = openDropdownAndGet("Profile");

      fireEvent.click(profileLink);

      expect(mockGuard).toHaveBeenCalledWith("/profile", undefined);
    });

    it("closes dropdown regardless of guard result", () => {
      setGlobalGuard(() => false);
      render(<NavBar {...defaultProps} />);
      openDropdownAndGet("Profile");

      fireEvent.click(screen.getByText("Profile"));

      expect(screen.queryByText("Profile")).toBeNull();
    });
  });

  // ── Logout button ───────────────────────────────────────────────

  describe("logout button", () => {
    it("submits form when no guard is registered", () => {
      render(<NavBar {...defaultProps} />);
      const logoutBtn = openDropdownAndGet("Log Out");

      const clickEvent = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      });
      act(() => {
        logoutBtn.dispatchEvent(clickEvent);
      });

      expect(clickEvent.defaultPrevented).toBe(false);
    });

    it("submits form when guard allows (no dirty steps)", () => {
      setGlobalGuard(() => true);
      render(<NavBar {...defaultProps} />);
      const logoutBtn = openDropdownAndGet("Log Out");

      const clickEvent = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      });
      act(() => {
        logoutBtn.dispatchEvent(clickEvent);
      });

      expect(clickEvent.defaultPrevented).toBe(false);
    });

    it("prevents logout and closes dropdown when guard blocks", () => {
      const mockGuard = vi.fn(() => false);
      setGlobalGuard(mockGuard);
      render(<NavBar {...defaultProps} />);
      openDropdownAndGet("Log Out");

      fireEvent.click(screen.getByText("Log Out"));

      expect(mockGuard).toHaveBeenCalledWith("/login", expect.any(Function));
      expect(screen.queryByText("Log Out")).toBeNull();
    });

    it("passes logout action as onDiscard callback", () => {
      let capturedCallback: (() => void) | undefined;
      const mockGuard = vi.fn((_href: string, onDiscard?: () => void) => {
        capturedCallback = onDiscard;
        return false;
      });
      setGlobalGuard(mockGuard);
      render(<NavBar {...defaultProps} />);
      openDropdownAndGet("Log Out");

      fireEvent.click(screen.getByText("Log Out"));

      expect(capturedCallback).toBeDefined();
      capturedCallback!();
      expect(mockLogout).toHaveBeenCalled();
    });
  });
});
