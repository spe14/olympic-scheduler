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

vi.mock("@/components/medal-icon", () => ({
  default: () => <svg data-testid="medal-icon" />,
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

// Suppress jsdom "Not implemented: navigation" noise on the virtual console
const vc = (window as any)._virtualConsole;
if (vc) {
  vc.removeAllListeners("jsdomError");
}

describe("NavBar navigation guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setGlobalGuard(null);
  });

  afterEach(() => {
    cleanup();
    setGlobalGuard(null);
  });

  // ── Brand / layout ─────────────────────────────────────────────

  describe("brand and layout", () => {
    it("renders brand name and medal icon", () => {
      render(<NavBar {...defaultProps} />);

      expect(screen.getByText("collaboly")).toBeTruthy();
      expect(screen.getByTestId("medal-icon")).toBeTruthy();
    });

    it("renders My Groups and About nav links", () => {
      render(<NavBar {...defaultProps} />);

      const groupsLink = screen.getByText("My Groups").closest("a")!;
      expect(groupsLink.getAttribute("href")).toBe("/groups");

      const aboutLink = screen.getByText("About").closest("a")!;
      expect(aboutLink.getAttribute("href")).toBe("/about");
    });

    it("displays username in avatar button", () => {
      render(<NavBar {...defaultProps} />);

      expect(screen.getByText("@janedoe")).toBeTruthy();
    });
  });

  // ── My Groups link ────────────────────────────────────────────

  describe("My Groups link", () => {
    it("navigates when no guard is registered", () => {
      render(<NavBar {...defaultProps} />);

      const link = screen.getByText("My Groups").closest("a")!;
      const clickEvent = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      });
      act(() => {
        link.dispatchEvent(clickEvent);
      });

      expect(clickEvent.defaultPrevented).toBe(false);
    });

    it("navigates when guard allows (no dirty steps)", () => {
      setGlobalGuard(() => true);
      render(<NavBar {...defaultProps} />);

      const link = screen.getByText("My Groups").closest("a")!;
      const clickEvent = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      });
      act(() => {
        link.dispatchEvent(clickEvent);
      });

      expect(clickEvent.defaultPrevented).toBe(false);
    });

    it("prevents navigation when guard blocks (unsaved changes)", () => {
      const mockGuard = vi.fn(() => false);
      setGlobalGuard(mockGuard);
      render(<NavBar {...defaultProps} />);

      const link = screen.getByText("My Groups").closest("a")!;
      fireEvent.click(link);

      expect(mockGuard).toHaveBeenCalledWith("/groups", undefined);
    });
  });

  // ── About link ────────────────────────────────────────────────

  describe("About link", () => {
    it("navigates when no guard is registered", () => {
      render(<NavBar {...defaultProps} />);

      const link = screen.getByText("About").closest("a")!;
      const clickEvent = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      });
      act(() => {
        link.dispatchEvent(clickEvent);
      });

      expect(clickEvent.defaultPrevented).toBe(false);
    });

    it("prevents navigation when guard blocks (unsaved changes)", () => {
      const mockGuard = vi.fn(() => false);
      setGlobalGuard(mockGuard);
      render(<NavBar {...defaultProps} />);

      const link = screen.getByText("About").closest("a")!;
      fireEvent.click(link);

      expect(mockGuard).toHaveBeenCalledWith("/about", undefined);
    });
  });

  // ── Profile link ──────────────────────────────────────────────

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

  // ── Dropdown open/close ───────────────────────────────────────

  describe("dropdown behavior", () => {
    it("opens dropdown on avatar button click", () => {
      render(<NavBar {...defaultProps} />);

      expect(screen.queryByText("Profile")).toBeNull();

      const avatarButton = screen.getByText("@janedoe").closest("button")!;
      fireEvent.click(avatarButton);

      expect(screen.getByText("Profile")).toBeTruthy();
      expect(screen.getByText("Log Out")).toBeTruthy();
    });

    it("shows user info in dropdown", () => {
      render(<NavBar {...defaultProps} />);
      const avatarButton = screen.getByText("@janedoe").closest("button")!;
      fireEvent.click(avatarButton);

      expect(screen.getByText("Jane Doe")).toBeTruthy();
    });

    it("closes dropdown on outside click", () => {
      render(<NavBar {...defaultProps} />);
      const avatarButton = screen.getByText("@janedoe").closest("button")!;
      fireEvent.click(avatarButton);

      expect(screen.getByText("Profile")).toBeTruthy();

      fireEvent.mouseDown(document.body);

      expect(screen.queryByText("Profile")).toBeNull();
    });
  });

  // ── Logout button ─────────────────────────────────────────────

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
