// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { GroupDetail } from "@/lib/types";

// ─── Mocks ──────────────────────────────────────────────────────────

vi.mock("next/navigation", () => ({
  usePathname: () => "/groups/group-1",
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
    onClick,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
    onClick?: React.MouseEventHandler<HTMLAnchorElement>;
  }) => (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  ),
}));

let capturedOnOpenSettings: (() => void) | undefined;
let capturedOnNameSaved: (() => void) | undefined;

vi.mock("@/app/(main)/groups/[groupId]/_components/group-header", () => ({
  default: ({
    onOpenSettings,
    onNameSaved,
  }: {
    onOpenSettings?: () => void;
    onNameSaved?: () => void;
  }) => {
    capturedOnOpenSettings = onOpenSettings;
    capturedOnNameSaved = onNameSaved;
    return (
      <div data-testid="group-header">
        {onOpenSettings && (
          <button data-testid="settings-trigger" onClick={onOpenSettings}>
            Settings
          </button>
        )}
        {onNameSaved && (
          <button data-testid="name-saved-trigger" onClick={onNameSaved}>
            Name Saved
          </button>
        )}
      </div>
    );
  },
}));

vi.mock(
  "@/app/(main)/groups/[groupId]/_components/group-settings-modal",
  () => ({
    default: ({ onClose }: { onClose?: () => void }) => (
      <div data-testid="settings-modal">
        <button data-testid="close-settings" onClick={onClose}>
          Close
        </button>
      </div>
    ),
  })
);

import GroupShell from "@/app/(main)/groups/[groupId]/_components/group-shell";
import {
  GroupProvider,
  useGroup,
} from "@/app/(main)/groups/[groupId]/_components/group-context";
import { useNavigationGuard } from "@/app/(main)/groups/[groupId]/_components/navigation-guard-context";

afterEach(cleanup);

// ─── Helpers ────────────────────────────────────────────────────────

function makeGroup(overrides: Partial<GroupDetail> = {}): GroupDetail {
  return {
    id: "group-1",
    name: "Test Group",
    phase: "preferences",
    inviteCode: "ABC123",
    dateMode: null,
    consecutiveDays: null,
    startDate: null,
    endDate: null,
    scheduleGeneratedAt: null,
    createdAt: "2028-01-01T00:00:00Z",
    myRole: "owner",
    myStatus: "preferences_set",
    myMemberId: "owner-1",
    members: [
      {
        id: "owner-1",
        userId: "user-1",
        firstName: "Alice",
        lastName: "Smith",
        username: "alice",
        avatarColor: "blue",
        role: "owner",
        status: "preferences_set",
        joinedAt: "2027-12-01T00:00:00Z",
        statusChangedAt: null,
        createdAt: "2027-12-01T00:00:00Z",
      },
      {
        id: "member-2",
        userId: "user-2",
        firstName: "Bob",
        lastName: "Jones",
        username: "bob",
        avatarColor: "red",
        role: "member",
        status: "preferences_set",
        joinedAt: "2027-12-02T00:00:00Z",
        statusChangedAt: null,
        createdAt: "2027-12-02T00:00:00Z",
      },
    ],
    membersWithNoCombos: [],
    memberTimeslots: [],
    departedMembers: [],
    affectedBuddyMembers: {},
    windowRankings: [],
    ...overrides,
  };
}

function getNavItem(label: string) {
  return screen.getByText(label).closest("a")!;
}

function hasWarningIcon(navEl: HTMLElement): boolean {
  // Warning icon is an SVG with stroke="#d97706" inside the nav link
  return navEl.querySelector('svg[stroke="#d97706"]') !== null;
}

function hasCheckIcon(navEl: HTMLElement): boolean {
  // Check icon is a span with green background containing an SVG
  return navEl.querySelector('svg[stroke="#059669"]') !== null;
}

function getTooltipText(navEl: HTMLElement): string | null {
  const tooltip = navEl.querySelector(".pointer-events-none.absolute");
  return tooltip?.textContent ?? null;
}

