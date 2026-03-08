// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import PreferenceWizard from "@/app/(main)/groups/[groupId]/preferences/_components/preference-wizard";

// ─── Mocks ──────────────────────────────────────────────────────────

const mockReplace = vi.fn();
const mockRefresh = vi.fn();
const mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, refresh: mockRefresh }),
  useSearchParams: () => mockSearchParams,
}));

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
  members: [],
};

vi.mock("@/app/(main)/groups/[groupId]/_components/group-context", () => ({
  useGroup: () => mockGroup,
}));

// Mock child step components to keep tests focused on wizard navigation
vi.mock(
  "@/app/(main)/groups/[groupId]/preferences/_components/buddies-budget-step",
  () => ({
    default: ({ onChange }: { onChange: () => void }) => (
      <div data-testid="buddies-budget-step">Buddies & Budget Step</div>
    ),
  })
);

vi.mock(
  "@/app/(main)/groups/[groupId]/preferences/_components/sport-rankings-step",
  () => ({
    default: () => (
      <div data-testid="sport-rankings-step">Sport Rankings Step</div>
    ),
  })
);

vi.mock(
  "@/app/(main)/groups/[groupId]/preferences/_components/sessions-step",
  () => ({
    default: () => <div data-testid="sessions-step">Sessions Step</div>,
  })
);

const mockSaveBuddiesBudget = vi.fn(() => Promise.resolve({ success: true }));
const mockSaveSportRankings = vi.fn(() => Promise.resolve({ success: true }));
const mockSaveSessionsPlaceholder = vi.fn(() =>
  Promise.resolve({ success: true })
);

vi.mock("@/app/(main)/groups/[groupId]/preferences/actions", () => ({
  saveBuddiesBudget: (...args: unknown[]) => mockSaveBuddiesBudget(...args),
  saveSportRankings: (...args: unknown[]) => mockSaveSportRankings(...args),
  saveSessionsPlaceholder: (...args: unknown[]) =>
    mockSaveSessionsPlaceholder(...args),
}));

// ─── Helpers ────────────────────────────────────────────────────────

const defaultProps = {
  initialBudget: null,
  initialMinBuddies: 0,
  initialBuddies: [] as { memberId: string; type: "hard" | "soft" }[],
  initialSportRankings: [] as string[],
  initialPreferenceStep: null,
  initialStatus: "joined",
  availableSports: ["Tennis", "Swimming"],
};

function setSearchParam(key: string, value: string) {
  mockSearchParams.set(key, value);
}

function clearSearchParams() {
  for (const key of [...mockSearchParams.keys()]) {
    mockSearchParams.delete(key);
  }
}

// ─── Tests ──────────────────────────────────────────────────────────

