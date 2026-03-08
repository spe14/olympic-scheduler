"use client";

import { resetPassword } from "../actions";
import { useActionState, useState } from "react";
import PasswordInput from "@/components/password-input";
import { resetPasswordSchema, passwordSchema } from "@/lib/validations";
import { inputClass } from "@/lib/constants";

export default function ResetPasswordPage() {
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
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-yellow-500">
              <span className="text-sm font-bold text-white">28</span>
            </div>
            <span className="text-sm font-medium uppercase tracking-widest text-[#009de5]/60">
              LA 2028 Scheduler
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
          {state?.error && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
              {state.error}
            </div>
          )}

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
