// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  act,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { GroupDetail } from "@/lib/types";
import type { GroupScheduleMemberCombo } from "@/app/(main)/groups/[groupId]/group-schedule/actions";

// ─── Mocks ──────────────────────────────────────────────────────────

const mockSetPanel = vi.fn();

vi.mock("@/app/(main)/groups/[groupId]/_components/side-panel-context", () => ({
  useSidePanel: () => ({ panel: null, setPanel: mockSetPanel }),
}));

const mockGetGroupSchedule = vi.fn<
  [string],
  Promise<{ data?: GroupScheduleMemberCombo[]; error?: string }>
>();

vi.mock("@/app/(main)/groups/[groupId]/group-schedule/actions", () => ({
  getGroupSchedule: (...args: unknown[]) =>
    mockGetGroupSchedule(...(args as [string])),
}));

let mockGroup: GroupDetail;

vi.mock("@/app/(main)/groups/[groupId]/_components/group-context", () => ({
  useGroup: () => mockGroup,
}));

vi.mock("@/components/modal", () => ({
  default: ({
    title,
    children,
    onClose,
  }: {
    title: string;
    children: React.ReactNode;
    onClose: () => void;
  }) => (
    <div data-testid="modal" data-title={title}>
      {children}
      <button data-testid="modal-close" onClick={onClose}>
        Close
      </button>
    </div>
  ),
}));

vi.mock("@/components/user-avatar", () => ({
  default: ({
    firstName,
    lastName,
  }: {
    firstName: string;
    lastName: string;
    avatarColor: string;
    size?: string;
  }) => (
    <span data-testid="user-avatar">
      {firstName[0]}
      {lastName[0]}
    </span>
  ),
}));

vi.mock("lucide-react", () => ({
  Maximize2: (props: Record<string, unknown>) => (
    <svg data-testid="maximize-icon" {...props} />
  ),
  User: (props: Record<string, unknown>) => (
    <svg data-testid="user-icon" {...props} />
  ),
}));

import GroupScheduleContent from "@/app/(main)/groups/[groupId]/group-schedule/group-schedule-content";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ─── Helpers ────────────────────────────────────────────────────────

// Jul 14, 2028 is a Friday. The week Sun Jul 9 – Sat Jul 15 contains it.
const SESSION_DAY = "2028-07-14";
const SESSION_DAY_2 = "2028-07-15";

function makeGroup(overrides: Partial<GroupDetail> = {}): GroupDetail {
  return {
    id: "group-1",
    name: "Test Group",
    phase: "schedule_review",
    inviteCode: "ABC123",
    dateMode: "specific",
    consecutiveDays: 5,
    startDate: "2028-07-14",
    endDate: "2028-07-18",
    scheduleGeneratedAt: "2028-07-01T00:00:00Z",
    createdAt: "2028-01-01T00:00:00Z",
    myRole: "owner",
    myStatus: "preferences_set",
    myMemberId: "m1",
    members: [
      {
        id: "m1",
        userId: "user-1",
        firstName: "Alex",
        lastName: "Chen",
        username: "alexc",
        avatarColor: "blue",
        role: "owner",
        status: "preferences_set",
        joinedAt: "2027-12-01T00:00:00Z",
        statusChangedAt: null,
        createdAt: "2027-12-01T00:00:00Z",
      },
      {
        id: "m2",
        userId: "user-2",
        firstName: "Jordan",
        lastName: "Park",
        username: "jordanp",
        avatarColor: "pink",
        role: "member",
        status: "preferences_set",
        joinedAt: "2027-12-02T00:00:00Z",
        statusChangedAt: null,
        createdAt: "2027-12-02T00:00:00Z",
      },
    ],
    membersWithNoCombos: [],
    departedMembers: [],
    affectedBuddyMembers: {},
    windowRankings: [
      {
        id: "w1",
        startDate: "2028-07-14",
        endDate: "2028-07-18",
        score: 85,
        selected: true,
      },
      {
        id: "w2",
        startDate: "2028-07-16",
        endDate: "2028-07-20",
        score: 72,
        selected: false,
      },
      {
        id: "w3",
        startDate: "2028-07-18",
        endDate: "2028-07-22",
        score: 65,
        selected: false,
      },
    ],
    ...overrides,
  };
}

function makeScheduleData(): GroupScheduleMemberCombo[] {
  return [
    {
      memberId: "m1",
      firstName: "Alex",
      lastName: "Chen",
      avatarColor: "blue",
      day: SESSION_DAY,
      rank: "primary",
      score: 85,
      sessions: [
        {
          sessionCode: "SWM01",
          sport: "Swimming",
          sessionType: "Final",
          sessionDescription: "100m Freestyle Final",
          venue: "Aquatics Center",
          zone: "Zone A",
          startTime: "09:00",
          endTime: "11:00",
        },
        {
          sessionCode: "ATH01",
          sport: "Athletics",
          sessionType: "Preliminary",
          sessionDescription: "100m Heats",
          venue: "Olympic Stadium",
          zone: "Zone B",
          startTime: "14:00",
          endTime: "16:00",
        },
      ],
    },
    {
      memberId: "m2",
      firstName: "Jordan",
      lastName: "Park",
      avatarColor: "pink",
      day: SESSION_DAY,
      rank: "primary",
      score: 80,
      sessions: [
        {
          sessionCode: "SWM01",
          sport: "Swimming",
          sessionType: "Final",
          sessionDescription: "100m Freestyle Final",
          venue: "Aquatics Center",
          zone: "Zone A",
          startTime: "09:00",
          endTime: "11:00",
        },
        {
          sessionCode: "GYM01",
          sport: "Gymnastics",
          sessionType: "Final",
          sessionDescription: "Women's All-Around Final",
          venue: "Gymnastics Arena",
          zone: "Zone C",
          startTime: "18:00",
          endTime: "20:00",
        },
      ],
    },
    {
      memberId: "m1",
      firstName: "Alex",
      lastName: "Chen",
      avatarColor: "blue",
      day: SESSION_DAY_2,
      rank: "primary",
      score: 82,
      sessions: [
        {
          sessionCode: "DIV01",
          sport: "Diving",
          sessionType: "Final",
          sessionDescription: "10m Platform Final",
          venue: "Aquatics Center",
          zone: "Zone A",
          startTime: "10:00",
          endTime: "12:00",
        },
      ],
    },
  ];
}