describe("PreferenceWizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSearchParams();
    mockGroup.phase = "preferences";
  });

  afterEach(() => {
    cleanup();
  });

  // ── Step initialization from DB ────────────────────────────────

  describe("step initialization from DB state", () => {
    it("starts on step 0 when no preference progress", () => {
      render(<PreferenceWizard {...defaultProps} />);
      expect(screen.getByTestId("buddies-budget-step")).toBeDefined();
    });

    it("starts on step 1 when buddies_budget is completed", () => {
      render(
        <PreferenceWizard
          {...defaultProps}
          initialPreferenceStep="buddies_budget"
        />
      );
      expect(screen.getByTestId("sport-rankings-step")).toBeDefined();
    });

    it("starts on step 2 when sport_rankings is completed", () => {
      render(
        <PreferenceWizard
          {...defaultProps}
          initialPreferenceStep="sport_rankings"
        />
      );
      expect(screen.getByTestId("sessions-step")).toBeDefined();
    });

    it("starts on step 0 with all complete when fully done", () => {
      render(
        <PreferenceWizard
          {...defaultProps}
          initialPreferenceStep="sessions"
          initialStatus="preferences_set"
        />
      );
      // Should show step 0 (review mode) with all steps completed
      expect(screen.getByTestId("buddies-budget-step")).toBeDefined();
    });
  });

  // ── URL search param overrides DB step ─────────────────────────

  describe("URL step parameter", () => {
    it("uses URL step param instead of DB-derived step", () => {
      // DB says go to step 1, but URL says step 2
      setSearchParam("step", "sessions");
      render(
        <PreferenceWizard
          {...defaultProps}
          initialPreferenceStep="buddies_budget"
        />
      );
      expect(screen.getByTestId("sessions-step")).toBeDefined();
    });

    it("overrides to step 0 via URL when DB says step 1", () => {
      setSearchParam("step", "buddies_budget");
      render(
        <PreferenceWizard
          {...defaultProps}
          initialPreferenceStep="buddies_budget"
        />
      );
      // DB would send to step 1, but URL overrides to step 0
      expect(screen.getByTestId("buddies-budget-step")).toBeDefined();
    });

    it("overrides to sport_rankings step via URL", () => {
      setSearchParam("step", "sport_rankings");
      render(<PreferenceWizard {...defaultProps} />);
      expect(screen.getByTestId("sport-rankings-step")).toBeDefined();
    });

    it("ignores invalid URL step param and falls back to DB", () => {
      setSearchParam("step", "nonexistent_step");
      render(
        <PreferenceWizard
          {...defaultProps}
          initialPreferenceStep="buddies_budget"
        />
      );
      // Should fall back to DB-derived step (1)
      expect(screen.getByTestId("sport-rankings-step")).toBeDefined();
    });

    it("falls back to DB step when no URL param", () => {
      render(
        <PreferenceWizard
          {...defaultProps}
          initialPreferenceStep="sport_rankings"
        />
      );
      expect(screen.getByTestId("sessions-step")).toBeDefined();
    });
  });

  // ── URL updates on navigation ──────────────────────────────────

  describe("URL updates on navigation", () => {
    it("updates URL when clicking Save & Continue", async () => {
      render(<PreferenceWizard {...defaultProps} />);

      const nextButton = screen.getByText("Save & Continue");
      fireEvent.click(nextButton);

      // Wait for async save
      await vi.waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith("?step=sport_rankings", {
          scroll: false,
        });
      });
    });

    it("updates URL when clicking Back", async () => {
      // Start on step 1
      setSearchParam("step", "sport_rankings");
      render(
        <PreferenceWizard
          {...defaultProps}
          initialPreferenceStep="buddies_budget"
        />
      );

      const backButton = screen.getByText("Back");
      fireEvent.click(backButton);

      expect(mockReplace).toHaveBeenCalledWith(
        expect.stringContaining("step=buddies_budget"),
        { scroll: false }
      );
    });

    it("updates URL when clicking a completed step indicator", async () => {
      // Start with step 0 completed, currently on step 1
      render(
        <PreferenceWizard
          {...defaultProps}
          initialPreferenceStep="buddies_budget"
        />
      );

      // Click the "Buddies & Budget" step indicator (step 0, which is completed)
      const stepButtons = screen.getAllByRole("button");
      const buddiesStepButton = stepButtons.find((btn) =>
        btn.textContent?.includes("Buddies & Budget")
      );
      expect(buddiesStepButton).toBeDefined();
      fireEvent.click(buddiesStepButton!);

      expect(mockReplace).toHaveBeenCalledWith(
        expect.stringContaining("step=buddies_budget"),
        { scroll: false }
      );
    });
  });

  // ── Step navigation behavior ───────────────────────────────────

  describe("step navigation", () => {
    it("advances to next step after successful save", async () => {
      render(<PreferenceWizard {...defaultProps} />);
      expect(screen.getByTestId("buddies-budget-step")).toBeDefined();

      fireEvent.click(screen.getByText("Save & Continue"));

      await vi.waitFor(() => {
        expect(screen.getByTestId("sport-rankings-step")).toBeDefined();
      });
    });

    it("stays on current step when save fails", async () => {
      mockSaveBuddiesBudget.mockResolvedValueOnce({
        error: "Validation error",
      });
      render(<PreferenceWizard {...defaultProps} />);

      fireEvent.click(screen.getByText("Save & Continue"));

      await vi.waitFor(() => {
        expect(screen.getByText("Validation error")).toBeDefined();
      });
      // Should still be on step 0
      expect(screen.getByTestId("buddies-budget-step")).toBeDefined();
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it("does not show Back button on first step", () => {
      render(<PreferenceWizard {...defaultProps} />);
      expect(screen.queryByText("Back")).toBeNull();
    });

    it("shows Back button on steps after the first", () => {
      setSearchParam("step", "sport_rankings");
      render(
        <PreferenceWizard
          {...defaultProps}
          initialPreferenceStep="buddies_budget"
        />
      );
      expect(screen.getByText("Back")).toBeDefined();
    });

    it("shows Finish button on last step", () => {
      setSearchParam("step", "sessions");
      render(
        <PreferenceWizard
          {...defaultProps}
          initialPreferenceStep="sport_rankings"
        />
      );
      expect(screen.getByText("Finish")).toBeDefined();
    });

    it("does not allow clicking incomplete future steps", () => {
      render(<PreferenceWizard {...defaultProps} />);

      // Step 2 (Sessions) button should be disabled
      const stepButtons = screen.getAllByRole("button");
      const sessionsButton = stepButtons.find((btn) =>
        btn.textContent?.includes("Sessions")
      );
      expect(sessionsButton).toBeDefined();
      expect(sessionsButton!.hasAttribute("disabled")).toBe(true);
    });
  });

  // ── Locked state ───────────────────────────────────────────────

  describe("locked state", () => {
    it("shows locked message when group phase is not preferences", () => {
      mockGroup.phase = "scheduling";
      render(<PreferenceWizard {...defaultProps} />);

      expect(screen.getByText("Preferences Locked")).toBeDefined();
      expect(screen.queryByText("Save & Continue")).toBeNull();
    });
  });
});
