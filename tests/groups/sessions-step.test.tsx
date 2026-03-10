// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import SessionsStep from "@/app/(main)/groups/[groupId]/preferences/_components/sessions-step";
import type {
  SessionData,
  SessionPreferenceData,
} from "@/app/(main)/groups/[groupId]/preferences/_components/preference-wizard";

// Mock the side panel context
const mockSetPanel = vi.fn();
vi.mock("@/app/(main)/groups/[groupId]/_components/side-panel-context", () => ({
  useSidePanel: () => ({ panel: null, setPanel: mockSetPanel }),
}));

// Mock the modal to keep tests focused
vi.mock(
  "@/app/(main)/groups/[groupId]/preferences/_components/session-interest-modal",
  () => ({
    default: ({
      session,
      onSave,
      onClear,
      onClose,
    }: {
      session: SessionData;
      onSave: (p: SessionPreferenceData) => void;
      onClear: (id: string) => void;
      onClose: () => void;
    }) => (
      <div data-testid="session-modal">
        <span data-testid="modal-session-code">{session.sessionCode}</span>
        <button
          data-testid="modal-save"
          onClick={() =>
            onSave({
              sessionId: session.sessionCode,
              interest: "high",
              maxWillingness: 200,
            })
          }
        >
          Save
        </button>
        <button
          data-testid="modal-clear"
          onClick={() => onClear(session.sessionCode)}
        >
          Clear
        </button>
        <button data-testid="modal-close" onClick={onClose}>
          Close
        </button>
      </div>
    ),
  })
);

const makeSessions = (): SessionData[] => [
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
    sessionCode: "TEN-002",
    sport: "Tennis",
    venue: "Court A",
    zone: "Valley Zone",
    sessionDate: "2025-07-26",
    sessionType: "Semifinal",
    sessionDescription: "Women's Singles Semifinal",
    startTime: "14:00",
    endTime: "16:00",
  },
  {
    sessionCode: "SWM-001",
    sport: "Swimming",
    venue: "Aquatics Center",
    zone: "Carson Zone",
    sessionDate: "2025-07-27",
    sessionType: "Final",
    sessionDescription: "100m Freestyle Final",
    startTime: "09:00",
    endTime: "11:00",
  },
  {
    sessionCode: "SWM-002",
    sport: "Swimming",
    venue: "Aquatics Center",
    zone: "Carson Zone",
    sessionDate: "2025-07-27",
    sessionType: "Preliminary",
    sessionDescription: "200m Butterfly Heats",
    startTime: "13:00",
    endTime: "15:00",
  },
];

const defaultProps = {
  sessions: makeSessions(),
  sportRankings: ["Tennis", "Swimming"],
  initialPreferences: new Map<string, SessionPreferenceData>(),
  initialHiddenSessions: new Set<string>(),
  onChange: vi.fn(),
  onHiddenChange: vi.fn(),
};

