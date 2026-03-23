"use client";

import { login } from "../actions";
import { useActionState, useState } from "react";
import Link from "next/link";
import PasswordInput from "@/components/password-input";
import ErrorAlert from "@/components/error-alert";
import { loginSchema } from "@/lib/validations";
import { inputClass } from "@/lib/constants";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, null);
  const [email, setEmail] = useState(state?.values?.email ?? "");
  const [password, setPassword] = useState(state?.values?.password ?? "");

  const isValid = loginSchema.safeParse({ email, password }).success;

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
            Welcome Back
          </h1>
          <p className="mt-2 text-slate-500">
            Sign in to continue planning your trip
          </p>
        </div>

        {/* Form card */}
        <div className="rounded-2xl border border-[#009de5]/10 bg-white p-8 shadow-xl shadow-[#009de5]/5 backdrop-blur-sm">
          {/* General error */}
          <ErrorAlert message={state?.error} className="mb-6" />

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
              {state?.fieldErrors?.email && (
                <p className="mt-1 text-sm text-red-500">
                  {state.fieldErrors.email[0]}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-slate-600"
              >
                Password
              </label>
              <PasswordInput
                id="password"
                name="password"
                value={password}
                onChange={setPassword}
                className={inputClass}
                placeholder="Your password"
              />
              {state?.fieldErrors?.password && (
                <p className="mt-1 text-sm text-red-500">
                  {state.fieldErrors.password[0]}
                </p>
              )}
            </div>

            <div className="flex justify-end">
              <Link
                href="/forgot-password"
                className="text-sm font-medium text-[#009de5] transition-colors hover:text-[#0088c9]"
              >
                Forgot Password?
              </Link>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={!isValid || pending}
              className="w-full rounded-lg bg-[#009de5] px-4 py-2.5 font-semibold text-white shadow-lg shadow-[#009de5]/20 transition-all duration-200 hover:bg-[#0088c9] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "Logging in..." : "Log In"}
            </button>
          </form>

          {/* Divider */}
          <div className="mt-6 border-t border-slate-100 pt-6 text-center">
            <p className="text-sm text-slate-500">
              Don&apos;t have an account?{" "}
              <Link
                href="/signup"
                className="font-medium text-[#009de5] transition-colors hover:text-[#0088c9]"
              >
                Create One
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
