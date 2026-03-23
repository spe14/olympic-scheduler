// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { GroupDetail } from "@/lib/types";

import {
  GroupProvider,
  GroupSyncProvider,
  useGroup,
} from "@/app/(main)/groups/[groupId]/_components/group-context";

afterEach(cleanup);

function makeGroup(overrides: Partial<GroupDetail> = {}): GroupDetail {
  return {
    id: "group-1",
    name: "Test Group",
    phase: "preferences",
    inviteCode: "ABC123",
    dateMode: null,
    consecutiveDays: null,
    startDate: null,
    endDate: null,
    scheduleGeneratedAt: null,
    purchaseDataChangedAt: null,
    myScheduleWarningAckedAt: null,
    createdAt: "2028-01-01T00:00:00Z",
    myRole: "owner",
    myStatus: "preferences_set",
    myMemberId: "owner-1",
    myTimeslot: null,
    members: [],
    membersWithNoCombos: [],
    memberTimeslots: [],
    membersPurchased: [],
    membersWithPurchaseData: [],
    departedMembers: [],
    affectedBuddyMembers: {},
    windowRankings: [],
    ...overrides,
  };
}

describe("useGroup", () => {
  it("returns group data when used inside GroupProvider", () => {
    const group = makeGroup({ name: "My Group" });
    function Consumer() {
      const g = useGroup();
      return <div data-testid="name">{g.name}</div>;
    }
    render(
      <GroupProvider group={group}>
        <Consumer />
      </GroupProvider>
    );
    expect(screen.getByTestId("name")).toHaveTextContent("My Group");
  });

  it("throws when used outside GroupProvider", () => {
    function BadConsumer() {
      useGroup();
      return <div />;
    }
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<BadConsumer />)).toThrow(
      "useGroup must be used within a GroupProvider"
    );
    spy.mockRestore();
  });
});

describe("GroupSyncProvider", () => {
  it("calls onSync callback when GroupProvider renders inside it", () => {
    const onSync = vi.fn();
    const group = makeGroup();

    render(
      <GroupSyncProvider onSync={onSync}>
        <GroupProvider group={group}>
          <div>child</div>
        </GroupProvider>
      </GroupSyncProvider>
    );

    expect(onSync).toHaveBeenCalledWith(group);
  });

  it("calls onSync again when group prop changes", () => {
    const onSync = vi.fn();
    const group1 = makeGroup({ name: "First" });
    const group2 = makeGroup({ name: "Second" });

    const { rerender } = render(
      <GroupSyncProvider onSync={onSync}>
        <GroupProvider group={group1}>
          <div>child</div>
        </GroupProvider>
      </GroupSyncProvider>
    );

    expect(onSync).toHaveBeenCalledWith(group1);

    rerender(
      <GroupSyncProvider onSync={onSync}>
        <GroupProvider group={group2}>
          <div>child</div>
        </GroupProvider>
      </GroupSyncProvider>
    );

    expect(onSync).toHaveBeenCalledWith(group2);
  });
});
