import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  saveBuddiesBudget,
  saveSportRankings,
  saveSessionPreferences,
} from "@/app/(main)/groups/[groupId]/preferences/actions";

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock auth
const mockGetCurrentUser = vi.fn();
const mockGetMembership = vi.fn();
vi.mock("@/lib/auth", () => ({
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
  getMembership: (...args: unknown[]) => mockGetMembership(...args),
  getOwnerMembership: vi.fn(),
}));

// Mock DB
const mockLimit = vi.fn();
let directWhereResults: unknown[][] = [];
const mockWhere = vi.fn(() => ({
  limit: mockLimit,
  then(resolve: (v: unknown) => void) {
    resolve(directWhereResults.shift() ?? []);
  },
}));
const mockFrom = vi.fn(() => ({ where: mockWhere }));
const mockSelect = vi.fn(() => ({ from: mockFrom }));

// selectDistinct mock (for sports query - no .where(), resolves from .from())
let selectDistinctResults: unknown[] = [];
const mockSelectDistinctFrom = vi.fn(() => ({
  then(resolve: (v: unknown) => void) {
    resolve(selectDistinctResults.shift() ?? []);
  },
}));
const mockSelectDistinct = vi.fn(() => ({ from: mockSelectDistinctFrom }));

const mockUpdateWhere = vi.fn(() => Promise.resolve());
const mockSet = vi.fn(() => ({ where: mockUpdateWhere }));
const mockUpdate = vi.fn(() => ({ set: mockSet }));

const mockDeleteWhere = vi.fn(() => Promise.resolve());
const mockDelete = vi.fn(() => ({ where: mockDeleteWhere }));

const mockInsertValues = vi.fn(() => Promise.resolve());
const mockInsert = vi.fn(() => ({ values: mockInsertValues }));

const mockTransaction = vi.fn((cb: (tx: unknown) => Promise<void>) => {
  const txUpdateWhere = vi.fn(() => Promise.resolve());
  const txDeleteWhere = vi.fn(() => Promise.resolve());
  const txInsertValues = vi.fn(() => Promise.resolve());
  const tx = {
    update: vi.fn(() => ({
      set: vi.fn(() => ({ where: txUpdateWhere })),
    })),
    delete: vi.fn(() => ({ where: txDeleteWhere })),
    insert: vi.fn(() => ({ values: txInsertValues })),
  };
  return cb(tx);
});

vi.mock("@/lib/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    selectDistinct: (...args: unknown[]) => mockSelectDistinct(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
    transaction: (...args: unknown[]) => mockTransaction(...(args as [never])),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  member: {
    id: "id",
    userId: "user_id",
    groupId: "group_id",
    role: "role",
    status: "status",
    preferenceStep: "preference_step",
    budget: "budget",
    minBuddies: "min_buddies",
    sportRankings: "sport_rankings",
  },
  buddyConstraint: {
    memberId: "member_id",
    buddyMemberId: "buddy_id",
    type: "type",
  },
  session: { sport: "sport", sessionCode: "session_code" },
  sessionPreference: {
    sessionId: "session_id",
    memberId: "member_id",
    interest: "interest",
    maxWillingness: "max_willingness",
    hardBuddyOverride: "hard_buddy_override",
    minBuddyOverride: "min_buddy_override",
    excluded: "excluded",
  },
}));

const mockUser = { id: "user-1", authId: "auth-123" };

// Helper: getMembership returns active member
function mockActiveMember(overrides: Record<string, unknown> = {}) {
  mockGetCurrentUser.mockResolvedValue(mockUser);
  mockGetMembership.mockResolvedValue({
    id: "member-1",
    role: "member",
    status: "joined",
    preferenceStep: null,
    ...overrides,
  });
}

// Helper: getMembership returns null (not logged in or not a member)
function mockNoMembership() {
  mockGetCurrentUser.mockResolvedValue(null);
  mockGetMembership.mockResolvedValue(null);
}