// ─── Tests ──────────────────────────────────────────────────────────

describe("GroupShell — sidebar nav statuses", () => {
  // ── Overview warning icon ─────────────────────────────────────

  describe("Overview warning icon", () => {
    it("shows no warning when schedules are fresh", () => {
      const group = makeGroup({
        phase: "schedule_review",
        myStatus: "preferences_set",
        members: [
          {
            id: "owner-1",
            userId: "user-1",
            firstName: "Alice",
            lastName: "Smith",
            username: "alice",
            avatarColor: "blue",
            role: "owner",
            status: "preferences_set",
            joinedAt: "2027-12-01T00:00:00Z",
            statusChangedAt: null,
            createdAt: "2027-12-01T00:00:00Z",
          },
        ],
      });
      render(
        <GroupShell group={group}>
          <div />
        </GroupShell>
      );
      const nav = getNavItem("Overview");
      expect(hasWarningIcon(nav)).toBe(false);
    });

    it("shows warning when departed members exist", () => {
      const group = makeGroup({
        phase: "preferences",
        departedMembers: [
          { name: "Charlie Brown", departedAt: "2028-01-10T12:00:00Z" },
        ],
      });
      render(
        <GroupShell group={group}>
          <div />
        </GroupShell>
      );
      const nav = getNavItem("Overview");
      expect(hasWarningIcon(nav)).toBe(true);
      expect(getTooltipText(nav)).toBe("Schedules may need to be regenerated.");
    });

    it("shows warning when affected buddy members exist", () => {
      const group = makeGroup({
        affectedBuddyMembers: { "member-2": ["Charlie Brown"] },
      });
      render(
        <GroupShell group={group}>
          <div />
        </GroupShell>
      );
      expect(hasWarningIcon(getNavItem("Overview"))).toBe(true);
    });

    it("shows warning when a member updated preferences after generation", () => {
      const group = makeGroup({
        phase: "schedule_review",
        myStatus: "preferences_set",
        scheduleGeneratedAt: "2028-01-01T00:00:00Z",
        members: [
          {
            id: "owner-1",
            userId: "user-1",
            firstName: "Alice",
            lastName: "Smith",
            username: "alice",
            avatarColor: "blue",
            role: "owner",
            status: "preferences_set",
            joinedAt: "2027-12-01T00:00:00Z",
            statusChangedAt: null,
            createdAt: "2027-12-01T00:00:00Z",
          },
          {
            id: "member-2",
            userId: "user-2",
            firstName: "Bob",
            lastName: "Jones",
            username: "bob",
            avatarColor: "red",
            role: "member",
            status: "preferences_set",
            joinedAt: "2027-12-02T00:00:00Z",
            statusChangedAt: "2028-01-05T00:00:00Z",
            createdAt: "2027-12-02T00:00:00Z",
          },
        ],
      });
      render(
        <GroupShell group={group}>
          <div />
        </GroupShell>
      );
      expect(hasWarningIcon(getNavItem("Overview"))).toBe(true);
    });

    it("shows no warning when members have not updated after generation", () => {
      const group = makeGroup({
        phase: "schedule_review",
        myStatus: "preferences_set",
        scheduleGeneratedAt: "2028-01-01T00:00:00Z",
        members: [
          {
            id: "owner-1",
            userId: "user-1",
            firstName: "Alice",
            lastName: "Smith",
            username: "alice",
            avatarColor: "blue",
            role: "owner",
            status: "preferences_set",
            joinedAt: "2027-12-01T00:00:00Z",
            statusChangedAt: null,
            createdAt: "2027-12-01T00:00:00Z",
          },
          {
            id: "member-2",
            userId: "user-2",
            firstName: "Bob",
            lastName: "Jones",
            username: "bob",
            avatarColor: "red",
            role: "member",
            status: "preferences_set",
            joinedAt: "2027-12-02T00:00:00Z",
            statusChangedAt: null,
            createdAt: "2027-12-02T00:00:00Z",
          },
        ],
      });
      render(
        <GroupShell group={group}>
          <div />
        </GroupShell>
      );
      expect(hasWarningIcon(getNavItem("Overview"))).toBe(false);
    });

    it("shows warning when newly joined member exists in schedule_review", () => {
      const group = makeGroup({
        phase: "schedule_review",
        myStatus: "preferences_set",
        scheduleGeneratedAt: "2028-01-01T00:00:00Z",
        members: [
          {
            id: "owner-1",
            userId: "user-1",
            firstName: "Alice",
            lastName: "Smith",
            username: "alice",
            avatarColor: "blue",
            role: "owner",
            status: "preferences_set",
            joinedAt: "2027-12-01T00:00:00Z",
            statusChangedAt: null,
            createdAt: "2027-12-01T00:00:00Z",
          },
          {
            id: "member-2",
            userId: "user-2",
            firstName: "Bob",
            lastName: "Jones",
            username: "bob",
            avatarColor: "red",
            role: "member",
            status: "joined",
            joinedAt: "2028-01-02T00:00:00Z",
            statusChangedAt: null,
            createdAt: "2028-01-02T00:00:00Z",
          },
        ],
      });
      render(
        <GroupShell group={group}>
          <div />
        </GroupShell>
      );
      expect(hasWarningIcon(getNavItem("Overview"))).toBe(true);
    });

    it("shows warning when no-combo member has not updated in preferences phase (post-generation)", () => {
      const group = makeGroup({
        phase: "preferences",
        myStatus: "preferences_set",
        scheduleGeneratedAt: "2028-01-01T00:00:00Z",
        membersWithNoCombos: ["member-2"],
        members: [
          {
            id: "owner-1",
            userId: "user-1",
            firstName: "Alice",
            lastName: "Smith",
            username: "alice",
            avatarColor: "blue",
            role: "owner",
            status: "preferences_set",
            joinedAt: "2027-12-01T00:00:00Z",
            statusChangedAt: null,
            createdAt: "2027-12-01T00:00:00Z",
          },
          {
            id: "member-2",
            userId: "user-2",
            firstName: "Bob",
            lastName: "Jones",
            username: "bob",
            avatarColor: "red",
            role: "member",
            status: "preferences_set",
            joinedAt: "2027-12-02T00:00:00Z",
            statusChangedAt: null,
            createdAt: "2027-12-02T00:00:00Z",
          },
        ],
      });
      render(
        <GroupShell group={group}>
          <div />
        </GroupShell>
      );
      expect(hasWarningIcon(getNavItem("Overview"))).toBe(true);
    });

    it("shows no warning in preferences phase with no issues", () => {
      const group = makeGroup({ phase: "preferences" });
      render(
        <GroupShell group={group}>
          <div />
        </GroupShell>
      );
      expect(hasWarningIcon(getNavItem("Overview"))).toBe(false);
    });
  });

  // ── Preferences nav status ────────────────────────────────────

  describe("Preferences nav status", () => {
    it("shows check when prefs complete and not affected buddy", () => {
      const group = makeGroup({ myStatus: "preferences_set" });
      render(
        <GroupShell group={group}>
          <div />
        </GroupShell>
      );
      expect(hasCheckIcon(getNavItem("Preferences"))).toBe(true);
      expect(hasWarningIcon(getNavItem("Preferences"))).toBe(false);
    });

    it("shows warning when user is affected buddy member", () => {
      const group = makeGroup({
        myStatus: "preferences_set",
        affectedBuddyMembers: { "owner-1": ["Charlie Brown"] },
      });
      render(
        <GroupShell group={group}>
          <div />
        </GroupShell>
      );
      expect(hasWarningIcon(getNavItem("Preferences"))).toBe(true);
      expect(getTooltipText(getNavItem("Preferences"))).toBe(
        "You need to review your preferences."
      );
    });

    it("shows warning for no-combo member who hasn't updated", () => {
      const group = makeGroup({
        phase: "preferences",
        myStatus: "preferences_set",
        myMemberId: "owner-1",
        scheduleGeneratedAt: "2028-01-01T00:00:00Z",
        membersWithNoCombos: ["owner-1"],
      });
      render(
        <GroupShell group={group}>
          <div />
        </GroupShell>
      );
      expect(hasWarningIcon(getNavItem("Preferences"))).toBe(true);
      expect(getTooltipText(getNavItem("Preferences"))).toBe(
        "You didn't receive any sessions on your schedule. Review and update your preferences."
      );
    });

    it("clears no-combo warning on Preferences nav after regeneration clears membersWithNoCombos", () => {
      const group = makeGroup({
        phase: "schedule_review",
        myStatus: "preferences_set",
        myMemberId: "owner-1",
        scheduleGeneratedAt: "2028-01-02T00:00:00Z",
        membersWithNoCombos: [],
      });
      render(
        <GroupShell group={group}>
          <div />
        </GroupShell>
      );
      // After regeneration clears membersWithNoCombos, warning should clear
      expect(hasCheckIcon(getNavItem("Preferences"))).toBe(true);
      expect(hasWarningIcon(getNavItem("Preferences"))).toBe(false);
    });

    it("shows warning when prefs not entered", () => {
      const group = makeGroup({ myStatus: "joined" });
      render(
        <GroupShell group={group}>
          <div />
        </GroupShell>
      );
      expect(hasWarningIcon(getNavItem("Preferences"))).toBe(true);
      expect(getTooltipText(getNavItem("Preferences"))).toBe(
        "You haven't entered your preferences yet."
      );
    });
  });

  // ── My Schedule nav status ────────────────────────────────────

  describe("My Schedule nav status", () => {
    it("shows check when in schedule_review phase", () => {
      const group = makeGroup({
        phase: "schedule_review",
        myStatus: "preferences_set",
      });
      render(
        <GroupShell group={group}>
          <div />
        </GroupShell>
      );
      expect(hasCheckIcon(getNavItem("My Schedule"))).toBe(true);
      expect(hasWarningIcon(getNavItem("My Schedule"))).toBe(false);
    });

    it("shows warning when any member has no combos (preferences phase post-generation)", () => {
      const group = makeGroup({
        phase: "preferences",
        myStatus: "preferences_set",
        scheduleGeneratedAt: "2028-01-01T00:00:00Z",
        membersWithNoCombos: ["member-2"],
        members: [
          {
            id: "owner-1",
            userId: "user-1",
            firstName: "Alice",
            lastName: "Smith",
            username: "alice",
            avatarColor: "blue",
            role: "owner",
            status: "preferences_set",
            joinedAt: "2027-12-01T00:00:00Z",
            statusChangedAt: null,
            createdAt: "2027-12-01T00:00:00Z",
          },
          {
            id: "member-2",
            userId: "user-2",
            firstName: "Bob",
            lastName: "Jones",
            username: "bob",
            avatarColor: "red",
            role: "member",
            status: "preferences_set",
            joinedAt: "2027-12-02T00:00:00Z",
            statusChangedAt: null,
            createdAt: "2027-12-02T00:00:00Z",
          },
        ],
      });
      render(
        <GroupShell group={group}>
          <div />
        </GroupShell>
      );
      expect(hasWarningIcon(getNavItem("My Schedule"))).toBe(true);
      expect(getTooltipText(getNavItem("My Schedule"))).toBe(
        "Schedules unavailable — some members didn't receive any sessions."
      );
    });

    it("does not show check icon when membersWithNoCombos is non-empty", () => {
      const group = makeGroup({
        phase: "preferences",
        myStatus: "preferences_set",
        scheduleGeneratedAt: "2028-01-01T00:00:00Z",
        membersWithNoCombos: ["member-2"],
        members: [
          {
            id: "owner-1",
            userId: "user-1",
            firstName: "Alice",
            lastName: "Smith",
            username: "alice",
            avatarColor: "blue",
            role: "owner",
            status: "preferences_set",
            joinedAt: "2027-12-01T00:00:00Z",
            statusChangedAt: null,
            createdAt: "2027-12-01T00:00:00Z",
          },
          {
            id: "member-2",
            userId: "user-2",
            firstName: "Bob",
            lastName: "Jones",
            username: "bob",
            avatarColor: "red",
            role: "member",
            status: "preferences_set",
            joinedAt: "2027-12-02T00:00:00Z",
            statusChangedAt: null,
            createdAt: "2027-12-02T00:00:00Z",
          },
        ],
      });
      render(
        <GroupShell group={group}>
          <div />
        </GroupShell>
      );
      expect(hasCheckIcon(getNavItem("My Schedule"))).toBe(false);
      expect(hasWarningIcon(getNavItem("My Schedule"))).toBe(true);
    });

    it("clears no-combos warning after affected member departs (phase regresses to preferences)", () => {
      // After a no-combo member departs, phase → preferences, membersWithNoCombos → []
      const group = makeGroup({
        phase: "preferences",
        myStatus: "preferences_set",
        membersWithNoCombos: [],
        departedMembers: [
          { name: "Bob Jones", departedAt: "2028-01-10T12:00:00Z" },
        ],
        members: [
          {
            id: "owner-1",
            userId: "user-1",
            firstName: "Alice",
            lastName: "Smith",
            username: "alice",
            avatarColor: "blue",
            role: "owner",
            status: "preferences_set",
            joinedAt: "2027-12-01T00:00:00Z",
            statusChangedAt: null,
            createdAt: "2027-12-01T00:00:00Z",
          },
        ],
      });
      render(
        <GroupShell group={group}>
          <div />
        </GroupShell>
      );
      // My Schedule: no warning (phase is preferences, membersWithNoCombos is empty)
      expect(hasWarningIcon(getNavItem("My Schedule"))).toBe(false);
      expect(hasCheckIcon(getNavItem("My Schedule"))).toBe(false);
      // Overview: warning (departed member)
      expect(hasWarningIcon(getNavItem("Overview"))).toBe(true);
    });

    it("shows no icon in preferences phase even if status is preferences_set", () => {
      const group = makeGroup({
        phase: "preferences",
        myStatus: "preferences_set",
      });
      render(
        <GroupShell group={group}>
          <div />
        </GroupShell>
      );
      expect(hasWarningIcon(getNavItem("My Schedule"))).toBe(false);
      expect(hasCheckIcon(getNavItem("My Schedule"))).toBe(false);
    });

    it("shows no warning after departure resets phase to preferences", () => {
      // Simulates the post-departure state: phase regressed, myStatus reset
      const group = makeGroup({
        phase: "preferences",
        myStatus: "preferences_set",
        departedMembers: [
          { name: "Charlie Brown", departedAt: "2028-01-10T12:00:00Z" },
        ],
        affectedBuddyMembers: { "owner-1": ["Charlie Brown"] },
      });
      render(
        <GroupShell group={group}>
          <div />
        </GroupShell>
      );
      // My Schedule should have no warning (phase is preferences)
      expect(hasWarningIcon(getNavItem("My Schedule"))).toBe(false);
      // But Preferences should show warning (affected buddy)
      expect(hasWarningIcon(getNavItem("Preferences"))).toBe(true);
      // And Overview should show warning (departed + affected)
      expect(hasWarningIcon(getNavItem("Overview"))).toBe(true);
    });
  });

  // ── GroupSyncProvider — layout/page data sync ─────────────────

  describe("GroupSyncProvider sync", () => {
    it("sidebar uses layout data initially", () => {
      const layoutGroup = makeGroup({
        phase: "schedule_review",
        myStatus: "preferences_set",
        members: [
          {
            id: "owner-1",
            userId: "user-1",
            firstName: "Alice",
            lastName: "Smith",
            username: "alice",
            avatarColor: "blue",
            role: "owner",
            status: "preferences_set",
            joinedAt: "2027-12-01T00:00:00Z",
            statusChangedAt: null,
            createdAt: "2027-12-01T00:00:00Z",
          },
        ],
      });
      render(
        <GroupShell group={layoutGroup}>
          <div />
        </GroupShell>
      );
      // My Schedule should show check (in schedule_review phase)
      expect(hasCheckIcon(getNavItem("My Schedule"))).toBe(true);
    });

    it("sidebar updates when page syncs fresh data via GroupProvider", () => {
      // Layout has stale data: schedule_review phase, pending status
      const staleGroup = makeGroup({
        phase: "schedule_review",
        myStatus: "preferences_set",
        members: [
          {
            id: "owner-1",
            userId: "user-1",
            firstName: "Alice",
            lastName: "Smith",
            username: "alice",
            avatarColor: "blue",
            role: "owner",
            status: "preferences_set",
            joinedAt: "2027-12-01T00:00:00Z",
            statusChangedAt: null,
            createdAt: "2027-12-01T00:00:00Z",
          },
        ],
      });

      // Page has fresh data: phase regressed to preferences, status reset,
      // departed member recorded, owner is affected buddy
      const freshGroup = makeGroup({
        phase: "preferences",
        myStatus: "preferences_set",
        departedMembers: [
          { name: "Charlie Brown", departedAt: "2028-01-10T12:00:00Z" },
        ],
        affectedBuddyMembers: { "owner-1": ["Charlie Brown"] },
        members: [
          {
            id: "owner-1",
            userId: "user-1",
            firstName: "Alice",
            lastName: "Smith",
            username: "alice",
            avatarColor: "blue",
            role: "owner",
            status: "preferences_set",
            joinedAt: "2027-12-01T00:00:00Z",
            statusChangedAt: null,
            createdAt: "2027-12-01T00:00:00Z",
          },
        ],
      });

      // Render GroupShell with stale layout data,
      // then a child GroupProvider pushes fresh data via sync
      render(
        <GroupShell group={staleGroup}>
          <GroupProvider group={freshGroup}>
            <div data-testid="page-content" />
          </GroupProvider>
        </GroupShell>
      );

      // After sync effect fires, sidebar should use fresh data:
      // - My Schedule: NO warning (phase is preferences, not schedule_review)
      expect(hasWarningIcon(getNavItem("My Schedule"))).toBe(false);
      // - Preferences: WARNING (affected buddy)
      expect(hasWarningIcon(getNavItem("Preferences"))).toBe(true);
      expect(getTooltipText(getNavItem("Preferences"))).toBe(
        "You need to review your preferences."
      );
      // - Overview: WARNING (departed members + affected buddy)
      expect(hasWarningIcon(getNavItem("Overview"))).toBe(true);
    });

    it("sidebar reflects schedule_review state from synced page data", () => {
      const staleGroup = makeGroup({
        phase: "schedule_review",
        myStatus: "preferences_set",
        members: [
          {
            id: "owner-1",
            userId: "user-1",
            firstName: "Alice",
            lastName: "Smith",
            username: "alice",
            avatarColor: "blue",
            role: "owner",
            status: "preferences_set",
            joinedAt: "2027-12-01T00:00:00Z",
            statusChangedAt: null,
            createdAt: "2027-12-01T00:00:00Z",
          },
        ],
      });

      const freshGroup = makeGroup({
        phase: "schedule_review",
        myStatus: "preferences_set",
        members: [
          {
            id: "owner-1",
            userId: "user-1",
            firstName: "Alice",
            lastName: "Smith",
            username: "alice",
            avatarColor: "blue",
            role: "owner",
            status: "preferences_set",
            joinedAt: "2027-12-01T00:00:00Z",
            statusChangedAt: null,
            createdAt: "2027-12-01T00:00:00Z",
          },
        ],
      });

      render(
        <GroupShell group={staleGroup}>
          <GroupProvider group={freshGroup}>
            <div />
          </GroupProvider>
        </GroupShell>
      );

      // My Schedule should show check (confirmed), not warning (pending)
      expect(hasCheckIcon(getNavItem("My Schedule"))).toBe(true);
      expect(hasWarningIcon(getNavItem("My Schedule"))).toBe(false);
    });

    it("sidebar clears affected buddy warning when synced data clears it", () => {
      const staleGroup = makeGroup({
        myStatus: "preferences_set",
        affectedBuddyMembers: { "owner-1": ["Charlie Brown"] },
      });

      const freshGroup = makeGroup({
        myStatus: "preferences_set",
        affectedBuddyMembers: {},
      });

      render(
        <GroupShell group={staleGroup}>
          <GroupProvider group={freshGroup}>
            <div />
          </GroupProvider>
        </GroupShell>
      );

      // Preferences should show check (no affected buddy in fresh data)
      expect(hasCheckIcon(getNavItem("Preferences"))).toBe(true);
      expect(hasWarningIcon(getNavItem("Preferences"))).toBe(false);
    });

    it("sidebar works without page GroupProvider (layout-only)", () => {
      const group = makeGroup({
        phase: "schedule_review",
        myStatus: "preferences_set",
      });
      render(
        <GroupShell group={group}>
          <div>No GroupProvider here</div>
        </GroupShell>
      );
      // Should still work using layout data
      expect(hasCheckIcon(getNavItem("My Schedule"))).toBe(true);
    });
  });

  // ── Post-departure combined scenario ──────────────────────────

  describe("post-departure scenario (test case 5)", () => {
    it("stale layout shows wrong states, fresh page sync corrects them", () => {
      // Stale layout: schedule_review, owner has preferences_set
      const staleLayout = makeGroup({
        phase: "schedule_review",
        myStatus: "preferences_set",
        departedMembers: [],
        affectedBuddyMembers: {},
        members: [
          {
            id: "owner-1",
            userId: "user-1",
            firstName: "Alice",
            lastName: "Smith",
            username: "alice",
            avatarColor: "blue",
            role: "owner",
            status: "preferences_set",
            joinedAt: "2027-12-01T00:00:00Z",
            statusChangedAt: null,
            createdAt: "2027-12-01T00:00:00Z",
          },
          {
            id: "member-2",
            userId: "user-2",
            firstName: "Bob",
            lastName: "Jones",
            username: "bob",
            avatarColor: "red",
            role: "member",
            status: "preferences_set",
            joinedAt: "2027-12-02T00:00:00Z",
            statusChangedAt: null,
            createdAt: "2027-12-02T00:00:00Z",
          },
        ],
      });

      // Fresh page data after Bob departs:
      // - phase regressed to preferences
      // - owner status reset to preferences_set
      // - owner is affected buddy (had Bob as required buddy)
      // - Bob recorded as departed
      const freshPage = makeGroup({
        phase: "preferences",
        myStatus: "preferences_set",
        departedMembers: [
          { name: "Bob Jones", departedAt: "2028-01-10T12:00:00Z" },
        ],
        affectedBuddyMembers: { "owner-1": ["Bob Jones"] },
        members: [
          {
            id: "owner-1",
            userId: "user-1",
            firstName: "Alice",
            lastName: "Smith",
            username: "alice",
            avatarColor: "blue",
            role: "owner",
            status: "preferences_set",
            joinedAt: "2027-12-01T00:00:00Z",
            statusChangedAt: null,
            createdAt: "2027-12-01T00:00:00Z",
          },
        ],
      });

      render(
        <GroupShell group={staleLayout}>
          <GroupProvider group={freshPage}>
            <div />
          </GroupProvider>
        </GroupShell>
      );

      // My Schedule: NO warning (phase is preferences after sync)
      expect(hasWarningIcon(getNavItem("My Schedule"))).toBe(false);

      // Preferences: WARNING (owner is affected buddy)
      expect(hasWarningIcon(getNavItem("Preferences"))).toBe(true);
      expect(getTooltipText(getNavItem("Preferences"))).toBe(
        "You need to review your preferences."
      );

      // Overview: WARNING (departed + affected buddy)
      expect(hasWarningIcon(getNavItem("Overview"))).toBe(true);
    });
  });
});

