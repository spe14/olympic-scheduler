import { describe, it, expect, vi, beforeEach } from "vitest";
import { getGroupSchedule } from "@/app/(main)/groups/[groupId]/group-schedule/actions";
import { createPurchaseDataMock } from "@/tests/helpers";

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock auth
const mockGetMembership = vi.fn();
vi.mock("@/lib/auth", () => ({
  getMembership: (...args: unknown[]) => mockGetMembership(...args),
  requireMembership: async (groupId: string) => {
    const membership = await mockGetMembership(groupId);
    if (!membership)
      return {
        membership: null,
        error: { error: "You are not an active member of this group." },
      };
    return { membership, error: null };
  },
}));

// Mock DB
const mockLimit = vi.fn();
let directWhereResults: unknown[][] = [];
const mockOrderBy = vi.fn(() => ({
  then(resolve: (v: unknown) => void) {
    resolve(directWhereResults.shift() ?? []);
  },
}));
const mockWhere: ReturnType<typeof vi.fn> = vi.fn(() => ({
  limit: mockLimit,
  orderBy: mockOrderBy,
  then(resolve: (v: unknown) => void) {
    resolve(directWhereResults.shift() ?? []);
  },
}));
const mockFrom = vi.fn(() => ({
  where: mockWhere,
  innerJoin: vi.fn(() => ({ where: mockWhere })),
}));
const mockSelect = vi.fn(() => ({ from: mockFrom }));

vi.mock("@/lib/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
  },
}));

// Mock purchase actions
const mockGetPurchaseDataForSessions = createPurchaseDataMock();
vi.mock("@/app/(main)/groups/[groupId]/schedule/purchase-actions", () => ({
  getPurchaseDataForSessions: (...args: unknown[]) =>
    mockGetPurchaseDataForSessions(...args),
}));

