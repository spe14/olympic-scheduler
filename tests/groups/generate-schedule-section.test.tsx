// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

// Mock actions
const mockGenerateSchedules = vi.fn();
vi.mock("@/app/(main)/groups/[groupId]/actions", () => ({
  generateSchedules: (...args: unknown[]) => mockGenerateSchedules(...args),
}));

// Group context mock
let mockGroup: Record<string, unknown> = {};
vi.mock("@/app/(main)/groups/[groupId]/_components/group-context", () => ({
  useGroup: () => mockGroup,
}));

import GenerateScheduleSection from "@/app/(main)/groups/[groupId]/_components/generate-schedule-section";

afterEach(cleanup);

function baseGroup(overrides: Record<string, unknown> = {}) {
  return {
    id: "group-1",
    phase: "preferences",
    myRole: "owner",
    myMemberId: "owner-1",
    myStatus: "preferences_set",
    scheduleGeneratedAt: null,
    members: [
      {
        id: "owner-1",
        firstName: "Alice",
        lastName: "Smith",
        role: "owner",
        status: "preferences_set",
      },
      {
        id: "member-2",
        firstName: "Bob",
        lastName: "Jones",
        role: "member",
        status: "preferences_set",
      },
    ],
    membersWithNoCombos: [],
    memberTimeslots: [],
    departedMembers: [],
    affectedBuddyMembers: {},
    ...overrides,
  };
}

