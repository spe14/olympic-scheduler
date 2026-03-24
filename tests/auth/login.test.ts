import { describe, it, expect, vi, beforeEach } from "vitest";
import { login } from "@/app/(auth)/actions";
import { makeFormData } from "@/tests/helpers";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

// Mock Supabase client
const mockSignInWithPassword = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: { signInWithPassword: mockSignInWithPassword },
  })),
}));

// Mock DB – login now verifies the user has a local DB record after auth
const mockDbLimit = vi.fn();
const mockDbWhere = vi.fn(() => ({ limit: mockDbLimit }));
const mockDbFrom = vi.fn(() => ({ where: mockDbWhere }));
const mockDbSelect = vi.fn(() => ({ from: mockDbFrom }));
vi.mock("@/lib/db", () => ({
  db: {
    select: (...args: unknown[]) => mockDbSelect(...args),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  user: { id: "id", authId: "authId" },
}));

const validFields = {
  email: "jane@example.com",
  password: "password123",
};

describe("login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("validation", () => {
    it("returns field error for empty email", async () => {
      const fd = makeFormData({ email: "", password: "password123" });
      const result = await login(null, fd);

      expect(result?.fieldErrors?.email).toBeDefined();
      expect(result?.fieldErrors?.email?.[0]).toBe("Email must be valid.");
    });

    it("returns field error for invalid email", async () => {
      const fd = makeFormData({ email: "not-valid", password: "password123" });
      const result = await login(null, fd);

      expect(result?.fieldErrors?.email).toBeDefined();
    });

    it("returns field error for empty password", async () => {
      const fd = makeFormData({ email: "jane@example.com", password: "" });
      const result = await login(null, fd);

      expect(result?.fieldErrors?.password).toBeDefined();
      expect(result?.fieldErrors?.password?.[0]).toContain("required");
    });

    it("returns errors for both empty fields", async () => {
      const fd = makeFormData({ email: "", password: "" });
      const result = await login(null, fd);

      expect(result?.fieldErrors?.email).toBeDefined();
      expect(result?.fieldErrors?.password).toBeDefined();
    });

    it("preserves submitted values on validation error (without password)", async () => {
      const fd = makeFormData({ email: "bad", password: "" });
      const result = await login(null, fd);

      expect(result?.values?.email).toBe("bad");
      expect(result?.values?.password).toBeUndefined();
    });
  });

  describe("authentication", () => {
    it("returns error for invalid credentials", async () => {
      mockSignInWithPassword.mockResolvedValue({
        error: { message: "Invalid login credentials" },
      });

      const fd = makeFormData(validFields);
      const result = await login(null, fd);

      expect(result?.error).toBe("Invalid email or password.");
      expect(result?.values?.email).toBe(validFields.email);
    });

    it("redirects on successful login", async () => {
      mockSignInWithPassword.mockResolvedValue({
        error: null,
        data: { user: { id: "auth-123" } },
      });
      mockDbLimit.mockResolvedValue([{ id: 1 }]);

      const fd = makeFormData(validFields);

      await expect(login(null, fd)).rejects.toThrow("NEXT_REDIRECT");
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: validFields.email,
        password: validFields.password,
      });
    });

    it("does not call supabase when validation fails", async () => {
      const fd = makeFormData({ email: "", password: "" });
      await login(null, fd);

      expect(mockSignInWithPassword).not.toHaveBeenCalled();
    });
  });
});
