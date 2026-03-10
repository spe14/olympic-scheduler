// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import ReviewStep from "@/app/(main)/groups/[groupId]/preferences/_components/review-step";
import type {
  SessionData,
  SessionPreferenceData,
} from "@/app/(main)/groups/[groupId]/preferences/_components/preference-wizard";

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
      firstName: "Alice",
      lastName: "Smith",
      avatarColor: "blue",
    },
    { id: "member-2", firstName: "Bob", lastName: "Jones", avatarColor: "red" },
    {
      id: "member-3",
      firstName: "Carol",
      lastName: "Lee",
      avatarColor: "green",
    },
  ],
};

vi.mock("@/app/(main)/groups/[groupId]/_components/group-context", () => ({
  useGroup: () => mockGroup,
}));

vi.mock("@/components/user-avatar", () => ({
  default: ({ name }: { name: string }) => (
    <span data-testid="user-avatar">{name}</span>
  ),
}));

// ─── Helpers ────────────────────────────────────────────────────────

function makeSessions(overrides: Partial<SessionData>[] = []): SessionData[] {
  const defaults: SessionData[] = [
    {
      sessionCode: "S1",
      sport: "Swimming",
      sessionType: "Final",
      sessionDescription: "100m Freestyle Final",
      sessionDate: "2024-07-28",
      startTime: "10:00",
      endTime: "12:00",
      venue: "Aquatics Centre",
    },
    {
      sessionCode: "S2",
      sport: "Athletics",
      sessionType: "Heats",
      sessionDescription: "",
      sessionDate: "2024-07-28",
      startTime: "14:00",
      endTime: "16:00",
      venue: "Olympic Stadium",
    },
    {
      sessionCode: "S3",
      sport: "Gymnastics",
      sessionType: "Team Final",
      sessionDescription: "Women's Team Final",
      sessionDate: "2024-07-29",
      startTime: "09:00",
      endTime: "11:00",
      venue: "Gymnastics Arena",
    },
  ];
  return overrides.length > 0
    ? overrides.map((o, i) => ({ ...defaults[i % defaults.length], ...o }))
    : defaults;
}

function makePreferences(
  entries: [string, Partial<SessionPreferenceData>][]
): Map<string, SessionPreferenceData> {
  const map = new Map<string, SessionPreferenceData>();
  for (const [key, partial] of entries) {
    map.set(key, {
      sessionId: partial.sessionId ?? key,
      interest: partial.interest ?? "medium",
      maxWillingness: partial.maxWillingness ?? 200,
      ...partial,
    } as SessionPreferenceData);
  }
  return map;
}

const defaultProps = {
  budget: 5000,
  minBuddies: 2,
  buddies: [] as { memberId: string; type: "hard" | "soft" }[],
  sportRankings: ["Swimming", "Athletics", "Gymnastics"],
  sessionPreferences: new Map<string, SessionPreferenceData>(),
  sessions: makeSessions(),
};

// ─── Tests ──────────────────────────────────────────────────────────

