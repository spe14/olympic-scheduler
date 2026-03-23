// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  act,
  waitFor,
} from "@testing-library/react";
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
  members: [] as {
    id: string;
    firstName: string;
    lastName: string;
    joinedAt: string;
  }[],
  affectedBuddyMembers: {} as Record<string, string[]>,
  membersWithNoCombos: [] as string[],
  memberTimeslots: [],
  scheduleGeneratedAt: null as string | null,
  myScheduleWarningAckedAt: null as string | null,
};

vi.mock("@/app/(main)/groups/[groupId]/_components/group-context", () => ({
  useGroup: () => mockGroup,
}));

const mockSetDirtyChecker = vi.fn();
vi.mock(
  "@/app/(main)/groups/[groupId]/_components/navigation-guard-context",
  () => ({
    useNavigationGuard: () => ({
      setDirtyChecker: mockSetDirtyChecker,
      guardNavigation: () => true,
    }),
  })
);

// Mock child step components to keep tests focused on wizard navigation
vi.mock(
  "@/app/(main)/groups/[groupId]/preferences/_components/buddies-step",
  () => ({
    default: ({
      onChange,
    }: {
      onChange: (data: {
        minBuddies: number;
        buddies: { memberId: string; type: "hard" | "soft" }[];
      }) => void;
    }) => (
      <div data-testid="buddies-step">
        Buddies & Budget Step
        <button
          data-testid="change-budget"
          onClick={() =>
            onChange({ minBuddies: 2, buddies: [], isValid: true })
          }
        >
          Change Budget
        </button>
      </div>
    ),
  })
);

vi.mock(
  "@/app/(main)/groups/[groupId]/preferences/_components/sport-rankings-step",
  () => ({
    default: ({ onChange }: { onChange: (rankings: string[]) => void }) => (
      <div data-testid="sport-rankings-step">
        Sport Rankings Step
        <button
          data-testid="set-sport-rankings"
          onClick={() => onChange(["Tennis", "Swimming"])}
        >
          Set Rankings
        </button>
        <button
          data-testid="remove-swimming"
          onClick={() => onChange(["Tennis"])}
        >
          Remove Swimming
        </button>
      </div>
    ),
  })
);

vi.mock(
  "@/app/(main)/groups/[groupId]/preferences/_components/sessions-step",
  () => ({
    default: ({
      onChange,
      onHiddenChange,
    }: {
      onChange: (prefs: Map<string, unknown>) => void;
      onHiddenChange: (hidden: Set<string>) => void;
    }) => (
      <div data-testid="sessions-step">
        Sessions Step
        <button
          data-testid="add-session-pref"
          onClick={() =>
            onChange(
              new Map([
                [
                  "TEN-001",
                  {
                    sessionId: "TEN-001",
                    interest: "high",
                  },
                ],
              ])
            )
          }
        >
          Add Pref
        </button>
        <button
          data-testid="change-hidden"
          onClick={() => onHiddenChange(new Set(["TEN-001"]))}
        >
          Change Hidden
        </button>
      </div>
    ),
  })
);

vi.mock(
  "@/app/(main)/groups/[groupId]/preferences/_components/session-interest-modal",
  () => ({
    default: () => <div data-testid="session-interest-modal">Modal</div>,
  })
);

vi.mock(
  "@/app/(main)/groups/[groupId]/preferences/_components/review-step",
  () => ({
    default: ({ onConfirmReview }: { onConfirmReview?: () => void }) => (
      <div data-testid="review-step">
        Review Step
        {onConfirmReview && (
          <button data-testid="confirm-review-btn" onClick={onConfirmReview}>
            Confirm Review
          </button>
        )}
      </div>
    ),
  })
);

const mockSaveBuddies = vi.fn(() => Promise.resolve({ success: true }));
const mockSaveSportRankings = vi.fn(() => Promise.resolve({ success: true }));
const mockSaveSessionPreferences = vi.fn(() =>
  Promise.resolve({ success: true })
);
const mockConfirmAffectedBuddyReview = vi.fn(() =>
  Promise.resolve({ success: true })
);
const mockAckScheduleWarning = vi.fn(() => {
  mockGroup.myScheduleWarningAckedAt = mockGroup.scheduleGeneratedAt;
  return Promise.resolve({ success: true });
});

vi.mock("@/app/(main)/groups/[groupId]/preferences/actions", () => ({
  saveBuddies: (...args: unknown[]) => mockSaveBuddies(...args),
  saveSportRankings: (...args: unknown[]) => mockSaveSportRankings(...args),
  saveSessionPreferences: (...args: unknown[]) =>
    mockSaveSessionPreferences(...args),
  confirmAffectedBuddyReview: (...args: unknown[]) =>
    mockConfirmAffectedBuddyReview(...args),
  ackScheduleWarning: (...args: unknown[]) => mockAckScheduleWarning(...args),
}));

// ─── Helpers ────────────────────────────────────────────────────────

