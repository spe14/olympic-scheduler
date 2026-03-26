import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  updateProfileField,
  updatePassword,
  updateAvatarColor,
  deleteAccount,
} from "@/app/(main)/profile/actions";

// Mock getCurrentUser
const mockGetCurrentUser = vi.fn();
vi.mock("@/lib/auth", () => ({
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
}));

// Mock Supabase client
const mockSignInWithPassword = vi.fn();
const mockUpdateUser = vi.fn();
const mockSignOut = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
      updateUser: mockUpdateUser,
      signOut: mockSignOut,
    },
  })),
}));

// Mock Supabase admin client
const mockAdminDeleteUser = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    auth: { admin: { deleteUser: mockAdminDeleteUser } },
  })),
}));

// Mock next/headers
const mockCookieDelete = vi.fn();
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve({ delete: mockCookieDelete })),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

// Mock removeMemberTransaction
const mockRemoveMemberTransaction = vi.fn();
vi.mock("@/app/(main)/groups/[groupId]/actions", () => ({
  removeMemberTransaction: (...args: unknown[]) =>
    mockRemoveMemberTransaction(...args),
}));

// Mock next/cache (imported transitively by group actions)
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock DB
const mockLimit = vi.fn();
let mockWhereDirectResult: unknown[] = [];
const mockWhere = vi.fn(() => ({
  limit: mockLimit,
  then: (resolve: (v: unknown) => void) => resolve(mockWhereDirectResult),
}));
const mockFrom = vi.fn(() => ({ where: mockWhere }));
const mockSelect = vi.fn(() => ({ from: mockFrom }));
const mockSet = vi.fn(() => ({ where: vi.fn() }));
const mockUpdate = vi.fn(() => ({ set: mockSet }));
const mockDeleteWhere = vi.fn(() => Promise.resolve());
const mockDbDelete = vi.fn(() => ({ where: mockDeleteWhere }));
const mockTransaction = vi.fn(async (cb: (tx: unknown) => Promise<void>) => {
  await cb({});
});

vi.mock("@/lib/db", () => ({
  db: {
    select: () => mockSelect(),
    update: () => mockUpdate(),
    delete: () => mockDbDelete(),
    transaction: (...args: unknown[]) => mockTransaction(...(args as [any])),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  user: {
    id: "id",
    username: "username",
    firstName: "firstName",
    lastName: "lastName",
    authId: "authId",
  },
  member: {
    id: "id",
    groupId: "groupId",
    role: "role",
    userId: "userId",
  },
  group: { id: "id" },
}));

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    fd.set(key, value);
  }
  return fd;
}

const mockUser = {
  id: 1,
  authId: "auth-123",
  email: "jane@example.com",
  username: "janedoe",
  firstName: "Jane",
  lastName: "Doe",
};