// ─── saveBuddiesBudget ──────────────────────────────────────────────

describe("saveBuddiesBudget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLimit.mockReset();
    mockUpdateWhere.mockReset();
    mockTransaction.mockClear();
    directWhereResults = [];
    mockUpdateWhere.mockResolvedValue(undefined);
    mockTransaction.mockImplementation((cb: (tx: unknown) => Promise<void>) => {
      const txUpdateWhere = vi.fn(() => Promise.resolve());
      const txDeleteWhere = vi.fn(() => Promise.resolve());
      const txInsertValues = vi.fn(() => Promise.resolve());
      const tx = {
        update: vi.fn(() => ({
          set: vi.fn(() => ({ where: txUpdateWhere })),
        })),
        delete: vi.fn(() => ({ where: txDeleteWhere })),
        insert: vi.fn(() => ({ values: txInsertValues })),
      };
      return cb(tx);
    });
  });

  it("returns error when not authenticated", async () => {
    mockNoMembership();
    const result = await saveBuddiesBudget("group-1", {
      budget: 500,
      minBuddies: 0,
      buddies: [],
    });

    expect(result.error).toBe("You are not an active member of this group.");
  });

  it("returns error when user has no active membership", async () => {
    mockGetCurrentUser.mockResolvedValue(mockUser);
    mockLimit.mockResolvedValueOnce([]); // no membership

    const result = await saveBuddiesBudget("group-1", {
      budget: 500,
      minBuddies: 0,
      buddies: [],
    });

    expect(result.error).toBe("You are not an active member of this group.");
  });

  // Budget validation
  it("allows null budget (optional field)", async () => {
    mockActiveMember();
    // valid members query for minBuddies check
    directWhereResults.push([{ id: "member-1" }, { id: "member-2" }]);

    const result = await saveBuddiesBudget("group-1", {
      budget: null,
      minBuddies: 0,
      buddies: [],
    });

    expect(result.success).toBe(true);
  });

  it("returns error for budget of 0", async () => {
    mockActiveMember();

    const result = await saveBuddiesBudget("group-1", {
      budget: 0,
      minBuddies: 0,
      buddies: [],
    });

    expect(result.error).toBe("Budget must be a positive whole number.");
  });

  it("returns error for negative budget", async () => {
    mockActiveMember();

    const result = await saveBuddiesBudget("group-1", {
      budget: -100,
      minBuddies: 0,
      buddies: [],
    });

    expect(result.error).toBe("Budget must be a positive whole number.");
  });

  it("returns error for decimal budget", async () => {
    mockActiveMember();

    const result = await saveBuddiesBudget("group-1", {
      budget: 99.5,
      minBuddies: 0,
      buddies: [],
    });

    expect(result.error).toBe("Budget must be a positive whole number.");
  });

  it("accepts valid positive integer budget", async () => {
    mockActiveMember();
    directWhereResults.push([{ id: "member-1" }, { id: "member-2" }]);

    const result = await saveBuddiesBudget("group-1", {
      budget: 1000,
      minBuddies: 0,
      buddies: [],
    });

    expect(result.success).toBe(true);
  });

  // minBuddies validation
  it("returns error for negative minBuddies", async () => {
    mockActiveMember();
    directWhereResults.push([{ id: "member-1" }, { id: "member-2" }]);

    const result = await saveBuddiesBudget("group-1", {
      budget: null,
      minBuddies: -1,
      buddies: [],
    });

    expect(result.error).toBe(
      "Minimum buddies must be a non-negative integer."
    );
  });

  it("returns error for non-integer minBuddies", async () => {
    mockActiveMember();
    directWhereResults.push([{ id: "member-1" }, { id: "member-2" }]);

    const result = await saveBuddiesBudget("group-1", {
      budget: null,
      minBuddies: 1.5,
      buddies: [],
    });

    expect(result.error).toBe(
      "Minimum buddies must be a non-negative integer."
    );
  });

  it("returns error when minBuddies exceeds other member count", async () => {
    mockActiveMember();
    // 2 members total, self is member-1, so 1 other member
    directWhereResults.push([{ id: "member-1" }, { id: "member-2" }]);

    const result = await saveBuddiesBudget("group-1", {
      budget: null,
      minBuddies: 2,
      buddies: [],
    });

    expect(result.error).toContain("cannot exceed 1");
  });

  it("accepts minBuddies equal to other member count", async () => {
    mockActiveMember();
    directWhereResults.push([
      { id: "member-1" },
      { id: "member-2" },
      { id: "member-3" },
    ]);

    const result = await saveBuddiesBudget("group-1", {
      budget: null,
      minBuddies: 2,
      buddies: [],
    });

    expect(result.success).toBe(true);
  });

  it("accepts minBuddies of 0", async () => {
    mockActiveMember();
    directWhereResults.push([{ id: "member-1" }]);

    const result = await saveBuddiesBudget("group-1", {
      budget: null,
      minBuddies: 0,
      buddies: [],
    });

    expect(result.success).toBe(true);
  });

  // Buddy validation
  it("returns error for duplicate buddy selections", async () => {
    mockActiveMember();
    directWhereResults.push([{ id: "member-1" }, { id: "member-2" }]);

    const result = await saveBuddiesBudget("group-1", {
      budget: null,
      minBuddies: 0,
      buddies: [
        { memberId: "member-2", type: "hard" },
        { memberId: "member-2", type: "soft" },
      ],
    });

    expect(result.error).toBe("Duplicate buddy selections.");
  });

  it("returns error when selecting self as buddy", async () => {
    mockActiveMember();
    directWhereResults.push([{ id: "member-1" }, { id: "member-2" }]);

    const result = await saveBuddiesBudget("group-1", {
      budget: null,
      minBuddies: 0,
      buddies: [{ memberId: "member-1", type: "hard" }],
    });

    expect(result.error).toBe("You cannot select yourself as a buddy.");
  });

  it("returns error for invalid buddy member ID", async () => {
    mockActiveMember();
    directWhereResults.push([{ id: "member-1" }, { id: "member-2" }]);

    const result = await saveBuddiesBudget("group-1", {
      budget: null,
      minBuddies: 0,
      buddies: [{ memberId: "nonexistent", type: "hard" }],
    });

    expect(result.error).toBe("Invalid buddy selection.");
  });

  it("saves with valid buddies and verifies transaction operations", async () => {
    mockActiveMember();
    directWhereResults.push([
      { id: "member-1" },
      { id: "member-2" },
      { id: "member-3" },
    ]);

    const txSetMock = vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) }));
    const txUpdateMock = vi.fn(() => ({ set: txSetMock }));
    const txDeleteMock = vi.fn(() => ({
      where: vi.fn(() => Promise.resolve()),
    }));
    const txInsertValuesMock = vi.fn(() => Promise.resolve());
    const txInsertMock = vi.fn(() => ({ values: txInsertValuesMock }));
    mockTransaction.mockImplementation((cb: (tx: unknown) => Promise<void>) =>
      cb({
        update: txUpdateMock,
        delete: txDeleteMock,
        insert: txInsertMock,
      })
    );

    const result = await saveBuddiesBudget("group-1", {
      budget: 500,
      minBuddies: 1,
      buddies: [
        { memberId: "member-2", type: "hard" },
        { memberId: "member-3", type: "soft" },
      ],
    });

    expect(result.success).toBe(true);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    // Verify member update was called
    expect(txUpdateMock).toHaveBeenCalled();
    expect(txSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        budget: 500,
        minBuddies: 1,
        preferenceStep: "buddies_budget",
      })
    );
    // Verify old buddy constraints deleted
    expect(txDeleteMock).toHaveBeenCalled();
    // Verify new buddy constraints inserted
    expect(txInsertMock).toHaveBeenCalled();
    expect(txInsertValuesMock).toHaveBeenCalledWith([
      { memberId: "member-1", buddyMemberId: "member-2", type: "hard" },
      { memberId: "member-1", buddyMemberId: "member-3", type: "soft" },
    ]);
  });

  it("saves with empty buddies list and skips insert", async () => {
    mockActiveMember();
    directWhereResults.push([{ id: "member-1" }]);

    const txInsertMock = vi.fn(() => ({ values: vi.fn() }));
    mockTransaction.mockImplementation((cb: (tx: unknown) => Promise<void>) =>
      cb({
        update: vi.fn(() => ({
          set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
        })),
        delete: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
        insert: txInsertMock,
      })
    );

    const result = await saveBuddiesBudget("group-1", {
      budget: 200,
      minBuddies: 0,
      buddies: [],
    });

    expect(result.success).toBe(true);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    // Should NOT insert when buddies list is empty
    expect(txInsertMock).not.toHaveBeenCalled();
  });

  it("does not reset status when re-editing after preferences_set", async () => {
    mockActiveMember({ status: "preferences_set", preferenceStep: "sessions" });
    directWhereResults.push([{ id: "member-1" }, { id: "member-2" }]);

    const txSetMock = vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) }));
    mockTransaction.mockImplementation((cb: (tx: unknown) => Promise<void>) =>
      cb({
        update: vi.fn(() => ({ set: txSetMock })),
        delete: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
        insert: vi.fn(() => ({ values: vi.fn(() => Promise.resolve()) })),
      })
    );

    const result = await saveBuddiesBudget("group-1", {
      budget: 500,
      minBuddies: 0,
      buddies: [],
    });

    expect(result.success).toBe(true);
    const setCall = txSetMock.mock.calls[0][0] as Record<string, unknown>;
    expect(setCall.status).toBeUndefined();
  });

  it("does not overwrite preferenceStep when already at a higher step", async () => {
    // preferenceStep is "sessions" — saving buddies_budget should NOT set preferenceStep: "buddies_budget"
    mockActiveMember({ preferenceStep: "sessions" });
    directWhereResults.push([{ id: "member-1" }, { id: "member-2" }]);

    const txSetMock = vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) }));
    mockTransaction.mockImplementation((cb: (tx: unknown) => Promise<void>) =>
      cb({
        update: vi.fn(() => ({ set: txSetMock })),
        delete: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
        insert: vi.fn(() => ({ values: vi.fn(() => Promise.resolve()) })),
      })
    );

    const result = await saveBuddiesBudget("group-1", {
      budget: 500,
      minBuddies: 0,
      buddies: [],
    });

    expect(result.success).toBe(true);
    const setCall = txSetMock.mock.calls[0][0] as Record<string, unknown>;
    expect(setCall.preferenceStep).toBeUndefined();
  });

  it("returns error when transaction fails", async () => {
    mockActiveMember();
    directWhereResults.push([{ id: "member-1" }, { id: "member-2" }]);
    mockTransaction.mockRejectedValue(new Error("TX error"));

    const result = await saveBuddiesBudget("group-1", {
      budget: 500,
      minBuddies: 0,
      buddies: [],
    });

    expect(result.error).toBe("Failed to save preferences. Please try again.");
  });
});

