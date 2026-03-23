// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import BuddiesStep from "@/app/(main)/groups/[groupId]/preferences/_components/buddies-step";
import type { GroupDetail } from "@/lib/types";

// ─── Mocks ──────────────────────────────────────────────────────────

const mockGroup: GroupDetail = {
  id: "group-1",
  name: "Test Group",
  phase: "preferences",
  inviteCode: "ABC123",
  dateMode: null,
  consecutiveDays: null,
  startDate: null,
  endDate: null,
  scheduleGeneratedAt: null,
  createdAt: new Date().toISOString(),
  myRole: "member",
  myStatus: "joined",
  myMemberId: "member-1",
  members: [
    {
      id: "member-1",
      userId: "user-1",
      firstName: "Alice",
      lastName: "Smith",
      username: "alice",
      avatarColor: "blue" as const,
      role: "owner",
      status: "joined",
      joinedAt: new Date().toISOString(),
      statusChangedAt: null,
      createdAt: new Date().toISOString(),
    },
    {
      id: "member-2",
      userId: "user-2",
      firstName: "Bob",
      lastName: "Jones",
      username: "bob",
      avatarColor: "red" as const,
      role: "member",
      status: "joined",
      joinedAt: new Date().toISOString(),
      statusChangedAt: null,
      createdAt: new Date().toISOString(),
    },
    {
      id: "member-3",
      userId: "user-3",
      firstName: "Charlie",
      lastName: "Brown",
      username: "charlie",
      avatarColor: "green" as const,
      role: "member",
      status: "joined",
      joinedAt: new Date().toISOString(),
      statusChangedAt: null,
      createdAt: new Date().toISOString(),
    },
    {
      id: "member-4",
      userId: "user-4",
      firstName: "Dana",
      lastName: "White",
      username: "dana",
      avatarColor: "purple" as const,
      role: "member",
      status: "pending_approval",
      joinedAt: null,
      statusChangedAt: null,
      createdAt: new Date().toISOString(),
    },
  ],
  membersWithNoCombos: [],
  memberTimeslots: [],
  departedMembers: [],
  affectedBuddyMembers: {},
  windowRankings: [],
};

vi.mock("@/app/(main)/groups/[groupId]/_components/group-context", () => ({
  useGroup: () => mockGroup,
}));

vi.mock("@/components/user-avatar", () => ({
  default: ({ color }: { color: string }) => (
    <span data-testid="user-avatar">{color}</span>
  ),
}));

vi.mock("@/lib/constants", () => ({
  inputClass: "mock-input-class",
}));

// ─── Helpers ────────────────────────────────────────────────────────

type BuddySelection = { memberId: string; type: "hard" | "soft" };

const defaultProps = {
  initialMinBuddies: 0,
  initialBuddies: [] as BuddySelection[],
  onChange: vi.fn(),
};

// ─── Tests ──────────────────────────────────────────────────────────

