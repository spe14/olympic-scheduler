// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import BuddiesBudgetStep from "@/app/(main)/groups/[groupId]/preferences/_components/buddies-budget-step";

// ─── Mocks ──────────────────────────────────────────────────────────

const mockGroup = {
  id: "group-1",
  name: "Test Group",
  phase: "preferences",
  inviteCode: "ABC123",
  dateMode: null,
  consecutiveDays: null,
  startDate: null,
  endDate: null,
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
      budget: null,
      joinedAt: new Date().toISOString(),
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
      budget: null,
      joinedAt: new Date().toISOString(),
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
      budget: null,
      joinedAt: new Date().toISOString(),
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
      budget: null,
      joinedAt: null,
      createdAt: new Date().toISOString(),
    },
  ],
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
  initialBudget: null as number | null,
  initialMinBuddies: 0,
  initialBuddies: [] as BuddySelection[],
  onChange: vi.fn(),
};

// ─── Tests ──────────────────────────────────────────────────────────

describe("BuddiesBudgetStep", () => {
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
        budget: null,
        joinedAt: new Date().toISOString(),
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
        budget: null,
        joinedAt: new Date().toISOString(),
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
        budget: null,
        joinedAt: new Date().toISOString(),
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
        budget: null,
        joinedAt: null,
        createdAt: new Date().toISOString(),
      },
    ];
  });

  afterEach(() => {
    cleanup();
  });

  // ── Budget section ──────────────────────────────────────────────

  describe("budget section", () => {
    it("renders budget section with Optional label", () => {
      render(<BuddiesBudgetStep {...defaultProps} />);
      expect(screen.getByText("Budget")).toBeDefined();
      expect(screen.getByText("(Optional)")).toBeDefined();
    });

    it("budget input starts empty when initialBudget is null", () => {
      render(<BuddiesBudgetStep {...defaultProps} initialBudget={null} />);
      const input = screen.getByPlaceholderText("");
      expect(input).toBeDefined();
      expect((input as HTMLInputElement).value).toBe("");
    });

    it("budget input shows formatted value when initialBudget is set", () => {
      render(<BuddiesBudgetStep {...defaultProps} initialBudget={5000} />);
      const inputs = document.querySelectorAll('input[inputmode="numeric"]');
      const budgetInput = inputs[0] as HTMLInputElement;
      expect(budgetInput.value).toBe("5,000");
    });

    it("budget input strips non-digit characters", () => {
      const onChange = vi.fn();
      render(<BuddiesBudgetStep {...defaultProps} onChange={onChange} />);
      const inputs = document.querySelectorAll('input[inputmode="numeric"]');
      const budgetInput = inputs[0] as HTMLInputElement;

      fireEvent.change(budgetInput, { target: { value: "abc$1,23def4" } });

      // onChange should receive the parsed integer of digits only ("1234")
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ budget: 1234 })
      );
    });

    it("budget onChange emits null for empty input", () => {
      const onChange = vi.fn();
      render(
        <BuddiesBudgetStep
          {...defaultProps}
          initialBudget={500}
          onChange={onChange}
        />
      );
      const inputs = document.querySelectorAll('input[inputmode="numeric"]');
      const budgetInput = inputs[0] as HTMLInputElement;

      // Clear the input
      fireEvent.change(budgetInput, { target: { value: "" } });

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ budget: null })
      );
    });

    it("budget onChange emits parsed integer for valid input", () => {
      const onChange = vi.fn();
      render(<BuddiesBudgetStep {...defaultProps} onChange={onChange} />);
      const inputs = document.querySelectorAll('input[inputmode="numeric"]');
      const budgetInput = inputs[0] as HTMLInputElement;

      fireEvent.change(budgetInput, { target: { value: "2500" } });

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ budget: 2500 })
      );
    });

    it("comma formatting in budget - typing 5000 shows 5,000", () => {
      render(<BuddiesBudgetStep {...defaultProps} />);
      const inputs = document.querySelectorAll('input[inputmode="numeric"]');
      const budgetInput = inputs[0] as HTMLInputElement;

      fireEvent.change(budgetInput, { target: { value: "5000" } });

      expect(budgetInput.value).toBe("5,000");
    });
  });

  // ── Minimum buddies section ─────────────────────────────────────

  describe("minimum buddies section", () => {
    it("renders minimum buddies section", () => {
      render(<BuddiesBudgetStep {...defaultProps} />);
      expect(screen.getByText("Minimum Buddies")).toBeDefined();
    });

    it("min buddies input starts with initial value", () => {
      render(<BuddiesBudgetStep {...defaultProps} initialMinBuddies={2} />);
      const input = screen.getByDisplayValue("2");
      expect(input).toBeDefined();
    });

    it("min buddies clamped to eligible member count max", () => {
      const onChange = vi.fn();
      // Eligible members: member-2, member-3 (not self, not pending) = 2
      render(<BuddiesBudgetStep {...defaultProps} onChange={onChange} />);
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
      render(<BuddiesBudgetStep {...defaultProps} onChange={onChange} />);
      const input = document.querySelector(
        'input[type="number"]'
      ) as HTMLInputElement;

      fireEvent.change(input, { target: { value: "-5" } });

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ minBuddies: 0 })
      );
    });
  });

  // ── Buddy preferences section ──────────────────────────────────

  describe("buddy preferences section", () => {
    it("renders eligible members excluding pending_approval and self", () => {
      render(<BuddiesBudgetStep {...defaultProps} />);
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
          budget: null,
          joinedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        },
      ];
      render(<BuddiesBudgetStep {...defaultProps} />);
      expect(
        screen.getByText("No other members in this group yet.")
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
          budget: null,
          joinedAt: new Date().toISOString(),
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
          budget: null,
          joinedAt: null,
          createdAt: new Date().toISOString(),
        },
      ];
      render(<BuddiesBudgetStep {...defaultProps} />);
      expect(screen.queryByText("Eve Pending")).toBeNull();
      expect(
        screen.getByText("No other members in this group yet.")
      ).toBeDefined();
    });
  });

  // ── Buddy toggle cycle ─────────────────────────────────────────

  describe("buddy toggle cycle", () => {
    it("toggles None → Required (hard)", () => {
      const onChange = vi.fn();
      render(<BuddiesBudgetStep {...defaultProps} onChange={onChange} />);

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
        <BuddiesBudgetStep
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
        <BuddiesBudgetStep
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
      render(<BuddiesBudgetStep {...defaultProps} onChange={onChange} />);

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
    it("onChange called on budget change", () => {
      const onChange = vi.fn();
      render(<BuddiesBudgetStep {...defaultProps} onChange={onChange} />);
      const inputs = document.querySelectorAll('input[inputmode="numeric"]');
      const budgetInput = inputs[0] as HTMLInputElement;

      fireEvent.change(budgetInput, { target: { value: "100" } });

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          budget: 100,
          minBuddies: 0,
          buddies: [],
        })
      );
    });

    it("onChange called on minBuddies change", () => {
      const onChange = vi.fn();
      render(<BuddiesBudgetStep {...defaultProps} onChange={onChange} />);
      const input = document.querySelector(
        'input[type="number"]'
      ) as HTMLInputElement;

      fireEvent.change(input, { target: { value: "1" } });

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          budget: null,
          minBuddies: 1,
          buddies: [],
        })
      );
    });

    it("onChange called on buddy toggle", () => {
      const onChange = vi.fn();
      render(<BuddiesBudgetStep {...defaultProps} onChange={onChange} />);

      const charlieButton = screen
        .getByText("Charlie Brown")
        .closest("button")!;
      fireEvent.click(charlieButton);

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          budget: null,
          minBuddies: 0,
          buddies: [{ memberId: "member-3", type: "hard" }],
        })
      );
    });
  });

  // ── Initial buddies pre-populated ──────────────────────────────

  describe("initial buddies pre-populated", () => {
    it("renders initial buddies with correct states", () => {
      render(
        <BuddiesBudgetStep
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
