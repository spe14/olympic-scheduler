"use client";

import { forgotPassword } from "../actions";
import { useActionState, useState } from "react";
import Link from "next/link";
import { emailSchema } from "@/lib/validations";
import { inputClass } from "@/lib/constants";

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(forgotPassword, null);
  const [email, setEmail] = useState(state?.values?.email ?? "");
  const emailResult = emailSchema.safeParse(email);
  const emailHint =
    email.length > 0 && !emailResult.success
      ? emailResult.error.issues[0].message
      : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      {/* Subtle background texture */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#009de5]/10 via-white to-white" />

      <div className="relative w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-yellow-500">
              <span className="text-sm font-bold text-white">28</span>
            </div>
            <span className="text-sm font-medium uppercase tracking-widest text-[#009de5]/60">
              LA 2028 Scheduler
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
          {/* General message */}
          {state?.error && (
            <div className="mb-6 rounded-lg border border-[#009de5]/20 bg-[#009de5]/5 p-3 text-sm text-[#009de5]">
              {state.error}
            </div>
          )}

          <form action={formAction} className="space-y-5">
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
              {emailHint && (
                <p className="mt-1 text-sm text-slate-400">{emailHint}</p>
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
