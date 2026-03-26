"use client";

import { login } from "@/app/(auth)/actions";
import { useActionState, useState } from "react";
import Link from "next/link";
import PasswordInput from "@/components/password-input";
import ErrorAlert from "@/components/error-alert";
import { loginSchema, emailSchema } from "@/lib/validations";
import { inputClass } from "@/lib/constants";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, null);
  const [email, setEmail] = useState(state?.values?.email ?? "");
  const [password, setPassword] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);

  const isValid = loginSchema.safeParse({ email, password }).success;
  const emailError =
    emailTouched && email.length > 0 && !emailSchema.safeParse(email).success;

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
                <linearGradient id="lGold" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#ffe14d" />
                  <stop offset="50%" stopColor="#ffc107" />
                  <stop offset="100%" stopColor="#e5a100" />
                </linearGradient>
                <linearGradient id="lGoldLight" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#fff176" />
                  <stop offset="50%" stopColor="#ffd54f" />
                  <stop offset="100%" stopColor="#ffca28" />
                </linearGradient>
              </defs>
              <circle cx="16" cy="16" r="15" fill="url(#lGold)" />
              <circle cx="16" cy="16" r="13.5" fill="url(#lGoldLight)" />
              <circle
                cx="16"
                cy="16"
                r="11.5"
                fill="url(#lGold)"
                stroke="#e5a100"
                strokeWidth="0.4"
              />
              <circle cx="16" cy="16" r="10.5" fill="url(#lGoldLight)" />
              <path
                d="M10,16 Q11.5,11 16,10 Q12.5,12.5 12,16"
                fill="#e5a100"
                opacity="0.5"
              />
              <path
                d="M10.5,18 Q12,13 16,12 Q13,14.5 12.5,18"
                fill="#e5a100"
                opacity="0.4"
              />
              <path
                d="M22,16 Q20.5,11 16,10 Q19.5,12.5 20,16"
                fill="#e5a100"
                opacity="0.5"
              />
              <path
                d="M21.5,18 Q20,13 16,12 Q19,14.5 19.5,18"
                fill="#e5a100"
                opacity="0.4"
              />
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
                onBlur={() => setEmailTouched(true)}
                className={inputClass}
                placeholder="jane@example.com"
              />
              {emailError && (
                <p className="mt-1 text-xs text-slate-400">
                  Please enter a valid email address.
                </p>
              )}
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
