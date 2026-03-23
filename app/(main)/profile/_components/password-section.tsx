"use client";

import { useActionState, useState } from "react";
import { updatePassword } from "../actions";
import PasswordInput from "@/components/password-input";
import ErrorAlert from "@/components/error-alert";
import { updatePasswordSchema, passwordSchema } from "@/lib/validations";
import { inputClass } from "@/lib/constants";

export default function PasswordSection() {
  const [passwordState, passwordAction, passwordPending] = useActionState(
    updatePassword,
    null
  );
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const passwordResult = passwordSchema.safeParse(newPassword);
  const passwordHints =
    newPassword.length > 0 && !passwordResult.success
      ? passwordResult.error.issues.map((i) => i.message)
      : [];
  const confirmResult = updatePasswordSchema.safeParse({
    currentPassword,
    newPassword,
    confirmPassword,
  });
  const confirmHints =
    confirmPassword.length > 0 && !confirmResult.success
      ? confirmResult.error.issues
          .filter((i) => i.path.includes("confirmPassword"))
          .map((i) => i.message)
      : [];
  const isValid = updatePasswordSchema.safeParse({
    currentPassword,
    newPassword,
    confirmPassword,
  }).success;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
      <h2 className="mb-5 text-lg font-semibold text-slate-900">
        Change Password
      </h2>

      <ErrorAlert message={passwordState?.error} />
      {passwordState?.success && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-600">
          Password updated successfully.
        </div>
      )}

      <form action={passwordAction} className="space-y-4">
        <div>
          <label
            htmlFor="currentPassword"
            className="mb-1.5 block text-sm font-medium text-slate-600"
          >
            Current Password
          </label>
          <PasswordInput
            id="currentPassword"
            name="currentPassword"
            value={currentPassword}
            onChange={setCurrentPassword}
            className={inputClass}
            errors={passwordState?.fieldErrors?.currentPassword}
          />
        </div>

        <div>
          <label
            htmlFor="newPassword"
            className="mb-1.5 block text-sm font-medium text-slate-600"
          >
            New Password
          </label>
          <PasswordInput
            id="newPassword"
            name="newPassword"
            value={newPassword}
            onChange={setNewPassword}
            placeholder="At least 8 characters"
            className={inputClass}
            errors={passwordState?.fieldErrors?.newPassword}
          />
          {passwordHints.map((hint) => (
            <p key={hint} className="mt-1 text-sm text-slate-400">
              {hint}
            </p>
          ))}
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="mb-1.5 block text-sm font-medium text-slate-600"
          >
            Confirm New Password
          </label>
          <PasswordInput
            id="confirmPassword"
            name="confirmPassword"
            value={confirmPassword}
            onChange={setConfirmPassword}
            className={inputClass}
            errors={passwordState?.fieldErrors?.confirmPassword}
          />
          {confirmHints.map((hint) => (
            <p key={hint} className="mt-1 text-sm text-slate-400">
              {hint}
            </p>
          ))}
        </div>

        <button
          type="submit"
          disabled={!isValid || passwordPending}
          className="w-full rounded-lg bg-[#009de5] px-4 py-2.5 font-semibold text-white shadow-lg shadow-[#009de5]/20 transition-all duration-200 hover:bg-[#0088c9] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {passwordPending ? "Updating..." : "Update Password"}
        </button>
      </form>
    </div>
  );
}