// ─── saveSportRankings ──────────────────────────────────────────────

describe("saveSportRankings", () => {
  let txSetMock: ReturnType<typeof vi.fn>;
  let txDeleteWhere: ReturnType<typeof vi.fn>;

  function setupSportRankingsTransaction(
    existingPrefs: { sessionId: string }[] = [],
    matchedSessions: { sessionCode: string; sport: string }[] = []
  ) {
    txDeleteWhere = vi.fn(() => Promise.resolve());
    const txUpdateWhere = vi.fn(() => Promise.resolve());
    txSetMock = vi.fn(() => ({ where: txUpdateWhere }));

    // tx.select() for existing preferences and matched sessions
    const selectResults = [existingPrefs, matchedSessions];
    const txSelectWhere = vi.fn(() =>
      Promise.resolve(selectResults.shift() ?? [])
    );
    const txSelectFrom = vi.fn(() => ({ where: txSelectWhere }));
    const txSelect = vi.fn(() => ({ from: txSelectFrom }));

    mockTransaction.mockImplementation((cb: (tx: unknown) => Promise<void>) =>
      cb({
        update: vi.fn(() => ({ set: txSetMock })),
        delete: vi.fn(() => ({ where: txDeleteWhere })),
        select: txSelect,
      })
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockLimit.mockReset();
    mockUpdateWhere.mockReset();
    mockTransaction.mockClear();
    directWhereResults = [];
    selectDistinctResults = [];
    mockUpdateWhere.mockResolvedValue(undefined);
    // Default transaction mock for simple cases (no existing prefs)
    setupSportRankingsTransaction();
  });

  // Mock the selectDistinct sports query
  function mockValidSports(sports: string[]) {
    selectDistinctResults.push(sports.map((s) => ({ sport: s })));
  }

  it("returns error when not authenticated", async () => {
    mockNoMembership();

    const result = await saveSportRankings("group-1", {
      sportRankings: ["Tennis"],
    });

    expect(result.error).toBe("You are not an active member of this group.");
  });

  it("returns error for empty rankings array", async () => {
    mockActiveMember();

    const result = await saveSportRankings("group-1", {
      sportRankings: [],
    });

    expect(result.error).toBe("You must rank between 1 and 10 sports.");
  });

  it("returns error for more than 10 sports", async () => {
    mockActiveMember();

    const result = await saveSportRankings("group-1", {
      sportRankings: Array.from({ length: 11 }, (_, i) => `Sport${i}`),
    });

    expect(result.error).toBe("You must rank between 1 and 10 sports.");
  });

  it("returns error for invalid sport name", async () => {
    mockActiveMember();
    mockValidSports(["Tennis", "Swimming", "Basketball"]);

    const result = await saveSportRankings("group-1", {
      sportRankings: ["Tennis", "Quidditch"],
    });

    expect(result.error).toBe("Invalid sport: Quidditch");
  });

  it("returns error for duplicate sports", async () => {
    mockActiveMember();
    mockValidSports(["Tennis", "Swimming"]);

    const result = await saveSportRankings("group-1", {
      sportRankings: ["Tennis", "Tennis"],
    });

    expect(result.error).toBe("Duplicate sports in rankings.");
  });

  it("saves valid sport rankings successfully", async () => {
    mockActiveMember();
    mockValidSports(["Tennis", "Swimming", "Basketball"]);
    setupSportRankingsTransaction();

    const result = await saveSportRankings("group-1", {
      sportRankings: ["Swimming", "Tennis"],
    });

    expect(result.success).toBe(true);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(txSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sportRankings: ["Swimming", "Tennis"],
        preferenceStep: "sport_rankings",
      })
    );
  });

  it("saves single sport ranking", async () => {
    mockActiveMember();
    mockValidSports(["Tennis"]);
    setupSportRankingsTransaction();

    const result = await saveSportRankings("group-1", {
      sportRankings: ["Tennis"],
    });

    expect(result.success).toBe(true);
  });

  it("saves exactly 10 sport rankings", async () => {
    const sports = Array.from({ length: 10 }, (_, i) => `Sport${i}`);
    mockActiveMember();
    mockValidSports(sports);
    setupSportRankingsTransaction();

    const result = await saveSportRankings("group-1", {
      sportRankings: sports,
    });

    expect(result.success).toBe(true);
  });

  it("does not reset status when re-editing after preferences_set", async () => {
    mockActiveMember({ status: "preferences_set", preferenceStep: "sessions" });
    mockValidSports(["Tennis", "Swimming"]);
    setupSportRankingsTransaction();

    const result = await saveSportRankings("group-1", {
      sportRankings: ["Tennis"],
    });

    expect(result.success).toBe(true);
    const setCall = txSetMock.mock.calls[0][0] as Record<string, unknown>;
    expect(setCall.status).toBeUndefined();
  });

  it("does not overwrite preferenceStep when already at a higher step", async () => {
    // preferenceStep is "sessions" — saving sport_rankings should NOT set preferenceStep: "sport_rankings"
    mockActiveMember({ preferenceStep: "sessions" });
    mockValidSports(["Tennis"]);
    setupSportRankingsTransaction();

    const result = await saveSportRankings("group-1", {
      sportRankings: ["Tennis"],
    });

    expect(result.success).toBe(true);
    const setCall = txSetMock.mock.calls[0][0] as Record<string, unknown>;
    expect(setCall.preferenceStep).toBeUndefined();
  });

  it("returns error when transaction fails", async () => {
    mockActiveMember();
    mockValidSports(["Tennis"]);
    mockTransaction.mockRejectedValue(new Error("TX error"));

    const result = await saveSportRankings("group-1", {
      sportRankings: ["Tennis"],
    });

    expect(result.error).toBe(
      "Failed to save sport rankings. Please try again."
    );
  });

  // ── Session preference cleanup on sport unranking ────────────

  it("deletes session preferences for unranked sports via transaction", async () => {
    mockActiveMember({ preferenceStep: "sport_rankings" });
    mockValidSports(["Tennis", "Swimming", "Basketball"]);
    setupSportRankingsTransaction(
      [{ sessionId: "TEN-001" }, { sessionId: "SWM-001" }],
      [
        { sessionCode: "TEN-001", sport: "Tennis" },
        { sessionCode: "SWM-001", sport: "Swimming" },
      ]
    );

    // User removes Swimming, keeps only Tennis
    const result = await saveSportRankings("group-1", {
      sportRankings: ["Tennis"],
    });

    expect(result.success).toBe(true);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    // Should delete SWM-001 since Swimming is no longer ranked
    expect(txDeleteWhere).toHaveBeenCalled();
  });

  it("does not delete preferences when no stale sessions exist", async () => {
    mockActiveMember({ preferenceStep: "sport_rankings" });
    mockValidSports(["Tennis", "Swimming"]);
    setupSportRankingsTransaction();

    const result = await saveSportRankings("group-1", {
      sportRankings: ["Tennis", "Swimming"],
    });

    expect(result.success).toBe(true);
  });

  it("keeps preferences for sessions in still-ranked sports", async () => {
    mockActiveMember({ preferenceStep: "sport_rankings" });
    mockValidSports(["Tennis", "Swimming", "Basketball"]);
    setupSportRankingsTransaction(
      [{ sessionId: "TEN-001" }],
      [{ sessionCode: "TEN-001", sport: "Tennis" }]
    );

    // User keeps Tennis, removes Swimming — TEN-001 should survive
    const result = await saveSportRankings("group-1", {
      sportRankings: ["Tennis"],
    });

    expect(result.success).toBe(true);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });
});

