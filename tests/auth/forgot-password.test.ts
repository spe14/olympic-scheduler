import { describe, it, expect, vi, beforeEach } from "vitest";
import { forgotPassword } from "@/app/(auth)/actions";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

const mockResetPasswordForEmail = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: { resetPasswordForEmail: mockResetPasswordForEmail },
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

describe("forgotPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("validation", () => {
    it("returns field error for empty email", async () => {
      const fd = makeFormData({ email: "" });
      const result = await forgotPassword(null, fd);

      expect(result?.fieldErrors?.email).toBeDefined();
      expect(result?.fieldErrors?.email?.[0]).toBe("Email must be valid.");
    });

    it("returns field error for invalid email", async () => {
      const fd = makeFormData({ email: "not-an-email" });
      const result = await forgotPassword(null, fd);

      expect(result?.fieldErrors?.email).toBeDefined();
    });

    it("preserves submitted email on validation error", async () => {
      const fd = makeFormData({ email: "bad" });
      const result = await forgotPassword(null, fd);

      expect(result?.values?.email).toBe("bad");
    });
  });

  describe("password reset request", () => {
    it("calls resetPasswordForEmail with valid email", async () => {
      mockResetPasswordForEmail.mockResolvedValue({ error: null });

      const fd = makeFormData({ email: "jane@example.com" });
      await forgotPassword(null, fd);

      expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
        "jane@example.com",
        expect.objectContaining({
          redirectTo: expect.stringContaining("/api/auth/callback"),
        })
      );
    });

    it("returns success message on valid email", async () => {
      mockResetPasswordForEmail.mockResolvedValue({ error: null });

      const fd = makeFormData({ email: "jane@example.com" });
      const result = await forgotPassword(null, fd);

      expect(result?.error).toContain("password reset link");
    });

    it("returns error when Supabase fails", async () => {
      mockResetPasswordForEmail.mockResolvedValue({
        error: { message: "Rate limit exceeded" },
      });

      const fd = makeFormData({ email: "jane@example.com" });
      const result = await forgotPassword(null, fd);

      expect(result?.error).toBe("Rate limit exceeded");
      expect(result?.values?.email).toBe("jane@example.com");
    });

    it("does not call Supabase when email is invalid", async () => {
      const fd = makeFormData({ email: "bad" });
      await forgotPassword(null, fd);

      expect(mockResetPasswordForEmail).not.toHaveBeenCalled();
    });
  });
});
