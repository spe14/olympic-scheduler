// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// Group context mock
let mockGroup: Record<string, unknown> = {};
vi.mock("@/app/(main)/groups/[groupId]/_components/group-context", () => ({
  useGroup: () => mockGroup,
}));

import NotificationsSection from "@/app/(main)/groups/[groupId]/_components/notifications-section";

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
        joinedAt: "2027-12-01T00:00:00Z",
        statusChangedAt: null,
      },
      {
        id: "member-2",
        firstName: "Bob",
        lastName: "Jones",
        role: "member",
        status: "preferences_set",
        joinedAt: "2027-12-01T00:00:00Z",
        statusChangedAt: null,
      },
    ],
    membersWithNoCombos: [],
    memberTimeslots: [],
    departedMembers: [],
    affectedBuddyMembers: {},
    ...overrides,
  };
}

describe("NotificationsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGroup = baseGroup();
  });

  // --- Section visibility ---

  it("renders nothing when there are no notifications", () => {
    const { container } = render(<NotificationsSection />);
    expect(container.innerHTML).toBe("");
  });

  it("renders Notifications heading when notifications exist", () => {
    mockGroup = baseGroup({
      phase: "preferences",
      scheduleGeneratedAt: "2028-01-01T00:00:00Z",
      membersWithNoCombos: ["member-2"],
    });
    render(<NotificationsSection />);
    expect(
      screen.getByRole("heading", { name: "Notifications" })
    ).toBeInTheDocument();
  });

  // --- No combos (RED) ---

  it("shows no-combos message with red styling", () => {
    mockGroup = baseGroup({
      phase: "preferences",
      scheduleGeneratedAt: "2028-01-01T00:00:00Z",
      membersWithNoCombos: ["member-2"],
    });
    render(<NotificationsSection />);
    expect(
      screen.getByText(/Some members received no sessions on their schedules/)
    ).toBeInTheDocument();
  });

  it("shows scheduleGeneratedAt timestamp for no-combos notification", () => {
    mockGroup = baseGroup({
      phase: "preferences",
      scheduleGeneratedAt: "2028-07-15T14:30:00Z",
      membersWithNoCombos: ["member-2"],
    });
    render(<NotificationsSection />);
    // Timestamp should be formatted from scheduleGeneratedAt
    expect(screen.getByText(/Jul 15, 2028/)).toBeInTheDocument();
  });

  it("does not show no-combos when list is empty", () => {
    mockGroup = baseGroup({
      phase: "preferences",
      scheduleGeneratedAt: "2028-01-01T00:00:00Z",
      membersWithNoCombos: [],
    });
    render(<NotificationsSection />);
    expect(
      screen.queryByText(/Some members received no sessions/)
    ).not.toBeInTheDocument();
  });

  // --- Departed members (RED if not rejoined) ---

  it("shows departed members message for owner", () => {
    mockGroup = baseGroup({
      phase: "preferences",
      departedMembers: [
        { name: "Charlie Brown", departedAt: "2028-01-10T12:00:00Z" },
      ],
    });
    render(<NotificationsSection />);
    expect(
      screen.getByText(/Charlie Brown recently left the group/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/You will need to regenerate schedules/)
    ).toBeInTheDocument();
  });

  it("shows departed message for non-owner with different suffix", () => {
    mockGroup = baseGroup({
      phase: "preferences",
      myRole: "member",
      departedMembers: [
        { name: "Charlie Brown", departedAt: "2028-01-10T12:00:00Z" },
      ],
    });
    render(<NotificationsSection />);
    expect(
      screen.getByText(/Wait for the group owner to regenerate schedules/)
    ).toBeInTheDocument();
  });

  it("shows departedAt timestamp for departed notification", () => {
    mockGroup = baseGroup({
      phase: "preferences",
      departedMembers: [
        { name: "Charlie Brown", departedAt: "2028-07-20T10:00:00Z" },
      ],
    });
    render(<NotificationsSection />);
    expect(screen.getByText(/Jul 20, 2028/)).toBeInTheDocument();
  });

  it("formats multiple departed members correctly", () => {
    mockGroup = baseGroup({
      phase: "preferences",
      departedMembers: [
        { name: "Charlie Brown", departedAt: "2028-01-10T12:00:00Z" },
        { name: "Diana Prince", departedAt: "2028-01-11T12:00:00Z" },
      ],
    });
    render(<NotificationsSection />);
    expect(
      screen.getByText(/Charlie Brown and Diana Prince recently left the group/)
    ).toBeInTheDocument();
  });

  it("does not show departed message when list is empty", () => {
    mockGroup = baseGroup({ departedMembers: [] });
    render(<NotificationsSection />);
    expect(
      screen.queryByText(/recently left the group/)
    ).not.toBeInTheDocument();
  });

  // --- Departed + Rejoined (BLUE merged message) ---

  it("shows merged blue message for departed+rejoined member", () => {
    mockGroup = baseGroup({
      phase: "preferences",
      departedMembers: [
        {
          name: "Charlie Brown",
          departedAt: "2028-01-10T12:00:00Z",
          rejoinedAt: "2028-01-12T14:00:00Z",
        },
      ],
    });
    render(<NotificationsSection />);
    expect(
      screen.getByText(/Charlie Brown left and rejoined the group/)
    ).toBeInTheDocument();
    // Should NOT show the departed-style message
    expect(
      screen.queryByText(/recently left the group/)
    ).not.toBeInTheDocument();
  });

  it("shows rejoinedAt timestamp for rejoined notification", () => {
    mockGroup = baseGroup({
      phase: "preferences",
      departedMembers: [
        {
          name: "Charlie Brown",
          departedAt: "2028-01-10T12:00:00Z",
          rejoinedAt: "2028-07-25T09:00:00Z",
        },
      ],
    });
    render(<NotificationsSection />);
    expect(screen.getByText(/Jul 25, 2028/)).toBeInTheDocument();
  });

  it("shows both departed and rejoined notifications when mixed", () => {
    mockGroup = baseGroup({
      phase: "preferences",
      departedMembers: [
        { name: "Charlie Brown", departedAt: "2028-01-10T12:00:00Z" },
        {
          name: "Diana Prince",
          departedAt: "2028-01-11T12:00:00Z",
          rejoinedAt: "2028-01-13T12:00:00Z",
        },
      ],
    });
    render(<NotificationsSection />);
    // Charlie: red departed
    expect(
      screen.getByText(/Charlie Brown recently left the group/)
    ).toBeInTheDocument();
    // Diana: blue rejoined
    expect(
      screen.getByText(/Diana Prince left and rejoined the group/)
    ).toBeInTheDocument();
  });

  it("rejoined member does NOT appear in newly joined notification", () => {
    mockGroup = baseGroup({
      phase: "preferences",
      scheduleGeneratedAt: "2028-01-01T00:00:00Z",
      departedMembers: [
        {
          name: "Bob Jones",
          departedAt: "2028-01-10T12:00:00Z",
          rejoinedAt: "2028-01-12T14:00:00Z",
        },
      ],
      members: [
        {
          id: "owner-1",
          firstName: "Alice",
          lastName: "Smith",
          role: "owner",
          status: "preferences_set",
          joinedAt: "2027-12-01T00:00:00Z",
          statusChangedAt: null,
        },
        {
          id: "member-2",
          firstName: "Bob",
          lastName: "Jones",
          role: "member",
          status: "joined",
          joinedAt: "2028-01-12T14:00:00Z",
          statusChangedAt: null,
        },
      ],
    });
    render(<NotificationsSection />);
    // Bob rejoined — should NOT appear in newly joined
    expect(
      screen.queryByText(/Bob Jones recently joined the group/)
    ).not.toBeInTheDocument();
    // Should appear in rejoined notification
    expect(
      screen.getByText(/Bob Jones left and rejoined the group/)
    ).toBeInTheDocument();
  });

  // --- Affected buddy members (RED) ---

  it("shows affected buddy message for owner — only others affected", () => {
    mockGroup = baseGroup({
      phase: "preferences",
      affectedBuddyMembers: { "member-2": ["Charlie Brown"] },
      departedMembers: [
        { name: "Charlie Brown", departedAt: "2028-01-10T12:00:00Z" },
      ],
    });
    render(<NotificationsSection />);
    expect(
      screen.getByText(
        /Charlie Brown was automatically removed from some members' required buddies list/
      )
    ).toBeInTheDocument();
  });

  it("shows owner-affected message when owner is affected alone", () => {
    mockGroup = baseGroup({
      phase: "preferences",
      affectedBuddyMembers: { "owner-1": ["Charlie Brown"] },
      departedMembers: [
        { name: "Charlie Brown", departedAt: "2028-01-10T12:00:00Z" },
      ],
    });
    render(<NotificationsSection />);
    expect(
      screen.getByText(
        /Charlie Brown was automatically removed from your required buddies list/
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Other members were also affected/)
    ).not.toBeInTheDocument();
  });

  it("owner + others affected shows combined message", () => {
    mockGroup = baseGroup({
      phase: "preferences",
      affectedBuddyMembers: {
        "owner-1": ["Charlie Brown"],
        "member-2": ["Charlie Brown"],
      },
      departedMembers: [
        { name: "Charlie Brown", departedAt: "2028-01-10T12:00:00Z" },
      ],
    });
    render(<NotificationsSection />);
    expect(
      screen.getByText(
        /Charlie Brown was automatically removed from your required buddies list/
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Other members were also affected/)
    ).toBeInTheDocument();
  });

  it("shows affected buddy message for non-owner affected member", () => {
    mockGroup = baseGroup({
      phase: "preferences",
      myRole: "member",
      myMemberId: "member-2",
      affectedBuddyMembers: { "member-2": ["Charlie Brown"] },
      departedMembers: [
        { name: "Charlie Brown", departedAt: "2028-01-10T12:00:00Z" },
      ],
    });
    render(<NotificationsSection />);
    expect(
      screen.getByText(
        /Charlie Brown was automatically removed from your required buddies list/
      )
    ).toBeInTheDocument();
  });

  it("does not show affected buddy message for non-owner unaffected member", () => {
    mockGroup = baseGroup({
      phase: "preferences",
      myRole: "member",
      myMemberId: "member-3",
      affectedBuddyMembers: { "member-2": ["Charlie Brown"] },
      departedMembers: [
        { name: "Charlie Brown", departedAt: "2028-01-10T12:00:00Z" },
      ],
    });
    render(<NotificationsSection />);
    expect(
      screen.queryByText(/automatically removed from/)
    ).not.toBeInTheDocument();
  });

  it("affected buddy notification uses departed member's timestamp", () => {
    mockGroup = baseGroup({
      phase: "preferences",
      affectedBuddyMembers: { "owner-1": ["Charlie Brown"] },
      departedMembers: [
        { name: "Charlie Brown", departedAt: "2028-07-18T16:00:00Z" },
      ],
    });
    render(<NotificationsSection />);
    // Both departed and affected buddy notifications share the same timestamp
    const timestamps = screen.getAllByText(/Jul 18, 2028/);
    expect(timestamps.length).toBeGreaterThanOrEqual(1);
  });

  // --- Newly joined (BLUE) ---

  it("shows newly joined message for owner", () => {
    mockGroup = baseGroup({
      phase: "preferences",
      scheduleGeneratedAt: "2028-01-01T00:00:00Z",
      members: [
        {
          id: "owner-1",
          firstName: "Alice",
          lastName: "Smith",
          role: "owner",
          status: "preferences_set",
          joinedAt: "2027-12-01T00:00:00Z",
          statusChangedAt: null,
        },
        {
          id: "member-2",
          firstName: "Bob",
          lastName: "Jones",
          role: "member",
          status: "joined",
          joinedAt: "2028-01-02T00:00:00Z",
          statusChangedAt: null,
        },
      ],
    });
    render(<NotificationsSection />);
    expect(
      screen.getByText(/Bob Jones recently joined the group/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Wait for them to enter their preferences/)
    ).toBeInTheDocument();
  });

  it("shows 'You' in newly joined message when current user is newly joined", () => {
    mockGroup = baseGroup({
      phase: "preferences",
      myRole: "member",
      myMemberId: "member-2",
      scheduleGeneratedAt: "2028-01-01T00:00:00Z",
      members: [
        {
          id: "owner-1",
          firstName: "Alice",
          lastName: "Smith",
          role: "owner",
          status: "preferences_set",
          joinedAt: "2027-12-01T00:00:00Z",
          statusChangedAt: null,
        },
        {
          id: "member-2",
          firstName: "Bob",
          lastName: "Jones",
          role: "member",
          status: "joined",
          joinedAt: "2028-01-02T00:00:00Z",
          statusChangedAt: null,
        },
      ],
    });
    render(<NotificationsSection />);
    expect(
      screen.getByText(/You recently joined the group/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Enter your preferences so the group owner can regenerate schedules/
      )
    ).toBeInTheDocument();
  });

  it("excludes affected buddy members from newly joined list", () => {
    mockGroup = baseGroup({
      phase: "preferences",
      scheduleGeneratedAt: "2028-01-01T00:00:00Z",
      affectedBuddyMembers: { "member-2": ["Charlie Brown"] },
      departedMembers: [
        { name: "Charlie Brown", departedAt: "2028-01-10T12:00:00Z" },
      ],
      members: [
        {
          id: "owner-1",
          firstName: "Alice",
          lastName: "Smith",
          role: "owner",
          status: "preferences_set",
          joinedAt: "2027-12-01T00:00:00Z",
          statusChangedAt: null,
        },
        {
          id: "member-2",
          firstName: "Bob",
          lastName: "Jones",
          role: "member",
          status: "joined",
          joinedAt: "2028-01-02T00:00:00Z",
          statusChangedAt: null,
        },
      ],
    });
    render(<NotificationsSection />);
    expect(
      screen.queryByText(/Bob Jones recently joined the group/)
    ).not.toBeInTheDocument();
  });

  it("does not show newly joined when no scheduleGeneratedAt", () => {
    mockGroup = baseGroup({
      phase: "preferences",
      scheduleGeneratedAt: null,
      members: [
        {
          id: "owner-1",
          firstName: "Alice",
          lastName: "Smith",
          role: "owner",
          status: "preferences_set",
          joinedAt: "2027-12-01T00:00:00Z",
          statusChangedAt: null,
        },
        {
          id: "member-2",
          firstName: "Bob",
          lastName: "Jones",
          role: "member",
          status: "joined",
          joinedAt: "2028-01-02T00:00:00Z",
          statusChangedAt: null,
        },
      ],
    });
    render(<NotificationsSection />);
    expect(
      screen.queryByText(/recently joined the group/)
    ).not.toBeInTheDocument();
  });

  it("newly joined notification uses most recent joinedAt", () => {
    mockGroup = baseGroup({
      phase: "preferences",
      scheduleGeneratedAt: "2028-01-01T00:00:00Z",
      members: [
        {
          id: "owner-1",
          firstName: "Alice",
          lastName: "Smith",
          role: "owner",
          status: "preferences_set",
          joinedAt: "2027-12-01T00:00:00Z",
          statusChangedAt: null,
        },
        {
          id: "member-2",
          firstName: "Bob",
          lastName: "Jones",
          role: "member",
          status: "joined",
          joinedAt: "2028-07-22T08:00:00Z",
          statusChangedAt: null,
        },
      ],
    });
    render(<NotificationsSection />);
    expect(screen.getByText(/Jul 22, 2028/)).toBeInTheDocument();
  });

  // --- Updated preferences (BLUE) ---

  it("shows updated preferences message with new text", () => {
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
          joinedAt: "2027-12-01T00:00:00Z",
          statusChangedAt: null,
        },
        {
          id: "member-2",
          firstName: "Bob",
          lastName: "Jones",
          role: "member",
          status: "preferences_set",
          joinedAt: "2027-12-01T00:00:00Z",
          statusChangedAt: "2028-01-05T10:00:00Z",
        },
      ],
    });
    render(<NotificationsSection />);
    expect(
      screen.getByText(
        /Bob Jones has updated their preferences\. These updates won't be reflected on your schedule until the owner regenerates schedules\./
      )
    ).toBeInTheDocument();
  });

  it("shows 'You' in updated message when owner updated preferences", () => {
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
          joinedAt: "2027-12-01T00:00:00Z",
          statusChangedAt: "2028-01-05T10:00:00Z",
        },
        {
          id: "member-2",
          firstName: "Bob",
          lastName: "Jones",
          role: "member",
          status: "preferences_set",
          joinedAt: "2027-12-01T00:00:00Z",
          statusChangedAt: null,
        },
      ],
    });
    render(<NotificationsSection />);
    expect(
      screen.getByText(/You have updated your preferences/)
    ).toBeInTheDocument();
  });

  it("shows combined 'You and X' when both owner and member updated", () => {
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
          joinedAt: "2027-12-01T00:00:00Z",
          statusChangedAt: "2028-01-05T10:00:00Z",
        },
        {
          id: "member-2",
          firstName: "Bob",
          lastName: "Jones",
          role: "member",
          status: "preferences_set",
          joinedAt: "2027-12-01T00:00:00Z",
          statusChangedAt: "2028-01-06T10:00:00Z",
        },
      ],
    });
    render(<NotificationsSection />);
    expect(
      screen.getByText(/You and Bob Jones have updated their preferences/)
    ).toBeInTheDocument();
  });

  it("does not show updated message in preferences phase without scheduleGeneratedAt", () => {
    mockGroup = baseGroup({
      phase: "preferences",
      scheduleGeneratedAt: null,
      members: [
        {
          id: "owner-1",
          firstName: "Alice",
          lastName: "Smith",
          role: "owner",
          status: "preferences_set",
          joinedAt: "2027-12-01T00:00:00Z",
          statusChangedAt: null,
        },
      ],
    });
    render(<NotificationsSection />);
    expect(screen.queryByText(/updated.*preferences/)).not.toBeInTheDocument();
  });

  it("excludes post-generation joiners from updated preferences message", () => {
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
          joinedAt: "2027-12-01T00:00:00Z",
          statusChangedAt: null,
        },
        {
          id: "member-2",
          firstName: "Bob",
          lastName: "Jones",
          role: "member",
          status: "preferences_set",
          joinedAt: "2028-01-02T00:00:00Z",
          statusChangedAt: "2028-01-03T00:00:00Z",
        },
      ],
    });
    render(<NotificationsSection />);
    expect(screen.queryByText(/updated.*preferences/)).not.toBeInTheDocument();
  });

  it("updated-preferences notification uses most recent statusChangedAt", () => {
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
          joinedAt: "2027-12-01T00:00:00Z",
          statusChangedAt: "2028-07-28T15:00:00Z",
        },
        {
          id: "member-2",
          firstName: "Bob",
          lastName: "Jones",
          role: "member",
          status: "preferences_set",
          joinedAt: "2027-12-01T00:00:00Z",
          statusChangedAt: null,
        },
      ],
    });
    render(<NotificationsSection />);
    expect(screen.getByText(/Jul 28, 2028/)).toBeInTheDocument();
  });

  // --- Color / variant tests ---

  it("renders no-combos with red/error styling", () => {
    mockGroup = baseGroup({
      phase: "preferences",
      scheduleGeneratedAt: "2028-01-01T00:00:00Z",
      membersWithNoCombos: ["member-2"],
    });
    const { container } = render(<NotificationsSection />);
    const notification = container.querySelector(".border-red-200");
    expect(notification).toBeInTheDocument();
  });

  it("renders departed (not rejoined) with red/error styling", () => {
    mockGroup = baseGroup({
      phase: "preferences",
      departedMembers: [
        { name: "Charlie Brown", departedAt: "2028-01-10T12:00:00Z" },
      ],
    });
    const { container } = render(<NotificationsSection />);
    const notification = container.querySelector(".border-red-200");
    expect(notification).toBeInTheDocument();
  });

  it("renders departed+rejoined with blue/info styling", () => {
    mockGroup = baseGroup({
      phase: "preferences",
      departedMembers: [
        {
          name: "Charlie Brown",
          departedAt: "2028-01-10T12:00:00Z",
          rejoinedAt: "2028-01-12T14:00:00Z",
        },
      ],
    });
    const { container } = render(<NotificationsSection />);
    // Should NOT have red border
    expect(container.querySelector(".border-red-200")).not.toBeInTheDocument();
    // Should have blue styling
    expect(
      container.querySelector(".text-\\[\\#009de5\\]")
    ).toBeInTheDocument();
  });

  it("renders newly joined with blue/info styling", () => {
    mockGroup = baseGroup({
      phase: "preferences",
      scheduleGeneratedAt: "2028-01-01T00:00:00Z",
      members: [
        {
          id: "owner-1",
          firstName: "Alice",
          lastName: "Smith",
          role: "owner",
          status: "preferences_set",
          joinedAt: "2027-12-01T00:00:00Z",
          statusChangedAt: null,
        },
        {
          id: "member-2",
          firstName: "Bob",
          lastName: "Jones",
          role: "member",
          status: "joined",
          joinedAt: "2028-01-02T00:00:00Z",
          statusChangedAt: null,
        },
      ],
    });
    const { container } = render(<NotificationsSection />);
    expect(container.querySelector(".border-red-200")).not.toBeInTheDocument();
  });

  // --- Message ordering ---

  it("renders notifications in correct order: no-combos, departed, affected, joined, updated", () => {
    mockGroup = baseGroup({
      phase: "preferences",
      scheduleGeneratedAt: "2028-01-01T00:00:00Z",
      membersWithNoCombos: ["member-2"],
      departedMembers: [
        { name: "Charlie Brown", departedAt: "2028-01-10T12:00:00Z" },
      ],
      affectedBuddyMembers: { "owner-1": ["Charlie Brown"] },
      members: [
        {
          id: "owner-1",
          firstName: "Alice",
          lastName: "Smith",
          role: "owner",
          status: "preferences_set",
          joinedAt: "2027-12-01T00:00:00Z",
          statusChangedAt: "2028-01-05T10:00:00Z",
        },
        {
          id: "member-2",
          firstName: "Bob",
          lastName: "Jones",
          role: "member",
          status: "joined",
          joinedAt: "2028-01-02T00:00:00Z",
          statusChangedAt: null,
        },
        {
          id: "member-3",
          firstName: "Dave",
          lastName: "Wilson",
          role: "member",
          status: "preferences_set",
          joinedAt: "2027-12-01T00:00:00Z",
          statusChangedAt: "2028-01-06T10:00:00Z",
        },
      ],
    });
    const { container } = render(<NotificationsSection />);

    const html = container.innerHTML;
    const noCombosPos = html.indexOf("no sessions on their schedules");
    const departedPos = html.indexOf("recently left the group");
    const affectedPos = html.indexOf(
      "automatically removed from your required buddies list"
    );
    const joinedPos = html.indexOf("recently joined the group");
    const updatedPos = html.indexOf("updated");

    expect(noCombosPos).toBeGreaterThan(-1);
    expect(departedPos).toBeGreaterThan(-1);
    expect(affectedPos).toBeGreaterThan(-1);
    expect(joinedPos).toBeGreaterThan(-1);
    expect(updatedPos).toBeGreaterThan(-1);

    expect(noCombosPos).toBeLessThan(departedPos);
    expect(departedPos).toBeLessThan(affectedPos);
    expect(affectedPos).toBeLessThan(joinedPos);
    expect(joinedPos).toBeLessThan(updatedPos);
  });

  // --- Purchase changes (AMBER) ---

  it("shows purchase changes notification for owner when purchase data changed after schedule generation", () => {
    mockGroup = baseGroup({
      phase: "schedule_review",
      scheduleGeneratedAt: "2028-01-01T00:00:00Z",
      purchaseDataChangedAt: "2028-01-05T10:00:00Z",
    });
    render(<NotificationsSection />);
    expect(
      screen.getByText(/purchase status and\/or availability updated/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/You may want to regenerate schedules/)
    ).toBeInTheDocument();
  });

  it("shows purchase changes notification for non-owner with different wording", () => {
    mockGroup = baseGroup({
      phase: "schedule_review",
      myRole: "member",
      scheduleGeneratedAt: "2028-01-01T00:00:00Z",
      purchaseDataChangedAt: "2028-01-05T10:00:00Z",
    });
    render(<NotificationsSection />);
    expect(
      screen.getByText(
        /won't be reflected on your schedule until the owner regenerates/
      )
    ).toBeInTheDocument();
  });

  it("does not show purchase changes when purchaseDataChangedAt is before scheduleGeneratedAt", () => {
    mockGroup = baseGroup({
      phase: "schedule_review",
      scheduleGeneratedAt: "2028-01-10T00:00:00Z",
      purchaseDataChangedAt: "2028-01-05T00:00:00Z",
    });
    render(<NotificationsSection />);
    expect(screen.queryByText(/purchase status/)).not.toBeInTheDocument();
  });

  // --- Newly joined: multiple members with different joinedAt ---

  it("uses most recent joinedAt across multiple newly joined members", () => {
    mockGroup = baseGroup({
      phase: "preferences",
      scheduleGeneratedAt: "2028-01-01T00:00:00Z",
      members: [
        {
          id: "owner-1",
          firstName: "Alice",
          lastName: "Smith",
          role: "owner",
          status: "preferences_set",
          joinedAt: "2027-12-01T00:00:00Z",
          statusChangedAt: null,
        },
        {
          id: "member-2",
          firstName: "Bob",
          lastName: "Jones",
          role: "member",
          status: "joined",
          joinedAt: "2028-07-20T08:00:00Z",
          statusChangedAt: null,
        },
        {
          id: "member-3",
          firstName: "Carol",
          lastName: "White",
          role: "member",
          status: "joined",
          joinedAt: "2028-07-25T10:00:00Z",
          statusChangedAt: null,
        },
      ],
    });
    render(<NotificationsSection />);
    // Should list both names
    expect(
      screen.getByText(/Bob Jones and Carol White recently joined/)
    ).toBeInTheDocument();
    // Timestamp should use the more recent joinedAt (Jul 25)
    expect(screen.getByText(/Jul 25, 2028/)).toBeInTheDocument();
  });

  it("handles newly joined member with null joinedAt gracefully", () => {
    mockGroup = baseGroup({
      phase: "preferences",
      scheduleGeneratedAt: "2028-01-01T00:00:00Z",
      members: [
        {
          id: "owner-1",
          firstName: "Alice",
          lastName: "Smith",
          role: "owner",
          status: "preferences_set",
          joinedAt: "2027-12-01T00:00:00Z",
          statusChangedAt: null,
        },
        {
          id: "member-2",
          firstName: "Bob",
          lastName: "Jones",
          role: "member",
          status: "joined",
          joinedAt: null,
          statusChangedAt: null,
        },
      ],
    });
    render(<NotificationsSection />);
    expect(
      screen.getByText(/Bob Jones recently joined the group/)
    ).toBeInTheDocument();
  });

  // --- Non-convergence (AMBER) ---

  it("shows non-convergence warning for affected member", () => {
    mockGroup = baseGroup({
      phase: "schedule_review",
      scheduleGeneratedAt: "2028-01-01T00:00:00Z",
      nonConvergenceMembers: ["owner-1"],
    });
    render(<NotificationsSection />);
    expect(
      screen.getByText(/not able to meet all of your requirements/)
    ).toBeInTheDocument();
  });

  it("does not show non-convergence warning for unaffected member", () => {
    mockGroup = baseGroup({
      phase: "schedule_review",
      scheduleGeneratedAt: "2028-01-01T00:00:00Z",
      nonConvergenceMembers: ["member-2"],
    });
    render(<NotificationsSection />);
    expect(
      screen.queryByText(/not able to meet all of your requirements/)
    ).not.toBeInTheDocument();
  });

  it("does not show non-convergence warning when list is empty", () => {
    mockGroup = baseGroup({
      phase: "schedule_review",
      scheduleGeneratedAt: "2028-01-01T00:00:00Z",
      nonConvergenceMembers: [],
    });
    render(<NotificationsSection />);
    expect(
      screen.queryByText(/not able to meet all of your requirements/)
    ).not.toBeInTheDocument();
  });

  it("shows non-convergence notification with amber styling", () => {
    mockGroup = baseGroup({
      phase: "schedule_review",
      scheduleGeneratedAt: "2028-01-01T00:00:00Z",
      nonConvergenceMembers: ["owner-1"],
    });
    const { container } = render(<NotificationsSection />);
    const amberNotifications = container.querySelectorAll(".border-amber-200");
    const texts = Array.from(amberNotifications).map((el) => el.textContent);
    expect(texts.some((t) => t?.includes("not able to meet all"))).toBe(true);
  });

  it("shows non-convergence timestamp from scheduleGeneratedAt", () => {
    mockGroup = baseGroup({
      phase: "schedule_review",
      scheduleGeneratedAt: "2028-07-15T14:30:00Z",
      nonConvergenceMembers: ["owner-1"],
    });
    render(<NotificationsSection />);
    expect(screen.getByText(/Jul 15, 2028/)).toBeInTheDocument();
  });

  it("does not show non-convergence warning when scheduleGeneratedAt is null", () => {
    mockGroup = baseGroup({
      nonConvergenceMembers: ["owner-1"],
      scheduleGeneratedAt: null,
    });
    render(<NotificationsSection />);
    expect(
      screen.queryByText(/not able to meet all of your requirements/)
    ).not.toBeInTheDocument();
  });
});