describe("ReviewStep", () => {
  afterEach(() => cleanup());

  // 1. Renders review title and subtitle
  it("renders review title and subtitle", () => {
    render(<ReviewStep {...defaultProps} />);
    expect(screen.getByText("Review Your Preferences")).toBeDefined();
    expect(
      screen.getByText("You can go back to any step to make changes.")
    ).toBeDefined();
  });

  // 2. Shows budget when set (formatted with $ and comma separator)
  it("shows budget formatted with $ and comma separator", () => {
    render(<ReviewStep {...defaultProps} budget={5000} />);
    expect(screen.getByText("$5,000")).toBeDefined();
  });

  // 3. Shows "Not set" when budget is null
  it('shows "Not set" when budget is null', () => {
    render(<ReviewStep {...defaultProps} budget={null} />);
    expect(screen.getByText("Not set")).toBeDefined();
  });

  // 4. Shows minimum buddies count
  it("shows minimum buddies count", () => {
    render(<ReviewStep {...defaultProps} minBuddies={3} sportRankings={[]} />);
    expect(
      screen.getByText("Minimum Buddies Required Per Session")
    ).toBeDefined();
    expect(screen.getByText("3")).toBeDefined();
  });

  // 5. Shows required (hard) buddy names
  it("shows required (hard) buddy names", () => {
    render(
      <ReviewStep
        {...defaultProps}
        buddies={[{ memberId: "member-2", type: "hard" }]}
      />
    );
    expect(screen.getByText("Required Buddies")).toBeDefined();
    expect(screen.getByText("Bob Jones")).toBeDefined();
  });

  // 6. Shows preferred (soft) buddy names
  it("shows preferred (soft) buddy names", () => {
    render(
      <ReviewStep
        {...defaultProps}
        buddies={[{ memberId: "member-3", type: "soft" }]}
      />
    );
    expect(screen.getByText("Preferred Buddies")).toBeDefined();
    expect(screen.getByText("Carol Lee")).toBeDefined();
  });

  // 7. Shows "No buddies selected" when empty
  it('shows "No buddies selected" when buddies array is empty', () => {
    render(<ReviewStep {...defaultProps} buddies={[]} />);
    expect(screen.getByText("No buddies selected")).toBeDefined();
  });

  // 8. Shows sport rankings in order with rank numbers
  it("shows sport rankings in order with rank numbers", () => {
    render(
      <ReviewStep
        {...defaultProps}
        sportRankings={["Swimming", "Athletics", "Gymnastics"]}
        sessionPreferences={new Map()}
      />
    );
    expect(screen.getByText("Sport Rankings")).toBeDefined();
    expect(screen.getByText("Swimming")).toBeDefined();
    expect(screen.getByText("Athletics")).toBeDefined();
    expect(screen.getByText("Gymnastics")).toBeDefined();
    // Check rank numbers exist (may appear in other sections too, so use getAllByText)
    expect(screen.getAllByText("1").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("2").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("3").length).toBeGreaterThanOrEqual(1);
    // Verify ordering by checking DOM positions
    const { container } = render(
      <ReviewStep
        {...defaultProps}
        sportRankings={["Swimming", "Athletics", "Gymnastics"]}
        sessionPreferences={new Map()}
      />
    );
    const text = container.textContent ?? "";
    const swimIdx = text.indexOf("Swimming");
    const athIdx = text.indexOf("Athletics");
    const gymIdx = text.indexOf("Gymnastics");
    expect(swimIdx).toBeLessThan(athIdx);
    expect(athIdx).toBeLessThan(gymIdx);
  });

  // 9. Shows "No sports ranked" when empty
  it('shows "No sports ranked" when sportRankings is empty', () => {
    render(<ReviewStep {...defaultProps} sportRankings={[]} />);
    expect(screen.getByText("No sports ranked")).toBeDefined();
  });

  // 10. Shows selected session details (sport, type, description, interest, willingness)
  it("shows selected session details", () => {
    const prefs = makePreferences([
      ["S1", { interest: "high", maxWillingness: 200 }],
    ]);
    render(
      <ReviewStep
        {...defaultProps}
        sportRankings={[]}
        sessionPreferences={prefs}
        sessions={makeSessions()}
      />
    );
    expect(screen.getByText("Swimming")).toBeDefined();
    expect(screen.getByText("Final")).toBeDefined();
    expect(screen.getByText("100m Freestyle Final")).toBeDefined();
    expect(screen.getByText("High")).toBeDefined();
    expect(screen.getByText("<$200")).toBeDefined();
  });

  // 11. Shows "No sessions selected" when empty
  it('shows "No sessions selected" when no session preferences exist', () => {
    render(
      <ReviewStep
        {...defaultProps}
        sessionPreferences={new Map()}
        sessions={makeSessions()}
      />
    );
    expect(screen.getByText("No sessions selected")).toBeDefined();
  });

  // 12. Groups sessions by date
  it("groups sessions by date with formatted date headers", () => {
    const prefs = makePreferences([
      ["S1", { interest: "high", maxWillingness: 200 }],
      ["S2", { interest: "medium", maxWillingness: 300 }],
      ["S3", { interest: "low", maxWillingness: null }],
    ]);
    render(
      <ReviewStep
        {...defaultProps}
        sessionPreferences={prefs}
        sessions={makeSessions()}
      />
    );
    // Two dates: Jul 28 and Jul 29
    expect(screen.getByText("Sun, Jul 28")).toBeDefined();
    expect(screen.getByText("Mon, Jul 29")).toBeDefined();
  });

  // 13. Shows interest level breakdown badges
  it("shows interest level breakdown badges", () => {
    const prefs = makePreferences([
      ["S1", { interest: "high", maxWillingness: 200 }],
      ["S2", { interest: "high", maxWillingness: 300 }],
      ["S3", { interest: "medium", maxWillingness: 100 }],
    ]);
    render(
      <ReviewStep
        {...defaultProps}
        sessionPreferences={prefs}
        sessions={makeSessions()}
      />
    );
    expect(screen.getByText("2 High")).toBeDefined();
    expect(screen.getByText("1 Medium")).toBeDefined();
  });

  // 14. Shows total selected sessions count (singular vs plural)
  it("shows total selected sessions count with correct pluralization", () => {
    // Plural case
    const prefsMultiple = makePreferences([
      ["S1", { interest: "high", maxWillingness: 200 }],
      ["S2", { interest: "medium", maxWillingness: 300 }],
    ]);
    const { unmount } = render(
      <ReviewStep
        {...defaultProps}
        sessionPreferences={prefsMultiple}
        sessions={makeSessions()}
      />
    );
    expect(screen.getByText("2 sessions selected")).toBeDefined();
    unmount();

    // Singular case
    const prefsSingle = makePreferences([
      ["S1", { interest: "high", maxWillingness: 200 }],
    ]);
    render(
      <ReviewStep
        {...defaultProps}
        sessionPreferences={prefsSingle}
        sessions={makeSessions()}
      />
    );
    expect(screen.getByText("1 session selected")).toBeDefined();
  });

  // 15. Formats willingness as "$1000+" for null, "<$200" for number
  it("formats willingness correctly for null and number values", () => {
    const prefs = makePreferences([
      ["S1", { interest: "high", maxWillingness: null }],
      ["S2", { interest: "medium", maxWillingness: 200 }],
    ]);
    render(
      <ReviewStep
        {...defaultProps}
        sessionPreferences={prefs}
        sessions={makeSessions()}
      />
    );
    expect(screen.getByText("$1000+")).toBeDefined();
    expect(screen.getByText("<$200")).toBeDefined();
  });

  // 16. Session sorting: sessions ordered by date then time
  it("sorts sessions by date then by time", () => {
    const sessions: SessionData[] = [
      {
        sessionCode: "LATE",
        sport: "Late Session Sport",
        sessionType: "Final",
        sessionDescription: "",
        sessionDate: "2024-07-29",
        startTime: "18:00",
        endTime: "20:00",
        venue: "Venue A",
      },
      {
        sessionCode: "EARLY",
        sport: "Early Session Sport",
        sessionType: "Heats",
        sessionDescription: "",
        sessionDate: "2024-07-28",
        startTime: "08:00",
        endTime: "10:00",
        venue: "Venue B",
      },
      {
        sessionCode: "MID",
        sport: "Mid Session Sport",
        sessionType: "Semi",
        sessionDescription: "",
        sessionDate: "2024-07-28",
        startTime: "14:00",
        endTime: "16:00",
        venue: "Venue C",
      },
    ];
    const prefs = makePreferences([
      ["LATE", { interest: "low", maxWillingness: 100 }],
      ["EARLY", { interest: "high", maxWillingness: 200 }],
      ["MID", { interest: "medium", maxWillingness: 300 }],
    ]);
    const { container } = render(
      <ReviewStep
        {...defaultProps}
        sessionPreferences={prefs}
        sessions={sessions}
      />
    );
    // Verify order: Early Session Sport before Mid Session Sport before Late Session Sport
    const text = container.textContent ?? "";
    const earlyIdx = text.indexOf("Early Session Sport");
    const midIdx = text.indexOf("Mid Session Sport");
    const lateIdx = text.indexOf("Late Session Sport");
    expect(earlyIdx).toBeLessThan(midIdx);
    expect(midIdx).toBeLessThan(lateIdx);
  });

  // 17. Handles member not found in group gracefully
  it("handles buddy with unknown memberId gracefully", () => {
    render(
      <ReviewStep
        {...defaultProps}
        buddies={[
          { memberId: "unknown-member", type: "hard" },
          { memberId: "member-2", type: "hard" },
        ]}
      />
    );
    // Should still render the known buddy without crashing
    expect(screen.getByText("Bob Jones")).toBeDefined();
    // The unknown buddy should not produce any text
    expect(screen.queryByText("unknown-member")).toBeNull();
  });

  // Additional edge cases

  it("shows both hard and soft buddies in separate sections", () => {
    render(
      <ReviewStep
        {...defaultProps}
        buddies={[
          { memberId: "member-2", type: "hard" },
          { memberId: "member-3", type: "soft" },
        ]}
      />
    );
    expect(screen.getByText("Required Buddies")).toBeDefined();
    expect(screen.getByText("Preferred Buddies")).toBeDefined();
    expect(screen.getByText("Bob Jones")).toBeDefined();
    expect(screen.getByText("Carol Lee")).toBeDefined();
    // "No buddies selected" should NOT appear
    expect(screen.queryByText("No buddies selected")).toBeNull();
  });

  it("does not show interest breakdown badges for levels with zero count", () => {
    const prefs = makePreferences([
      ["S1", { interest: "high", maxWillingness: 200 }],
    ]);
    render(
      <ReviewStep
        {...defaultProps}
        sessionPreferences={prefs}
        sessions={makeSessions()}
      />
    );
    expect(screen.getByText("1 High")).toBeDefined();
    expect(screen.queryByText(/Medium/)).toBeNull();
    expect(screen.queryByText(/Low/)).toBeNull();
  });

  it("does not render session description when it is empty", () => {
    // S2 has empty sessionDescription
    const prefs = makePreferences([
      ["S2", { interest: "medium", maxWillingness: 300 }],
    ]);
    render(
      <ReviewStep
        {...defaultProps}
        sportRankings={[]}
        sessionPreferences={prefs}
        sessions={makeSessions()}
      />
    );
    expect(screen.getByText("Athletics")).toBeDefined();
    expect(screen.getByText("Heats")).toBeDefined();
    // The empty description should not be rendered as a <p>
    expect(screen.queryByText("100m Freestyle Final")).toBeNull();
  });

  it("shows section headings for Buddies & Budget and Session Interests", () => {
    render(<ReviewStep {...defaultProps} />);
    expect(screen.getByText("Buddies & Budget")).toBeDefined();
    expect(screen.getByText("Session Interests")).toBeDefined();
  });
});