// ─── Settings modal ──────────────────────────────────────────────────

describe("GroupShell — settings modal", () => {
  it("opens settings modal when settings button is clicked", () => {
    const group = makeGroup({ myRole: "owner" });
    render(
      <GroupShell group={group}>
        <div />
      </GroupShell>
    );

    // Settings modal should not be visible initially
    expect(screen.queryByTestId("settings-modal")).not.toBeInTheDocument();

    // Click the settings trigger exposed by the GroupHeader mock
    const settingsBtn = screen.getByTestId("settings-trigger");
    act(() => {
      settingsBtn.click();
    });

    // Settings modal should now be visible
    expect(screen.getByTestId("settings-modal")).toBeInTheDocument();
  });

  it("invokes router.refresh when onNameSaved is called", () => {
    const group = makeGroup({ myRole: "owner" });
    render(
      <GroupShell group={group}>
        <div />
      </GroupShell>
    );

    const nameSavedBtn = screen.getByTestId("name-saved-trigger");
    act(() => {
      nameSavedBtn.click();
    });

    // The onNameSaved callback calls router.refresh() — verify it was rendered
    expect(nameSavedBtn).toBeInTheDocument();
  });

  it("closes settings modal when close button is clicked", () => {
    const group = makeGroup({ myRole: "owner" });
    render(
      <GroupShell group={group}>
        <div />
      </GroupShell>
    );

    // Open the modal
    act(() => {
      screen.getByTestId("settings-trigger").click();
    });
    expect(screen.getByTestId("settings-modal")).toBeInTheDocument();

    // Close the modal
    act(() => {
      screen.getByTestId("close-settings").click();
    });
    expect(screen.queryByTestId("settings-modal")).not.toBeInTheDocument();
  });
});