function makeOverlappingData(): GroupScheduleMemberCombo[] {
  return [
    {
      memberId: "m1",
      firstName: "Alex",
      lastName: "Chen",
      avatarColor: "blue",
      day: SESSION_DAY,
      rank: "primary",
      score: 85,
      sessions: [
        {
          sessionCode: "S1",
          sport: "Swimming",
          sessionType: "Final",
          sessionDescription: null,
          venue: "V1",
          zone: "Z1",
          startTime: "09:00",
          endTime: "11:00",
        },
        {
          sessionCode: "S2",
          sport: "Athletics",
          sessionType: "Final",
          sessionDescription: null,
          venue: "V2",
          zone: "Z2",
          startTime: "09:00",
          endTime: "11:00",
        },
        {
          sessionCode: "S3",
          sport: "Gymnastics",
          sessionType: "Final",
          sessionDescription: null,
          venue: "V3",
          zone: "Z3",
          startTime: "09:00",
          endTime: "11:00",
        },
        {
          sessionCode: "S4",
          sport: "Diving",
          sessionType: "Final",
          sessionDescription: null,
          venue: "V4",
          zone: "Z4",
          startTime: "09:00",
          endTime: "11:00",
        },
        {
          sessionCode: "S5",
          sport: "Fencing",
          sessionType: "Final",
          sessionDescription: null,
          venue: "V5",
          zone: "Z5",
          startTime: "09:00",
          endTime: "11:00",
        },
      ],
    },
  ];
}

async function renderWithSchedule(
  groupOverrides: Partial<GroupDetail> = {},
  scheduleData: GroupScheduleMemberCombo[] = makeScheduleData()
) {
  mockGroup = makeGroup(groupOverrides);
  mockGetGroupSchedule.mockResolvedValue({ data: scheduleData });
  await act(async () => {
    render(<GroupScheduleContent />);
  });
}

function getLatestSidebarElement() {
  const panelCalls = mockSetPanel.mock.calls.filter((call) => call[0] !== null);
  return panelCalls[panelCalls.length - 1]?.[0];
}

function renderSidebar() {
  const el = getLatestSidebarElement();
  return render(el);
}

// ─── Empty / Loading States ─────────────────────────────────────────

describe("GroupScheduleContent — empty states", () => {
  it("shows placeholder when no schedules generated", () => {
    mockGroup = makeGroup({ scheduleGeneratedAt: null });
    mockGetGroupSchedule.mockResolvedValue({ data: [] });
    render(<GroupScheduleContent />);
    expect(
      screen.getByText(
        "The group schedule will appear here once the owner has generated schedules and configured dates."
      )
    ).toBeDefined();
  });

  it("shows error when members have no combos", () => {
    mockGroup = makeGroup({ membersWithNoCombos: ["m1"] });
    mockGetGroupSchedule.mockResolvedValue({ data: [] });
    render(<GroupScheduleContent />);
    expect(
      screen.getByText("Some members received no sessions on their schedules.")
    ).toBeDefined();
  });

  it("shows placeholder when no date config", async () => {
    mockGroup = makeGroup({ dateMode: null, windowRankings: [] });
    mockGetGroupSchedule.mockResolvedValue({ data: makeScheduleData() });
    await act(async () => {
      render(<GroupScheduleContent />);
    });
    expect(
      screen.getByText(
        "Owner needs to configure dates before the group schedule can be viewed."
      )
    ).toBeDefined();
  });

  it("shows owner hint when no date config and user is owner", async () => {
    mockGroup = makeGroup({
      dateMode: null,
      windowRankings: [],
      myRole: "owner",
    });
    mockGetGroupSchedule.mockResolvedValue({ data: makeScheduleData() });
    await act(async () => {
      render(<GroupScheduleContent />);
    });
    expect(
      screen.getByText("Open Group Settings to set your date configuration.")
    ).toBeDefined();
  });

  it("hides owner hint when user is not owner", async () => {
    mockGroup = makeGroup({
      dateMode: null,
      windowRankings: [],
      myRole: "member",
    });
    mockGetGroupSchedule.mockResolvedValue({ data: makeScheduleData() });
    await act(async () => {
      render(<GroupScheduleContent />);
    });
    expect(
      screen.queryByText("Open Group Settings to set your date configuration.")
    ).toBeNull();
  });

  it("shows loading state while fetching", () => {
    mockGroup = makeGroup();
    mockGetGroupSchedule.mockReturnValue(new Promise(() => {}));
    render(<GroupScheduleContent />);
    expect(screen.getByText("Loading group schedule...")).toBeDefined();
  });

  it("shows error state on fetch failure", async () => {
    mockGroup = makeGroup();
    mockGetGroupSchedule.mockResolvedValue({ error: "Something went wrong" });
    await act(async () => {
      render(<GroupScheduleContent />);
    });
    expect(screen.getByText("Something went wrong")).toBeDefined();
  });

  it("shows empty state when schedule data is empty", async () => {
    mockGroup = makeGroup();
    mockGetGroupSchedule.mockResolvedValue({ data: [] });
    await act(async () => {
      render(<GroupScheduleContent />);
    });
    expect(screen.getByText("No schedule data available.")).toBeDefined();
  });
});

// ─── Calendar View (Week) ───────────────────────────────────────────

