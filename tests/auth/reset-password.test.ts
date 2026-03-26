import { describe, it, expect, vi, beforeEach } from "vitest";
import { resetPassword } from "@/app/(auth)/actions";
import { makeFormData } from "@/tests/helpers";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

const mockUpdateUser = vi.fn();
const mockSignOut = vi.fn().mockResolvedValue({});
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: { updateUser: mockUpdateUser, signOut: mockSignOut },
  })),
}));

const mockGet = vi.fn();
const mockDelete = vi.fn();
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve({ get: mockGet, delete: mockDelete })),
}));

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/db/schema", () => ({ user: {} }));

describe("resetPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockReturnValue({ name: "password_reset", value: "1" });
  });

  describe("validation", () => {
    it("returns error for short password", async () => {
      const fd = makeFormData({ password: "short", confirmPassword: "short" });
      const result = await resetPassword(null, fd);

      expect(result?.fieldErrors?.password).toBeDefined();
      expect(result?.fieldErrors?.password?.[0]).toContain("at least 8");
    });

    it("returns error for password over 72 characters", async () => {
      const long = "a".repeat(73);
      const fd = makeFormData({ password: long, confirmPassword: long });
      const result = await resetPassword(null, fd);

      expect(result?.fieldErrors?.password).toBeDefined();
      expect(result?.fieldErrors?.password?.[0]).toContain("less than 72");
    });

    it("returns error when passwords do not match", async () => {
      const fd = makeFormData({
        password: "password123",
        confirmPassword: "password456",
      });
      const result = await resetPassword(null, fd);

      expect(result?.fieldErrors?.confirmPassword).toBeDefined();
      expect(result?.fieldErrors?.confirmPassword?.[0]).toContain(
        "do not match"
      );
    });

    it("returns error for empty fields", async () => {
      const fd = makeFormData({ password: "", confirmPassword: "" });
      const result = await resetPassword(null, fd);

      expect(result?.fieldErrors?.password).toBeDefined();
    });

    it("accepts password at exactly 8 characters", async () => {
      mockUpdateUser.mockResolvedValue({ error: null });
      const fd = makeFormData({
        password: "abcd1234",
        confirmPassword: "abcd1234",
      });

      await expect(resetPassword(null, fd)).rejects.toThrow("NEXT_REDIRECT");
    });

    it("accepts password at exactly 72 characters", async () => {
      mockUpdateUser.mockResolvedValue({ error: null });
      const pw = "a".repeat(72);
      const fd = makeFormData({ password: pw, confirmPassword: pw });

      await expect(resetPassword(null, fd)).rejects.toThrow("NEXT_REDIRECT");
    });

    it("does not call Supabase when validation fails", async () => {
      const fd = makeFormData({ password: "short", confirmPassword: "short" });
      await resetPassword(null, fd);

      expect(mockUpdateUser).not.toHaveBeenCalled();
    });
  });

  describe("reset cookie guard", () => {
    it("returns error when password_reset cookie is missing", async () => {
      mockGet.mockReturnValue(undefined);
      const fd = makeFormData({
        password: "newpassword123",
        confirmPassword: "newpassword123",
      });
      const result = await resetPassword(null, fd);

      expect(result?.error).toContain("expired");
      expect(mockUpdateUser).not.toHaveBeenCalled();
    });
  });

  describe("password update", () => {
    it("calls updateUser with new password", async () => {
      mockUpdateUser.mockResolvedValue({ error: null });

      const fd = makeFormData({
        password: "newpassword123",
        confirmPassword: "newpassword123",
      });

      await expect(resetPassword(null, fd)).rejects.toThrow("NEXT_REDIRECT");
      expect(mockUpdateUser).toHaveBeenCalledWith({
        password: "newpassword123",
      });
    });

    it("signs out and redirects to login on success", async () => {
      const { redirect } = await import("next/navigation");
      mockUpdateUser.mockResolvedValue({ error: null });

      const fd = makeFormData({
        password: "newpassword123",
        confirmPassword: "newpassword123",
      });

      await expect(resetPassword(null, fd)).rejects.toThrow("NEXT_REDIRECT");
      expect(mockSignOut).toHaveBeenCalled();
      expect(redirect).toHaveBeenCalledWith("/login");
    });

    it("cleans up all session cookies on success", async () => {
      mockUpdateUser.mockResolvedValue({ error: null });

      const fd = makeFormData({
        password: "newpassword123",
        confirmPassword: "newpassword123",
      });

      await expect(resetPassword(null, fd)).rejects.toThrow("NEXT_REDIRECT");
      expect(mockDelete).toHaveBeenCalledWith("password_reset");
      expect(mockDelete).toHaveBeenCalledWith("session_start_at");
      expect(mockDelete).toHaveBeenCalledWith("last_active_at");
    });

    it("returns generic error when Supabase update fails", async () => {
      mockUpdateUser.mockResolvedValue({
        error: { message: "Session expired" },
      });

      const fd = makeFormData({
        password: "newpassword123",
        confirmPassword: "newpassword123",
      });
      const result = await resetPassword(null, fd);

      expect(result?.error).toBe("Failed to reset password. Please try again.");
    });
  });
});
