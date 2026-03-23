import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/groups/[groupId]/route";

const mockGetCurrentUser = vi.fn();
vi.mock("@/lib/auth", () => ({
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
}));

const mockLimit = vi.fn();
const mockOrderBy = vi.fn();
// Queue for direct-await queries (e.g. group data without .limit())
let directWhereResults: unknown[][] = [];
const mockWhere = vi.fn(() => ({
  limit: mockLimit,
  orderBy: mockOrderBy,
  then(resolve: (v: unknown) => void) {
    resolve(directWhereResults.shift() ?? []);
  },
}));
const mockInnerJoin = vi.fn(() => ({ where: mockWhere }));
const mockFrom = vi.fn(() => ({
  where: mockWhere,
  innerJoin: mockInnerJoin,
}));
const mockSelect = vi.fn(() => ({ from: mockFrom }));

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
    createdAt: "created_at",
  },
  member: {
    id: "id",
    userId: "user_id",
    groupId: "group_id",
    role: "role",
    status: "status",
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
  desc: vi.fn(),
}));

const mockUser = { id: "user-1" };
const mockParams = Promise.resolve({ groupId: "group-1" });

function callGET() {
  return GET(new Request("http://localhost/api/groups/group-1"), {
    params: mockParams,
  });
}

const sampleGroup = {
  id: "group-1",
  name: "Test Group",
  phase: "preferences",
  inviteCode: "abc123",
  dateMode: null,
  consecutiveDays: null,
  startDate: null,
  endDate: null,
  createdAt: "2028-01-01",
};

const sampleMembers = [
  {
    id: "member-1",
    userId: "user-1",
    firstName: "John",
    lastName: "Doe",
    username: "johndoe",
    avatarColor: "blue",
    role: "owner",
    status: "joined",
    createdAt: "2028-01-01",
  },
];

describe("GET /api/groups/[groupId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLimit.mockReset();
    mockOrderBy.mockReset();
    directWhereResults = [];
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const response = await callGET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 404 when user is not a member of the group", async () => {
    mockGetCurrentUser.mockResolvedValue(mockUser);
    mockLimit.mockResolvedValueOnce([]); // no membership

    const response = await callGET();
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Not found");
  });

  it("returns 404 when group does not exist", async () => {
    mockGetCurrentUser.mockResolvedValue(mockUser);
    mockLimit.mockResolvedValueOnce([
      { id: "member-1", role: "owner", status: "joined" },
    ]);
    // Group data query — resolves via thenable to [undefined]
    directWhereResults.push([undefined]);

    const response = await callGET();
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Not found");
  });

  it("returns group data with members for valid request", async () => {
    mockGetCurrentUser.mockResolvedValue(mockUser);
    mockLimit.mockResolvedValueOnce([
      { id: "member-1", role: "owner", status: "joined" },
    ]);
    directWhereResults.push([sampleGroup]);
    // First orderBy call is for windowRankings, second is for members
    mockOrderBy.mockResolvedValueOnce([]);
    mockOrderBy.mockResolvedValueOnce(sampleMembers);

    const response = await callGET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.name).toBe("Test Group");
    expect(body.myRole).toBe("owner");
    expect(body.myStatus).toBe("joined");
    expect(body.myMemberId).toBe("member-1");
    expect(body.members).toEqual(sampleMembers);
    expect(body.windowRankings).toEqual([]);
  });

  it("returns correct myRole and myStatus for non-owner member", async () => {
    mockGetCurrentUser.mockResolvedValue(mockUser);
    mockLimit.mockResolvedValueOnce([
      { id: "member-2", role: "member", status: "preferences_set" },
    ]);
    directWhereResults.push([sampleGroup]);
    // First orderBy call is for windowRankings, second is for members
    mockOrderBy.mockResolvedValueOnce([]);
    mockOrderBy.mockResolvedValueOnce([]);

    const response = await callGET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.myRole).toBe("member");
    expect(body.myStatus).toBe("preferences_set");
    expect(body.myMemberId).toBe("member-2");
  });

  it("transforms legacy string departedMembers to object format", async () => {
    mockGetCurrentUser.mockResolvedValue(mockUser);
    mockLimit.mockResolvedValueOnce([
      { id: "member-1", role: "owner", status: "joined" },
    ]);
    directWhereResults.push([
      { ...sampleGroup, departedMembers: ["Alice", "Bob"] },
    ]);
    mockOrderBy.mockResolvedValueOnce([]);
    mockOrderBy.mockResolvedValueOnce(sampleMembers);

    const response = await callGET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.departedMembers).toHaveLength(2);
    expect(body.departedMembers[0]).toEqual(
      expect.objectContaining({ name: "Alice" })
    );
    expect(body.departedMembers[0].departedAt).toBeDefined();
    expect(body.departedMembers[1]).toEqual(
      expect.objectContaining({ name: "Bob" })
    );
  });

  it("passes through object departedMembers unchanged", async () => {
    mockGetCurrentUser.mockResolvedValue(mockUser);
    mockLimit.mockResolvedValueOnce([
      { id: "member-1", role: "owner", status: "joined" },
    ]);
    const departed = [{ name: "Carol", departedAt: "2028-02-01" }];
    directWhereResults.push([{ ...sampleGroup, departedMembers: departed }]);
    mockOrderBy.mockResolvedValueOnce([]);
    mockOrderBy.mockResolvedValueOnce([]);

    const response = await callGET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.departedMembers).toEqual(departed);
  });

  it("returns empty array when departedMembers is not an array", async () => {
    mockGetCurrentUser.mockResolvedValue(mockUser);
    mockLimit.mockResolvedValueOnce([
      { id: "member-1", role: "owner", status: "joined" },
    ]);
    directWhereResults.push([{ ...sampleGroup, departedMembers: null }]);
    mockOrderBy.mockResolvedValueOnce([]);
    mockOrderBy.mockResolvedValueOnce([]);

    const response = await callGET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.departedMembers).toEqual([]);
  });

  it("returns empty object when affectedBuddyMembers is an array", async () => {
    mockGetCurrentUser.mockResolvedValue(mockUser);
    mockLimit.mockResolvedValueOnce([
      { id: "member-1", role: "owner", status: "joined" },
    ]);
    directWhereResults.push([
      { ...sampleGroup, affectedBuddyMembers: ["invalid"] },
    ]);
    mockOrderBy.mockResolvedValueOnce([]);
    mockOrderBy.mockResolvedValueOnce([]);

    const response = await callGET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.affectedBuddyMembers).toEqual({});
  });

  it("returns empty object when affectedBuddyMembers is null", async () => {
    mockGetCurrentUser.mockResolvedValue(mockUser);
    mockLimit.mockResolvedValueOnce([
      { id: "member-1", role: "owner", status: "joined" },
    ]);
    directWhereResults.push([{ ...sampleGroup, affectedBuddyMembers: null }]);
    mockOrderBy.mockResolvedValueOnce([]);
    mockOrderBy.mockResolvedValueOnce([]);

    const response = await callGET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.affectedBuddyMembers).toEqual({});
  });
});
