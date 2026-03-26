"use client";

import { resetPassword } from "@/app/(auth)/actions";
import { useActionState, useState } from "react";
import PasswordInput from "@/components/password-input";
import ErrorAlert from "@/components/error-alert";
import { resetPasswordSchema, passwordSchema } from "@/lib/validations";
import { inputClass } from "@/lib/constants";

export default function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(resetPassword, null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const passwordResult = passwordSchema.safeParse(password);
  const passwordHints =
    password.length > 0 && !passwordResult.success
      ? passwordResult.error.issues.map((i) => i.message)
      : [];
  const confirmResult = resetPasswordSchema.safeParse({
    password,
    confirmPassword,
  });
  const confirmHint =
    confirmPassword.length > 0 && !confirmResult.success
      ? confirmResult.error.issues
          .filter((i) => i.path.includes("confirmPassword"))
          .map((i) => i.message)
      : [];
  const isValid = resetPasswordSchema.safeParse({
    password,
    confirmPassword,
  }).success;

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
                <linearGradient id="rGold" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#ffe14d" />
                  <stop offset="50%" stopColor="#ffc107" />
                  <stop offset="100%" stopColor="#e5a100" />
                </linearGradient>
                <linearGradient id="rGoldLight" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#fff176" />
                  <stop offset="50%" stopColor="#ffd54f" />
                  <stop offset="100%" stopColor="#ffca28" />
                </linearGradient>
              </defs>
              <circle cx="16" cy="16" r="15" fill="url(#rGold)" />
              <circle cx="16" cy="16" r="13.5" fill="url(#rGoldLight)" />
              <circle
                cx="16"
                cy="16"
                r="11.5"
                fill="url(#rGold)"
                stroke="#e5a100"
                strokeWidth="0.4"
              />
              <circle cx="16" cy="16" r="10.5" fill="url(#rGoldLight)" />
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
            Set New Password
          </h1>
          <p className="mt-2 text-slate-500">Enter your new password below</p>
        </div>

        {/* Form card */}
        <div className="rounded-2xl border border-[#009de5]/10 bg-white p-8 shadow-xl shadow-[#009de5]/5 backdrop-blur-sm">
          {/* General error */}
          <ErrorAlert message={state?.error} className="mb-6" />

          <form action={formAction} className="space-y-5">
            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-slate-600"
              >
                New Password
              </label>
              <PasswordInput
                id="password"
                name="password"
                value={password}
                onChange={setPassword}
                className={inputClass}
                placeholder="At least 8 characters"
              />
              {state?.fieldErrors?.password?.map((err) => (
                <p key={err} className="mt-1 text-sm text-red-500">
                  {err}
                </p>
              ))}
              {passwordHints.map((hint) => (
                <p key={hint} className="mt-1 text-sm text-slate-400">
                  {hint}
                </p>
              ))}
            </div>

            {/* Confirm Password */}
            <div>
              <label
                htmlFor="confirmPassword"
                className="mb-1.5 block text-sm font-medium text-slate-600"
              >
                Confirm Password
              </label>
              <PasswordInput
                id="confirmPassword"
                name="confirmPassword"
                value={confirmPassword}
                onChange={setConfirmPassword}
                className={inputClass}
                placeholder="Re-enter your password"
              />
              {state?.fieldErrors?.confirmPassword?.map((err) => (
                <p key={err} className="mt-1 text-sm text-red-500">
                  {err}
                </p>
              ))}
              {confirmHint.map((hint) => (
                <p key={hint} className="mt-1 text-sm text-slate-400">
                  {hint}
                </p>
              ))}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={!isValid || pending}
              className="w-full rounded-lg bg-[#009de5] px-4 py-2.5 font-semibold text-white shadow-lg shadow-[#009de5]/20 transition-all duration-200 hover:bg-[#0088c9] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "Updating..." : "Update Password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