describe("GenerateScheduleSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGroup = baseGroup();
  });

  // --- Visibility ---

  it("renders nothing when phase is not preferences or schedule_review", () => {
    mockGroup = baseGroup({ phase: "some_other_phase" });
    const { container } = render(<GenerateScheduleSection />);
    expect(container.innerHTML).toBe("");
  });

  it("renders in preferences phase", () => {
    render(<GenerateScheduleSection />);
    expect(
      screen.getByRole("heading", { name: "Generate Schedules" })
    ).toBeInTheDocument();
  });

  it("renders in schedule_review phase", () => {
    mockGroup = baseGroup({ phase: "schedule_review" });
    render(<GenerateScheduleSection />);
    expect(
      screen.getByRole("heading", { name: "Generate Schedules" })
    ).toBeInTheDocument();
  });

  // --- Ready count ---

  it("shows members ready count in preferences phase", () => {
    render(<GenerateScheduleSection />);
    expect(
      screen.getByText(/Members ready: 2\/2 have set preferences/)
    ).toBeInTheDocument();
  });

  it("shows partial ready count when not all members ready", () => {
    mockGroup = baseGroup({
      members: [
        {
          id: "owner-1",
          firstName: "Alice",
          lastName: "Smith",
          role: "owner",
          status: "preferences_set",
        },
        {
          id: "member-2",
          firstName: "Bob",
          lastName: "Jones",
          role: "member",
          status: "joined",
        },
      ],
    });
    render(<GenerateScheduleSection />);
    expect(
      screen.getByText(/Members ready: 1\/2 have set preferences/)
    ).toBeInTheDocument();
  });

  it("excludes affected buddy members from ready count", () => {
    mockGroup = baseGroup({
      phase: "preferences",
      affectedBuddyMembers: { "member-2": ["Charlie Brown"] },
      members: [
        {
          id: "owner-1",
          firstName: "Alice",
          lastName: "Smith",
          role: "owner",
          status: "preferences_set",
        },
        {
          id: "member-2",
          firstName: "Bob",
          lastName: "Jones",
          role: "member",
          status: "preferences_set",
        },
      ],
    });
    render(<GenerateScheduleSection />);
    expect(
      screen.getByText(/Members ready: 1\/2 have set preferences/)
    ).toBeInTheDocument();
  });

  it("does not show ready count in schedule_review phase", () => {
    mockGroup = baseGroup({
      phase: "schedule_review",
      scheduleGeneratedAt: "2028-01-01T00:00:00Z",
    });
    render(<GenerateScheduleSection />);
    expect(screen.queryByText(/Members ready/)).not.toBeInTheDocument();
  });

  it("shows ready count when phase is preferences with scheduleGeneratedAt (no-combo scenario)", () => {
    mockGroup = baseGroup({
      phase: "preferences",
      scheduleGeneratedAt: "2028-01-01T00:00:00Z",
      membersWithNoCombos: ["member-2"],
      members: [
        {
          id: "owner-1",
          firstName: "Alice",
          lastName: "Smith",
          role: "owner",
          status: "preferences_set",
        },
        {
          id: "member-2",
          firstName: "Bob",
          lastName: "Jones",
          role: "member",
          status: "joined",
        },
      ],
    });
    render(<GenerateScheduleSection />);
    expect(
      screen.getByText(/Members ready: 1\/2 have set preferences/)
    ).toBeInTheDocument();
  });

  // --- Button state ---

  it("enables button when owner and all members ready", () => {
    render(<GenerateScheduleSection />);
    const btn = screen.getByRole("button", { name: /Generate Schedules/ });
    expect(btn).not.toBeDisabled();
  });

  it("disables button when not all members ready", () => {
    mockGroup = baseGroup({
      members: [
        {
          id: "owner-1",
          firstName: "Alice",
          lastName: "Smith",
          role: "owner",
          status: "preferences_set",
        },
        {
          id: "member-2",
          firstName: "Bob",
          lastName: "Jones",
          role: "member",
          status: "joined",
        },
      ],
    });
    render(<GenerateScheduleSection />);
    const btn = screen.getByRole("button", { name: /Generate Schedules/ });
    expect(btn).toBeDisabled();
  });

  it("disables generate button when affected buddy members exist", () => {
    mockGroup = baseGroup({
      phase: "preferences",
      affectedBuddyMembers: { "member-2": ["Charlie Brown"] },
      members: [
        {
          id: "owner-1",
          firstName: "Alice",
          lastName: "Smith",
          role: "owner",
          status: "preferences_set",
        },
        {
          id: "member-2",
          firstName: "Bob",
          lastName: "Jones",
          role: "member",
          status: "preferences_set",
        },
      ],
    });
    render(<GenerateScheduleSection />);
    const btn = screen.getByRole("button", { name: /Generate Schedules/ });
    expect(btn).toBeDisabled();
  });

  it("disables button for non-owner", () => {
    mockGroup = baseGroup({ myRole: "member" });
    render(<GenerateScheduleSection />);
    const btn = screen.getByRole("button", { name: /Generate Schedules/ });
    expect(btn).toBeDisabled();
  });

  it("shows regenerate button text when scheduleGeneratedAt is set", () => {
    mockGroup = baseGroup({
      phase: "schedule_review",
      scheduleGeneratedAt: "2028-01-01T00:00:00Z",
    });
    render(<GenerateScheduleSection />);
    expect(
      screen.getByRole("button", { name: /Generate New Schedules/ })
    ).toBeInTheDocument();
  });

  it("disables regenerate button when nothing has changed since last generation", () => {
    mockGroup = baseGroup({
      phase: "schedule_review",
      scheduleGeneratedAt: "2028-01-01T00:00:00Z",
      members: [
        {
          id: "owner-1",
          firstName: "Alice",
          lastName: "Smith",
          role: "owner",
          status: "preferences_set",
          statusChangedAt: "2027-12-01T00:00:00Z",
        },
        {
          id: "member-2",
          firstName: "Bob",
          lastName: "Jones",
          role: "member",
          status: "preferences_set",
          statusChangedAt: "2027-12-01T00:00:00Z",
        },
      ],
    });
    render(<GenerateScheduleSection />);
    const btn = screen.getByRole("button", { name: /Generate New Schedules/ });
    expect(btn).toBeDisabled();
    expect(screen.getByText("Schedules are up to date.")).toBeInTheDocument();
  });

  it("enables regenerate button when a member has updated preferences", () => {
    mockGroup = baseGroup({
      phase: "schedule_review",
      scheduleGeneratedAt: "2028-01-01T00:00:00Z",
      members: [
        {
          id: "owner-1",
          firstName: "Alice",
          lastName: "Smith",
          role: "owner",
          status: "preferences_set",
          statusChangedAt: "2027-12-01T00:00:00Z",
        },
        {
          id: "member-2",
          firstName: "Bob",
          lastName: "Jones",
          role: "member",
          status: "preferences_set",
          statusChangedAt: "2028-01-05T00:00:00Z",
        },
      ],
    });
    render(<GenerateScheduleSection />);
    const btn = screen.getByRole("button", { name: /Generate New Schedules/ });
    expect(btn).not.toBeDisabled();
  });

  it("enables regenerate button when a member has departed", () => {
    mockGroup = baseGroup({
      phase: "preferences",
      scheduleGeneratedAt: "2028-01-01T00:00:00Z",
      departedMembers: [
        {
          userId: "user-charlie",
          name: "Charlie Brown",
          departedAt: "2028-01-02T00:00:00Z",
        },
      ],
    });
    render(<GenerateScheduleSection />);
    const btn = screen.getByRole("button", { name: /Generate New Schedules/ });
    expect(btn).not.toBeDisabled();
  });

  it("enables regenerate button when no-combo members exist", () => {
    mockGroup = baseGroup({
      phase: "preferences",
      scheduleGeneratedAt: "2028-01-01T00:00:00Z",
      membersWithNoCombos: ["member-2"],
      members: [
        {
          id: "owner-1",
          firstName: "Alice",
          lastName: "Smith",
          role: "owner",
          status: "preferences_set",
          statusChangedAt: "2028-01-05T00:00:00Z",
        },
        {
          id: "member-2",
          firstName: "Bob",
          lastName: "Jones",
          role: "member",
          status: "preferences_set",
          statusChangedAt: "2028-01-05T00:00:00Z",
        },
      ],
    });
    render(<GenerateScheduleSection />);
    const btn = screen.getByRole("button", { name: /Generate New Schedules/ });
    expect(btn).not.toBeDisabled();
  });

  it("enables regenerate button when purchase data has changed since last generation", () => {
    mockGroup = baseGroup({
      phase: "schedule_review",
      scheduleGeneratedAt: "2028-01-01T00:00:00Z",
      purchaseDataChangedAt: "2028-01-05T00:00:00Z",
      members: [
        {
          id: "owner-1",
          firstName: "Alice",
          lastName: "Smith",
          role: "owner",
          status: "preferences_set",
          statusChangedAt: "2027-12-01T00:00:00Z",
        },
        {
          id: "member-2",
          firstName: "Bob",
          lastName: "Jones",
          role: "member",
          status: "preferences_set",
          statusChangedAt: "2027-12-01T00:00:00Z",
        },
      ],
    });
    render(<GenerateScheduleSection />);
    const btn = screen.getByRole("button", { name: /Generate New Schedules/ });
    expect(btn).not.toBeDisabled();
  });

  it("disables regenerate when purchaseDataChangedAt is before scheduleGeneratedAt", () => {
    mockGroup = baseGroup({
      phase: "schedule_review",
      scheduleGeneratedAt: "2028-01-10T00:00:00Z",
      purchaseDataChangedAt: "2028-01-05T00:00:00Z",
      members: [
        {
          id: "owner-1",
          firstName: "Alice",
          lastName: "Smith",
          role: "owner",
          status: "preferences_set",
          statusChangedAt: "2027-12-01T00:00:00Z",
        },
        {
          id: "member-2",
          firstName: "Bob",
          lastName: "Jones",
          role: "member",
          status: "preferences_set",
          statusChangedAt: "2027-12-01T00:00:00Z",
        },
      ],
    });
    render(<GenerateScheduleSection />);
    const btn = screen.getByRole("button", { name: /Generate New Schedules/ });
    expect(btn).toBeDisabled();
  });

  // --- Tooltip messages ---

  it("shows owner tooltip when not owner", () => {
    mockGroup = baseGroup({ myRole: "member" });
    render(<GenerateScheduleSection />);
    expect(
      screen.getByText("Only the owner can generate schedules.")
    ).toBeInTheDocument();
  });

  it("shows preferences tooltip when owner but not all ready", () => {
    mockGroup = baseGroup({
      members: [
        {
          id: "owner-1",
          firstName: "Alice",
          lastName: "Smith",
          role: "owner",
          status: "preferences_set",
        },
        {
          id: "member-2",
          firstName: "Bob",
          lastName: "Jones",
          role: "member",
          status: "joined",
        },
      ],
    });
    render(<GenerateScheduleSection />);
    expect(
      screen.getByText("All members must set their preferences first.")
    ).toBeInTheDocument();
  });

  // --- No-combo ready count effects ---

  it("excludes no-combo members who haven't updated from ready count", () => {
    mockGroup = baseGroup({
      phase: "preferences",
      scheduleGeneratedAt: "2028-01-01T00:00:00Z",
      membersWithNoCombos: ["member-2"],
      members: [
        {
          id: "owner-1",
          firstName: "Alice",
          lastName: "Smith",
          role: "owner",
          status: "preferences_set",
        },
        {
          id: "member-2",
          firstName: "Bob",
          lastName: "Jones",
          role: "member",
          status: "preferences_set",
          statusChangedAt: null,
        },
      ],
    });
    render(<GenerateScheduleSection />);
    expect(
      screen.getByText(/Members ready: 1\/2 have set preferences/)
    ).toBeInTheDocument();
  });

  it("includes no-combo members who have updated in ready count", () => {
    mockGroup = baseGroup({
      phase: "preferences",
      scheduleGeneratedAt: "2028-01-01T00:00:00Z",
      membersWithNoCombos: ["member-2"],
      members: [
        {
          id: "owner-1",
          firstName: "Alice",
          lastName: "Smith",
          role: "owner",
          status: "preferences_set",
        },
        {
          id: "member-2",
          firstName: "Bob",
          lastName: "Jones",
          role: "member",
          status: "preferences_set",
          statusChangedAt: "2028-01-05T00:00:00Z",
        },
      ],
    });
    render(<GenerateScheduleSection />);
    expect(
      screen.getByText(/Members ready: 2\/2 have set preferences/)
    ).toBeInTheDocument();
  });

  // --- Schedule last updated timestamp ---

  it("shows schedule last updated date in schedule_review phase", () => {
    mockGroup = baseGroup({
      phase: "schedule_review",
      scheduleGeneratedAt: "2028-07-15T14:30:00Z",
    });
    render(<GenerateScheduleSection />);
    expect(screen.getByText(/Schedules Last Updated On/)).toBeInTheDocument();
  });

  it("does not show last updated in preferences phase", () => {
    mockGroup = baseGroup({ phase: "preferences" });
    render(<GenerateScheduleSection />);
    expect(
      screen.queryByText(/Schedules Last Updated On/)
    ).not.toBeInTheDocument();
  });

  // --- Modal interaction ---

  it("opens modal on button click", () => {
    render(<GenerateScheduleSection />);
    fireEvent.click(screen.getByRole("button", { name: /Generate Schedules/ }));
    // Modal should show confirmation text
    expect(
      screen.getByText("Are you ready to generate schedules?")
    ).toBeInTheDocument();
  });

  it("opens regenerate modal with regeneration-specific text", () => {
    mockGroup = baseGroup({
      phase: "schedule_review",
      scheduleGeneratedAt: "2028-01-01T00:00:00Z",
      members: [
        {
          id: "owner-1",
          firstName: "Alice",
          lastName: "Smith",
          role: "owner",
          status: "preferences_set",
          statusChangedAt: "2028-01-05T00:00:00Z",
        },
      ],
    });
    render(<GenerateScheduleSection />);
    fireEvent.click(
      screen.getByRole("button", { name: /Generate New Schedules/ })
    );
    // Modal should show regeneration-specific text
    expect(
      screen.getByText("Are you sure you want to regenerate schedules?")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/This will replace all existing schedules/)
    ).toBeInTheDocument();
    // Confirm button should also say "Generate New Schedules"
    const modalButtons = screen.getAllByRole("button", {
      name: "Generate New Schedules",
    });
    expect(modalButtons.length).toBeGreaterThanOrEqual(1);
  });

  // --- Modal confirm / close behavior ---

  it("closes modal on successful generation", async () => {
    mockGenerateSchedules.mockResolvedValue({ error: null });
    render(<GenerateScheduleSection />);

    // Open the modal
    fireEvent.click(screen.getByRole("button", { name: /Generate Schedules/ }));
    expect(
      screen.getByText("Are you ready to generate schedules?")
    ).toBeInTheDocument();

    // Both the section button and modal confirm share the same label;
    // the modal confirm button is the last one rendered.
    const genButtons = screen.getAllByRole("button", {
      name: "Generate Schedules",
    });
    fireEvent.click(genButtons[genButtons.length - 1]);

    // After success, modal should close
    await waitFor(() => {
      expect(
        screen.queryByText("Are you ready to generate schedules?")
      ).not.toBeInTheDocument();
    });
    expect(mockGenerateSchedules).toHaveBeenCalledWith("group-1");
  });

  it("shows error message in modal on failed generation", async () => {
    mockGenerateSchedules.mockResolvedValue({
      error: "Something went wrong",
    });
    render(<GenerateScheduleSection />);

    // Open the modal
    fireEvent.click(screen.getByRole("button", { name: /Generate Schedules/ }));

    // Click the modal confirm button (last of the duplicate-name buttons)
    const genButtons = screen.getAllByRole("button", {
      name: "Generate Schedules",
    });
    fireEvent.click(genButtons[genButtons.length - 1]);

    // Error message should appear; modal stays open
    await waitFor(() => {
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });
    expect(
      screen.getByText("Are you ready to generate schedules?")
    ).toBeInTheDocument();
  });

  it("closes modal on cancel and clears error on reopen", async () => {
    // First, trigger an error so the error state is populated
    mockGenerateSchedules.mockResolvedValue({
      error: "Something went wrong",
    });
    render(<GenerateScheduleSection />);

    // Open modal
    fireEvent.click(screen.getByRole("button", { name: /Generate Schedules/ }));
    expect(
      screen.getByText("Are you ready to generate schedules?")
    ).toBeInTheDocument();

    // Confirm to trigger the error (modal confirm is the last matching button)
    const genButtons = screen.getAllByRole("button", {
      name: "Generate Schedules",
    });
    fireEvent.click(genButtons[genButtons.length - 1]);
    await waitFor(() => {
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });

    // Close the modal via Cancel
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    // Modal should be gone
    await waitFor(() => {
      expect(
        screen.queryByText("Are you ready to generate schedules?")
      ).not.toBeInTheDocument();
    });

    // Reopen modal — error should be cleared
    fireEvent.click(screen.getByRole("button", { name: /Generate Schedules/ }));
    expect(
      screen.getByText("Are you ready to generate schedules?")
    ).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });

  // --- No message blocks remain ---

  it("does not render any notification messages (moved to NotificationsSection)", () => {
    mockGroup = baseGroup({
      phase: "preferences",
      scheduleGeneratedAt: "2028-01-01T00:00:00Z",
      membersWithNoCombos: ["member-2"],
      departedMembers: [
        {
          userId: "user-charlie",
          name: "Charlie Brown",
          departedAt: "2028-01-01T00:00:00Z",
        },
      ],
      affectedBuddyMembers: { "owner-1": ["Charlie Brown"] },
      members: [
        {
          id: "owner-1",
          firstName: "Alice",
          lastName: "Smith",
          role: "owner",
          status: "preferences_set",
        },
        {
          id: "member-2",
          firstName: "Bob",
          lastName: "Jones",
          role: "member",
          status: "joined",
        },
      ],
    });
    render(<GenerateScheduleSection />);
    // None of the old message blocks should render
    expect(
      screen.queryByText(/Some members received no sessions/)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/recently left the group/)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/automatically removed from/)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/recently joined the group/)
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/updated.*preferences/)).not.toBeInTheDocument();
  });
});
