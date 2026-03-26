import { describe, it, expect, vi, beforeEach } from "vitest";
import { signUp } from "@/app/(auth)/actions";
import { makeFormData } from "@/tests/helpers";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

// Mock Supabase client
const mockSignUp = vi.fn();
const mockSignOut = vi.fn().mockResolvedValue({ error: null });
const mockSignInWithPassword = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: {
      signUp: mockSignUp,
      signOut: mockSignOut,
      signInWithPassword: mockSignInWithPassword,
    },
  })),
}));

// Mock DB
const mockLimit = vi.fn();
const mockWhere = vi.fn(() => ({ limit: mockLimit }));
const mockFrom = vi.fn(() => ({ where: mockWhere }));
const mockSelect = vi.fn(() => ({ from: mockFrom }));
const mockOnConflictDoUpdate = vi.fn();
const mockValues = vi.fn(() => ({
  onConflictDoUpdate: mockOnConflictDoUpdate,
}));
const mockInsert = vi.fn(() => ({ values: mockValues }));

vi.mock("@/lib/db", () => ({
  db: {
    select: () => mockSelect(),
    insert: () => mockInsert(),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  user: { id: "id", username: "username", authId: "auth_id" },
}));

const validFields = {
  email: "jane@example.com",
  password: "password123",
  username: "janedoe",
  firstName: "Jane",
  lastName: "Doe",
};

describe("signUp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLimit.mockResolvedValue([]);
  });

  describe("validation", () => {
    it("returns field errors for empty fields", async () => {
      const fd = makeFormData({
        email: "",
        password: "",
        username: "",
        firstName: "",
        lastName: "",
      });

      const result = await signUp(null, fd);

      expect(result?.fieldErrors).toBeDefined();
      expect(result?.fieldErrors?.email).toBeDefined();
      expect(result?.fieldErrors?.password).toBeDefined();
      expect(result?.fieldErrors?.username).toBeDefined();
      expect(result?.fieldErrors?.firstName).toBeDefined();
      expect(result?.fieldErrors?.lastName).toBeDefined();
    });

    it("returns error for invalid email", async () => {
      const fd = makeFormData({ ...validFields, email: "not-an-email" });
      const result = await signUp(null, fd);

      expect(result?.fieldErrors?.email).toBeDefined();
      expect(result?.fieldErrors?.email?.[0]).toBe("Email must be valid.");
    });

    it("returns error for short password", async () => {
      const fd = makeFormData({ ...validFields, password: "short" });
      const result = await signUp(null, fd);

      expect(result?.fieldErrors?.password).toBeDefined();
      expect(result?.fieldErrors?.password?.[0]).toContain("at least 8");
    });

    it("returns error for password over 72 characters", async () => {
      const fd = makeFormData({ ...validFields, password: "a".repeat(73) });
      const result = await signUp(null, fd);

      expect(result?.fieldErrors?.password).toBeDefined();
      expect(result?.fieldErrors?.password?.[0]).toContain("less than 72");
    });

    it("returns error for short username", async () => {
      const fd = makeFormData({ ...validFields, username: "ab" });
      const result = await signUp(null, fd);

      expect(result?.fieldErrors?.username).toBeDefined();
      expect(result?.fieldErrors?.username?.[0]).toContain("at least 3");
    });

    it("returns error for username with invalid characters", async () => {
      const fd = makeFormData({ ...validFields, username: "jane doe!" });
      const result = await signUp(null, fd);

      expect(result?.fieldErrors?.username).toBeDefined();
      expect(result?.fieldErrors?.username?.[0]).toContain("letters, numbers");
    });

    it("returns multiple errors for username that is both too short and has invalid characters", async () => {
      const fd = makeFormData({ ...validFields, username: "@!" });
      const result = await signUp(null, fd);

      expect(result?.fieldErrors?.username).toBeDefined();
      expect(result?.fieldErrors?.username?.length).toBeGreaterThanOrEqual(2);
    });

    it("accepts username at exactly 30 characters", async () => {
      const fd = makeFormData({ ...validFields, username: "a".repeat(30) });
      mockSignUp.mockResolvedValue({
        data: { user: { id: "auth-123" } },
        error: null,
      });
      mockOnConflictDoUpdate.mockResolvedValue(undefined);

      await expect(signUp(null, fd)).rejects.toThrow("NEXT_REDIRECT");
    });

    it("returns error for username over 30 characters", async () => {
      const fd = makeFormData({ ...validFields, username: "a".repeat(31) });
      const result = await signUp(null, fd);

      expect(result?.fieldErrors?.username).toBeDefined();
      expect(result?.fieldErrors?.username?.[0]).toContain("less than 30");
    });

    it("accepts username with hyphens and underscores", async () => {
      const fd = makeFormData({ ...validFields, username: "jane_doe-123" });
      mockSignUp.mockResolvedValue({
        data: { user: { id: "auth-123" } },
        error: null,
      });
      mockOnConflictDoUpdate.mockResolvedValue(undefined);

      await expect(signUp(null, fd)).rejects.toThrow("NEXT_REDIRECT");
    });

    it("accepts password at exactly 8 characters", async () => {
      const fd = makeFormData({ ...validFields, password: "abcd1234" });
      mockSignUp.mockResolvedValue({
        data: { user: { id: "auth-123" } },
        error: null,
      });
      mockOnConflictDoUpdate.mockResolvedValue(undefined);

      await expect(signUp(null, fd)).rejects.toThrow("NEXT_REDIRECT");
    });

    it("accepts password at exactly 72 characters", async () => {
      const fd = makeFormData({ ...validFields, password: "a".repeat(72) });
      mockSignUp.mockResolvedValue({
        data: { user: { id: "auth-123" } },
        error: null,
      });
      mockOnConflictDoUpdate.mockResolvedValue(undefined);

      await expect(signUp(null, fd)).rejects.toThrow("NEXT_REDIRECT");
    });

    it("returns error for first name over 50 characters", async () => {
      const fd = makeFormData({ ...validFields, firstName: "a".repeat(51) });
      const result = await signUp(null, fd);

      expect(result?.fieldErrors?.firstName).toBeDefined();
      expect(result?.fieldErrors?.firstName?.[0]).toContain("less than 50");
    });

    it("returns error for last name over 50 characters", async () => {
      const fd = makeFormData({ ...validFields, lastName: "a".repeat(51) });
      const result = await signUp(null, fd);

      expect(result?.fieldErrors?.lastName).toBeDefined();
      expect(result?.fieldErrors?.lastName?.[0]).toContain("less than 50");
    });

    it("preserves submitted values on validation error", async () => {
      const fd = makeFormData({ ...validFields, password: "short" });
      const result = await signUp(null, fd);

      expect(result?.values?.email).toBe(validFields.email);
      expect(result?.values?.username).toBe(validFields.username);
      expect(result?.values?.firstName).toBe(validFields.firstName);
    });
  });

  describe("username availability", () => {
    it("returns error when username is already taken", async () => {
      mockLimit.mockResolvedValue([{ id: 1 }]);

      const fd = makeFormData(validFields);
      const result = await signUp(null, fd);

      expect(result?.error).toContain("username is already taken");
      expect(mockSignUp).not.toHaveBeenCalled();
    });

    it("preserves submitted values when username is taken", async () => {
      mockLimit.mockResolvedValue([{ id: 1 }]);

      const fd = makeFormData(validFields);
      const result = await signUp(null, fd);

      expect(result?.values?.email).toBe(validFields.email);
      expect(result?.values?.username).toBe(validFields.username);
      expect(result?.values?.firstName).toBe(validFields.firstName);
      expect(result?.values?.lastName).toBe(validFields.lastName);
    });
  });

  describe("supabase auth", () => {
    it("returns friendly message when email registered and sign-in fails", async () => {
      mockSignUp.mockResolvedValue({
        data: { user: null },
        error: { message: "User already registered" },
      });
      mockSignInWithPassword.mockResolvedValue({
        data: { user: null },
        error: { message: "Invalid login credentials" },
      });

      const fd = makeFormData(validFields);
      const result = await signUp(null, fd);

      expect(result?.error).toContain("already associated with an account");
      expect(result?.error).toContain("Please log in");
    });

    it("returns friendly message when email registered and DB user exists", async () => {
      mockSignUp.mockResolvedValue({
        data: { user: null },
        error: { message: "User already registered" },
      });
      mockSignInWithPassword.mockResolvedValue({
        data: { user: { id: "auth-123" } },
        error: null,
      });
      mockLimit.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 1 }]);

      const fd = makeFormData(validFields);
      const result = await signUp(null, fd);

      expect(result?.error).toContain("already associated with an account");
      expect(mockSignOut).toHaveBeenCalled();
    });

    it("recovers orphaned auth user by creating DB row", async () => {
      mockSignUp.mockResolvedValue({
        data: { user: null },
        error: { message: "User already registered" },
      });
      mockSignInWithPassword.mockResolvedValue({
        data: { user: { id: "auth-123" } },
        error: null,
      });
      // First call: username check (no match), second call: DB user check (no match)
      mockLimit.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      mockOnConflictDoUpdate.mockResolvedValue(undefined);

      const fd = makeFormData(validFields);

      await expect(signUp(null, fd)).rejects.toThrow("NEXT_REDIRECT");
      expect(mockInsert).toHaveBeenCalled();
    });

    it("returns username-taken when orphaned user recovery insert fails with username constraint", async () => {
      mockSignUp.mockResolvedValue({
        data: { user: null },
        error: { message: "User already registered" },
      });
      mockSignInWithPassword.mockResolvedValue({
        data: { user: { id: "auth-orphan" } },
        error: null,
      });
      // First call: username check (no match), second call: DB user check (no match)
      mockLimit.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      // Recovery insert fails with username constraint
      mockValues.mockRejectedValueOnce(
        new Error(
          'duplicate key value violates unique constraint "users_username_unique"'
        )
      );

      const fd = makeFormData(validFields);
      const result = await signUp(null, fd);

      expect(result?.error).toContain("username is already taken");
      expect(mockSignOut).toHaveBeenCalled();
    });

    it("returns generic error when orphaned user recovery insert fails with non-username error", async () => {
      mockSignUp.mockResolvedValue({
        data: { user: null },
        error: { message: "User already registered" },
      });
      mockSignInWithPassword.mockResolvedValue({
        data: { user: { id: "auth-orphan" } },
        error: null,
      });
      mockLimit.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      // Recovery insert fails with a generic error
      mockValues.mockRejectedValueOnce(new Error("connection timeout"));

      const fd = makeFormData(validFields);
      const result = await signUp(null, fd);

      expect(result?.error).toContain("Sign up failed");
      expect(mockSignOut).toHaveBeenCalled();
    });

    it("returns generic error for other auth errors", async () => {
      mockSignUp.mockResolvedValue({
        data: { user: null },
        error: { message: "Rate limit exceeded" },
      });

      const fd = makeFormData(validFields);
      const result = await signUp(null, fd);

      expect(result?.error).toBe("Sign up failed. Please try again.");
    });

    it("returns error when signUp succeeds but no user is returned", async () => {
      mockSignUp.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const fd = makeFormData(validFields);
      const result = await signUp(null, fd);

      expect(result?.error).toContain("Sign up failed");
    });
  });

  describe("database insert", () => {
    it("redirects on successful signup", async () => {
      mockSignUp.mockResolvedValue({
        data: { user: { id: "auth-123" } },
        error: null,
      });
      mockOnConflictDoUpdate.mockResolvedValue(undefined);

      const fd = makeFormData(validFields);

      await expect(signUp(null, fd)).rejects.toThrow("NEXT_REDIRECT");
      expect(mockInsert).toHaveBeenCalled();
    });

    it("returns generic error and signs out when db insert fails", async () => {
      mockSignUp.mockResolvedValue({
        data: { user: { id: "auth-123" } },
        error: null,
      });
      mockOnConflictDoUpdate.mockRejectedValue(new Error("connection error"));

      const fd = makeFormData(validFields);
      const result = await signUp(null, fd);

      expect(result?.error).toContain("Sign up failed");
      expect(mockSignOut).toHaveBeenCalled();
    });

    it("returns username taken when db insert fails with username constraint", async () => {
      mockSignUp.mockResolvedValue({
        data: { user: { id: "auth-123" } },
        error: null,
      });
      mockOnConflictDoUpdate.mockRejectedValue(
        new Error(
          'duplicate key value violates unique constraint "users_username_unique"'
        )
      );

      const fd = makeFormData(validFields);
      const result = await signUp(null, fd);

      expect(result?.error).toContain("username is already taken");
      expect(mockSignOut).toHaveBeenCalled();
    });
  });
});