describe("updateProfileField", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockUser);
    mockLimit.mockResolvedValue([]);
  });

  it("returns error when not logged in", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const fd = makeFormData({ field: "username", value: "newname" });
    const result = await updateProfileField(null, fd);

    expect(result.error).toBe("You must be logged in.");
  });

  it("returns error for invalid field name", async () => {
    const fd = makeFormData({ field: "email", value: "bad@example.com" });
    const result = await updateProfileField(null, fd);

    expect(result.error).toBe("Invalid field.");
  });

  it("returns validation error for short username", async () => {
    const fd = makeFormData({ field: "username", value: "ab" });
    const result = await updateProfileField(null, fd);

    expect(result.error).toContain("at least 3");
  });

  it("returns validation error for username with invalid characters", async () => {
    const fd = makeFormData({ field: "username", value: "jane doe!" });
    const result = await updateProfileField(null, fd);

    expect(result.error).toContain("letters, numbers");
  });

  it("returns validation error for empty first name", async () => {
    const fd = makeFormData({ field: "firstName", value: "" });
    const result = await updateProfileField(null, fd);

    expect(result.error).toContain("required");
  });

  it("returns validation error for empty last name", async () => {
    const fd = makeFormData({ field: "lastName", value: "" });
    const result = await updateProfileField(null, fd);

    expect(result.error).toContain("required");
  });

  it("returns validation error for username over 30 characters", async () => {
    const fd = makeFormData({ field: "username", value: "a".repeat(31) });
    const result = await updateProfileField(null, fd);

    expect(result.error).toContain("less than 30");
  });

  it("accepts username with hyphens and underscores", async () => {
    const fd = makeFormData({ field: "username", value: "jane_doe-123" });
    const result = await updateProfileField(null, fd);

    expect(result.success).toBe(true);
    expect(result.updatedValue).toBe("jane_doe-123");
  });

  it("returns validation error for first name over 50 characters", async () => {
    const fd = makeFormData({ field: "firstName", value: "a".repeat(51) });
    const result = await updateProfileField(null, fd);

    expect(result.error).toContain("less than 50");
  });

  it("returns validation error for last name over 50 characters", async () => {
    const fd = makeFormData({ field: "lastName", value: "a".repeat(51) });
    const result = await updateProfileField(null, fd);

    expect(result.error).toContain("less than 50");
  });

  it("returns error when username is already taken", async () => {
    mockLimit.mockResolvedValue([{ id: 2 }]);
    const fd = makeFormData({ field: "username", value: "takenname" });
    const result = await updateProfileField(null, fd);

    expect(result.error).toContain("already taken");
  });

  it("does not check uniqueness for non-username fields", async () => {
    const fd = makeFormData({ field: "firstName", value: "NewName" });
    const result = await updateProfileField(null, fd);

    expect(result.success).toBe(true);
    expect(result.updatedValue).toBe("NewName");
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("updates field and returns success", async () => {
    const fd = makeFormData({ field: "username", value: "newusername" });
    const result = await updateProfileField(null, fd);

    expect(result.success).toBe(true);
    expect(result.updatedValue).toBe("newusername");
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("updates lastName successfully", async () => {
    const fd = makeFormData({ field: "lastName", value: "Smith" });
    const result = await updateProfileField(null, fd);

    expect(result.success).toBe(true);
    expect(result.updatedValue).toBe("Smith");
  });

  it("returns generic error when DB update throws", async () => {
    mockSet.mockImplementationOnce(() => ({
      where: vi.fn(() => {
        throw new Error("connection reset");
      }),
    }));
    const fd = makeFormData({ field: "firstName", value: "NewName" });
    const result = await updateProfileField(null, fd);

    expect(result.error).toBe("Failed to update profile. Please try again.");
  });
});

describe("updatePassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockUser);
  });

  it("returns error when not logged in", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const fd = makeFormData({
      currentPassword: "old123456",
      newPassword: "new123456",
      confirmPassword: "new123456",
    });
    const result = await updatePassword(null, fd);

    expect(result.error).toBe("You must be logged in.");
  });

  it("returns field errors for empty current password", async () => {
    const fd = makeFormData({
      currentPassword: "",
      newPassword: "new123456",
      confirmPassword: "new123456",
    });
    const result = await updatePassword(null, fd);

    expect(result.fieldErrors?.currentPassword).toBeDefined();
  });

  it("returns field errors for short new password", async () => {
    const fd = makeFormData({
      currentPassword: "old123456",
      newPassword: "short",
      confirmPassword: "short",
    });
    const result = await updatePassword(null, fd);

    expect(result.fieldErrors?.newPassword).toBeDefined();
    expect(result.fieldErrors?.newPassword?.[0]).toContain("at least 8");
  });

  it("returns field error when passwords do not match", async () => {
    const fd = makeFormData({
      currentPassword: "old123456",
      newPassword: "new123456",
      confirmPassword: "different1",
    });
    const result = await updatePassword(null, fd);

    expect(result.fieldErrors?.confirmPassword).toBeDefined();
    expect(result.fieldErrors?.confirmPassword?.[0]).toContain("do not match");
  });

  it("returns field errors for new password over 72 characters", async () => {
    const fd = makeFormData({
      currentPassword: "old123456",
      newPassword: "a".repeat(73),
      confirmPassword: "a".repeat(73),
    });
    const result = await updatePassword(null, fd);

    expect(result.fieldErrors?.newPassword).toBeDefined();
    expect(result.fieldErrors?.newPassword?.[0]).toContain("less than 72");
  });

  it("returns error when current password is incorrect", async () => {
    mockSignInWithPassword.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });

    const fd = makeFormData({
      currentPassword: "wrongpass1",
      newPassword: "new123456",
      confirmPassword: "new123456",
    });
    const result = await updatePassword(null, fd);

    expect(result.fieldErrors?.currentPassword?.[0]).toContain("incorrect");
  });

  it("returns generic error when supabase updateUser fails", async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null });
    mockUpdateUser.mockResolvedValue({
      error: { message: "Password update failed" },
    });

    const fd = makeFormData({
      currentPassword: "old123456",
      newPassword: "new123456",
      confirmPassword: "new123456",
    });
    const result = await updatePassword(null, fd);

    expect(result.error).toBe("Failed to update password. Please try again.");
  });

  it("returns success on valid password update", async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null });
    mockUpdateUser.mockResolvedValue({ error: null });

    const fd = makeFormData({
      currentPassword: "old123456",
      newPassword: "new123456",
      confirmPassword: "new123456",
    });
    const result = await updatePassword(null, fd);

    expect(result.success).toBe(true);
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: mockUser.email,
      password: "old123456",
    });
    expect(mockUpdateUser).toHaveBeenCalledWith({
      password: "new123456",
    });
  });

  it("does not call supabase when validation fails", async () => {
    const fd = makeFormData({
      currentPassword: "",
      newPassword: "short",
      confirmPassword: "mismatch",
    });
    await updatePassword(null, fd);

    expect(mockSignInWithPassword).not.toHaveBeenCalled();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });
});