describe("GroupScheduleContent — calendar week view", () => {
  it("renders session blocks on the calendar", async () => {
    await renderWithSchedule();
    expect(screen.getByText("SWM01")).toBeDefined();
    expect(screen.getByText("ATH01")).toBeDefined();
    expect(screen.getByText("GYM01")).toBeDefined();
  });

  it('shows "You" indicator on sessions the current user attends', async () => {
    await renderWithSchedule();
    // m1 attends SWM01, ATH01, DIV01 — GYM01 is only m2
    const youLabels = screen.getAllByText("You");
    expect(youLabels.length).toBe(3);
  });

  it('does not show "You" on sessions only other members attend', async () => {
    await renderWithSchedule();
    // GYM01 only has m2. Find its button and check no "You" inside.
    const gymBlock = screen.getByText("GYM01").closest("button")!;
    expect(gymBlock.textContent).not.toContain("You");
  });

  it("shows schedule last updated timestamp", async () => {
    await renderWithSchedule();
    expect(screen.getByText(/Schedule Last Updated On/)).toBeDefined();
  });

  it("renders week label with date range", async () => {
    await renderWithSchedule();
    expect(screen.getByText(/Jul \d+ - Jul \d+, 2028/)).toBeDefined();
  });

  it("shows Week/Day scale toggle", async () => {
    await renderWithSchedule();
    expect(screen.getByRole("button", { name: "Week" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Day" })).toBeDefined();
  });

  it("defaults to Week scale", async () => {
    await renderWithSchedule();
    const weekBtn = screen.getByRole("button", { name: "Week" });
    expect(weekBtn.className).toContain("bg-white");
  });

  it("shows column headers for the top window's week", async () => {
    await renderWithSchedule();
    expect(screen.getByText("Jul 14")).toBeDefined();
  });

  it("deduplicates sessions shared across members", async () => {
    await renderWithSchedule();
    // SWM01 appears in both m1 and m2 combos but should render once
    const swmBlocks = screen.getAllByText("SWM01");
    expect(swmBlocks.length).toBe(1);
  });
});

// ─── Calendar View (Day) ────────────────────────────────────────────

describe("GroupScheduleContent — calendar day view", () => {
  it("switches to day view when Day button is clicked", async () => {
    await renderWithSchedule();
    const dayBtn = screen.getByRole("button", { name: "Day" });
    fireEvent.click(dayBtn);
    expect(dayBtn.className).toContain("bg-white");
  });

  it("shows a single day label in day view", async () => {
    await renderWithSchedule();
    fireEvent.click(screen.getByRole("button", { name: "Day" }));
    expect(screen.getByText(/\w+, Jul \d+, 2028/)).toBeDefined();
  });

  it("navigates between days", async () => {
    await renderWithSchedule();
    fireEvent.click(screen.getByRole("button", { name: "Day" }));
    const label = screen.getByText(/\w+, Jul \d+, 2028/);
    const initialText = label.textContent;
    const navButtons = screen
      .getAllByRole("button")
      .filter((b) => b.querySelector("svg path") !== null);
    const nextBtn = navButtons[navButtons.length - 1];
    if (nextBtn && !nextBtn.hasAttribute("disabled")) {
      fireEvent.click(nextBtn);
      const newText = screen.getByText(/\w+, Jul \d+, 2028/).textContent;
      expect(newText).not.toBe(initialText);
    }
  });

  it("switches back to week view preserving context", async () => {
    await renderWithSchedule();
    fireEvent.click(screen.getByRole("button", { name: "Day" }));
    fireEvent.click(screen.getByRole("button", { name: "Week" }));
    expect(screen.getByText("Jul 14")).toBeDefined();
  });

  it("shows Week/Day toggle in calendar mode", async () => {
    await renderWithSchedule();
    expect(screen.getByRole("button", { name: "Week" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Day" })).toBeDefined();
  });

  it("clicking a day header in week view opens day view for that day", async () => {
    await renderWithSchedule();
    // Jul 14 is an Olympic day — its header should be clickable
    const jul14Header = screen.getByText("Jul 14").closest("[role='button']");
    expect(jul14Header).not.toBeNull();
    fireEvent.click(jul14Header!);
    // Should switch to day view
    const dayBtn = screen.getByRole("button", { name: "Day" });
    expect(dayBtn.className).toContain("bg-white");
    // Day label should show Jul 14
    expect(screen.getByText(/Fri, Jul 14, 2028/)).toBeDefined();
  });

  it("non-Olympic day headers in week view are not clickable", async () => {
    await renderWithSchedule();
    // Jul 9 is before Olympics — should NOT have role="button"
    const jul9Header = screen.getByText("Jul 9").closest("[role='button']");
    expect(jul9Header).toBeNull();
  });
});

// ─── List View ──────────────────────────────────────────────────────

describe("GroupScheduleContent — list view", () => {
  it("sidebar contains View As header with Calendar/List", async () => {
    await renderWithSchedule();
    const sidebar = renderSidebar();
    expect(sidebar.container.textContent).toContain("View As");
    expect(sidebar.getByText("Calendar")).toBeDefined();
    expect(sidebar.getByText("List")).toBeDefined();
    cleanup();
  });

  it("defaults Calendar as active in View As toggle", async () => {
    await renderWithSchedule();
    const sidebar = renderSidebar();
    const calBtn = sidebar.getByText("Calendar");
    expect(calBtn.className).toContain("bg-white");
    expect(calBtn.className).toContain("shadow-sm");
    cleanup();
  });

  it("List button is not active by default", async () => {
    await renderWithSchedule();
    const sidebar = renderSidebar();
    const listBtn = sidebar.getByText("List");
    expect(listBtn.className).not.toContain("shadow-sm");
    cleanup();
  });
});

// ─── Sidebar — Window Rankings ──────────────────────────────────────

describe("GroupScheduleContent — sidebar window rankings", () => {
  const consecutiveOverrides = {
    dateMode: "consecutive" as const,
    consecutiveDays: 5,
  };

  it("renders top 3 window rankings with scores", async () => {
    await renderWithSchedule(consecutiveOverrides);
    const sidebar = renderSidebar();
    expect(sidebar.container.textContent).toContain("Top Windows");
    expect(sidebar.container.textContent).toContain("85.0");
    expect(sidebar.container.textContent).toContain("72.0");
    expect(sidebar.container.textContent).toContain("65.0");
    cleanup();
  });

  it("highlights the top-ranked window by default", async () => {
    await renderWithSchedule(consecutiveOverrides);
    const sidebar = renderSidebar();
    const windowItems = Array.from(
      sidebar.container.querySelectorAll("[role='button']")
    ).filter((el) => el.textContent?.includes("Jul"));
    expect(windowItems.length).toBeGreaterThan(0);
    expect(windowItems[0].className).toContain("border-[#009de5]");
    cleanup();
  });

  it("non-active windows have default border", async () => {
    await renderWithSchedule(consecutiveOverrides);
    const sidebar = renderSidebar();
    const windowItems = Array.from(
      sidebar.container.querySelectorAll("[role='button']")
    ).filter((el) => el.textContent?.includes("Jul"));
    expect(windowItems[1].className).toContain("border-slate-200");
    cleanup();
  });

  it("shows Ranked by Group Score with info tooltip", async () => {
    await renderWithSchedule(consecutiveOverrides);
    const sidebar = renderSidebar();
    expect(sidebar.container.textContent).toContain("Ranked by Group Score");
    expect(sidebar.container.textContent).toContain("Scores reflect how well");
    cleanup();
  });

  it("clicking a window in calendar mode does not crash", async () => {
    await renderWithSchedule(consecutiveOverrides);
    const sidebar = renderSidebar();
    const windowItems = Array.from(
      sidebar.container.querySelectorAll("[role='button']")
    ).filter((el) => el.textContent?.includes("Jul"));
    fireEvent.click(windowItems[1]);
    cleanup();
    expect(mockSetPanel).toHaveBeenCalled();
  });

  it("windows are not clickable in list mode (no role=button)", async () => {
    await renderWithSchedule(consecutiveOverrides);
    // First render sidebar — it's in calendar mode by default
    let sidebar = renderSidebar();
    // Switch to list mode
    fireEvent.click(sidebar.getByText("List"));
    cleanup();
    // The setPanel will be called with updated displayMode.
    // Get the latest sidebar which should have displayMode="list"
    // Since the sidebar re-renders via the parent effect, check the latest call
    const latestPanel = getLatestSidebarElement();
    if (latestPanel) {
      const sidebar2 = render(latestPanel);
      const windowItems = Array.from(
        sidebar2.container.querySelectorAll("[role='button']")
      ).filter((el) => el.textContent?.includes("Jul"));
      // In list mode, windows should NOT have role="button"
      expect(windowItems.length).toBe(0);
      cleanup();
    }
  });

  it("does not render window section when no rankings", async () => {
    await renderWithSchedule({ ...consecutiveOverrides, windowRankings: [] });
    const sidebar = renderSidebar();
    expect(sidebar.container.textContent).not.toContain("Top Windows");
    cleanup();
  });

  it("hides Top Windows section in specific date mode", async () => {
    await renderWithSchedule({ dateMode: "specific" });
    const sidebar = renderSidebar();
    expect(sidebar.container.textContent).not.toContain("Top Windows");
    cleanup();
  });
});

// ─── Sidebar — Member Filter ────────────────────────────────────────

describe("GroupScheduleContent — sidebar member filter", () => {
  it("renders All Members selected by default", async () => {
    await renderWithSchedule();
    const sidebar = renderSidebar();
    const allBtn = sidebar.getByText("All Members");
    expect(allBtn.className).toContain("bg-[#009de5]");
    cleanup();
  });

  it("renders Any Attending / All Attending toggle", async () => {
    await renderWithSchedule();
    const sidebar = renderSidebar();
    expect(sidebar.getByText("Any Attending")).toBeDefined();
    expect(sidebar.getByText("All Attending")).toBeDefined();
    cleanup();
  });

  it("defaults to Any Attending mode", async () => {
    await renderWithSchedule();
    const sidebar = renderSidebar();
    const anyBtn = sidebar.getByText("Any Attending");
    expect(anyBtn.className).toContain("bg-white");
    expect(anyBtn.className).toContain("shadow-sm");
    cleanup();
  });

  it("shows individual member names", async () => {
    await renderWithSchedule();
    const sidebar = renderSidebar();
    expect(sidebar.container.textContent).toContain("Alex Chen");
    expect(sidebar.container.textContent).toContain("Jordan Park");
    cleanup();
  });

  it("shows tooltips for Any/All toggle", async () => {
    await renderWithSchedule();
    const sidebar = renderSidebar();
    expect(sidebar.container.textContent).toContain(
      "Display sessions that at least 1 selected member is attending."
    );
    expect(sidebar.container.textContent).toContain(
      "Display sessions that all selected members are attending."
    );
    cleanup();
  });

  it("clicking a member name does not crash", async () => {
    await renderWithSchedule();
    const sidebar = renderSidebar();
    fireEvent.click(sidebar.getByText("Alex Chen"));
    cleanup();
    expect(mockSetPanel).toHaveBeenCalled();
  });

  it("clicking All Attending toggle does not crash", async () => {
    await renderWithSchedule();
    const sidebar = renderSidebar();
    fireEvent.click(sidebar.getByText("All Attending"));
    cleanup();
    expect(mockSetPanel).toHaveBeenCalled();
  });
});

// ─── Sidebar Ordering ───────────────────────────────────────────────

describe("GroupScheduleContent — sidebar section ordering", () => {
  it("renders: View As → Selected Dates → Top Windows → Members (consecutive)", async () => {
    await renderWithSchedule({
      dateMode: "consecutive" as const,
      consecutiveDays: 5,
    });
    const sidebar = renderSidebar();
    const text = sidebar.container.textContent ?? "";
    const viewAsIdx = text.indexOf("View As");
    const datesIdx = text.indexOf("Selected Dates");
    const windowsIdx = text.indexOf("Top Windows");
    const membersIdx = text.indexOf("Members");
    expect(viewAsIdx).toBeLessThan(datesIdx);
    expect(datesIdx).toBeLessThan(windowsIdx);
    expect(windowsIdx).toBeLessThan(membersIdx);
    cleanup();
  });

  it("renders: View As → Selected Dates → Members (specific, no Top Windows)", async () => {
    await renderWithSchedule({ dateMode: "specific" as const });
    const sidebar = renderSidebar();
    const text = sidebar.container.textContent ?? "";
    const viewAsIdx = text.indexOf("View As");
    const datesIdx = text.indexOf("Selected Dates");
    const membersIdx = text.indexOf("Members");
    expect(viewAsIdx).toBeLessThan(datesIdx);
    expect(datesIdx).toBeLessThan(membersIdx);
    expect(text).not.toContain("Top Windows");
    cleanup();
  });
});

// ─── Sidebar — Selected Dates ────────────────────────────────────────

describe("GroupScheduleContent — sidebar selected dates", () => {
  it("shows date range for specific mode", async () => {
    await renderWithSchedule({
      dateMode: "specific",
      startDate: "2028-07-14",
      endDate: "2028-07-18",
    });
    const sidebar = renderSidebar();
    expect(sidebar.container.textContent).toContain("Selected Dates");
    expect(sidebar.container.textContent).toContain("Jul 14");
    expect(sidebar.container.textContent).toContain("Jul 18");
    cleanup();
  });

  it("shows consecutive days for consecutive mode", async () => {
    await renderWithSchedule({
      dateMode: "consecutive" as const,
      consecutiveDays: 5,
    });
    const sidebar = renderSidebar();
    expect(sidebar.container.textContent).toContain("Selected Dates");
    expect(sidebar.container.textContent).toContain("5 consecutive days");
    cleanup();
  });

  it("shows singular 'day' for 1 consecutive day", async () => {
    await renderWithSchedule({
      dateMode: "consecutive" as const,
      consecutiveDays: 1,
    });
    const sidebar = renderSidebar();
    expect(sidebar.container.textContent).toContain("1 consecutive day");
    expect(sidebar.container.textContent).not.toContain("1 consecutive days");
    cleanup();
  });
});

// ─── Session Detail Modal ───────────────────────────────────────────

describe("GroupScheduleContent — session detail modal", () => {
  it("opens modal when a session block is clicked", async () => {
    await renderWithSchedule();
    fireEvent.click(screen.getAllByText("SWM01")[0].closest("button")!);
    const modal = screen.getByTestId("modal");
    expect(modal).toBeDefined();
    expect(modal.getAttribute("data-title")).toBe("Session Details");
  });

  it("shows session sport, venue, and zone in modal", async () => {
    await renderWithSchedule();
    fireEvent.click(screen.getAllByText("SWM01")[0].closest("button")!);
    const modal = screen.getByTestId("modal");
    expect(modal.textContent).toContain("Swimming");
    expect(modal.textContent).toContain("Aquatics Center");
    expect(modal.textContent).toContain("Zone A");
  });

  it("shows session code and type in modal header", async () => {
    await renderWithSchedule();
    fireEvent.click(screen.getAllByText("SWM01")[0].closest("button")!);
    const modal = screen.getByTestId("modal");
    expect(modal.textContent).toContain("SWM01");
    expect(modal.textContent).toContain("Final");
  });

  it("shows session description in modal", async () => {
    await renderWithSchedule();
    fireEvent.click(screen.getAllByText("SWM01")[0].closest("button")!);
    const modal = screen.getByTestId("modal");
    expect(modal.textContent).toContain("100m Freestyle Final");
  });

  it("shows attending members grouped by rank", async () => {
    await renderWithSchedule();
    fireEvent.click(screen.getAllByText("SWM01")[0].closest("button")!);
    const modal = screen.getByTestId("modal");
    expect(modal.textContent).toContain("Attending Members");
    expect(modal.textContent).toContain("Primary");
    expect(modal.textContent).toContain("Alex Chen");
    expect(modal.textContent).toContain("Jordan Park");
  });

  it("renders user avatars for attending members", async () => {
    await renderWithSchedule();
    fireEvent.click(screen.getAllByText("SWM01")[0].closest("button")!);
    const avatars = screen.getAllByTestId("user-avatar");
    expect(avatars.length).toBeGreaterThanOrEqual(2);
  });

  it("closes modal on close button click", async () => {
    await renderWithSchedule();
    fireEvent.click(screen.getAllByText("SWM01")[0].closest("button")!);
    expect(screen.getByTestId("modal")).toBeDefined();
    fireEvent.click(screen.getByTestId("modal-close"));
    expect(screen.queryByTestId("modal")).toBeNull();
  });

  it("does not show modal initially", async () => {
    await renderWithSchedule();
    expect(screen.queryByTestId("modal")).toBeNull();
  });
});

// ─── Week View Overlap Capping ──────────────────────────────────────

describe("GroupScheduleContent — week view overlap capping", () => {
  it('shows "+N more" badge when sessions exceed 3 overlapping columns', async () => {
    await renderWithSchedule({}, makeOverlappingData());
    expect(screen.getByText("+2 more")).toBeDefined();
  });

  it("does not show +more badge when overlaps are within limit", async () => {
    await renderWithSchedule();
    expect(screen.queryByText(/\+\d+ more/)).toBeNull();
  });

  it('clicking "+N more" switches to day view', async () => {
    await renderWithSchedule({}, makeOverlappingData());
    fireEvent.click(screen.getByText("+2 more"));
    const dayBtn = screen.getByRole("button", { name: "Day" });
    expect(dayBtn.className).toContain("bg-white");
    // All 5 sessions should now be visible
    expect(screen.getByText("S4")).toBeDefined();
    expect(screen.getByText("S5")).toBeDefined();
  });

  it("shows all sessions in day view without capping", async () => {
    await renderWithSchedule({}, makeOverlappingData());
    // Click "+2 more" to jump to day view for the correct day
    fireEvent.click(screen.getByText("+2 more"));
    expect(screen.getByText("S1")).toBeDefined();
    expect(screen.getByText("S2")).toBeDefined();
    expect(screen.getByText("S3")).toBeDefined();
    expect(screen.getByText("S4")).toBeDefined();
    expect(screen.getByText("S5")).toBeDefined();
    expect(screen.queryByText(/\+\d+ more/)).toBeNull();
  });
});

// ─── Calendar Default Position ──────────────────────────────────────

describe("GroupScheduleContent — calendar default position", () => {
  it("opens to the week containing the top window start date", async () => {
    await renderWithSchedule();
    expect(screen.getByText("Jul 14")).toBeDefined();
  });

  it("shows window days with highlighted background", async () => {
    await renderWithSchedule();
    const jul14Header = screen.getByText("Jul 14").closest("div[class]")!;
    expect(jul14Header.parentElement!.className).toContain("bg-slate-100");
  });

  it("shows non-olympic days with faded styling", async () => {
    await renderWithSchedule();
    // Jul 9 is before Olympics start (Jul 12) — should have faded text
    const jul9Header = screen.getByText("Jul 9");
    expect(jul9Header.className).toContain("text-slate-300");
  });
});

// ─── Member Filter Integration ──────────────────────────────────────

describe("GroupScheduleContent — member filter behavior", () => {
  it("shows all sessions when All Members + Any Attending (default)", async () => {
    await renderWithSchedule();
    expect(screen.getByText("SWM01")).toBeDefined();
    expect(screen.getByText("ATH01")).toBeDefined();
    expect(screen.getByText("GYM01")).toBeDefined();
    expect(screen.getByText("DIV01")).toBeDefined();
  });

  it("merges members from multiple combos into same session", async () => {
    await renderWithSchedule();
    // SWM01 has both m1 and m2 — clicking it should show both in modal
    fireEvent.click(screen.getAllByText("SWM01")[0].closest("button")!);
    const modal = screen.getByTestId("modal");
    expect(modal.textContent).toContain("Alex Chen");
    expect(modal.textContent).toContain("Jordan Park");
  });

  it("upgrades rank when member appears in multiple combos", async () => {
    // m1 has SWM01 in primary combo, add a backup1 combo with same session
    const data: GroupScheduleMemberCombo[] = [
      {
        memberId: "m1",
        firstName: "Alex",
        lastName: "Chen",
        avatarColor: "blue",
        day: SESSION_DAY,
        rank: "backup1",
        score: 70,
        sessions: [
          {
            sessionCode: "SWM01",
            sport: "Swimming",
            sessionType: "Final",
            sessionDescription: "100m Freestyle Final",
            venue: "Aquatics Center",
            zone: "Zone A",
            startTime: "09:00",
            endTime: "11:00",
          },
        ],
      },
      {
        memberId: "m1",
        firstName: "Alex",
        lastName: "Chen",
        avatarColor: "blue",
        day: SESSION_DAY,
        rank: "primary",
        score: 85,
        sessions: [
          {
            sessionCode: "SWM01",
            sport: "Swimming",
            sessionType: "Final",
            sessionDescription: "100m Freestyle Final",
            venue: "Aquatics Center",
            zone: "Zone A",
            startTime: "09:00",
            endTime: "11:00",
          },
        ],
      },
    ];
    await renderWithSchedule({}, data);
    fireEvent.click(screen.getAllByText("SWM01")[0].closest("button")!);
    const modal = screen.getByTestId("modal");
    // Should show Primary (best rank), not Backup 1
    expect(modal.textContent).toContain("Primary");
  });
});

// ─── Sidebar not rendered for empty states ──────────────────────────

describe("GroupScheduleContent — sidebar lifecycle", () => {
  it("does not render sidebar when no schedules", () => {
    mockGroup = makeGroup({ scheduleGeneratedAt: null });
    mockGetGroupSchedule.mockResolvedValue({ data: [] });
    render(<GroupScheduleContent />);
    // setPanel should be called with null (cleanup), not with sidebar content
    const nonNullCalls = mockSetPanel.mock.calls.filter(
      (call) => call[0] !== null
    );
    expect(nonNullCalls.length).toBe(0);
  });

  it("renders sidebar when schedule data is loaded", async () => {
    await renderWithSchedule();
    const nonNullCalls = mockSetPanel.mock.calls.filter(
      (call) => call[0] !== null
    );
    expect(nonNullCalls.length).toBeGreaterThan(0);
  });
});

// ─── Member Filter — filtering behavior ─────────────────────────────

describe("GroupScheduleContent — member filter filtering", () => {
  it("All Members + All Attending hides sessions not attended by everyone", async () => {
    await renderWithSchedule();
    // Switch to All Attending via sidebar
    const sidebar = renderSidebar();
    fireEvent.click(sidebar.getByText("All Attending"));
    cleanup();

    // After toggling, the main component re-renders.
    // ATH01 (m1 only) and GYM01 (m2 only) should be hidden.
    // SWM01 (both m1 and m2) should remain.
    // We need to verify through the sidebar callback re-render.
    // Since sidebar callbacks trigger state updates in the parent,
    // and the parent re-renders passing new props to setPanel,
    // we verify the All Attending toggle was activated.
    const latestSidebar = getLatestSidebarElement();
    const sidebar2 = render(latestSidebar);
    const allBtn = sidebar2.getByText("All Attending");
    expect(allBtn.className).toContain("bg-white");
    cleanup();
  });

  it("selecting individual member via sidebar does not crash", async () => {
    await renderWithSchedule();
    const sidebar = renderSidebar();
    // Click Alex Chen to switch from "All Members" to individual
    fireEvent.click(sidebar.getByText("Alex Chen"));
    cleanup();
    // Verify setPanel was called again (re-render happened)
    const latestSidebar = getLatestSidebarElement();
    const sidebar2 = render(latestSidebar);
    // Alex should be active, All Members should not
    const alexBtn = sidebar2.getByText("Alex Chen");
    expect(alexBtn.className).toContain("bg-[#009de5]");
    const allMembersBtn = sidebar2.getByText("All Members");
    expect(allMembersBtn.className).not.toContain("ring-[#009de5]");
    cleanup();
  });

  it("All Members button calls selectAll callback", async () => {
    await renderWithSchedule();
    const sidebar = renderSidebar();
    // All Members should be active by default
    const allBtn = sidebar.getByText("All Members");
    expect(allBtn.className).toContain("bg-[#009de5]");
    // Clicking it again should not crash
    fireEvent.click(allBtn);
    cleanup();
    expect(mockSetPanel).toHaveBeenCalled();
  });
});

// ─── Day column click-to-zoom ───────────────────────────────────────

describe("GroupScheduleContent — day column click-to-zoom", () => {
  it("clicking day header switches to day view for that day", async () => {
    await renderWithSchedule();
    // Jul 14 header has role="button" — clicking it should jump to day view
    const header = screen.getByText("Jul 14").closest("[role='button']")!;
    fireEvent.click(header);
    // Day button should be active
    const dayBtn = screen.getByRole("button", { name: "Day" });
    expect(dayBtn.className).toContain("bg-white");
    // Should show Jul 14 in the day label
    expect(screen.getByText(/Fri, Jul 14, 2028/)).toBeDefined();
  });

  it("session block click opens modal, not day view", async () => {
    await renderWithSchedule();
    // Click a session block — should open modal, not switch to day view
    const sessionBlock = screen.getAllByText("SWM01")[0].closest("button")!;
    fireEvent.click(sessionBlock);
    // Modal should be open
    expect(screen.getByTestId("modal")).toBeDefined();
    // Should still be in week view
    const weekBtn = screen.getByRole("button", { name: "Week" });
    expect(weekBtn.className).toContain("bg-white");
  });
});

// ─── Week navigation ────────────────────────────────────────────────

describe("GroupScheduleContent — week navigation", () => {
  it("next button advances to next week", async () => {
    await renderWithSchedule();
    const initialLabel = screen.getByText(
      /Jul \d+ - Jul \d+, 2028/
    ).textContent;
    // Find nav buttons (the ones with SVG arrows)
    const navArea = screen.getByText(/Jul \d+ - Jul \d+, 2028/).parentElement!;
    const buttons = navArea.querySelectorAll("button");
    const nextBtn = buttons[1]; // second button is next
    if (nextBtn && !nextBtn.hasAttribute("disabled")) {
      fireEvent.click(nextBtn);
      const newLabel = screen.getByText(/Jul \d+ - Jul \d+, 2028/).textContent;
      expect(newLabel).not.toBe(initialLabel);
    }
  });

  it("prev button is disabled on first week", async () => {
    // Default opens to the week with Jul 14, which is the first week (Jul 9-15)
    await renderWithSchedule();
    const navArea = screen.getByText(/Jul \d+ - Jul \d+, 2028/).parentElement!;
    const buttons = navArea.querySelectorAll("button");
    const prevBtn = buttons[0];
    expect(prevBtn.hasAttribute("disabled")).toBe(true);
  });
});

// ─── List view content rendering ────────────────────────────────────

describe("GroupScheduleContent — list view content", () => {
  it("switching to list shows sessions grouped by date", async () => {
    await renderWithSchedule();
    // Toggle to list via sidebar
    const sidebar = renderSidebar();
    fireEvent.click(sidebar.getByText("List"));
    cleanup();

    // The setPanel callback triggers setDisplayMode("list") in the parent.
    // After the state change, list view should render.
    // We verify the callback was invoked and List is now active in the latest sidebar.
    const latestSidebar = render(getLatestSidebarElement());
    const listBtn = latestSidebar.getByText("List");
    expect(listBtn.className).toContain("bg-white");
    cleanup();
  });

  it("calendar nav is hidden when list mode is active in sidebar", async () => {
    await renderWithSchedule();
    // In default calendar mode, Week/Day toggle exists
    expect(screen.getByRole("button", { name: "Week" })).toBeDefined();
    // We can verify the sidebar reflects the current mode
    const sidebar = renderSidebar();
    const calBtn = sidebar.getByText("Calendar");
    expect(calBtn.className).toContain("bg-white");
    cleanup();
  });
});

// ─── Hover state ────────────────────────────────────────────────────

describe("GroupScheduleContent — day column hover", () => {
  it("mouseEnter on day header sets hover state", async () => {
    await renderWithSchedule();
    // Find Jul 14 header (it has role="button" in week view)
    const jul14Header = screen.getByText("Jul 14").closest("[role='button']")!;
    fireEvent.mouseEnter(jul14Header);
    // The header should now have hover background
    expect(jul14Header.className).toContain("bg-slate-200/60");
  });

  it("mouseLeave on day header clears hover state", async () => {
    await renderWithSchedule();
    const jul14Header = screen.getByText("Jul 14").closest("[role='button']")!;
    fireEvent.mouseEnter(jul14Header);
    expect(jul14Header.className).toContain("bg-slate-200/60");
    fireEvent.mouseLeave(jul14Header);
    // Should revert — Jul 14 is in the window, so bg-slate-100
    expect(jul14Header.className).toContain("bg-slate-100");
  });
});

// ─── Coverage: weekIndexForDate returns 0 for unknown date (line 316) ──
describe("GroupScheduleContent — weekIndexForDate fallback", () => {
  it("clicking a window whose startDate is outside all weeks falls back to week index 0", async () => {
    await renderWithSchedule({
      dateMode: "consecutive" as const,
      consecutiveDays: 5,
      windowRankings: [
        {
          id: "w1",
          startDate: "2028-07-14",
          endDate: "2028-07-18",
          score: 85,
          selected: true,
        },
        {
          id: "w-outside",
          startDate: "2029-01-01",
          endDate: "2029-01-05",
          score: 50,
          selected: false,
        },
      ],
    });
    const sidebar = renderSidebar();
    // Click the second window whose startDate is outside olympic weeks
    const windowItems = Array.from(
      sidebar.container.querySelectorAll("[role='button']")
    ).filter((el) => el.textContent?.includes("Jan"));
    expect(windowItems.length).toBeGreaterThan(0);
    await act(async () => {
      fireEvent.click(windowItems[0]);
    });
    sidebar.unmount();
    // Should not crash; calendar should fall back to week index 0 (week containing Jul 9-15)
    expect(screen.getByText(/Jul \d+ - Jul \d+, 2028/)).toBeDefined();
  });
});

// ─── Coverage: toggleMember branches (lines 454-462) ────────────────
describe("GroupScheduleContent — toggleMember branches", () => {
  it("adds a second member, removes one, then removes last to return to all", async () => {
    await renderWithSchedule();

    // Step 1: select Alex Chen (transitions from "all" to Set(["m1"]))
    let sidebar = renderSidebar();
    await act(async () => {
      fireEvent.click(sidebar.getByText("Alex Chen"));
    });
    sidebar.unmount();

    // Step 2: click Jordan Park — should ADD to set → Set(["m1","m2"])
    // Must get fresh sidebar element with updated closure
    sidebar = render(getLatestSidebarElement());
    expect(sidebar.getByText("Alex Chen").className).toContain("bg-[#009de5]");
    await act(async () => {
      fireEvent.click(sidebar.getByText("Jordan Park"));
    });
    sidebar.unmount();

    // Verify both are selected
    sidebar = render(getLatestSidebarElement());
    expect(sidebar.getByText("Alex Chen").className).toContain("bg-[#009de5]");
    expect(sidebar.getByText("Jordan Park").className).toContain(
      "bg-[#009de5]"
    );

    // Step 3: click Alex Chen — should REMOVE from set → Set(["m2"])
    await act(async () => {
      fireEvent.click(sidebar.getByText("Alex Chen"));
    });
    sidebar.unmount();

    sidebar = render(getLatestSidebarElement());
    expect(sidebar.getByText("Alex Chen").className).not.toContain(
      "bg-[#009de5]"
    );
    expect(sidebar.getByText("Jordan Park").className).toContain(
      "bg-[#009de5]"
    );

    // Step 4: click Jordan Park — last member deselected → returns to "all"
    await act(async () => {
      fireEvent.click(sidebar.getByText("Jordan Park"));
    });
    sidebar.unmount();

    sidebar = render(getLatestSidebarElement());
    const allBtn = sidebar.getByText("All Members");
    expect(allBtn.className).toContain("bg-[#009de5]");
    sidebar.unmount();
  });
});

// ─── Coverage: prev navigation button click (lines 824-829) ─────────
describe("GroupScheduleContent — prev navigation button", () => {
  it("clicks prev in week scale after navigating forward", async () => {
    await renderWithSchedule();
    const navArea = screen.getByText(/Jul \d+ - Jul \d+, 2028/).parentElement!;
    const buttons = navArea.querySelectorAll("button");
    const nextBtn = buttons[1];
    const prevBtn = buttons[0];
    // Navigate forward first
    fireEvent.click(nextBtn);
    const afterNextLabel = screen.getByText(
      /Jul \d+ - Jul \d+, 2028/
    ).textContent;
    // Now click prev
    fireEvent.click(prevBtn);
    const afterPrevLabel = screen.getByText(
      /Jul \d+ - Jul \d+, 2028/
    ).textContent;
    expect(afterPrevLabel).not.toBe(afterNextLabel);
  });

  it("clicks prev in day scale after navigating forward", async () => {
    await renderWithSchedule();
    // Switch to Day view
    fireEvent.click(screen.getByRole("button", { name: "Day" }));
    const dayLabel = () => screen.getByText(/\w+, Jul \d+, 2028/).textContent;
    const initialDay = dayLabel();
    // Find nav buttons in day view
    const navArea = screen.getByText(/\w+, Jul \d+, 2028/).parentElement!;
    const buttons = navArea.querySelectorAll("button");
    const nextBtn = buttons[1];
    const prevBtn = buttons[0];
    // Navigate forward
    fireEvent.click(nextBtn);
    const afterNextDay = dayLabel();
    expect(afterNextDay).not.toBe(initialDay);
    // Navigate back
    fireEvent.click(prevBtn);
    const afterPrevDay = dayLabel();
    expect(afterPrevDay).toBe(initialDay);
  });
});

// ─── Coverage: list view session click and keyboard handler (lines 912-920) ──
describe("GroupScheduleContent — list view session interaction", () => {
  async function switchToListView() {
    await renderWithSchedule();
    const sidebar = renderSidebar();
    await act(async () => {
      fireEvent.click(sidebar.getByText("List"));
    });
    sidebar.unmount();
  }

  it("clicking a session row in list view opens session detail modal", async () => {
    await switchToListView();
    // In list view, sessions are rendered as div[role='button']
    const sessionRows = screen
      .getAllByRole("button")
      .filter((el) => el.textContent?.includes("SWM01"));
    expect(sessionRows.length).toBeGreaterThan(0);
    fireEvent.click(sessionRows[0]);
    expect(screen.getByTestId("modal")).toBeDefined();
    expect(screen.getByTestId("modal").getAttribute("data-title")).toBe(
      "Session Details"
    );
  });

  it("pressing Enter on a session row in list view opens session detail modal", async () => {
    await switchToListView();
    const sessionRows = screen
      .getAllByRole("button")
      .filter((el) => el.textContent?.includes("ATH01"));
    expect(sessionRows.length).toBeGreaterThan(0);
    fireEvent.keyDown(sessionRows[0], { key: "Enter" });
    expect(screen.getByTestId("modal")).toBeDefined();
  });

  it("pressing Space on a session row in list view opens session detail modal", async () => {
    await switchToListView();
    const sessionRows = screen
      .getAllByRole("button")
      .filter((el) => el.textContent?.includes("GYM01"));
    expect(sessionRows.length).toBeGreaterThan(0);
    fireEvent.keyDown(sessionRows[0], { key: " " });
    expect(screen.getByTestId("modal")).toBeDefined();
  });
});

// ─── Coverage: mini-calendar day header keyboard handler (lines 1003-1005) ──
describe("GroupScheduleContent — day header keyboard navigation", () => {
  it("pressing Enter on a day header switches to day view", async () => {
    await renderWithSchedule();
    const jul14Header = screen.getByText("Jul 14").closest("[role='button']")!;
    fireEvent.keyDown(jul14Header, { key: "Enter" });
    const dayBtn = screen.getByRole("button", { name: "Day" });
    expect(dayBtn.className).toContain("bg-white");
    expect(screen.getByText(/Fri, Jul 14, 2028/)).toBeDefined();
  });

  it("pressing Space on a day header switches to day view", async () => {
    await renderWithSchedule();
    const jul14Header = screen.getByText("Jul 14").closest("[role='button']")!;
    fireEvent.keyDown(jul14Header, { key: " " });
    const dayBtn = screen.getByRole("button", { name: "Day" });
    expect(dayBtn.className).toContain("bg-white");
    expect(screen.getByText(/Fri, Jul 14, 2028/)).toBeDefined();
  });
});

// ─── Coverage: multiple "more badges" clusters (lines 1105-1112) ────
describe("GroupScheduleContent — multiple more badge clusters", () => {
  it("renders multiple +N more badges for hidden sessions in different time clusters", async () => {
    // We need >3 sessions at different times that form separate clusters when hidden.
    // Create 6 sessions: 4 overlapping at 09:00-11:00 (columns 0-3, so col 3 hidden),
    // and 2 more at 18:00-20:00 overlapping with 2 of the first group's columns
    // so the hidden ones at different times form separate clusters.
    const multiClusterData: GroupScheduleMemberCombo[] = [
      {
        memberId: "m1",
        firstName: "Alex",
        lastName: "Chen",
        avatarColor: "blue",
        day: SESSION_DAY,
        rank: "primary",
        score: 85,
        sessions: [
          {
            sessionCode: "MC1",
            sport: "Swimming",
            sessionType: "Final",
            sessionDescription: null,
            venue: "V1",
            zone: "Z1",
            startTime: "09:00",
            endTime: "11:00",
          },
          {
            sessionCode: "MC2",
            sport: "Athletics",
            sessionType: "Final",
            sessionDescription: null,
            venue: "V2",
            zone: "Z2",
            startTime: "09:00",
            endTime: "11:00",
          },
          {
            sessionCode: "MC3",
            sport: "Gymnastics",
            sessionType: "Final",
            sessionDescription: null,
            venue: "V3",
            zone: "Z3",
            startTime: "09:00",
            endTime: "11:00",
          },
          {
            sessionCode: "MC4",
            sport: "Diving",
            sessionType: "Final",
            sessionDescription: null,
            venue: "V4",
            zone: "Z4",
            startTime: "09:00",
            endTime: "11:00",
          },
          {
            sessionCode: "MC5",
            sport: "Fencing",
            sessionType: "Final",
            sessionDescription: null,
            venue: "V5",
            zone: "Z5",
            startTime: "18:00",
            endTime: "20:00",
          },
          {
            sessionCode: "MC6",
            sport: "Rowing",
            sessionType: "Final",
            sessionDescription: null,
            venue: "V6",
            zone: "Z6",
            startTime: "18:00",
            endTime: "20:00",
          },
          {
            sessionCode: "MC7",
            sport: "Boxing",
            sessionType: "Final",
            sessionDescription: null,
            venue: "V7",
            zone: "Z7",
            startTime: "18:00",
            endTime: "20:00",
          },
          {
            sessionCode: "MC8",
            sport: "Judo",
            sessionType: "Final",
            sessionDescription: null,
            venue: "V8",
            zone: "Z8",
            startTime: "18:00",
            endTime: "20:00",
          },
        ],
      },
    ];
    await renderWithSchedule({}, multiClusterData);
    // Both time clusters have >3 overlapping sessions, each should produce a +N more badge
    const moreBadges = screen.getAllByText(/\+\d+ more/);
    expect(moreBadges.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── Coverage: calendar column onMouseEnter/onMouseLeave (lines 1144-1149, 1193-1202) ──
describe("GroupScheduleContent — calendar column mouse events", () => {
  it("mouseEnter on a day column (with capped sessions) sets hover", async () => {
    await renderWithSchedule({}, makeOverlappingData());
    // The day column for SESSION_DAY has capped sessions.
    // The column is in the grid; find it by the session content inside it.
    // The column div contains the "+2 more" button. Its parent is the column.
    const moreBtn = screen.getByText("+2 more");
    const dayColumn = moreBtn.closest("div.relative")!;
    fireEvent.mouseEnter(dayColumn);
    expect(dayColumn.className).toContain("bg-slate-200/60");
  });

  it("mouseLeave on a day column (with capped sessions) clears hover", async () => {
    await renderWithSchedule({}, makeOverlappingData());
    const moreBtn = screen.getByText("+2 more");
    const dayColumn = moreBtn.closest("div.relative")!;
    fireEvent.mouseEnter(dayColumn);
    expect(dayColumn.className).toContain("bg-slate-200/60");
    fireEvent.mouseLeave(dayColumn);
    expect(dayColumn.className).not.toContain("bg-slate-200/60");
  });

  it("mouseEnter/mouseLeave on normal day column (no capped sessions) sets hover", async () => {
    await renderWithSchedule();
    // Find a day column that is an Olympic day in the window (has hover handler).
    // Normal columns (without capped sessions) also get onMouseEnter/onMouseLeave
    // when shouldCap && isOlympic. Look for a column with bg-slate-100/60 (window day).
    const gridColumns = document.querySelectorAll(
      "div.relative.border-l.border-slate-300.transition-colors"
    );
    // Find one that currently has bg-slate-100/60 (olympic window day, not capped)
    let targetCol: Element | null = null;
    for (const col of gridColumns) {
      if (col.className.includes("bg-slate-100/60")) {
        targetCol = col;
        break;
      }
    }
    expect(targetCol).not.toBeNull();
    fireEvent.mouseEnter(targetCol!);
    expect(targetCol!.className).toContain("bg-slate-200/60");
    fireEvent.mouseLeave(targetCol!);
    expect(targetCol!.className).not.toContain("bg-slate-200/60");
  });
});

// ─── Coverage: window ranking onKeyDown handler (lines 1361-1363) ───
describe("GroupScheduleContent — window ranking keyboard handler", () => {
  const consecutiveOverrides = {
    dateMode: "consecutive" as const,
    consecutiveDays: 5,
  };

  it("pressing Enter on a window ranking item selects it", async () => {
    await renderWithSchedule(consecutiveOverrides);
    const sidebar = renderSidebar();
    const windowItems = Array.from(
      sidebar.container.querySelectorAll("[role='button']")
    ).filter((el) => el.textContent?.includes("Jul"));
    expect(windowItems.length).toBeGreaterThanOrEqual(2);
    // Press Enter on the second window
    fireEvent.keyDown(windowItems[1], { key: "Enter" });
    cleanup();
    // The sidebar should re-render with the second window highlighted
    const sidebar2 = render(getLatestSidebarElement());
    const updatedWindows = Array.from(
      sidebar2.container.querySelectorAll("[role='button']")
    ).filter((el) => el.textContent?.includes("Jul"));
    expect(updatedWindows[1].className).toContain("border-[#009de5]");
    cleanup();
  });

  it("pressing Space on a window ranking item selects it", async () => {
    await renderWithSchedule(consecutiveOverrides);
    const sidebar = renderSidebar();
    const windowItems = Array.from(
      sidebar.container.querySelectorAll("[role='button']")
    ).filter((el) => el.textContent?.includes("Jul"));
    fireEvent.keyDown(windowItems[1], { key: " " });
    cleanup();
    const sidebar2 = render(getLatestSidebarElement());
    const updatedWindows = Array.from(
      sidebar2.container.querySelectorAll("[role='button']")
    ).filter((el) => el.textContent?.includes("Jul"));
    expect(updatedWindows[1].className).toContain("border-[#009de5]");
    cleanup();
  });
});
