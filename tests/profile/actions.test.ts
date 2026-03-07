import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  updateProfileField,
  updatePassword,
  updateAvatarColor,
} from "@/app/(main)/profile/actions";

// Mock getCurrentUser
const mockGetCurrentUser = vi.fn();
vi.mock("@/lib/auth", () => ({
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
}));

// Mock Supabase client
const mockSignInWithPassword = vi.fn();
const mockUpdateUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
      updateUser: mockUpdateUser,
    },
  })),
}));

// Mock DB
const mockLimit = vi.fn();
const mockWhere = vi.fn(() => ({ limit: mockLimit }));
const mockFrom = vi.fn(() => ({ where: mockWhere }));
const mockSelect = vi.fn(() => ({ from: mockFrom }));
const mockSet = vi.fn(() => ({ where: vi.fn() }));
const mockUpdate = vi.fn(() => ({ set: mockSet }));

vi.mock("@/lib/db", () => ({
  db: {
    select: () => mockSelect(),
    update: () => mockUpdate(),
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

  it("returns error when supabase updateUser fails", async () => {
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

    expect(result.error).toBe("Password update failed");
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

  it("returns error for invalid color", async () => {
    const result = await updateAvatarColor("red" as any);

    expect(result.error).toBe("Invalid color.");
  });

  it("returns error for empty string color", async () => {
    const result = await updateAvatarColor("" as any);

    expect(result.error).toBe("Invalid color.");
  });
});
