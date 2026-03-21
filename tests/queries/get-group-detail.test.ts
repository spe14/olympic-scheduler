import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock react cache as identity function
vi.mock("react", () => ({
  cache: (fn: Function) => fn,
}));

// Chainable DB mock infrastructure
// Each db.select().from().where() / .limit() / .innerJoin().where() / .orderBy() chain
// is driven by `queryResults`: each awaited chain shifts the next result off the front.
let queryResults: unknown[][] = [];

const makeChain = () => {
  let result: unknown[] | undefined;
  const chain: Record<string, any> = {};

  const settle = () => {
    if (result === undefined) {
      result = queryResults.shift() ?? [];
    }
  };

  chain.where = vi.fn(() => chain);
  chain.limit = vi.fn(() => {
    settle();
    return result!;
  });
  chain.orderBy = vi.fn(() => {
    settle();
    return result!;
  });
  chain.innerJoin = vi.fn(() => chain);

  // Make the chain thenable so `await db.select().from().where()` works
  chain.then = (
    resolve: (v: unknown) => void,
    _reject?: (e: unknown) => void
  ) => {
    settle();
    resolve(result!);
  };

  return chain;
};

const mockSelect = vi.fn(() => ({
  from: vi.fn(() => makeChain()),
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  group: {
    id: "id",
    name: "name",
    phase: "phase",
    inviteCode: "invite_code",
    dateMode: "date_mode",
    consecutiveDays: "consecutive_days",
    startDate: "start_date",
    endDate: "end_date",
    scheduleGeneratedAt: "schedule_generated_at",
    departedMembers: "departed_members",
    affectedBuddyMembers: "affected_buddy_members",
    membersWithNoCombos: "members_with_no_combos",
    createdAt: "created_at",
  },
  member: {
    id: "id",
    userId: "user_id",
    groupId: "group_id",
    role: "role",
    status: "status",
    scheduleWarningAckedAt: "schedule_warning_acked_at",
    joinedAt: "joined_at",
    statusChangedAt: "status_changed_at",
    createdAt: "created_at",
  },
  user: {
    id: "id",
    firstName: "first_name",
    lastName: "last_name",
    username: "username",
    avatarColor: "avatar_color",
  },
  windowRanking: {
    id: "id",
    groupId: "group_id",
    startDate: "start_date",
    endDate: "end_date",
    score: "score",
    selected: "selected",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  notInArray: vi.fn(),
  desc: vi.fn(),
}));

// Import the function under test AFTER mocks are set up
import { getGroupDetail } from "@/lib/queries/get-group-detail";

// --------------- helpers ---------------

const GROUP_ID = "g1";
const USER_ID = "u1";

const baseMembership = {
  id: "m1",
  role: "owner",
  status: "active",
  scheduleWarningAckedAt: null,
};

const baseGroup = {
  id: GROUP_ID,
  name: "Test Group",
  phase: "preferences",
  inviteCode: "ABC123",
  dateMode: "consecutive" as const,
  consecutiveDays: 3,
  startDate: "2028-07-20",
  endDate: "2028-08-10",
  scheduleGeneratedAt: null,
  departedMembers: [],
  affectedBuddyMembers: {},
  membersWithNoCombos: [],
  createdAt: new Date("2028-01-01"),
};

const baseWindowRanking = {
  id: "wr1",
  startDate: "2028-07-20",
  endDate: "2028-07-22",
  score: 95,
  selected: true,
};

const baseMember = {
  id: "m1",
  userId: "u1",
  firstName: "Alice",
  lastName: "Smith",
  username: "asmith",
  avatarColor: "blue",
  role: "owner",
  status: "active",
  joinedAt: new Date("2028-01-01"),
  statusChangedAt: null,
  createdAt: new Date("2028-01-01"),
};

// --------------- tests ---------------

describe("getGroupDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryResults = [];
  });

  it("returns null when user is not a member", async () => {
    // First query (membership lookup) returns empty
    queryResults = [[]];

    const result = await getGroupDetail(GROUP_ID, USER_ID);
    expect(result).toBeNull();
  });

  it("returns null when member status is denied", async () => {
    // Membership query returns denied status
    queryResults = [[{ ...baseMembership, status: "denied" }]];

    const result = await getGroupDetail(GROUP_ID, USER_ID);
    expect(result).toBeNull();
  });

  it("returns null when group not found", async () => {
    // Membership found, but group query returns empty
    queryResults = [
      [baseMembership], // membership
      [], // group data — not found
    ];

    const result = await getGroupDetail(GROUP_ID, USER_ID);
    expect(result).toBeNull();
  });

  it("returns full group detail", async () => {
    queryResults = [
      [baseMembership], // membership
      [baseGroup], // group data
      [baseWindowRanking], // window rankings
      [baseMember], // members
    ];

    const result = await getGroupDetail(GROUP_ID, USER_ID);

    expect(result).not.toBeNull();
    expect(result!.id).toBe(GROUP_ID);
    expect(result!.name).toBe("Test Group");
    expect(result!.phase).toBe("preferences");
    expect(result!.myRole).toBe("owner");
    expect(result!.myStatus).toBe("active");
    expect(result!.myMemberId).toBe("m1");
    expect(result!.myScheduleWarningAckedAt).toBeNull();
    expect(result!.windowRankings).toEqual([baseWindowRanking]);
    expect(result!.members).toEqual([baseMember]);
    expect(result!.departedMembers).toEqual([]);
    expect(result!.affectedBuddyMembers).toEqual({});
    expect(result!.membersWithNoCombos).toEqual([]);
  });

  it("transforms legacy string departedMembers to object format", async () => {
    queryResults = [
      [baseMembership],
      [{ ...baseGroup, departedMembers: ["Alice", "Bob"] }],
      [], // window rankings
      [], // members
    ];

    const result = await getGroupDetail(GROUP_ID, USER_ID);

    expect(result).not.toBeNull();
    expect(result!.departedMembers).toHaveLength(2);
    expect(result!.departedMembers[0].name).toBe("Alice");
    expect(result!.departedMembers[0].departedAt).toBeDefined();
    // Should be a valid ISO string
    expect(() => new Date(result!.departedMembers[0].departedAt)).not.toThrow();
    expect(result!.departedMembers[1].name).toBe("Bob");
  });

  it("transforms object departedMembers correctly", async () => {
    const departed = [
      { name: "Bob", departedAt: "2028-01-01" },
      { name: "Carol", departedAt: "2028-02-15", rejoinedAt: "2028-03-01" },
    ];
    queryResults = [
      [baseMembership],
      [{ ...baseGroup, departedMembers: departed }],
      [], // window rankings
      [], // members
    ];

    const result = await getGroupDetail(GROUP_ID, USER_ID);

    expect(result).not.toBeNull();
    expect(result!.departedMembers).toEqual(departed);
  });

  it("returns empty object for invalid affectedBuddyMembers", async () => {
    // When affectedBuddyMembers is an array (invalid — should be object)
    queryResults = [
      [baseMembership],
      [{ ...baseGroup, affectedBuddyMembers: ["invalid"] }],
      [],
      [],
    ];
    const result1 = await getGroupDetail(GROUP_ID, USER_ID);
    expect(result1!.affectedBuddyMembers).toEqual({});

    // When affectedBuddyMembers is null
    queryResults = [
      [baseMembership],
      [{ ...baseGroup, affectedBuddyMembers: null }],
      [],
      [],
    ];
    const result2 = await getGroupDetail(GROUP_ID, USER_ID);
    expect(result2!.affectedBuddyMembers).toEqual({});
  });

  it("returns empty array for invalid membersWithNoCombos", async () => {
    // When membersWithNoCombos is null
    queryResults = [
      [baseMembership],
      [{ ...baseGroup, membersWithNoCombos: null }],
      [],
      [],
    ];
    const result1 = await getGroupDetail(GROUP_ID, USER_ID);
    expect(result1!.membersWithNoCombos).toEqual([]);

    // When membersWithNoCombos is a string (not an array)
    queryResults = [
      [baseMembership],
      [{ ...baseGroup, membersWithNoCombos: "not-an-array" }],
      [],
      [],
    ];
    const result2 = await getGroupDetail(GROUP_ID, USER_ID);
    expect(result2!.membersWithNoCombos).toEqual([]);
  });
});