describe("BuddiesStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset members to default
    mockGroup.myMemberId = "member-1";
    mockGroup.members = [
      {
        id: "member-1",
        userId: "user-1",
        firstName: "Alice",
        lastName: "Smith",
        username: "alice",
        avatarColor: "blue" as const,
        role: "owner",
        status: "joined",
        joinedAt: new Date().toISOString(),
        statusChangedAt: null,
        createdAt: new Date().toISOString(),
      },
      {
        id: "member-2",
        userId: "user-2",
        firstName: "Bob",
        lastName: "Jones",
        username: "bob",
        avatarColor: "red" as const,
        role: "member",
        status: "joined",
        joinedAt: new Date().toISOString(),
        statusChangedAt: null,
        createdAt: new Date().toISOString(),
      },
      {
        id: "member-3",
        userId: "user-3",
        firstName: "Charlie",
        lastName: "Brown",
        username: "charlie",
        avatarColor: "green" as const,
        role: "member",
        status: "joined",
        joinedAt: new Date().toISOString(),
        statusChangedAt: null,
        createdAt: new Date().toISOString(),
      },
      {
        id: "member-4",
        userId: "user-4",
        firstName: "Dana",
        lastName: "White",
        username: "dana",
        avatarColor: "purple" as const,
        role: "member",
        status: "pending_approval",
        joinedAt: null,
        statusChangedAt: null,
        createdAt: new Date().toISOString(),
      },
    ];
  });

  afterEach(() => {
    cleanup();
  });

  // ── Minimum buddies section ─────────────────────────────────────

  describe("minimum buddies section", () => {
    it("renders minimum buddies section", () => {
      render(<BuddiesStep {...defaultProps} />);
      expect(screen.getByText("Minimum Buddies")).toBeDefined();
    });

    it("min buddies input starts with initial value", () => {
      render(<BuddiesStep {...defaultProps} initialMinBuddies={2} />);
      const input = screen.getByDisplayValue("2");
      expect(input).toBeDefined();
    });

    it("min buddies clamped to eligible member count max", () => {
      const onChange = vi.fn();
      // Eligible members: member-2, member-3 (not self, not pending) = 2
      render(<BuddiesStep {...defaultProps} onChange={onChange} />);
      const input = document.querySelector(
        'input[type="number"]'
      ) as HTMLInputElement;

      // Try to set above max (2 eligible members)
      fireEvent.change(input, { target: { value: "10" } });

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ minBuddies: 2 })
      );
    });

    it("min buddies clamped to 0 minimum", () => {
      const onChange = vi.fn();
      render(<BuddiesStep {...defaultProps} onChange={onChange} />);
      const input = document.querySelector(
        'input[type="number"]'
      ) as HTMLInputElement;

      fireEvent.change(input, { target: { value: "-5" } });

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ minBuddies: 0 })
      );
    });

    it("min buddies input min attribute is always 0", () => {
      render(
        <BuddiesStep
          {...defaultProps}
          initialMinBuddies={1}
          initialBuddies={[{ memberId: "member-2", type: "hard" }]}
        />
      );
      const input = document.querySelector(
        'input[type="number"]'
      ) as HTMLInputElement;

      expect(input.min).toBe("0");
    });

    it("shows error when minBuddies is less than hard buddy count", () => {
      render(
        <BuddiesStep
          {...defaultProps}
          initialMinBuddies={0}
          initialBuddies={[{ memberId: "member-2", type: "hard" }]}
        />
      );

      expect(
        screen.getByText(
          "The number of minimum buddies should be greater than or equal to the number of required buddies."
        )
      ).toBeDefined();
    });

    it("does not show error when minBuddies equals hard buddy count", () => {
      render(
        <BuddiesStep
          {...defaultProps}
          initialMinBuddies={1}
          initialBuddies={[{ memberId: "member-2", type: "hard" }]}
        />
      );

      expect(
        screen.queryByText(
          "The number of minimum buddies should be greater than or equal to the number of required buddies."
        )
      ).toBeNull();
    });

    it("does not show error when there are no hard buddies", () => {
      render(<BuddiesStep {...defaultProps} initialMinBuddies={0} />);

      expect(
        screen.queryByText(
          "The number of minimum buddies should be greater than or equal to the number of required buddies."
        )
      ).toBeNull();
    });

    it("error appears after toggling a buddy to Required with minBuddies=0", () => {
      render(<BuddiesStep {...defaultProps} initialMinBuddies={0} />);

      const bobButton = screen.getByText("Bob Jones").closest("button")!;
      fireEvent.click(bobButton); // None → Required

      expect(
        screen.getByText(
          "The number of minimum buddies should be greater than or equal to the number of required buddies."
        )
      ).toBeDefined();
    });

    it("error disappears after increasing minBuddies to meet hard buddy count", () => {
      render(
        <BuddiesStep
          {...defaultProps}
          initialMinBuddies={0}
          initialBuddies={[{ memberId: "member-2", type: "hard" }]}
        />
      );

      const input = document.querySelector(
        'input[type="number"]'
      ) as HTMLInputElement;
      fireEvent.change(input, { target: { value: "1" } });

      expect(
        screen.queryByText(
          "The number of minimum buddies should be greater than or equal to the number of required buddies."
        )
      ).toBeNull();
    });

    it("emits isValid=false when minBuddies is below hard buddy count", () => {
      const onChange = vi.fn();
      render(
        <BuddiesStep
          {...defaultProps}
          initialMinBuddies={1}
          initialBuddies={[{ memberId: "member-2", type: "hard" }]}
          onChange={onChange}
        />
      );

      // Toggle Bob from Required → Preferred → None, then Charlie to Required × 2
      // Easier: just add a second hard buddy to make hardCount > minBuddies
      const charlieButton = screen
        .getByText("Charlie Brown")
        .closest("button")!;
      fireEvent.click(charlieButton); // None → Required (hardCount=2, minBuddies=1)

      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ isValid: false })
      );
    });

    it("emits isValid=true when minBuddies meets hard buddy count", () => {
      const onChange = vi.fn();
      render(
        <BuddiesStep
          {...defaultProps}
          initialMinBuddies={0}
          onChange={onChange}
        />
      );

      const input = document.querySelector(
        'input[type="number"]'
      ) as HTMLInputElement;
      fireEvent.change(input, { target: { value: "1" } });

      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ isValid: true })
      );
    });
  });

  // ── Buddy preferences section ──────────────────────────────────

  describe("buddy preferences section", () => {
    it("renders eligible members excluding pending_approval and self", () => {
      render(<BuddiesStep {...defaultProps} />);
      expect(screen.getByText("Buddy Preferences")).toBeDefined();

      // Should show Bob and Charlie (not Alice/self, not Dana/pending)
      expect(screen.getByText("Bob Jones")).toBeDefined();
      expect(screen.getByText("Charlie Brown")).toBeDefined();

      // Should NOT show Alice (self) or Dana (pending_approval)
      expect(screen.queryByText("Alice Smith")).toBeNull();
      expect(screen.queryByText("Dana White")).toBeNull();
    });

    it("shows 'No other members' when no eligible members", () => {
      mockGroup.members = [
        {
          id: "member-1",
          userId: "user-1",
          firstName: "Alice",
          lastName: "Smith",
          username: "alice",
          avatarColor: "blue" as const,
          role: "owner",
          status: "joined",
          joinedAt: new Date().toISOString(),
          statusChangedAt: null,
          createdAt: new Date().toISOString(),
        },
      ];
      render(<BuddiesStep {...defaultProps} />);
      expect(
        screen.getByText("There are no other members in this group yet.")
      ).toBeDefined();
    });

    it("pending approval members are filtered out", () => {
      // All non-self members are pending_approval
      mockGroup.members = [
        {
          id: "member-1",
          userId: "user-1",
          firstName: "Alice",
          lastName: "Smith",
          username: "alice",
          avatarColor: "blue" as const,
          role: "owner",
          status: "joined",
          joinedAt: new Date().toISOString(),
          statusChangedAt: null,
          createdAt: new Date().toISOString(),
        },
        {
          id: "member-5",
          userId: "user-5",
          firstName: "Eve",
          lastName: "Pending",
          username: "eve",
          avatarColor: "red" as const,
          role: "member",
          status: "pending_approval",
          joinedAt: null,
          statusChangedAt: null,
          createdAt: new Date().toISOString(),
        },
      ];
      render(<BuddiesStep {...defaultProps} />);
      expect(screen.queryByText("Eve Pending")).toBeNull();
      expect(
        screen.getByText("There are no other members in this group yet.")
      ).toBeDefined();
    });
  });

  // ── Buddy toggle cycle ─────────────────────────────────────────

  describe("buddy toggle cycle", () => {
    it("toggles None → Required (hard)", () => {
      const onChange = vi.fn();
      render(<BuddiesStep {...defaultProps} onChange={onChange} />);

      // All buddies start as "None"
      const bobButton = screen.getByText("Bob Jones").closest("button")!;
      expect(bobButton.textContent).toContain("None");

      fireEvent.click(bobButton);

      expect(bobButton.textContent).toContain("Required");
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          buddies: [{ memberId: "member-2", type: "hard" }],
        })
      );
    });

    it("toggles Required (hard) → Preferred (soft)", () => {
      const onChange = vi.fn();
      render(
        <BuddiesStep
          {...defaultProps}
          initialBuddies={[{ memberId: "member-2", type: "hard" }]}
          onChange={onChange}
        />
      );

      const bobButton = screen.getByText("Bob Jones").closest("button")!;
      expect(bobButton.textContent).toContain("Required");

      fireEvent.click(bobButton);

      expect(bobButton.textContent).toContain("Preferred");
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          buddies: [{ memberId: "member-2", type: "soft" }],
        })
      );
    });

    it("toggles Preferred (soft) → None (removed)", () => {
      const onChange = vi.fn();
      render(
        <BuddiesStep
          {...defaultProps}
          initialBuddies={[{ memberId: "member-2", type: "soft" }]}
          onChange={onChange}
        />
      );

      const bobButton = screen.getByText("Bob Jones").closest("button")!;
      expect(bobButton.textContent).toContain("Preferred");

      fireEvent.click(bobButton);

      expect(bobButton.textContent).toContain("None");
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          buddies: [],
        })
      );
    });

    it("full cycle: None → Required → Preferred → None", () => {
      const onChange = vi.fn();
      render(<BuddiesStep {...defaultProps} onChange={onChange} />);

      const bobButton = screen.getByText("Bob Jones").closest("button")!;

      // None → Required
      expect(bobButton.textContent).toContain("None");
      fireEvent.click(bobButton);
      expect(bobButton.textContent).toContain("Required");

      // Required → Preferred
      fireEvent.click(bobButton);
      expect(bobButton.textContent).toContain("Preferred");

      // Preferred → None
      fireEvent.click(bobButton);
      expect(bobButton.textContent).toContain("None");

      expect(onChange).toHaveBeenCalledTimes(3);
    });
  });

  // ── onChange called on every interaction ────────────────────────

  describe("onChange called on every interaction", () => {
    it("onChange called on minBuddies change", () => {
      const onChange = vi.fn();
      render(<BuddiesStep {...defaultProps} onChange={onChange} />);
      const input = document.querySelector(
        'input[type="number"]'
      ) as HTMLInputElement;

      fireEvent.change(input, { target: { value: "1" } });

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          minBuddies: 1,
          buddies: [],
        })
      );
    });

    it("onChange called on buddy toggle", () => {
      const onChange = vi.fn();
      render(<BuddiesStep {...defaultProps} onChange={onChange} />);

      const charlieButton = screen
        .getByText("Charlie Brown")
        .closest("button")!;
      fireEvent.click(charlieButton);

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          minBuddies: 0,
          buddies: [{ memberId: "member-3", type: "hard" }],
          isValid: false,
        })
      );
    });

    it("minBuddies does not auto-bump when adding a hard buddy exceeds current value", () => {
      const onChange = vi.fn();
      render(
        <BuddiesStep
          {...defaultProps}
          initialMinBuddies={0}
          onChange={onChange}
        />
      );

      const bobButton = screen.getByText("Bob Jones").closest("button")!;
      fireEvent.click(bobButton); // None → Required

      // minBuddies stays at 0, not auto-bumped
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ minBuddies: 0, isValid: false })
      );
    });

    it("minBuddies stays unchanged when toggling buddy type", () => {
      const onChange = vi.fn();
      render(
        <BuddiesStep
          {...defaultProps}
          initialMinBuddies={2}
          initialBuddies={[
            { memberId: "member-2", type: "hard" },
            { memberId: "member-3", type: "hard" },
          ]}
          onChange={onChange}
        />
      );

      const bobButton = screen.getByText("Bob Jones").closest("button")!;
      fireEvent.click(bobButton); // Required → Preferred (hard count drops to 1)

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ minBuddies: 2, isValid: true })
      );
    });
  });

  // ── Initial buddies pre-populated ──────────────────────────────

  describe("initial buddies pre-populated", () => {
    it("renders initial buddies with correct states", () => {
      render(
        <BuddiesStep
          {...defaultProps}
          initialBuddies={[
            { memberId: "member-2", type: "hard" },
            { memberId: "member-3", type: "soft" },
          ]}
        />
      );

      const bobButton = screen.getByText("Bob Jones").closest("button")!;
      const charlieButton = screen
        .getByText("Charlie Brown")
        .closest("button")!;

      expect(bobButton.textContent).toContain("Required");
      expect(charlieButton.textContent).toContain("Preferred");
    });
  });
});