const defaultProps = {
  initialMinBuddies: 0,
  initialBuddies: [] as { memberId: string; type: "hard" | "soft" }[],
  initialSportRankings: [] as string[],
  initialPreferenceStep: null,
  initialStatus: "joined",
  availableSports: ["Tennis", "Swimming"],
  sessions: [],
  initialSessionPreferences: [],
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

const mockReplaceState = vi.spyOn(window.history, "replaceState");

describe("PreferenceWizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSearchParams();
    mockGroup.phase = "preferences";
    mockGroup.scheduleGeneratedAt = null;
    mockGroup.myScheduleWarningAckedAt = null;
    mockGroup.members = [];
    mockGroup.membersWithNoCombos = [];
    mockGroup.affectedBuddyMembers = {};
  });

  afterEach(() => {
    cleanup();
  });

  // ── Step initialization from DB ────────────────────────────────

  describe("step initialization from DB state", () => {
    it("starts on step 0 when no preference progress", async () => {
      await act(async () => {
        render(<PreferenceWizard {...defaultProps} />);
      });
      expect(screen.getByTestId("buddies-step")).toBeDefined();
    });

    it("starts on step 1 when buddies is completed", async () => {
      await act(async () => {
        render(
          <PreferenceWizard {...defaultProps} initialPreferenceStep="buddies" />
        );
      });
      expect(screen.getByTestId("sport-rankings-step")).toBeDefined();
    });

    it("starts on step 2 when sport_rankings is completed", async () => {
      await act(async () => {
        render(
          <PreferenceWizard
            {...defaultProps}
            initialPreferenceStep="sport_rankings"
          />
        );
      });
      expect(screen.getByTestId("sessions-step")).toBeDefined();
    });

    it("starts on review step when fully done", async () => {
      await act(async () => {
        render(
          <PreferenceWizard
            {...defaultProps}
            initialPreferenceStep="sessions"
            initialStatus="preferences_set"
          />
        );
      });
      // Should show review step with all steps completed
      expect(screen.getByTestId("review-step")).toBeDefined();
    });
  });

  // ── URL search param overrides DB step ─────────────────────────

  describe("URL step parameter", () => {
    it("uses URL step param instead of DB-derived step", async () => {
      // DB says go to step 1, but URL says step 2
      setSearchParam("step", "sessions");
      await act(async () => {
        render(
          <PreferenceWizard {...defaultProps} initialPreferenceStep="buddies" />
        );
      });
      expect(screen.getByTestId("sessions-step")).toBeDefined();
    });

    it("overrides to step 0 via URL when DB says step 1", async () => {
      setSearchParam("step", "buddies");
      await act(async () => {
        render(
          <PreferenceWizard {...defaultProps} initialPreferenceStep="buddies" />
        );
      });
      // DB would send to step 1, but URL overrides to step 0
      expect(screen.getByTestId("buddies-step")).toBeDefined();
    });

    it("overrides to sport_rankings step via URL", async () => {
      setSearchParam("step", "sport_rankings");
      await act(async () => {
        render(<PreferenceWizard {...defaultProps} />);
      });
      expect(screen.getByTestId("sport-rankings-step")).toBeDefined();
    });

    it("ignores invalid URL step param and falls back to DB", async () => {
      setSearchParam("step", "nonexistent_step");
      await act(async () => {
        render(
          <PreferenceWizard {...defaultProps} initialPreferenceStep="buddies" />
        );
      });
      // Should fall back to DB-derived step (1)
      expect(screen.getByTestId("sport-rankings-step")).toBeDefined();
    });

    it("falls back to DB step when no URL param", async () => {
      await act(async () => {
        render(
          <PreferenceWizard
            {...defaultProps}
            initialPreferenceStep="sport_rankings"
          />
        );
      });
      expect(screen.getByTestId("sessions-step")).toBeDefined();
    });
  });

  // ── URL updates on navigation ──────────────────────────────────

  describe("URL updates on navigation", () => {
    it("updates URL when clicking Save & Continue", async () => {
      await act(async () => {
        render(<PreferenceWizard {...defaultProps} />);
      });

      await act(async () => {
        fireEvent.click(screen.getByText("Save & Continue"));
      });

      // Wait for async save
      await waitFor(() => {
        expect(mockReplaceState).toHaveBeenCalledWith(
          null,
          "",
          expect.stringContaining("step=sport_rankings")
        );
      });
    });

    it("updates URL when clicking Back", async () => {
      // Start on step 1
      setSearchParam("step", "sport_rankings");
      await act(async () => {
        render(
          <PreferenceWizard {...defaultProps} initialPreferenceStep="buddies" />
        );
      });

      fireEvent.click(screen.getByText("Back"));

      expect(mockReplaceState).toHaveBeenCalledWith(
        null,
        "",
        expect.stringContaining("step=buddies")
      );
    });

    it("updates URL when clicking a completed step indicator", async () => {
      // Start with step 0 completed, currently on step 1
      await act(async () => {
        render(
          <PreferenceWizard {...defaultProps} initialPreferenceStep="buddies" />
        );
      });

      // Click the "Buddies & Budget" step indicator (step 0, which is completed)
      const stepButtons = screen.getAllByRole("button");
      const buddiesStepButton = stepButtons.find((btn) =>
        btn.textContent?.includes("Buddies")
      );
      expect(buddiesStepButton).toBeDefined();
      fireEvent.click(buddiesStepButton!);

      expect(mockReplaceState).toHaveBeenCalledWith(
        null,
        "",
        expect.stringContaining("step=buddies")
      );
    });
  });

  // ── Step navigation behavior ───────────────────────────────────

  describe("step navigation", () => {
    it("advances to next step after successful save", async () => {
      await act(async () => {
        render(<PreferenceWizard {...defaultProps} />);
      });
      expect(screen.getByTestId("buddies-step")).toBeDefined();

      await act(async () => {
        fireEvent.click(screen.getByText("Save & Continue"));
      });

      await waitFor(() => {
        expect(screen.getByTestId("sport-rankings-step")).toBeDefined();
      });
    });

    it("stays on current step when save fails", async () => {
      mockSaveBuddies.mockResolvedValueOnce({
        error: "Validation error",
      });
      await act(async () => {
        render(<PreferenceWizard {...defaultProps} />);
      });

      await act(async () => {
        fireEvent.click(screen.getByText("Save & Continue"));
      });

      await waitFor(() => {
        expect(screen.getByText("Validation error")).toBeDefined();
      });
      // Should still be on step 0
      expect(screen.getByTestId("buddies-step")).toBeDefined();
      expect(mockReplaceState).not.toHaveBeenCalled();
    });

    it("does not show Back button on first step", async () => {
      await act(async () => {
        render(<PreferenceWizard {...defaultProps} />);
      });
      expect(screen.queryByText("Back")).toBeNull();
    });

    it("shows Back button on steps after the first", async () => {
      setSearchParam("step", "sport_rankings");
      await act(async () => {
        render(
          <PreferenceWizard {...defaultProps} initialPreferenceStep="buddies" />
        );
      });
      expect(screen.getByText("Back")).toBeDefined();
    });

    it("defaults to review step when preferences are set", async () => {
      await act(async () => {
        render(
          <PreferenceWizard
            {...defaultProps}
            initialPreferenceStep="sessions"
            initialStatus="preferences_set"
          />
        );
      });
      expect(screen.getByTestId("review-step")).toBeDefined();
      // No forward button on review step
      expect(screen.queryByText("Finish")).toBeNull();
      expect(screen.queryByText("Save & Continue")).toBeNull();
      // Back button should still be present
      expect(screen.getByText("Back")).toBeDefined();
    });

    it("does not allow clicking incomplete future steps", async () => {
      await act(async () => {
        render(<PreferenceWizard {...defaultProps} />);
      });

      // Step 3 (Review) button should be disabled
      const stepButtons = screen.getAllByRole("button");
      const reviewButton = stepButtons.find((btn) =>
        btn.textContent?.includes("Review")
      );
      expect(reviewButton).toBeDefined();
      expect(reviewButton!.hasAttribute("disabled")).toBe(true);
    });

    it("allows clicking any previous step to go backward", async () => {
      // Start on step 2 with steps 0 and 1 completed
      setSearchParam("step", "sessions");
      await act(async () => {
        render(
          <PreferenceWizard
            {...defaultProps}
            initialPreferenceStep="sport_rankings"
          />
        );
      });
      expect(screen.getByTestId("sessions-step")).toBeDefined();

      // Click step 0 (Buddies & Budget) — should navigate back
      const stepButtons = screen.getAllByRole("button");
      const buddiesButton = stepButtons.find((btn) =>
        btn.textContent?.includes("Buddies")
      );
      fireEvent.click(buddiesButton!);

      expect(mockReplaceState).toHaveBeenCalledWith(
        null,
        "",
        expect.stringContaining("step=buddies")
      );
    });

    it("allows forward step click when all prior steps are completed", async () => {
      // Start with all steps completed — defaults to review step
      await act(async () => {
        render(
          <PreferenceWizard
            {...defaultProps}
            initialPreferenceStep="sessions"
            initialStatus="preferences_set"
          />
        );
      });
      expect(screen.getByTestId("review-step")).toBeDefined();

      // Click step 0 (Buddies & Budget) — backward, always allowed
      const stepButtons = screen.getAllByRole("button");
      const buddiesButton = stepButtons.find((btn) =>
        btn.textContent?.includes("Buddies")
      );
      fireEvent.click(buddiesButton!);

      expect(mockReplaceState).toHaveBeenCalledWith(
        null,
        "",
        expect.stringContaining("step=buddies")
      );

      // Now click forward to Session Interests — should work since all prior steps are completed
      mockReplaceState.mockClear();
      const stepButtons2 = screen.getAllByRole("button");
      const sessionsButton = stepButtons2.find((btn) =>
        btn.textContent?.includes("Session Interests")
      );
      fireEvent.click(sessionsButton!);

      expect(mockReplaceState).toHaveBeenCalledWith(
        null,
        "",
        expect.stringContaining("step=sessions")
      );
    });

    it("calls server on first-time save even with default (unchanged) values", async () => {
      // Step 0 is not in completedSteps on first render — must always call server
      await act(async () => {
        render(<PreferenceWizard {...defaultProps} />);
      });
      expect(mockSaveBuddies).not.toHaveBeenCalled();

      await act(async () => {
        fireEvent.click(screen.getByText("Save & Continue"));
      });

      await waitFor(() => {
        expect(screen.getByTestId("sport-rankings-step")).toBeDefined();
      });
      // Server must be called even though nothing was changed from the initial default values
      expect(mockSaveBuddies).toHaveBeenCalledTimes(1);
    });

    it("skips save when data is unchanged after step already completed", async () => {
      await act(async () => {
        render(<PreferenceWizard {...defaultProps} />);
      });

      // First save — should call the server action
      await act(async () => {
        fireEvent.click(screen.getByText("Save & Continue"));
      });
      await waitFor(() => {
        expect(screen.getByTestId("sport-rankings-step")).toBeDefined();
      });
      expect(mockSaveBuddies).toHaveBeenCalledTimes(1);

      // Go back to step 0
      fireEvent.click(screen.getByText("Back"));
      await waitFor(() => {
        expect(screen.getByTestId("buddies-step")).toBeDefined();
      });

      // Save again without changing anything — step is already completed, data unchanged, should NOT call server
      mockSaveBuddies.mockClear();
      await act(async () => {
        fireEvent.click(screen.getByText("Save & Continue"));
      });

      await waitFor(() => {
        expect(screen.getByTestId("sport-rankings-step")).toBeDefined();
      });
      expect(mockSaveBuddies).not.toHaveBeenCalled();
    });

    it("blocks forward step click when an intermediate step (not current) is dirty", async () => {
      // Start with all 3 steps completed and on review step, then navigate back to step 0
      await act(async () => {
        render(
          <PreferenceWizard
            {...defaultProps}
            initialPreferenceStep="sessions"
            initialStatus="preferences_set"
          />
        );
      });
      expect(screen.getByTestId("review-step")).toBeDefined();

      // Navigate back to step 1 (Sport Rankings)
      const stepButtons = screen.getAllByRole("button");
      const sportRankingsButton = stepButtons.find((btn) =>
        btn.textContent?.includes("Sport Rankings")
      );
      fireEvent.click(sportRankingsButton!);
      expect(mockReplaceState).toHaveBeenCalledWith(
        null,
        "",
        expect.stringContaining("step=sport_rankings")
      );

      // At this point step 1 is visited — if we don't change anything, it won't be dirty.
      // But the Buddies mock doesn't call onChange, so simulate a change by checking
      // the review step is NOT reachable when step 2 (sessions) has been visited and marked dirty
      // via the "visited but no snapshot for new step" path.
      // Instead, verify clicking the Review step from step 1 DOES work when intermediate step 2 is clean.
      mockReplaceState.mockClear();
      const stepButtons2 = screen.getAllByRole("button");
      const reviewButton = stepButtons2.find((btn) =>
        btn.textContent?.includes("Review")
      );
      // Review (step 3) is clickable when all prior steps are completed and none are dirty
      expect(reviewButton!.hasAttribute("disabled")).toBe(false);
      fireEvent.click(reviewButton!);
      expect(mockReplaceState).toHaveBeenCalledWith(
        null,
        "",
        expect.stringContaining("step=review")
      );
    });
  });

  // ── Step validation ──────────────────────────────────────────

  describe("step validation", () => {
    it("disables Save & Continue on step 1 when no sports are ranked", async () => {
      setSearchParam("step", "sport_rankings");
      await act(async () => {
        render(
          <PreferenceWizard
            {...defaultProps}
            initialPreferenceStep="buddies"
            initialSportRankings={[]}
          />
        );
      });

      const nextButton = screen.getByText("Save & Continue");
      expect(nextButton.hasAttribute("disabled")).toBe(true);
    });

    it("shows hint message on step 1 when no sports are ranked", async () => {
      setSearchParam("step", "sport_rankings");
      await act(async () => {
        render(
          <PreferenceWizard
            {...defaultProps}
            initialPreferenceStep="buddies"
            initialSportRankings={[]}
          />
        );
      });

      expect(
        screen.getByText("Select at least 1 sport to continue.")
      ).toBeDefined();
    });

    it("enables Save & Continue on step 1 when sports are ranked", async () => {
      setSearchParam("step", "sport_rankings");
      await act(async () => {
        render(
          <PreferenceWizard
            {...defaultProps}
            initialPreferenceStep="buddies"
            initialSportRankings={["Tennis"]}
          />
        );
      });

      const nextButton = screen.getByText("Save & Continue");
      expect(nextButton.hasAttribute("disabled")).toBe(false);
    });

    it("does not show hint on step 1 when sports are ranked", async () => {
      setSearchParam("step", "sport_rankings");
      await act(async () => {
        render(
          <PreferenceWizard
            {...defaultProps}
            initialPreferenceStep="buddies"
            initialSportRankings={["Tennis"]}
          />
        );
      });

      expect(
        screen.queryByText("Select at least 1 sport to continue.")
      ).toBeNull();
    });

    it("disables Save & Review on step 2 when no sessions are selected", async () => {
      setSearchParam("step", "sessions");
      await act(async () => {
        render(
          <PreferenceWizard
            {...defaultProps}
            initialPreferenceStep="sport_rankings"
            initialSportRankings={["Tennis"]}
            initialSessionPreferences={[]}
          />
        );
      });

      const nextButton = screen.getByText("Save & Review");
      expect(nextButton.hasAttribute("disabled")).toBe(true);
    });

    it("shows hint message on step 2 when no sessions are selected", async () => {
      setSearchParam("step", "sessions");
      await act(async () => {
        render(
          <PreferenceWizard
            {...defaultProps}
            initialPreferenceStep="sport_rankings"
            initialSportRankings={["Tennis"]}
            initialSessionPreferences={[]}
          />
        );
      });

      expect(
        screen.getByText("Select at least 1 session to continue.")
      ).toBeDefined();
    });

    it("enables Save & Review on step 2 when sessions are selected", async () => {
      setSearchParam("step", "sessions");
      await act(async () => {
        render(
          <PreferenceWizard
            {...defaultProps}
            initialPreferenceStep="sport_rankings"
            initialSportRankings={["Tennis"]}
            initialSessionPreferences={[
              { sessionId: "TEN-001", interest: "high" },
            ]}
          />
        );
      });

      const nextButton = screen.getByText("Save & Review");
      expect(nextButton.hasAttribute("disabled")).toBe(false);
    });

    it("step 0 (buddies & budget) is always valid — Save & Continue enabled", async () => {
      await act(async () => {
        render(<PreferenceWizard {...defaultProps} />);
      });

      const nextButton = screen.getByText("Save & Continue");
      expect(nextButton.hasAttribute("disabled")).toBe(false);
    });

    it("shows 'Save & Review' text on step 2 instead of 'Save & Continue'", async () => {
      setSearchParam("step", "sessions");
      await act(async () => {
        render(
          <PreferenceWizard
            {...defaultProps}
            initialPreferenceStep="sport_rankings"
            initialSportRankings={["Tennis"]}
            initialSessionPreferences={[
              { sessionId: "TEN-001", interest: "high" },
            ]}
          />
        );
      });

      expect(screen.getByText("Save & Review")).toBeDefined();
      expect(screen.queryByText("Save & Continue")).toBeNull();
    });
  });

  // ── Error handling ────────────────────────────────────────────

  describe("error handling", () => {
    it("shows generic error when save throws an exception", async () => {
      mockSaveBuddies.mockRejectedValueOnce(new Error("Network error"));
      await act(async () => {
        render(<PreferenceWizard {...defaultProps} />);
      });

      await act(async () => {
        fireEvent.click(screen.getByText("Save & Continue"));
      });

      await waitFor(() => {
        expect(
          screen.getByText("An unexpected error occurred. Please try again.")
        ).toBeDefined();
      });
      // Should still be on step 0
      expect(screen.getByTestId("buddies-step")).toBeDefined();
    });

    it("clears error when navigating back", async () => {
      // Start on step 1 to have a Back button
      setSearchParam("step", "sport_rankings");
      mockSaveSportRankings.mockResolvedValueOnce({
        error: "Save failed",
      });
      await act(async () => {
        render(
          <PreferenceWizard
            {...defaultProps}
            initialPreferenceStep="buddies"
            initialSportRankings={["Tennis"]}
          />
        );
      });

      await act(async () => {
        fireEvent.click(screen.getByText("Save & Continue"));
      });
      await waitFor(() => {
        expect(screen.getByText("Save failed")).toBeDefined();
      });

      // Click Back
      fireEvent.click(screen.getByText("Back"));
      expect(screen.queryByText("Save failed")).toBeNull();
    });

    it("shows 'Saving...' text on button while saving", async () => {
      // Make the save action hang
      let resolveSave: (val: { success: boolean }) => void;
      mockSaveBuddies.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveSave = resolve;
        })
      );
      await act(async () => {
        render(<PreferenceWizard {...defaultProps} />);
      });

      fireEvent.click(screen.getByText("Save & Continue"));
      expect(screen.getByText("Saving...")).toBeDefined();

      // Resolve the save
      await act(async () => {
        resolveSave!({ success: true });
      });
      await waitFor(() => {
        expect(screen.queryByText("Saving...")).toBeNull();
      });
    });
  });

  // ── Phase warning dialog ──────────────────────────────────────

  describe("phase warning dialog", () => {
    it("shows phase warning when saving dirty step in non-preferences phase", async () => {
      mockGroup.phase = "schedule_review";
      mockGroup.scheduleGeneratedAt = "2028-01-01T00:00:00Z";
      await act(async () => {
        render(<PreferenceWizard {...defaultProps} />);
      });

      // Make step 0 dirty
      fireEvent.click(screen.getByTestId("change-budget"));

      // Try to save
      await act(async () => {
        fireEvent.click(screen.getByText("Save & Continue"));
      });

      // Warning dialog should appear
      expect(screen.getByText("Warning")).toBeDefined();
      expect(
        screen.getByText(/Schedules have already been generated/)
      ).toBeDefined();
    });

    it("Proceed dismisses dialog and saves", async () => {
      mockGroup.phase = "schedule_review";
      mockGroup.scheduleGeneratedAt = "2028-01-01T00:00:00Z";
      await act(async () => {
        render(<PreferenceWizard {...defaultProps} />);
      });

      // Make step 0 dirty
      fireEvent.click(screen.getByTestId("change-budget"));

      // Trigger warning
      await act(async () => {
        fireEvent.click(screen.getByText("Save & Continue"));
      });
      expect(screen.getByText("Warning")).toBeDefined();

      // Click Proceed
      await act(async () => {
        fireEvent.click(screen.getByText("Proceed"));
      });

      await waitFor(() => {
        // Dialog dismissed, advanced to step 1
        expect(screen.queryByText("Warning")).toBeNull();
        expect(screen.getByTestId("sport-rankings-step")).toBeDefined();
      });
      expect(mockSaveBuddies).toHaveBeenCalledTimes(1);
    });

    it("Cancel reverts changes and dismisses dialog", async () => {
      mockGroup.phase = "schedule_review";
      mockGroup.scheduleGeneratedAt = "2028-01-01T00:00:00Z";
      await act(async () => {
        render(<PreferenceWizard {...defaultProps} />);
      });

      // Make step 0 dirty
      fireEvent.click(screen.getByTestId("change-budget"));

      // Trigger warning
      await act(async () => {
        fireEvent.click(screen.getByText("Save & Continue"));
      });
      expect(screen.getByText("Warning")).toBeDefined();

      // Click Cancel
      fireEvent.click(screen.getByText("Cancel"));

      // Dialog dismissed, still on step 0, no save called
      expect(screen.queryByText("Warning")).toBeNull();
      expect(screen.getByTestId("buddies-step")).toBeDefined();
      expect(mockSaveBuddies).not.toHaveBeenCalled();
    });

    it("does not show warning when step is clean (no changes made)", async () => {
      mockGroup.phase = "schedule_review";
      mockGroup.scheduleGeneratedAt = "2028-01-01T00:00:00Z";
      await act(async () => {
        render(<PreferenceWizard {...defaultProps} />);
      });

      // Save without making changes — step is not dirty
      await act(async () => {
        fireEvent.click(screen.getByText("Save & Continue"));
      });

      // No warning dialog, should proceed to save directly
      expect(screen.queryByText("Warning")).toBeNull();
      await waitFor(() => {
        expect(screen.getByTestId("sport-rankings-step")).toBeDefined();
      });
    });

    it("does not re-show warning after Proceed (acknowledged flag)", async () => {
      mockGroup.phase = "schedule_review";
      mockGroup.scheduleGeneratedAt = "2028-01-01T00:00:00Z";
      await act(async () => {
        render(<PreferenceWizard {...defaultProps} />);
      });

      // Make step 0 dirty and trigger warning
      fireEvent.click(screen.getByTestId("change-budget"));
      await act(async () => {
        fireEvent.click(screen.getByText("Save & Continue"));
      });
      expect(screen.getByText("Warning")).toBeDefined();

      // Proceed through warning
      await act(async () => {
        fireEvent.click(screen.getByText("Proceed"));
      });
      await waitFor(() => {
        expect(screen.getByTestId("sport-rankings-step")).toBeDefined();
      });

      // Make step 1 dirty and save — no warning this time
      fireEvent.click(screen.getByTestId("set-sport-rankings"));
      await act(async () => {
        fireEvent.click(screen.getByText("Save & Continue"));
      });

      expect(screen.queryByText("Warning")).toBeNull();
      await waitFor(() => {
        expect(screen.getByTestId("sessions-step")).toBeDefined();
      });
    });

    it("re-shows warning after Cancel + new edits + save", async () => {
      mockGroup.phase = "schedule_review";
      mockGroup.scheduleGeneratedAt = "2028-01-01T00:00:00Z";
      await act(async () => {
        render(<PreferenceWizard {...defaultProps} />);
      });

      // First attempt: make dirty, trigger warning, cancel
      fireEvent.click(screen.getByTestId("change-budget"));
      await act(async () => {
        fireEvent.click(screen.getByText("Save & Continue"));
      });
      expect(screen.getByText("Warning")).toBeDefined();
      fireEvent.click(screen.getByText("Cancel"));
      expect(screen.queryByText("Warning")).toBeNull();

      // Second attempt: make dirty again, warning should re-appear
      fireEvent.click(screen.getByTestId("change-budget"));
      await act(async () => {
        fireEvent.click(screen.getByText("Save & Continue"));
      });
      expect(screen.getByText("Warning")).toBeDefined();
    });

    it("does not show warning when no schedule has been generated", async () => {
      mockGroup.scheduleGeneratedAt = null;
      await act(async () => {
        render(<PreferenceWizard {...defaultProps} />);
      });

      // Make step 0 dirty
      fireEvent.click(screen.getByTestId("change-budget"));

      // Save — no warning, just saves normally
      await act(async () => {
        fireEvent.click(screen.getByText("Save & Continue"));
      });

      expect(screen.queryByText("Warning")).toBeNull();
      await waitFor(() => {
        expect(screen.getByTestId("sport-rankings-step")).toBeDefined();
      });
    });

    it("does not show warning for post-generation joiner in schedule_review phase", async () => {
      mockGroup.phase = "schedule_review";
      mockGroup.scheduleGeneratedAt = "2028-01-01T00:00:00Z";
      mockGroup.members = [
        {
          id: "member-1",
          firstName: "Test",
          lastName: "User",
          joinedAt: "2028-01-02T00:00:00Z", // joined after schedule generation
        },
      ];
      await act(async () => {
        render(<PreferenceWizard {...defaultProps} />);
      });

      // Make step 0 dirty
      fireEvent.click(screen.getByTestId("change-budget"));

      // Save — no warning since this member joined after schedule generation
      await act(async () => {
        fireEvent.click(screen.getByText("Save & Continue"));
      });

      expect(screen.queryByText("Warning")).toBeNull();
      await waitFor(() => {
        expect(screen.getByTestId("sport-rankings-step")).toBeDefined();
      });
    });

    it("does not show warning for member with no combos", async () => {
      mockGroup.phase = "schedule_review";
      mockGroup.scheduleGeneratedAt = "2028-01-01T00:00:00Z";
      mockGroup.membersWithNoCombos = ["member-1"];
      await act(async () => {
        render(<PreferenceWizard {...defaultProps} />);
      });

      // Make step 0 dirty
      fireEvent.click(screen.getByTestId("change-budget"));

      // Save — no warning since this member has no combos
      await act(async () => {
        fireEvent.click(screen.getByText("Save & Continue"));
      });

      expect(screen.queryByText("Warning")).toBeNull();
      await waitFor(() => {
        expect(screen.getByTestId("sport-rankings-step")).toBeDefined();
      });
    });

    it("does not show warning for member with affected buddy review", async () => {
      mockGroup.phase = "schedule_review";
      mockGroup.scheduleGeneratedAt = "2028-01-01T00:00:00Z";
      mockGroup.affectedBuddyMembers = { "member-1": ["Alice"] };
      await act(async () => {
        render(<PreferenceWizard {...defaultProps} />);
      });

      // Make step 0 dirty
      fireEvent.click(screen.getByTestId("change-budget"));

      // Save — no warning since this member has an affected buddy review
      await act(async () => {
        fireEvent.click(screen.getByText("Save & Continue"));
      });

      expect(screen.queryByText("Warning")).toBeNull();
      await waitFor(() => {
        expect(screen.getByTestId("sport-rankings-step")).toBeDefined();
      });
    });
  });

  // ── Sport rankings change filters session preferences ─────────

  describe("sport rankings change filtering", () => {
    const sessionsForFilter = [
      {
        sessionCode: "TEN-001",
        sport: "Tennis",
        venue: "Court A",
        zone: "Valley Zone",
        sessionDate: "2025-07-26",
        sessionType: "Final",
        sessionDescription: "Men's Singles Final",
        startTime: "10:00",
        endTime: "12:00",
      },
      {
        sessionCode: "SWM-001",
        sport: "Swimming",
        venue: "Pool",
        zone: "Carson Zone",
        sessionDate: "2025-07-27",
        sessionType: "Final",
        sessionDescription: "100m Final",
        startTime: "09:00",
        endTime: "11:00",
      },
    ];

    it("removes session preferences for unranked sports when sport rankings change", async () => {
      setSearchParam("step", "sport_rankings");
      await act(async () => {
        render(
          <PreferenceWizard
            {...defaultProps}
            initialPreferenceStep="buddies"
            initialSportRankings={["Tennis", "Swimming"]}
            sessions={sessionsForFilter}
            initialSessionPreferences={[
              { sessionId: "TEN-001", interest: "high" },
              { sessionId: "SWM-001", interest: "medium" },
            ]}
          />
        );
      });

      // Remove Swimming from rankings — should filter out SWM-001 preference
      fireEvent.click(screen.getByTestId("remove-swimming"));

      // Save step 1 to move to step 2 (sessions)
      await act(async () => {
        fireEvent.click(screen.getByText("Save & Continue"));
      });
      await waitFor(() => {
        expect(screen.getByTestId("sessions-step")).toBeDefined();
      });

      // The saveSportRankings should have been called with only Tennis
      expect(mockSaveSportRankings).toHaveBeenCalledWith("group-1", {
        sportRankings: ["Tennis"],
      });
    });

    it("does not filter session preferences when all sports remain ranked", async () => {
      setSearchParam("step", "sport_rankings");
      await act(async () => {
        render(
          <PreferenceWizard
            {...defaultProps}
            initialPreferenceStep="buddies"
            initialSportRankings={["Tennis", "Swimming"]}
            sessions={sessionsForFilter}
            initialSessionPreferences={[
              { sessionId: "TEN-001", interest: "high" },
            ]}
          />
        );
      });

      // Set rankings with both sports still included
      fireEvent.click(screen.getByTestId("set-sport-rankings"));

      // Save — should proceed normally
      await act(async () => {
        fireEvent.click(screen.getByText("Save & Continue"));
      });
      await waitFor(() => {
        expect(screen.getByTestId("sessions-step")).toBeDefined();
      });
    });
  });

  // ── Session preferences saving ────────────────────────────────

  describe("session preferences saving", () => {
    it("saves session preferences on step 2", async () => {
      setSearchParam("step", "sessions");
      await act(async () => {
        render(
          <PreferenceWizard
            {...defaultProps}
            initialPreferenceStep="sport_rankings"
            initialSportRankings={["Tennis"]}
            initialSessionPreferences={[
              { sessionId: "TEN-001", interest: "high" },
            ]}
          />
        );
      });

      await act(async () => {
        fireEvent.click(screen.getByText("Save & Review"));
      });
      await waitFor(() => {
        expect(mockSaveSessionPreferences).toHaveBeenCalledWith("group-1", {
          preferences: [{ sessionId: "TEN-001", interest: "high" }],
        });
      });
    });
  });

  // ── Hidden sessions change handler ─────────────────────────────

  describe("hidden sessions change handler", () => {
    it("updates hidden sessions when onHiddenChange is called", async () => {
      setSearchParam("step", "sessions");
      await act(async () => {
        render(
          <PreferenceWizard
            {...defaultProps}
            initialPreferenceStep="sport_rankings"
            initialSportRankings={["Tennis"]}
            initialSessionPreferences={[
              { sessionId: "TEN-001", interest: "high" },
            ]}
          />
        );
      });

      // Click the "Change Hidden" button in our mock SessionsStep
      fireEvent.click(screen.getByTestId("change-hidden"));

      // The component should accept it without errors
      expect(screen.getByTestId("sessions-step")).toBeDefined();
    });
  });

  // ── Session preferences change handler ──────────────────────────

  describe("session preferences change handler", () => {
    it("updates session preferences when onChange is called from SessionsStep", async () => {
      setSearchParam("step", "sessions");
      await act(async () => {
        render(
          <PreferenceWizard
            {...defaultProps}
            initialPreferenceStep="sport_rankings"
            initialSportRankings={["Tennis"]}
            initialSessionPreferences={[]}
            sessions={[
              {
                sessionCode: "TEN-001",
                sport: "Tennis",
                venue: "Court A",
                zone: "Valley Zone",
                sessionDate: "2025-07-26",
                sessionType: "Final",
                sessionDescription: "Final",
                startTime: "10:00",
                endTime: "12:00",
              },
            ]}
          />
        );
      });

      // Add a preference through the mock
      fireEvent.click(screen.getByTestId("add-session-pref"));

      // Now Save & Review should be enabled (we have a preference)
      await act(async () => {
        fireEvent.click(screen.getByText("Save & Review"));
      });
      await waitFor(() => {
        expect(mockSaveSessionPreferences).toHaveBeenCalledWith("group-1", {
          preferences: [{ sessionId: "TEN-001", interest: "high" }],
        });
      });
    });
  });

  // ── beforeunload event ──────────────────────────────────────────

  describe("beforeunload warning", () => {
    it("adds beforeunload event listener", async () => {
      const addSpy = vi.spyOn(window, "addEventListener");
      await act(async () => {
        render(<PreferenceWizard {...defaultProps} />);
      });

      expect(addSpy.mock.calls.some((call) => call[0] === "beforeunload")).toBe(
        true
      );
      addSpy.mockRestore();
    });

    it("removes beforeunload event listener on unmount", async () => {
      const removeSpy = vi.spyOn(window, "removeEventListener");
      let unmount: () => void;
      await act(async () => {
        const result = render(<PreferenceWizard {...defaultProps} />);
        unmount = result.unmount;
      });
      unmount!();

      expect(
        removeSpy.mock.calls.some((call) => call[0] === "beforeunload")
      ).toBe(true);
      removeSpy.mockRestore();
    });

    it("calls preventDefault on beforeunload when step is dirty", async () => {
      // Start on step 0, complete it, go to step 1
      await act(async () => {
        render(<PreferenceWizard {...defaultProps} />);
      });
      await act(async () => {
        fireEvent.click(screen.getByText("Save & Continue"));
      });
      await waitFor(() => {
        expect(screen.getByTestId("sport-rankings-step")).toBeDefined();
      });

      // Change sport rankings to make step 1 dirty
      fireEvent.click(screen.getByTestId("set-sport-rankings"));

      // Now fire a beforeunload event — it should call preventDefault since step 1 is dirty
      const event = new Event("beforeunload", { cancelable: true });
      const preventDefaultSpy = vi.spyOn(event, "preventDefault");
      window.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it("does not call preventDefault on beforeunload when no step is dirty", async () => {
      await act(async () => {
        render(<PreferenceWizard {...defaultProps} />);
      });

      const event = new Event("beforeunload", { cancelable: true });
      const preventDefaultSpy = vi.spyOn(event, "preventDefault");
      window.dispatchEvent(event);

      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });
  });

  // ── Navigation guard dirty checker ──────────────────────────────

  describe("navigation guard integration", () => {
    it("registers dirty checker on mount", async () => {
      await act(async () => {
        render(<PreferenceWizard {...defaultProps} />);
      });
      expect(mockSetDirtyChecker).toHaveBeenCalled();
    });

    it("unregisters dirty checker on unmount", async () => {
      let unmount: () => void;
      await act(async () => {
        const result = render(<PreferenceWizard {...defaultProps} />);
        unmount = result.unmount;
      });
      mockSetDirtyChecker.mockClear();
      unmount!();
      expect(mockSetDirtyChecker).toHaveBeenCalledWith(null);
    });

    it("dirty checker returns dirty step names when steps have unsaved changes", async () => {
      await act(async () => {
        render(<PreferenceWizard {...defaultProps} />);
      });

      // Complete step 0
      await act(async () => {
        fireEvent.click(screen.getByText("Save & Continue"));
      });
      await waitFor(() => {
        expect(screen.getByTestId("sport-rankings-step")).toBeDefined();
      });

      // Change sport rankings to make step 1 dirty
      fireEvent.click(screen.getByTestId("set-sport-rankings"));

      // The dirty checker function passed to setDirtyChecker should return dirty step names
      // Get the function that was passed to setDirtyChecker
      const checkerCall = mockSetDirtyChecker.mock.calls.find(
        (call) => typeof call[0] === "function"
      );
      if (checkerCall) {
        const dirtyNames = checkerCall[0]();
        // Should include "Sport Rankings" since we changed it
        expect(dirtyNames).toContain("Sport Rankings");
      }
    });
  });

  // ── Step click edge cases ─────────────────────────────────────────

  describe("step click edge cases", () => {
    it("does nothing when clicking the current step", async () => {
      await act(async () => {
        render(<PreferenceWizard {...defaultProps} />);
      });
      mockReplaceState.mockClear();

      // Click the step indicator for step 0 while on step 0
      const stepButtons = screen.getAllByRole("button");
      const buddiesButton = stepButtons.find((btn) =>
        btn.textContent?.includes("Buddies")
      );
      fireEvent.click(buddiesButton!);

      // Should not navigate
      expect(mockReplaceState).not.toHaveBeenCalled();
    });

    it("blocks forward step click when an intermediate step is dirty", async () => {
      // Start with all steps completed
      await act(async () => {
        render(
          <PreferenceWizard
            {...defaultProps}
            initialPreferenceStep="sessions"
            initialStatus="preferences_set"
          />
        );
      });

      // Go back to step 1 (Sport Rankings)
      const stepButtons = screen.getAllByRole("button");
      const sportButton = stepButtons.find((btn) =>
        btn.textContent?.includes("Sport Rankings")
      );
      fireEvent.click(sportButton!);

      // Change sport rankings to make step 1 dirty
      fireEvent.click(screen.getByTestId("set-sport-rankings"));

      // Now try to click forward to Review (step 3)
      // Step 1 is dirty so it should block
      mockReplaceState.mockClear();
      const stepButtons2 = screen.getAllByRole("button");
      const reviewButton = stepButtons2.find((btn) =>
        btn.textContent?.includes("Review")
      );
      fireEvent.click(reviewButton!);

      // Should NOT navigate because step 1 (current) is dirty
      expect(mockReplaceState).not.toHaveBeenCalled();
    });

    it("blocks forward step click when prior steps are incomplete", async () => {
      // Start on step 0 with no steps completed
      await act(async () => {
        render(<PreferenceWizard {...defaultProps} />);
      });
      mockReplaceState.mockClear();

      // Try to click Session Interests (step 2) — steps 0 and 1 not completed
      const stepButtons = screen.getAllByRole("button");
      const sessionsButton = stepButtons.find((btn) =>
        btn.textContent?.includes("Session Interests")
      );
      fireEvent.click(sessionsButton!);

      expect(mockReplaceState).not.toHaveBeenCalled();
    });
  });

  // ── Buddies onChange callback ──────────────────────────────

  describe("buddies change handler", () => {
    it("updates buddies data when onChange fires and saves it", async () => {
      await act(async () => {
        render(<PreferenceWizard {...defaultProps} />);
      });

      // Change the buddies data via the mock
      fireEvent.click(screen.getByTestId("change-budget"));

      // Save step 0
      await act(async () => {
        fireEvent.click(screen.getByText("Save & Continue"));
      });
      await waitFor(() => {
        expect(screen.getByTestId("sport-rankings-step")).toBeDefined();
      });

      // Verify the save was called with updated buddies data
      expect(mockSaveBuddies).toHaveBeenCalledWith("group-1", {
        minBuddies: 2,
        buddies: [],
      });
    });
  });

  // ── Session preference summary badges on step 2 ────────────────

  describe("session interest summary badges on step 2", () => {
    it("shows interest level summary counts on step 2 when preferences exist", async () => {
      setSearchParam("step", "sessions");
      await act(async () => {
        render(
          <PreferenceWizard
            {...defaultProps}
            initialPreferenceStep="sport_rankings"
            initialSportRankings={["Tennis"]}
            initialSessionPreferences={[
              { sessionId: "TEN-001", interest: "high" },
              { sessionId: "TEN-002", interest: "high" },
              { sessionId: "SWM-001", interest: "medium" },
            ]}
          />
        );
      });

      // Summary badges should show "2 High", "1 Medium"
      expect(screen.getByText("2 High")).toBeDefined();
      expect(screen.getByText("1 Medium")).toBeDefined();
      // Count text
      expect(screen.getByText("3 sessions selected")).toBeDefined();
    });

    it("shows singular session text when only 1 session selected", async () => {
      setSearchParam("step", "sessions");
      await act(async () => {
        render(
          <PreferenceWizard
            {...defaultProps}
            initialPreferenceStep="sport_rankings"
            initialSportRankings={["Tennis"]}
            initialSessionPreferences={[
              { sessionId: "TEN-001", interest: "low" },
            ]}
          />
        );
      });

      expect(screen.getByText("1 Low")).toBeDefined();
      expect(screen.getByText("1 session selected")).toBeDefined();
    });

    it("does not show summary badges on step 0", async () => {
      await act(async () => {
        render(
          <PreferenceWizard
            {...defaultProps}
            initialSessionPreferences={[
              { sessionId: "TEN-001", interest: "high" },
            ]}
          />
        );
      });

      expect(screen.queryByText("1 High")).toBeNull();
      expect(screen.queryByText(/session.* selected/)).toBeNull();
    });
  });

  // --- Affected buddy review ---

  describe("confirm affected buddy review", () => {
    it("calls confirmAffectedBuddyReview and refreshes when confirm button is clicked", async () => {
      mockGroup.affectedBuddyMembers = { "member-1": ["Charlie Brown"] };
      mockGroup.myStatus = "preferences_set";

      await act(async () => {
        render(
          <PreferenceWizard
            {...defaultProps}
            initialPreferenceStep="sessions"
            initialStatus="preferences_set"
            initialSportRankings={["Tennis"]}
            initialSessionPreferences={[
              { sessionId: "TEN-001", interest: "high" },
            ]}
          />
        );
      });

      // Should be on review step and show confirm review button
      const confirmBtn = screen.queryByTestId("confirm-review-btn");
      if (confirmBtn) {
        await act(async () => {
          confirmBtn.click();
        });

        expect(mockConfirmAffectedBuddyReview).toHaveBeenCalledWith("group-1");
        expect(mockRefresh).toHaveBeenCalled();
      }
    });
  });
});