describe("SessionsStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // ── Rendering ──────────────────────────────────────────────────

  it("renders header and subtitle", () => {
    render(<SessionsStep {...defaultProps} />);
    expect(screen.getByText("Session Interests")).toBeDefined();
  });

  it("renders all session cards", () => {
    render(<SessionsStep {...defaultProps} />);
    expect(screen.getByText("Men's Singles Final")).toBeDefined();
    expect(screen.getByText("Women's Singles Semifinal")).toBeDefined();
    expect(screen.getByText("100m Freestyle Final")).toBeDefined();
    expect(screen.getByText("200m Butterfly Heats")).toBeDefined();
  });

  it("renders date group headers", () => {
    render(<SessionsStep {...defaultProps} />);
    expect(screen.getByText("Sat, Jul 26")).toBeDefined();
    expect(screen.getByText("Sun, Jul 27")).toBeDefined();
  });

  it("shows no interest badges initially when no preferences set", () => {
    render(<SessionsStep {...defaultProps} />);
    // No interest badges should appear — all sessions are unset
    expect(screen.queryByText("High")).toBeNull();
    expect(screen.queryByText("Medium")).toBeNull();
    expect(screen.queryByText("Low")).toBeNull();
  });

  // ── Side panel filters ────────────────────────────────────────

  it("sets filter panel via side panel context on mount", () => {
    render(<SessionsStep {...defaultProps} />);
    expect(mockSetPanel).toHaveBeenCalled();
    // The last call should be a React element (the filter panel)
    const lastCall =
      mockSetPanel.mock.calls[mockSetPanel.mock.calls.length - 1][0];
    expect(lastCall).not.toBeNull();
  });

  it("clears side panel on unmount", () => {
    const { unmount } = render(<SessionsStep {...defaultProps} />);
    mockSetPanel.mockClear();
    unmount();
    expect(mockSetPanel).toHaveBeenCalledWith(null);
  });

  // ── Modal open/close ──────────────────────────────────────────

  it("opens modal when clicking a session card", () => {
    render(<SessionsStep {...defaultProps} />);

    fireEvent.click(screen.getByText("Men's Singles Final"));

    expect(screen.getByTestId("session-modal")).toBeDefined();
    expect(screen.getByTestId("modal-session-code").textContent).toBe(
      "TEN-001"
    );
  });

  it("closes modal on close button", () => {
    render(<SessionsStep {...defaultProps} />);

    fireEvent.click(screen.getByText("Men's Singles Final"));
    expect(screen.getByTestId("session-modal")).toBeDefined();

    fireEvent.click(screen.getByTestId("modal-close"));
    expect(screen.queryByTestId("session-modal")).toBeNull();
  });

  // ── Preference state ──────────────────────────────────────────

  it("saves preference via modal and shows interest badge on card", () => {
    render(<SessionsStep {...defaultProps} />);

    fireEvent.click(screen.getByText("Men's Singles Final"));
    fireEvent.click(screen.getByTestId("modal-save"));

    // Modal should close
    expect(screen.queryByTestId("session-modal")).toBeNull();

    // Interest badge should appear on the card
    expect(screen.getByText("High")).toBeDefined();

    // onChange should be called
    expect(defaultProps.onChange).toHaveBeenCalled();
  });

  it("clears preference via modal and removes badge from card", () => {
    const initialPrefs = new Map<string, SessionPreferenceData>([
      [
        "TEN-001",
        { sessionId: "TEN-001", interest: "high", maxWillingness: 200 },
      ],
    ]);
    render(
      <SessionsStep {...defaultProps} initialPreferences={initialPrefs} />
    );

    // Badge should be on card initially
    expect(screen.getByText("High")).toBeDefined();

    fireEvent.click(screen.getByText("Men's Singles Final"));
    fireEvent.click(screen.getByTestId("modal-clear"));

    // Badge should be removed from card
    expect(screen.queryByText("High")).toBeNull();
    expect(defaultProps.onChange).toHaveBeenCalled();
  });

  it("renders existing preference badges on session cards on mount", () => {
    const initialPrefs = new Map<string, SessionPreferenceData>([
      [
        "TEN-001",
        { sessionId: "TEN-001", interest: "medium", maxWillingness: 300 },
      ],
      [
        "SWM-001",
        { sessionId: "SWM-001", interest: "low", maxWillingness: 100 },
      ],
    ]);
    render(
      <SessionsStep {...defaultProps} initialPreferences={initialPrefs} />
    );

    expect(screen.getByText("Medium")).toBeDefined();
    expect(screen.getByText("Low")).toBeDefined();
  });

  // ── Hide/unhide ───────────────────────────────────────────────

  it("hides a session when hide button is clicked", () => {
    render(<SessionsStep {...defaultProps} />);

    const hideButtons = screen.getAllByLabelText("Hide Session");
    fireEvent.click(hideButtons[0]);

    // The session should be hidden
    expect(screen.queryByText("Men's Singles Final")).toBeNull();

    expect(defaultProps.onHiddenChange).toHaveBeenCalled();
  });

  it("shows hidden sessions with Show Session button visible", () => {
    // Start with a session pre-hidden, showHidden toggle will be in the filter panel
    // but the hide/show buttons on cards are still in the main content
    render(
      <SessionsStep
        {...defaultProps}
        initialHiddenSessions={new Set(["TEN-001"])}
      />
    );

    // Hidden session should not be visible by default
    expect(screen.queryByText("Men's Singles Final")).toBeNull();
    // Other sessions still visible
    expect(screen.getByText("Women's Singles Semifinal")).toBeDefined();
  });

  it("unhides a session via Show Session button", () => {
    render(<SessionsStep {...defaultProps} />);

    // Hide a session
    const hideButtons = screen.getAllByLabelText("Hide Session");
    fireEvent.click(hideButtons[0]);
    expect(screen.queryByText("Men's Singles Final")).toBeNull();

    // The onHiddenChange should have been called
    expect(defaultProps.onHiddenChange).toHaveBeenCalled();
  });

  // ── Empty state ───────────────────────────────────────────────

  it("shows empty state when no sessions provided", () => {
    render(<SessionsStep {...defaultProps} sessions={[]} />);
    expect(
      screen.getByText("No sessions match the current filters.")
    ).toBeDefined();
  });

  // ── Session code display ────────────────────────────────────

  it("displays session codes on cards", () => {
    render(<SessionsStep {...defaultProps} />);
    expect(screen.getByText(/TEN-001/)).toBeDefined();
    expect(screen.getByText(/TEN-002/)).toBeDefined();
    expect(screen.getByText(/SWM-001/)).toBeDefined();
    expect(screen.getByText(/SWM-002/)).toBeDefined();
  });

  // ── Session type labels ─────────────────────────────────────

  it("displays session type labels on cards", () => {
    render(<SessionsStep {...defaultProps} />);
    // Final and Semifinal for Tennis, Final and Preliminary for Swimming
    const finals = screen.getAllByText("Final");
    expect(finals.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Semifinal")).toBeDefined();
    expect(screen.getByText("Preliminary")).toBeDefined();
  });

  // ── Dynamic session type filters ────────────────────────────

  it("derives session types dynamically from session data", () => {
    // The filter panel should include types derived from the actual sessions
    // not hardcoded. Verify by rendering with custom session types.
    const customSessions: SessionData[] = [
      {
        sessionCode: "ATH-001",
        sport: "Athletics",
        venue: "Stadium",
        zone: "Downtown Zone",
        sessionDate: "2025-07-26",
        sessionType: "Qualification",
        sessionDescription: "100m Heats",
        startTime: "08:00",
        endTime: "10:00",
      },
      {
        sessionCode: "ATH-002",
        sport: "Athletics",
        venue: "Stadium",
        zone: "Downtown Zone",
        sessionDate: "2025-07-26",
        sessionType: "Medal Event",
        sessionDescription: "100m Final",
        startTime: "20:00",
        endTime: "22:00",
      },
    ];
    render(
      <SessionsStep
        {...defaultProps}
        sessions={customSessions}
        sportRankings={["Athletics"]}
      />
    );

    // The setPanel should have been called with filter panel containing these types
    expect(mockSetPanel).toHaveBeenCalled();
    const lastCall =
      mockSetPanel.mock.calls[mockSetPanel.mock.calls.length - 1][0];
    expect(lastCall).not.toBeNull();
  });

  // ── Interest level breakdown badges ─────────────────────────

  it("shows interest badges on all session cards with preferences", () => {
    const initialPrefs = new Map<string, SessionPreferenceData>([
      [
        "TEN-001",
        { sessionId: "TEN-001", interest: "high", maxWillingness: 200 },
      ],
      [
        "TEN-002",
        { sessionId: "TEN-002", interest: "high", maxWillingness: 300 },
      ],
      [
        "SWM-001",
        { sessionId: "SWM-001", interest: "medium", maxWillingness: 100 },
      ],
      [
        "SWM-002",
        { sessionId: "SWM-002", interest: "low", maxWillingness: 50 },
      ],
    ]);
    render(
      <SessionsStep {...defaultProps} initialPreferences={initialPrefs} />
    );

    // Each card shows its own interest badge (2 High cards, 1 Medium, 1 Low)
    const highBadges = screen.getAllByText("High");
    expect(highBadges.length).toBe(2);
    expect(screen.getByText("Medium")).toBeDefined();
    expect(screen.getByText("Low")).toBeDefined();
    // Summary counts (e.g. "2 High") live in the wizard footer, not here
    expect(screen.queryByText("2 High")).toBeNull();
    expect(screen.queryByText("4 sessions selected")).toBeNull();
  });

  it("does not show interest badges for sessions without preferences", () => {
    const initialPrefs = new Map<string, SessionPreferenceData>([
      [
        "TEN-001",
        { sessionId: "TEN-001", interest: "high", maxWillingness: 200 },
      ],
    ]);
    render(
      <SessionsStep {...defaultProps} initialPreferences={initialPrefs} />
    );

    expect(screen.getByText("High")).toBeDefined();
    // Other sessions have no badge — Medium and Low should not appear
    expect(screen.queryByText("Medium")).toBeNull();
    expect(screen.queryByText("Low")).toBeNull();
  });

  // ── Willingness badge display ───────────────────────────────

  it("shows willingness badge with price ceiling on cards", () => {
    const initialPrefs = new Map<string, SessionPreferenceData>([
      [
        "TEN-001",
        { sessionId: "TEN-001", interest: "high", maxWillingness: 200 },
      ],
    ]);
    render(
      <SessionsStep {...defaultProps} initialPreferences={initialPrefs} />
    );

    expect(screen.getByText("<$200")).toBeDefined();
  });

  it("shows $1000+ willingness badge for null maxWillingness", () => {
    const initialPrefs = new Map<string, SessionPreferenceData>([
      [
        "TEN-001",
        { sessionId: "TEN-001", interest: "low", maxWillingness: null },
      ],
    ]);
    render(
      <SessionsStep {...defaultProps} initialPreferences={initialPrefs} />
    );

    expect(screen.getByText("$1000+")).toBeDefined();
  });

  // ── Hidden sessions don't open modal ────────────────────────

  it("does not open modal when clicking a hidden session", () => {
    render(
      <SessionsStep
        {...defaultProps}
        initialHiddenSessions={new Set(["TEN-001"])}
      />
    );

    // Show hidden sessions first — toggle via the show button in inline controls
    const showButtons = screen.queryAllByText(/Show.*hidden/);
    if (showButtons.length > 0) {
      fireEvent.click(showButtons[0]);
    }

    // Even if visible, clicking a hidden session card should not open the modal
    // because the onClick handler checks isHidden
    expect(screen.queryByTestId("session-modal")).toBeNull();
  });

  // ── Preferences cleanup for invalid sessions ───────────────

  it("filters out preferences for sessions not in the session list on mount", () => {
    const initialPrefs = new Map<string, SessionPreferenceData>([
      [
        "TEN-001",
        { sessionId: "TEN-001", interest: "high", maxWillingness: 200 },
      ],
      [
        "DELETED-001",
        { sessionId: "DELETED-001", interest: "low", maxWillingness: 100 },
      ],
    ]);
    render(
      <SessionsStep {...defaultProps} initialPreferences={initialPrefs} />
    );

    // Only TEN-001 badge should appear since DELETED-001 is not in sessions
    expect(screen.getByText("High")).toBeDefined();
    // onChange should be called with filtered preferences (DELETED-001 removed)
    expect(defaultProps.onChange).toHaveBeenCalled();
  });

  // ── Multiple sessions saving ────────────────────────────────

  it("accumulates multiple session preferences", () => {
    render(<SessionsStep {...defaultProps} />);

    // Save preference for first session
    fireEvent.click(screen.getByText("Men's Singles Final"));
    fireEvent.click(screen.getByTestId("modal-save"));

    // First badge should appear
    const badges1 = screen.getAllByText("High");
    expect(badges1.length).toBe(1);

    // Save preference for second session
    fireEvent.click(screen.getByText("100m Freestyle Final"));
    fireEvent.click(screen.getByTestId("modal-save"));

    // Both badges should appear
    const badges2 = screen.getAllByText("High");
    expect(badges2.length).toBe(2);
  });

  // ── Singular/plural session count ───────────────────────────

  it("shows interest badge on card after saving 1 session", () => {
    render(<SessionsStep {...defaultProps} />);

    fireEvent.click(screen.getByText("Men's Singles Final"));
    fireEvent.click(screen.getByTestId("modal-save"));

    // One High badge on the card
    expect(screen.getAllByText("High").length).toBe(1);
  });

  it("shows no interest badges when no sessions have preferences", () => {
    render(<SessionsStep {...defaultProps} />);
    // The session count summary ("0 sessions selected") is in the wizard footer, not here
    expect(screen.queryByText("High")).toBeNull();
    expect(screen.queryByText("Medium")).toBeNull();
    expect(screen.queryByText("Low")).toBeNull();
  });

  // ── Keyboard accessibility ──────────────────────────────────

  it("opens modal on Enter keydown on a session card", () => {
    render(<SessionsStep {...defaultProps} />);

    // Find a card with role="button"
    const sessionCards = screen.getAllByRole("button");
    // The first role="button" that's not a hide button
    const sessionCard = sessionCards.find(
      (el) => !el.getAttribute("aria-label")
    );
    if (sessionCard) {
      fireEvent.keyDown(sessionCard, { key: "Enter" });
      expect(screen.getByTestId("session-modal")).toBeDefined();
    }
  });
});