// ─── saveSessionPreferences ─────────────────────────────────────────

describe("saveSessionPreferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLimit.mockReset();
    mockUpdateWhere.mockReset();
    mockTransaction.mockClear();
    directWhereResults = [];
    mockUpdateWhere.mockResolvedValue(undefined);
    mockTransaction.mockImplementation((cb: (tx: unknown) => Promise<void>) => {
      const txUpdateWhere = vi.fn(() => Promise.resolve());
      const txDeleteWhere = vi.fn(() => Promise.resolve());
      const txInsertValues = vi.fn(() => Promise.resolve());
      const tx = {
        update: vi.fn(() => ({
          set: vi.fn(() => ({ where: txUpdateWhere })),
        })),
        delete: vi.fn(() => ({ where: txDeleteWhere })),
        insert: vi.fn(() => ({ values: txInsertValues })),
      };
      return cb(tx);
    });
  });

  // Helper: mock sport rankings query (the second select call)
  function mockSportRankings(sports: string[]) {
    mockLimit.mockResolvedValueOnce([{ sportRankings: sports }]);
  }

  // Helper: mock valid sessions query
  function mockValidSessions(
    sessions: { sessionCode: string; sport: string }[]
  ) {
    directWhereResults.push(sessions);
  }

  it("returns error when not authenticated", async () => {
    mockNoMembership();

    const result = await saveSessionPreferences("group-1", {
      preferences: [{ sessionId: "s1", interest: "high", maxWillingness: 200 }],
    });

    expect(result.error).toBe("You are not an active member of this group.");
  });

  it("returns error when previous steps not completed", async () => {
    mockActiveMember({ preferenceStep: "buddies_budget" });

    const result = await saveSessionPreferences("group-1", {
      preferences: [{ sessionId: "s1", interest: "high", maxWillingness: 200 }],
    });

    expect(result.error).toBe("You must complete previous steps first.");
  });

  it("returns error when preferenceStep is null", async () => {
    mockActiveMember({ preferenceStep: null });

    const result = await saveSessionPreferences("group-1", {
      preferences: [{ sessionId: "s1", interest: "high", maxWillingness: 200 }],
    });

    expect(result.error).toBe("You must complete previous steps first.");
  });

  it("returns error for empty preferences array", async () => {
    mockActiveMember({ preferenceStep: "sport_rankings" });

    const result = await saveSessionPreferences("group-1", {
      preferences: [],
    });

    expect(result.error).toBe("You must select at least one session.");
  });

  it("returns error for duplicate session IDs", async () => {
    mockActiveMember({ preferenceStep: "sport_rankings" });

    const result = await saveSessionPreferences("group-1", {
      preferences: [
        { sessionId: "s1", interest: "high", maxWillingness: 200 },
        { sessionId: "s1", interest: "low", maxWillingness: 100 },
      ],
    });

    expect(result.error).toBe("Duplicate session selections.");
  });

  it("returns error for invalid interest level", async () => {
    mockActiveMember({ preferenceStep: "sport_rankings" });

    const result = await saveSessionPreferences("group-1", {
      preferences: [
        {
          sessionId: "s1",
          interest: "extreme" as "high",
          maxWillingness: 200,
        },
      ],
    });

    expect(result.error).toBe("Invalid interest level.");
  });

  it("returns error for invalid willingness value", async () => {
    mockActiveMember({ preferenceStep: "sport_rankings" });

    const result = await saveSessionPreferences("group-1", {
      preferences: [{ sessionId: "s1", interest: "high", maxWillingness: 75 }],
    });

    expect(result.error).toBe("Invalid willingness value.");
  });

  it("allows null maxWillingness (means $1000+)", async () => {
    mockActiveMember({ preferenceStep: "sport_rankings" });
    mockSportRankings(["Tennis"]);
    mockValidSessions([{ sessionCode: "s1", sport: "Tennis" }]);

    const result = await saveSessionPreferences("group-1", {
      preferences: [
        { sessionId: "s1", interest: "high", maxWillingness: null },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("returns error when sport rankings are empty", async () => {
    mockActiveMember({ preferenceStep: "sport_rankings" });
    mockLimit.mockResolvedValueOnce([{ sportRankings: [] }]);

    const result = await saveSessionPreferences("group-1", {
      preferences: [{ sessionId: "s1", interest: "high", maxWillingness: 200 }],
    });

    expect(result.error).toBe("You must complete sport rankings first.");
  });

  it("returns error for session not in ranked sports", async () => {
    mockActiveMember({ preferenceStep: "sport_rankings" });
    mockSportRankings(["Tennis"]);
    // No valid sessions returned (session doesn't match ranked sports)
    mockValidSessions([]);

    const result = await saveSessionPreferences("group-1", {
      preferences: [{ sessionId: "s1", interest: "high", maxWillingness: 200 }],
    });

    expect(result.error).toBe("Invalid session: s1");
  });

  it("saves valid session preferences in a transaction", async () => {
    mockActiveMember({ preferenceStep: "sport_rankings" });
    mockSportRankings(["Tennis", "Swimming"]);
    mockValidSessions([
      { sessionCode: "s1", sport: "Tennis" },
      { sessionCode: "s2", sport: "Swimming" },
    ]);

    const txDeleteWhere = vi.fn(() => Promise.resolve());
    const txInsertValues = vi.fn(() => Promise.resolve());
    const txUpdateWhere = vi.fn(() => Promise.resolve());
    const txSetMock = vi.fn(() => ({ where: txUpdateWhere }));
    mockTransaction.mockImplementation((cb: (tx: unknown) => Promise<void>) =>
      cb({
        delete: vi.fn(() => ({ where: txDeleteWhere })),
        insert: vi.fn(() => ({ values: txInsertValues })),
        update: vi.fn(() => ({ set: txSetMock })),
      })
    );

    const result = await saveSessionPreferences("group-1", {
      preferences: [
        { sessionId: "s1", interest: "high", maxWillingness: 200 },
        { sessionId: "s2", interest: "medium", maxWillingness: null },
      ],
    });

    expect(result.success).toBe(true);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(txDeleteWhere).toHaveBeenCalled();
    expect(txInsertValues).toHaveBeenCalledWith([
      {
        sessionId: "s1",
        memberId: "member-1",
        interest: "high",
        maxWillingness: 200,
      },
      {
        sessionId: "s2",
        memberId: "member-1",
        interest: "medium",
        maxWillingness: null,
      },
    ]);
    expect(txSetMock).toHaveBeenCalledWith({
      preferenceStep: "sessions",
      status: "preferences_set",
    });
  });

  it("succeeds when preferenceStep is already sessions (re-saving)", async () => {
    mockActiveMember({
      preferenceStep: "sessions",
      status: "preferences_set",
    });
    mockSportRankings(["Tennis"]);
    mockValidSessions([{ sessionCode: "s1", sport: "Tennis" }]);

    const result = await saveSessionPreferences("group-1", {
      preferences: [{ sessionId: "s1", interest: "low", maxWillingness: 100 }],
    });

    expect(result.success).toBe(true);
  });

  it("accepts all valid willingness bucket values", async () => {
    const validValues = [50, 100, 150, 200, 250, 300, 400, 500, 1000];
    for (const val of validValues) {
      vi.clearAllMocks();
      mockLimit.mockReset();
      directWhereResults = [];
      mockTransaction.mockImplementation(
        (cb: (tx: unknown) => Promise<void>) => {
          const tx = {
            update: vi.fn(() => ({
              set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
            })),
            delete: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
            insert: vi.fn(() => ({ values: vi.fn(() => Promise.resolve()) })),
          };
          return cb(tx);
        }
      );

      mockActiveMember({ preferenceStep: "sport_rankings" });
      mockSportRankings(["Tennis"]);
      mockValidSessions([{ sessionCode: "s1", sport: "Tennis" }]);

      const result = await saveSessionPreferences("group-1", {
        preferences: [
          { sessionId: "s1", interest: "high", maxWillingness: val },
        ],
      });

      expect(result.success).toBe(true);
    }
  });

  it("returns error when transaction fails", async () => {
    mockActiveMember({ preferenceStep: "sport_rankings" });
    mockSportRankings(["Tennis"]);
    mockValidSessions([{ sessionCode: "s1", sport: "Tennis" }]);
    mockTransaction.mockRejectedValue(new Error("TX error"));

    const result = await saveSessionPreferences("group-1", {
      preferences: [{ sessionId: "s1", interest: "high", maxWillingness: 200 }],
    });

    expect(result.error).toBe(
      "Failed to save session preferences. Please try again."
    );
  });
});