vi.mock("@/lib/db/schema", () => ({
  combo: {
    id: "id",
    groupId: "group_id",
    memberId: "member_id",
    day: "day",
    rank: "rank",
    score: "score",
  },
  comboSession: {
    comboId: "combo_id",
    sessionId: "session_id",
  },
  member: {
    id: "id",
    userId: "user_id",
    groupId: "group_id",
    role: "role",
    status: "status",
  },
  session: {
    sessionCode: "session_code",
    sport: "sport",
    sessionType: "session_type",
    sessionDescription: "session_description",
    venue: "venue",
    zone: "zone",
    startTime: "start_time",
    endTime: "end_time",
  },
  user: {
    id: "id",
    firstName: "first_name",
    lastName: "last_name",
    avatarColor: "avatar_color",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  inArray: vi.fn(),
  notInArray: vi.fn(),
}));

describe("getGroupSchedule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLimit.mockReset();
    directWhereResults = [];
  });

  it("returns error when not a member", async () => {
    mockGetMembership.mockResolvedValue(null);

    const result = await getGroupSchedule("group-1");

    expect(result.error).toBe("You are not an active member of this group.");
    expect(result.data).toBeUndefined();
  });

  it("returns empty data when no active members", async () => {
    mockGetMembership.mockResolvedValue({ id: "m-1", role: "member" });
    // First query: activeMembers — returns empty
    directWhereResults = [[]];

    const result = await getGroupSchedule("group-1");

    expect(result.data).toEqual([]);
    expect(result.error).toBeUndefined();
  });

  it("returns empty data when no combos exist", async () => {
    mockGetMembership.mockResolvedValue({ id: "m-1", role: "member" });
    // First query: activeMembers
    directWhereResults = [
      [{ memberId: "m-1", firstName: "m-1", status: "active" }],
      // Second query (orderBy path): allCombos — empty
      [],
    ];

    const result = await getGroupSchedule("group-1");

    expect(result.data).toEqual([]);
    expect(result.error).toBeUndefined();
  });

  it("returns full schedule data for group members", async () => {
    mockGetMembership.mockResolvedValue({ id: "m-1", role: "member" });

    directWhereResults = [
      // activeMembers
      [
        { memberId: "m-1", firstName: "m-1", status: "active" },
        { memberId: "m-2", firstName: "m-2", status: "active" },
      ],
      // allCombos (via orderBy)
      [
        {
          comboId: "c-1",
          memberId: "m-1",
          day: "2026-07-26",
          rank: "primary",
          score: 90,
        },
        {
          comboId: "c-2",
          memberId: "m-2",
          day: "2026-07-27",
          rank: "backup1",
          score: 80,
        },
      ],
      // allComboSessions (via innerJoin -> where)
      [
        {
          comboId: "c-1",
          sessionCode: "S001",
          sport: "Swimming",
          sessionType: "Final",
          sessionDescription: "100m Freestyle",
          venue: "Aquatic Centre",
          zone: "A",
          startTime: "2026-07-26T14:00:00",
          endTime: "2026-07-26T16:00:00",
        },
        {
          comboId: "c-1",
          sessionCode: "S002",
          sport: "Athletics",
          sessionType: "Heat",
          sessionDescription: "200m Sprint",
          venue: "Olympic Stadium",
          zone: "B",
          startTime: "2026-07-26T10:00:00",
          endTime: "2026-07-26T12:00:00",
        },
        {
          comboId: "c-2",
          sessionCode: "S003",
          sport: "Basketball",
          sessionType: "Quarter",
          sessionDescription: null,
          venue: "Arena",
          zone: "C",
          startTime: "2026-07-27T09:00:00",
          endTime: "2026-07-27T11:00:00",
        },
      ],
      // memberDetails (via innerJoin -> where)
      [
        {
          id: "m-1",
          firstName: "Alice",
          lastName: "Smith",
          avatarColor: "blue",
        },
        {
          id: "m-2",
          firstName: "Bob",
          lastName: "Jones",
          avatarColor: "green",
        },
      ],
    ];

    const result = await getGroupSchedule("group-1");

    expect(result.error).toBeUndefined();
    expect(result.data).toHaveLength(2);

    // First combo — member m-1
    const first = result.data![0];
    expect(first.memberId).toBe("m-1");
    expect(first.firstName).toBe("Alice");
    expect(first.lastName).toBe("Smith");
    expect(first.avatarColor).toBe("blue");
    expect(first.day).toBe("2026-07-26");
    expect(first.rank).toBe("primary");
    expect(first.score).toBe(90);
    // Sessions should be sorted by startTime — S002 (10:00) before S001 (14:00)
    expect(first.sessions).toHaveLength(2);
    expect(first.sessions[0].sessionCode).toBe("S002");
    expect(first.sessions[1].sessionCode).toBe("S001");

    // Second combo — member m-2
    const second = result.data![1];
    expect(second.memberId).toBe("m-2");
    expect(second.firstName).toBe("Bob");
    expect(second.lastName).toBe("Jones");
    expect(second.avatarColor).toBe("green");
    expect(second.sessions).toHaveLength(1);
    expect(second.sessions[0].sessionCode).toBe("S003");
  });

  it("returns generic error when DB query throws", async () => {
    mockGetMembership.mockResolvedValue({ id: "m-1", role: "member" });
    mockFrom.mockImplementationOnce(() => {
      throw new Error("connection reset");
    });

    const result = await getGroupSchedule("group-1");

    expect(result.error).toBe(
      "Failed to load group schedule. Please try again."
    );
    expect(result.data).toBeUndefined();
  });

  it("handles member without user details gracefully", async () => {
    mockGetMembership.mockResolvedValue({ id: "m-1", role: "member" });

    directWhereResults = [
      // activeMembers
      [{ memberId: "m-1", firstName: "m-1", status: "active" }],
      // allCombos (via orderBy)
      [
        {
          comboId: "c-1",
          memberId: "m-1",
          day: "2026-07-26",
          rank: "primary",
          score: 85,
        },
      ],
      // allComboSessions
      [
        {
          comboId: "c-1",
          sessionCode: "S001",
          sport: "Swimming",
          sessionType: "Final",
          sessionDescription: null,
          venue: "Aquatic Centre",
          zone: "A",
          startTime: "2026-07-26T10:00:00",
          endTime: "2026-07-26T12:00:00",
        },
      ],
      // memberDetails — empty (no match for m-1)
      [],
    ];

    const result = await getGroupSchedule("group-1");

    expect(result.error).toBeUndefined();
    expect(result.data).toHaveLength(1);
    expect(result.data![0].firstName).toBe("Unknown");
    expect(result.data![0].lastName).toBe("");
    expect(result.data![0].avatarColor).toBe("blue");
  });
});