describe("updateAvatarColor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockUser);
  });

  it("returns error when not logged in", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const result = await updateAvatarColor("blue");

    expect(result.error).toBe("You must be logged in.");
  });

  it("returns success for valid color 'blue'", async () => {
    const result = await updateAvatarColor("blue");

    expect(result.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("returns success for valid color 'yellow'", async () => {
    const result = await updateAvatarColor("yellow");

    expect(result.success).toBe(true);
  });

  it("returns success for valid color 'pink'", async () => {
    const result = await updateAvatarColor("pink");

    expect(result.success).toBe(true);
  });

  it("returns success for valid color 'green'", async () => {
    const result = await updateAvatarColor("green");

    expect(result.success).toBe(true);
  });

  it("returns success for valid color 'purple'", async () => {
    const result = await updateAvatarColor("purple");

    expect(result.success).toBe(true);
  });

  it("returns success for valid color 'orange'", async () => {
    const result = await updateAvatarColor("orange");

    expect(result.success).toBe(true);
  });

  it("returns success for valid color 'teal'", async () => {
    const result = await updateAvatarColor("teal");

    expect(result.success).toBe(true);
  });

  it("returns error for invalid color", async () => {
    const result = await updateAvatarColor("magenta" as any);

    expect(result.error).toBe("Invalid color.");
  });

  it("returns error for empty string color", async () => {
    const result = await updateAvatarColor("" as any);

    expect(result.error).toBe("Invalid color.");
  });

  it("returns generic error when DB update throws", async () => {
    mockSet.mockImplementationOnce(() => ({
      where: vi.fn(() => {
        throw new Error("connection reset");
      }),
    }));
    const result = await updateAvatarColor("blue");

    expect(result.error).toBe(
      "Failed to update avatar color. Please try again."
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// deleteAccount
// ─────────────────────────────────────────────────────────────────────────────

describe("deleteAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockUser);
    mockSignInWithPassword.mockResolvedValue({ error: null });
    mockSignOut.mockResolvedValue({ error: null });
    mockAdminDeleteUser.mockResolvedValue({ error: null });
    mockWhereDirectResult = [];
    mockRemoveMemberTransaction.mockResolvedValue(undefined);
  });

  it("returns error when not logged in", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const result = await deleteAccount("password123");

    expect(result.error).toBe("You must be logged in.");
  });

  it("returns error when password is incorrect", async () => {
    mockSignInWithPassword.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });
    const result = await deleteAccount("wrongpassword");

    expect(result.error).toBe("Incorrect password.");
  });

  it("blocks deletion when user owns a group", async () => {
    mockWhereDirectResult = [{ id: "m1", groupId: "g1", role: "owner" }];
    const result = await deleteAccount("password123");

    expect(result.error).toContain("transfer ownership or delete");
  });

  it("leaves all groups before deleting account", async () => {
    mockWhereDirectResult = [
      { id: "m1", groupId: "g1", role: "member" },
      { id: "m2", groupId: "g2", role: "member" },
    ];

    await expect(deleteAccount("password123")).rejects.toThrow("NEXT_REDIRECT");

    expect(mockTransaction).toHaveBeenCalledTimes(2);
    expect(mockRemoveMemberTransaction).toHaveBeenCalledTimes(2);
  });

  it("deletes user from local DB and Supabase", async () => {
    mockWhereDirectResult = [];

    await expect(deleteAccount("password123")).rejects.toThrow("NEXT_REDIRECT");

    expect(mockDbDelete).toHaveBeenCalled();
    expect(mockAdminDeleteUser).toHaveBeenCalledWith(mockUser.authId);
  });

  it("signs out and clears session cookies", async () => {
    mockWhereDirectResult = [];

    await expect(deleteAccount("password123")).rejects.toThrow("NEXT_REDIRECT");

    expect(mockSignOut).toHaveBeenCalled();
    expect(mockCookieDelete).toHaveBeenCalledWith("session_start_at");
    expect(mockCookieDelete).toHaveBeenCalledWith("last_active_at");
  });

  it("redirects to /login after successful deletion", async () => {
    mockWhereDirectResult = [];
    const { redirect } = await import("next/navigation");

    await expect(deleteAccount("password123")).rejects.toThrow("NEXT_REDIRECT");

    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("verifies password with correct email", async () => {
    mockWhereDirectResult = [];

    await expect(deleteAccount("mypassword")).rejects.toThrow("NEXT_REDIRECT");

    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: mockUser.email,
      password: "mypassword",
    });
  });

  it("returns generic error when DB operation throws", async () => {
    mockWhereDirectResult = [];
    mockDbDelete.mockImplementationOnce(() => ({
      where: vi.fn(() => {
        throw new Error("connection reset");
      }),
    }));

    const result = await deleteAccount("password123");

    expect(result.error).toBe("Failed to delete account. Please try again.");
  });
});
