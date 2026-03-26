"use client";

import { useState } from "react";
import Link from "next/link";
import { emailSchema } from "@/lib/validations";
import { inputClass } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import * as Sentry from "@sentry/nextjs";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<{
    message?: string;
    error?: string;
    fieldErrors?: { email?: string[] };
  } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const result = emailSchema.safeParse(email);
    if (!result.success) {
      setState({
        fieldErrors: { email: result.error.issues.map((i) => i.message) },
      });
      return;
    }

    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(result.data, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/callback?next=/reset-password`,
    });
    setPending(false);

    if (error) {
      Sentry.captureException(
        new Error(`Password reset email failed: ${error.message}`)
      );
    }

    setState({
      message:
        "If an account exists with this email, you will receive a password reset link. Please check your spam folder if you don't see it.",
    });
  }
  const emailError = email.length > 0 && !emailSchema.safeParse(email).success;

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      {/* Subtle background texture */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#009de5]/10 via-white to-white" />

      <div className="relative w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex items-center gap-2">
            <svg viewBox="0 0 32 32" className="h-8 w-8">
              <defs>
                <linearGradient id="fGold" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#ffe14d" />
                  <stop offset="50%" stopColor="#ffc107" />
                  <stop offset="100%" stopColor="#e5a100" />
                </linearGradient>
                <linearGradient id="fGoldLight" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#fff176" />
                  <stop offset="50%" stopColor="#ffd54f" />
                  <stop offset="100%" stopColor="#ffca28" />
                </linearGradient>
              </defs>
              <circle cx="16" cy="16" r="15" fill="url(#fGold)" />
              <circle cx="16" cy="16" r="13.5" fill="url(#fGoldLight)" />
              <circle
                cx="16"
                cy="16"
                r="11.5"
                fill="url(#fGold)"
                stroke="#e5a100"
                strokeWidth="0.4"
              />
              <circle cx="16" cy="16" r="10.5" fill="url(#fGoldLight)" />
              <text
                x="16"
                y="20.5"
                textAnchor="middle"
                fontFamily="system-ui, sans-serif"
                fontSize="11"
                fontWeight="bold"
                fill="#c8960a"
              >
                28
              </text>
            </svg>
            <span className="font-[family-name:var(--font-pacifico)] text-xl text-[#009de5]">
              collaboly
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[#009de5]">
            Reset Your Password
          </h1>
          <p className="mt-2 text-slate-500">
            Enter your email and we&apos;ll send you a reset link
          </p>
        </div>

        {/* Form card */}
        <div className="rounded-2xl border border-[#009de5]/10 bg-white p-8 shadow-xl shadow-[#009de5]/5 backdrop-blur-sm">
          {/* Success info message */}
          {state?.message && (
            <div className="mb-6 rounded-lg border border-[#009de5]/20 bg-[#009de5]/5 p-3 text-sm text-[#009de5]">
              {state.message}
            </div>
          )}

          {/* Error message */}
          {state?.error && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
              {state.error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-slate-600"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                name="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="jane@example.com"
              />
              {state?.fieldErrors?.email?.map((err) => (
                <p key={err} className="mt-1 text-sm text-red-500">
                  {err}
                </p>
              ))}
              {emailError && (
                <p className="mt-1 text-sm text-slate-400">
                  Please enter a valid email address.
                </p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={!emailSchema.safeParse(email).success || pending}
              className="w-full rounded-lg bg-[#009de5] px-4 py-2.5 font-semibold text-white shadow-lg shadow-[#009de5]/20 transition-all duration-200 hover:bg-[#0088c9] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "Sending..." : "Send Reset Link"}
            </button>
          </form>

          {/* Divider */}
          <div className="mt-6 border-t border-slate-100 pt-6 text-center">
            <p className="text-sm text-slate-500">
              Remember your password?{" "}
              <Link
                href="/login"
                className="font-medium text-[#009de5] transition-colors hover:text-[#0088c9]"
              >
                Log In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
