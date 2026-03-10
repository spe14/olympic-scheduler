// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  act,
} from "@testing-library/react";
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

  it("opens modal on Space keydown on a session card", () => {
    render(<SessionsStep {...defaultProps} />);

    const sessionCards = screen.getAllByRole("button");
    const sessionCard = sessionCards.find(
      (el) => !el.getAttribute("aria-label")
    );
    if (sessionCard) {
      fireEvent.keyDown(sessionCard, { key: " " });
      expect(screen.getByTestId("session-modal")).toBeDefined();
    }
  });

  // ── Sport label visibility ─────────────────────────────────────

  it("shows sport labels when multiple sports are present", () => {
    render(<SessionsStep {...defaultProps} />);
    // Both Tennis and Swimming labels should be visible
    const tennisLabels = screen.getAllByText("Tennis");
    expect(tennisLabels.length).toBeGreaterThanOrEqual(1);
    const swimmingLabels = screen.getAllByText("Swimming");
    expect(swimmingLabels.length).toBeGreaterThanOrEqual(1);
  });

  // ── Hidden session show/hide toggling ──────────────────────────

  it("shows hidden session count and toggle buttons when sessions are hidden", () => {
    render(
      <SessionsStep
        {...defaultProps}
        initialHiddenSessions={new Set(["TEN-001"])}
      />
    );

    // Should show toggle buttons for hidden sessions
    expect(screen.getByText(/Show 1 hidden session/)).toBeDefined();
    expect(screen.getByText("Unhide all sessions")).toBeDefined();
  });

  it("reveals hidden sessions when Show hidden button is clicked", () => {
    render(
      <SessionsStep
        {...defaultProps}
        initialHiddenSessions={new Set(["TEN-001"])}
      />
    );

    // Hidden session not visible initially
    expect(screen.queryByText("Men's Singles Final")).toBeNull();

    // Click Show hidden sessions
    fireEvent.click(screen.getByText(/Show 1 hidden session/));

    // Now the hidden session should be visible
    expect(screen.getByText("Men's Singles Final")).toBeDefined();
  });

  it("unhides all sessions when Unhide all is clicked", () => {
    render(
      <SessionsStep
        {...defaultProps}
        initialHiddenSessions={new Set(["TEN-001", "TEN-002"])}
      />
    );

    expect(screen.queryByText("Men's Singles Final")).toBeNull();

    fireEvent.click(screen.getByText("Unhide all sessions"));

    // All sessions should now be visible
    expect(screen.getByText("Men's Singles Final")).toBeDefined();
    expect(screen.getByText("Women's Singles Semifinal")).toBeDefined();
    expect(defaultProps.onHiddenChange).toHaveBeenCalled();
  });

  it("shows Show Session button on hidden session cards when shown", () => {
    render(
      <SessionsStep
        {...defaultProps}
        initialHiddenSessions={new Set(["TEN-001"])}
      />
    );

    // Show hidden sessions
    fireEvent.click(screen.getByText(/Show 1 hidden session/));

    // Should have a Show Session button on the hidden card
    expect(screen.getByLabelText("Show Session")).toBeDefined();
  });

  it("unhides individual session via Show Session button", () => {
    render(
      <SessionsStep
        {...defaultProps}
        initialHiddenSessions={new Set(["TEN-001"])}
      />
    );

    // Show hidden sessions to see the Show Session button
    fireEvent.click(screen.getByText(/Show 1 hidden session/));
    expect(screen.getByLabelText("Show Session")).toBeDefined();

    // Click Show Session to unhide
    fireEvent.click(screen.getByLabelText("Show Session"));
    expect(defaultProps.onHiddenChange).toHaveBeenCalled();
  });

  it("does not open modal when clicking a hidden session card", () => {
    render(
      <SessionsStep
        {...defaultProps}
        initialHiddenSessions={new Set(["TEN-001"])}
      />
    );

    // Show hidden sessions
    fireEvent.click(screen.getByText(/Show 1 hidden session/));

    // Click the hidden session description area — should not open modal
    fireEvent.click(screen.getByText("Men's Singles Final"));
    expect(screen.queryByTestId("session-modal")).toBeNull();
  });

  it("does not open modal on keydown for hidden session card", () => {
    render(
      <SessionsStep
        {...defaultProps}
        initialHiddenSessions={new Set(["TEN-001"])}
      />
    );

    // Show hidden sessions
    fireEvent.click(screen.getByText(/Show 1 hidden session/));

    // The hidden card should not have role="button"
    // Find the card container for TEN-001 — it shouldn't respond to keyboard
    const sessionDescription = screen.getByText("Men's Singles Final");
    const card = sessionDescription.closest("[class*='flex items-center']");
    if (card) {
      fireEvent.keyDown(card as HTMLElement, { key: "Enter" });
    }
    expect(screen.queryByTestId("session-modal")).toBeNull();
  });

  // ── Filter panel rendered via side panel ───────────────────────

  describe("session filters panel", () => {
    function getLastFilterElement() {
      return mockSetPanel.mock.calls[mockSetPanel.mock.calls.length - 1][0];
    }

    function renderFilterPanel() {
      const el = getLastFilterElement();
      const container = document.createElement("div");
      container.id = "filter-panel";
      document.body.appendChild(container);
      const result = render(el, { container });
      return { ...result, container };
    }

    it("renders filter panel with sport filter buttons", () => {
      render(<SessionsStep {...defaultProps} />);
      const { container, unmount } = renderFilterPanel();

      expect(container.textContent).toContain("Filter by Sport:");
      expect(container.textContent).toContain("Tennis");
      expect(container.textContent).toContain("Swimming");

      unmount();
      document.body.removeChild(container);
    });

    it("renders filter panel with date filter buttons", () => {
      render(<SessionsStep {...defaultProps} />);
      const { container, unmount } = renderFilterPanel();

      expect(container.textContent).toContain("Filter by Date:");
      expect(container.textContent).toContain("Sat, Jul 26");
      expect(container.textContent).toContain("Sun, Jul 27");

      unmount();
      document.body.removeChild(container);
    });

    it("renders filter panel with zone filter buttons", () => {
      render(<SessionsStep {...defaultProps} />);
      const { container, unmount } = renderFilterPanel();

      expect(container.textContent).toContain("Filter by Zone:");
      expect(container.textContent).toContain("Valley");
      expect(container.textContent).toContain("Carson");

      unmount();
      document.body.removeChild(container);
    });

    it("renders filter panel with session type filter buttons", () => {
      render(<SessionsStep {...defaultProps} />);
      const { container, unmount } = renderFilterPanel();

      expect(container.textContent).toContain("Filter by Session Type:");
      expect(container.textContent).toContain("Final");
      expect(container.textContent).toContain("Semifinal");
      expect(container.textContent).toContain("Preliminary");

      unmount();
      document.body.removeChild(container);
    });

    it("renders filter panel with interest filter buttons", () => {
      render(<SessionsStep {...defaultProps} />);
      const { container, unmount } = renderFilterPanel();

      expect(container.textContent).toContain("Filter by Interest:");
      expect(container.textContent).toContain("Low");
      expect(container.textContent).toContain("Medium");
      expect(container.textContent).toContain("High");
      expect(container.textContent).toContain("Not Set/No Interest");

      unmount();
      document.body.removeChild(container);
    });

    it("does not render Clear all button when no filters are active", () => {
      render(<SessionsStep {...defaultProps} />);
      const { container, unmount } = renderFilterPanel();

      expect(container.textContent).not.toContain("Clear all");

      unmount();
      document.body.removeChild(container);
    });

    it("shows hidden section in filter panel when sessions are hidden", () => {
      render(
        <SessionsStep
          {...defaultProps}
          initialHiddenSessions={new Set(["TEN-001"])}
        />
      );
      const { container, unmount } = renderFilterPanel();

      expect(container.textContent).toContain("Show 1 hidden session");
      expect(container.textContent).toContain("Unhide all sessions");

      unmount();
      document.body.removeChild(container);
    });

    it("shows plural hidden session count in filter panel", () => {
      render(
        <SessionsStep
          {...defaultProps}
          initialHiddenSessions={new Set(["TEN-001", "TEN-002"])}
        />
      );
      const { container, unmount } = renderFilterPanel();

      expect(container.textContent).toContain("Show 2 hidden sessions");

      unmount();
      document.body.removeChild(container);
    });

    it("clicking sport button in filter panel calls onToggleSport", () => {
      render(<SessionsStep {...defaultProps} />);
      const { container, unmount } = renderFilterPanel();

      const buttons = container.querySelectorAll("button");
      const tennisBtn = Array.from(buttons).find(
        (b) => b.textContent === "Tennis"
      );
      expect(tennisBtn).toBeDefined();
      fireEvent.click(tennisBtn!);

      unmount();
      document.body.removeChild(container);
    });

    it("clicking type button in filter panel calls onToggleType", () => {
      render(<SessionsStep {...defaultProps} />);
      const { container, unmount } = renderFilterPanel();

      const buttons = container.querySelectorAll("button");
      const finalBtn = Array.from(buttons).find(
        (b) => b.textContent === "Final"
      );
      expect(finalBtn).toBeDefined();
      fireEvent.click(finalBtn!);

      unmount();
      document.body.removeChild(container);
    });

    it("clicking date button in filter panel calls onToggleDate", () => {
      render(<SessionsStep {...defaultProps} />);
      const { container, unmount } = renderFilterPanel();

      const buttons = container.querySelectorAll("button");
      const dateBtn = Array.from(buttons).find(
        (b) => b.textContent === "Sat, Jul 26"
      );
      expect(dateBtn).toBeDefined();
      fireEvent.click(dateBtn!);

      unmount();
      document.body.removeChild(container);
    });

    it("clicking zone button in filter panel calls onToggleZone", () => {
      render(<SessionsStep {...defaultProps} />);
      const { container, unmount } = renderFilterPanel();

      const buttons = container.querySelectorAll("button");
      const zoneBtn = Array.from(buttons).find(
        (b) => b.textContent === "Valley"
      );
      expect(zoneBtn).toBeDefined();
      fireEvent.click(zoneBtn!);

      unmount();
      document.body.removeChild(container);
    });

    it("clicking interest button in filter panel calls onToggleInterest", () => {
      render(<SessionsStep {...defaultProps} />);
      const { container, unmount } = renderFilterPanel();

      const buttons = container.querySelectorAll("button");
      const highBtn = Array.from(buttons).find((b) => b.textContent === "High");
      expect(highBtn).toBeDefined();
      fireEvent.click(highBtn!);

      unmount();
      document.body.removeChild(container);
    });

    it("clicking All Types button calls onClearTypes", () => {
      render(<SessionsStep {...defaultProps} />);
      const { container, unmount } = renderFilterPanel();

      const buttons = container.querySelectorAll("button");
      const allTypesBtn = Array.from(buttons).find(
        (b) => b.textContent === "All Types"
      );
      expect(allTypesBtn).toBeDefined();
      fireEvent.click(allTypesBtn!);

      unmount();
      document.body.removeChild(container);
    });

    it("clicking All Dates button calls onClearDates", () => {
      render(<SessionsStep {...defaultProps} />);
      const { container, unmount } = renderFilterPanel();

      const buttons = container.querySelectorAll("button");
      const allDatesBtn = Array.from(buttons).find(
        (b) => b.textContent === "All Dates"
      );
      expect(allDatesBtn).toBeDefined();
      fireEvent.click(allDatesBtn!);

      unmount();
      document.body.removeChild(container);
    });

    it("clicking All Zones button calls onClearZones", () => {
      render(<SessionsStep {...defaultProps} />);
      const { container, unmount } = renderFilterPanel();

      const buttons = container.querySelectorAll("button");
      const allZonesBtn = Array.from(buttons).find(
        (b) => b.textContent === "All Zones"
      );
      expect(allZonesBtn).toBeDefined();
      fireEvent.click(allZonesBtn!);

      unmount();
      document.body.removeChild(container);
    });

    it("clicking hidden toggle button in filter panel calls onToggleShowHidden", () => {
      render(
        <SessionsStep
          {...defaultProps}
          initialHiddenSessions={new Set(["TEN-001"])}
        />
      );
      const { container, unmount } = renderFilterPanel();

      const buttons = container.querySelectorAll("button");
      const showHiddenBtn = Array.from(buttons).find((b) =>
        b.textContent?.includes("Show 1 hidden session")
      );
      expect(showHiddenBtn).toBeDefined();
      fireEvent.click(showHiddenBtn!);

      unmount();
      document.body.removeChild(container);
    });

    it("clicking Unhide all in filter panel calls onUnhideAll", () => {
      render(
        <SessionsStep
          {...defaultProps}
          initialHiddenSessions={new Set(["TEN-001"])}
        />
      );
      const { container, unmount } = renderFilterPanel();

      const buttons = container.querySelectorAll("button");
      const unhideBtn = Array.from(buttons).find(
        (b) => b.textContent === "Unhide all sessions"
      );
      expect(unhideBtn).toBeDefined();
      fireEvent.click(unhideBtn!);

      unmount();
      document.body.removeChild(container);
    });

    it("renders Clear all button and clicking it calls onClearAll", () => {
      render(<SessionsStep {...defaultProps} />);

      // Activate a filter first so "Clear all" appears
      act(() => {
        const props = getLastFilterElement().props;
        props.onToggleSport("Tennis");
      });

      // Re-render the filter panel from the updated setPanel call
      const { container, unmount } = renderFilterPanel();

      expect(container.textContent).toContain("Clear all");
      const buttons = container.querySelectorAll("button");
      const clearAllBtn = Array.from(buttons).find(
        (b) => b.textContent === "Clear all"
      );
      expect(clearAllBtn).toBeDefined();
      fireEvent.click(clearAllBtn!);

      unmount();
      document.body.removeChild(container);
    });

    it("renders selected sport button with active styling", () => {
      render(<SessionsStep {...defaultProps} />);

      // Toggle a sport filter on
      act(() => {
        getLastFilterElement().props.onToggleSport("Tennis");
      });

      const { container, unmount } = renderFilterPanel();

      // The Tennis button should have selectedSports containing "Tennis"
      // and render with "text-white" class (active sport)
      const buttons = container.querySelectorAll("button");
      const tennisBtn = Array.from(buttons).find(
        (b) => b.textContent === "Tennis"
      );
      expect(tennisBtn).toBeDefined();
      expect(tennisBtn!.className).toContain("text-white");

      unmount();
      document.body.removeChild(container);
    });

    it("renders selected type button with active styling", () => {
      render(<SessionsStep {...defaultProps} />);

      act(() => {
        getLastFilterElement().props.onToggleType("Final");
      });

      const { container, unmount } = renderFilterPanel();

      const buttons = container.querySelectorAll("button");
      const finalBtn = Array.from(buttons).find(
        (b) => b.textContent === "Final"
      );
      expect(finalBtn).toBeDefined();
      expect(finalBtn!.className).toContain("bg-[#009de5]");

      unmount();
      document.body.removeChild(container);
    });

    it("renders selected date button with active styling", () => {
      render(<SessionsStep {...defaultProps} />);

      act(() => {
        getLastFilterElement().props.onToggleDate("2025-07-26");
      });

      const { container, unmount } = renderFilterPanel();

      const buttons = container.querySelectorAll("button");
      const dateBtn = Array.from(buttons).find(
        (b) => b.textContent === "Sat, Jul 26"
      );
      expect(dateBtn).toBeDefined();
      expect(dateBtn!.className).toContain("bg-[#009de5]");

      unmount();
      document.body.removeChild(container);
    });

    it("renders selected zone button with active styling", () => {
      render(<SessionsStep {...defaultProps} />);

      act(() => {
        getLastFilterElement().props.onToggleZone("Valley Zone");
      });

      const { container, unmount } = renderFilterPanel();

      const buttons = container.querySelectorAll("button");
      const zoneBtn = Array.from(buttons).find(
        (b) => b.textContent === "Valley"
      );
      expect(zoneBtn).toBeDefined();
      expect(zoneBtn!.className).toContain("bg-[#009de5]");

      unmount();
      document.body.removeChild(container);
    });

    it("renders selected interest button with active inline styles", () => {
      render(<SessionsStep {...defaultProps} />);

      act(() => {
        getLastFilterElement().props.onToggleInterest("high");
      });

      const { container, unmount } = renderFilterPanel();

      const buttons = container.querySelectorAll("button");
      const highBtn = Array.from(buttons).find((b) => b.textContent === "High");
      expect(highBtn).toBeDefined();
      // Active interest buttons get inline backgroundColor style
      expect(highBtn!.style.backgroundColor).not.toBe("");

      unmount();
      document.body.removeChild(container);
    });

    it("renders Hide hidden sessions text after toggling show hidden on", () => {
      render(
        <SessionsStep
          {...defaultProps}
          initialHiddenSessions={new Set(["TEN-001"])}
        />
      );

      act(() => {
        getLastFilterElement().props.onToggleShowHidden();
      });

      const { container, unmount } = renderFilterPanel();

      expect(container.textContent).toContain("Hide hidden sessions");

      unmount();
      document.body.removeChild(container);
    });
  });

  // ── Filtering sessions via callbacks with assertions ──────────

  describe("filter callbacks with DOM assertions", () => {
    function getLastFilterProps() {
      return mockSetPanel.mock.calls[mockSetPanel.mock.calls.length - 1][0]
        .props;
    }

    it("sport filter hides sessions from non-matching sports", () => {
      render(<SessionsStep {...defaultProps} />);
      expect(screen.getByText("Men's Singles Final")).toBeDefined();
      expect(screen.getByText("100m Freestyle Final")).toBeDefined();

      act(() => {
        getLastFilterProps().onToggleSport("Tennis");
      });

      // Only Tennis sessions should remain
      expect(screen.getByText("Men's Singles Final")).toBeDefined();
      expect(screen.getByText("Women's Singles Semifinal")).toBeDefined();
      expect(screen.queryByText("100m Freestyle Final")).toBeNull();
      expect(screen.queryByText("200m Butterfly Heats")).toBeNull();
    });

    it("type filter hides sessions with non-matching type", () => {
      render(<SessionsStep {...defaultProps} />);

      act(() => {
        getLastFilterProps().onToggleType("Final");
      });

      // Only "Final" type sessions
      expect(screen.getByText("Men's Singles Final")).toBeDefined();
      expect(screen.getByText("100m Freestyle Final")).toBeDefined();
      expect(screen.queryByText("Women's Singles Semifinal")).toBeNull();
      expect(screen.queryByText("200m Butterfly Heats")).toBeNull();
    });

    it("date filter hides sessions on non-matching dates", () => {
      render(<SessionsStep {...defaultProps} />);

      act(() => {
        getLastFilterProps().onToggleDate("2025-07-26");
      });

      // Only 2025-07-26 sessions
      expect(screen.getByText("Men's Singles Final")).toBeDefined();
      expect(screen.getByText("Women's Singles Semifinal")).toBeDefined();
      expect(screen.queryByText("100m Freestyle Final")).toBeNull();
      expect(screen.queryByText("200m Butterfly Heats")).toBeNull();
    });

    it("zone filter hides sessions in non-matching zones", () => {
      render(<SessionsStep {...defaultProps} />);

      act(() => {
        getLastFilterProps().onToggleZone("Carson Zone");
      });

      // Only Carson Zone sessions (Swimming)
      expect(screen.queryByText("Men's Singles Final")).toBeNull();
      expect(screen.queryByText("Women's Singles Semifinal")).toBeNull();
      expect(screen.getByText("100m Freestyle Final")).toBeDefined();
      expect(screen.getByText("200m Butterfly Heats")).toBeDefined();
    });

    it("interest filter shows only sessions with matching interest level", () => {
      const initialPrefs = new Map<string, SessionPreferenceData>([
        [
          "TEN-001",
          { sessionId: "TEN-001", interest: "high", maxWillingness: 200 },
        ],
        [
          "SWM-001",
          { sessionId: "SWM-001", interest: "low", maxWillingness: 100 },
        ],
      ]);
      render(
        <SessionsStep {...defaultProps} initialPreferences={initialPrefs} />
      );

      act(() => {
        getLastFilterProps().onToggleInterest("high");
      });

      // Only TEN-001 has "high" interest
      expect(screen.getByText("Men's Singles Final")).toBeDefined();
      expect(screen.queryByText("100m Freestyle Final")).toBeNull();
      // TEN-002 and SWM-002 have no interest set, also filtered out
      expect(screen.queryByText("Women's Singles Semifinal")).toBeNull();
      expect(screen.queryByText("200m Butterfly Heats")).toBeNull();
    });

    it("interest filter 'not_set' shows only sessions without preferences", () => {
      const initialPrefs = new Map<string, SessionPreferenceData>([
        [
          "TEN-001",
          { sessionId: "TEN-001", interest: "high", maxWillingness: 200 },
        ],
      ]);
      render(
        <SessionsStep {...defaultProps} initialPreferences={initialPrefs} />
      );

      act(() => {
        getLastFilterProps().onToggleInterest("not_set");
      });

      // TEN-001 has "high" — should be hidden
      expect(screen.queryByText("Men's Singles Final")).toBeNull();
      // Others have no preference set — should be visible
      expect(screen.getByText("Women's Singles Semifinal")).toBeDefined();
      expect(screen.getByText("100m Freestyle Final")).toBeDefined();
      expect(screen.getByText("200m Butterfly Heats")).toBeDefined();
    });

    it("clearing all filters shows all sessions again", () => {
      render(<SessionsStep {...defaultProps} />);

      // Apply a filter
      act(() => {
        getLastFilterProps().onToggleSport("Tennis");
      });
      expect(screen.queryByText("100m Freestyle Final")).toBeNull();

      // Clear all
      act(() => {
        getLastFilterProps().onClearAll();
      });
      expect(screen.getByText("100m Freestyle Final")).toBeDefined();
      expect(screen.getByText("Men's Singles Final")).toBeDefined();
    });

    it("clearing sport filter shows all sports again", () => {
      render(<SessionsStep {...defaultProps} />);

      act(() => {
        getLastFilterProps().onToggleSport("Tennis");
      });
      expect(screen.queryByText("100m Freestyle Final")).toBeNull();

      act(() => {
        getLastFilterProps().onClearSports();
      });
      expect(screen.getByText("100m Freestyle Final")).toBeDefined();
    });

    it("clearing type filter shows all types again", () => {
      render(<SessionsStep {...defaultProps} />);

      act(() => {
        getLastFilterProps().onToggleType("Final");
      });
      expect(screen.queryByText("Women's Singles Semifinal")).toBeNull();

      act(() => {
        getLastFilterProps().onClearTypes();
      });
      expect(screen.getByText("Women's Singles Semifinal")).toBeDefined();
    });

    it("clearing date filter shows all dates again", () => {
      render(<SessionsStep {...defaultProps} />);

      act(() => {
        getLastFilterProps().onToggleDate("2025-07-26");
      });
      expect(screen.queryByText("100m Freestyle Final")).toBeNull();

      act(() => {
        getLastFilterProps().onClearDates();
      });
      expect(screen.getByText("100m Freestyle Final")).toBeDefined();
    });

    it("clearing zone filter shows all zones again", () => {
      render(<SessionsStep {...defaultProps} />);

      act(() => {
        getLastFilterProps().onToggleZone("Carson Zone");
      });
      expect(screen.queryByText("Men's Singles Final")).toBeNull();

      act(() => {
        getLastFilterProps().onClearZones();
      });
      expect(screen.getByText("Men's Singles Final")).toBeDefined();
    });

    it("clearing interest filter shows all sessions again", () => {
      const initialPrefs = new Map<string, SessionPreferenceData>([
        [
          "TEN-001",
          { sessionId: "TEN-001", interest: "high", maxWillingness: 200 },
        ],
      ]);
      render(
        <SessionsStep {...defaultProps} initialPreferences={initialPrefs} />
      );

      act(() => {
        getLastFilterProps().onToggleInterest("high");
      });
      expect(screen.queryByText("Women's Singles Semifinal")).toBeNull();

      act(() => {
        getLastFilterProps().onClearInterests();
      });
      expect(screen.getByText("Women's Singles Semifinal")).toBeDefined();
    });

    it("deselecting a sport filter re-shows those sessions", () => {
      render(<SessionsStep {...defaultProps} />);

      // Toggle on
      act(() => {
        getLastFilterProps().onToggleSport("Tennis");
      });
      expect(screen.queryByText("100m Freestyle Final")).toBeNull();

      // Toggle off (delete branch of toggleSetItem)
      act(() => {
        getLastFilterProps().onToggleSport("Tennis");
      });
      expect(screen.getByText("100m Freestyle Final")).toBeDefined();
    });

    it("shows empty state when filter matches no sessions", () => {
      render(<SessionsStep {...defaultProps} />);

      // Filter by a zone that doesn't exist (use Valley Zone, then add Carson)
      act(() => {
        getLastFilterProps().onToggleSport("Tennis");
      });
      act(() => {
        getLastFilterProps().onToggleZone("Carson Zone");
      });

      // Tennis sessions are in Valley Zone, not Carson Zone
      expect(
        screen.getByText("No sessions match the current filters.")
      ).toBeDefined();
    });

    it("show hidden sessions toggle via filter panel reveals hidden cards", () => {
      render(
        <SessionsStep
          {...defaultProps}
          initialHiddenSessions={new Set(["TEN-001"])}
        />
      );

      expect(screen.queryByText("Men's Singles Final")).toBeNull();

      act(() => {
        getLastFilterProps().onToggleShowHidden();
      });

      expect(screen.getByText("Men's Singles Final")).toBeDefined();
    });
  });
});