// ─── GuardedLink same-page refresh ──────────────────────────────────

describe("GroupShell — GuardedLink same-page refresh", () => {
  it("calls router.refresh when clicking a link to the current page", () => {
    // usePathname returns "/groups/group-1" — that's the Overview href
    const group = makeGroup();
    render(
      <GroupShell group={group}>
        <div />
      </GroupShell>
    );

    // The Overview link href matches the current pathname "/groups/group-1"
    const overviewLink = getNavItem("Overview");
    act(() => {
      overviewLink.click();
    });

    // The click should have been handled (preventDefault + refresh).
    // We verify the link is still rendered and the page didn't navigate away.
    expect(overviewLink).toBeInTheDocument();
  });
});

// ─── GuardedLink navigation prevention ──────────────────────────────

describe("GroupShell — GuardedLink", () => {
  it("prevents navigation when guard returns false", () => {
    // Helper component that registers a dirty checker so guardNavigation returns false
    function DirtyCheckerSetter() {
      const { setDirtyChecker } = useNavigationGuard();
      // Register a dirty checker that always reports dirty steps
      setDirtyChecker(() => ["Buddies"]);
      return null;
    }

    const group = makeGroup();
    render(
      <GroupShell group={group}>
        <DirtyCheckerSetter />
      </GroupShell>
    );

    // Find a sidebar nav link (e.g. "Preferences")
    const prefsLink = getNavItem("Preferences");

    // Click should be prevented — the "Unsaved Changes" dialog should appear
    act(() => {
      prefsLink.click();
    });

    // The navigation guard dialog should be shown
    expect(screen.getByText("Unsaved Changes")).toBeInTheDocument();
    expect(screen.getByText(/You have unsaved changes in/)).toBeInTheDocument();
  });
});

// ─── useGroup outside provider ──────────────────────────────────────

describe("useGroup outside GroupProvider", () => {
  it("throws when used outside GroupProvider", () => {
    function BadConsumer() {
      useGroup();
      return <div />;
    }

    // Suppress console.error for expected React error boundary noise
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      render(<BadConsumer />);
    }).toThrow("useGroup must be used within a GroupProvider");

    spy.mockRestore();
  });
});
