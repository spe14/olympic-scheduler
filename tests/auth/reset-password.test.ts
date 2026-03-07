import { describe, it, expect, vi, beforeEach } from "vitest";
import { resetPassword } from "@/app/(auth)/actions";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

const mockUpdateUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: { updateUser: mockUpdateUser },
  })),
}));

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/db/schema", () => ({ user: {} }));

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    fd.set(key, value);
  }
  return fd;
}

describe("resetPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    it("redirects to login on success", async () => {
      const { redirect } = await import("next/navigation");
      mockUpdateUser.mockResolvedValue({ error: null });

      const fd = makeFormData({
        password: "newpassword123",
        confirmPassword: "newpassword123",
      });

      await expect(resetPassword(null, fd)).rejects.toThrow("NEXT_REDIRECT");
      expect(redirect).toHaveBeenCalledWith("/login");
    });

    it("returns error when Supabase update fails", async () => {
      mockUpdateUser.mockResolvedValue({
        error: { message: "Session expired" },
      });

      const fd = makeFormData({
        password: "newpassword123",
        confirmPassword: "newpassword123",
      });
      const result = await resetPassword(null, fd);

      expect(result?.error).toBe("Session expired");
    });
  });
});
