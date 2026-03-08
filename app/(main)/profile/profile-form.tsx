"use client";

import { useActionState, useState, useTransition } from "react";
import {
  updateProfileField,
  updatePassword,
  updateAvatarColor,
} from "./actions";
import PasswordInput from "@/components/password-input";
import {
  profileFieldSchemas,
  updatePasswordSchema,
  passwordSchema,
} from "@/lib/validations";
import { avatarColors, type AvatarColor } from "@/lib/constants";

type ProfileFormProps = {
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  avatarColor: AvatarColor;
};

export default function ProfileForm({
  email,
  username,
  firstName,
  lastName,
  avatarColor,
}: ProfileFormProps) {
  const inputClass =
    "w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-slate-900 placeholder-slate-400 transition-colors focus:border-[#009de5]/40 focus:outline-none focus:ring-2 focus:ring-[#009de5]/20";
  const disabledClass =
    "w-full rounded-lg border border-slate-200 bg-slate-100 px-3.5 py-2.5 text-slate-500 cursor-not-allowed";

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-stretch">
      {/* Profile info section */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
        <h2 className="mb-5 text-lg font-semibold text-slate-900">
          Personal Information
        </h2>

        <div className="space-y-4">
          {/* Email (always read-only) */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-600">
              Email
            </label>
            <input
              type="email"
              value={email}
              disabled
              className={disabledClass}
            />
          </div>

          <EditableField
            label="Username"
            field="username"
            initialValue={username}
            inputClass={inputClass}
            disabledClass={disabledClass}
            validate={(v) => validateField("username", v)}
          />

          <EditableField
            label="First Name"
            field="firstName"
            initialValue={firstName}
            inputClass={inputClass}
            disabledClass={disabledClass}
            validate={(v) => validateField("firstName", v)}
          />

          <EditableField
            label="Last Name"
            field="lastName"
            initialValue={lastName}
            inputClass={inputClass}
            disabledClass={disabledClass}
            validate={(v) => validateField("lastName", v)}
          />
        </div>
      </div>

      <div className="space-y-8">
        <AvatarColorPicker
          initialColor={avatarColor}
          firstName={firstName}
          lastName={lastName}
        />
        <PasswordSection inputClass={inputClass} />
      </div>
    </div>
  );
}

function validateField(
  field: keyof typeof profileFieldSchemas,
  value: string
): string[] {
  if (value.length === 0) return [];
  const result = profileFieldSchemas[field].safeParse(value);
  if (!result.success) {
    return result.error.issues.map((i) => i.message);
  }
  return [];
}

function EditableField({
  label,
  field,
  initialValue,
  inputClass,
  disabledClass,
  validate,
}: {
  label: string;
  field: string;
  initialValue: string;
  inputClass: string;
  disabledClass: string;
  validate?: (value: string) => string[];
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialValue);
  const [displayValue, setDisplayValue] = useState(initialValue);
  const [state, formAction, pending] = useActionState(updateProfileField, null);
  const [prevState, setPrevState] = useState(state);

  if (prevState !== state) {
    setPrevState(state);
    if (state?.success && state.updatedValue) {
      setDisplayValue(state.updatedValue);
      setEditing(false);
    }
  }

  const hints = validate ? validate(value) : [];
  const isEmpty = value.trim().length === 0;

  function handleCancel() {
    setValue(displayValue);
    setEditing(false);
  }

  if (!editing) {
    return (
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-sm font-medium text-slate-600">{label}</label>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-sm font-medium text-[#009de5] hover:text-[#0088c9]"
          >
            Update
          </button>
        </div>
        <input
          type="text"
          value={displayValue}
          disabled
          className={disabledClass}
        />
      </div>
    );
  }

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-600">
        {label}
      </label>
      <form action={formAction}>
        <input type="hidden" name="field" value={field} />
        <input type="hidden" name="value" value={value} />
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className={inputClass}
          autoFocus
        />
        {hints.map((hint) => (
          <p key={hint} className="mt-1 text-sm text-slate-400">
            {hint}
          </p>
        ))}
        {state?.error && (
          <p className="mt-1 text-sm text-red-500">{state.error}</p>
        )}
        <div className="mt-2 flex gap-2">
          <button
            type="submit"
            disabled={pending || hints.length > 0 || isEmpty}
            className="rounded-lg bg-[#009de5] px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-[#0088c9] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={pending}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-all hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function AvatarColorPicker({
  initialColor,
  firstName,
  lastName,
}: {
  initialColor: AvatarColor;
  firstName: string;
  lastName: string;
}) {
  const [selected, setSelected] = useState<AvatarColor>(initialColor);
  const [isPending, startTransition] = useTransition();

  function handleSelect(color: AvatarColor) {
    setSelected(color);
    startTransition(async () => {
      await updateAvatarColor(color);
    });
  }

  const colors: AvatarColor[] = ["blue", "yellow", "pink", "green"];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
      <h2 className="mb-5 text-lg font-semibold text-slate-900">
        Avatar Color
      </h2>

      <div className="flex items-center gap-6">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-full text-lg font-semibold"
          style={{
            backgroundColor: avatarColors[selected].bg,
            color: avatarColors[selected].text,
          }}
        >
          {firstName[0].toUpperCase()}
          {lastName[0].toUpperCase()}
        </div>

        <div className="flex gap-3">
          {colors.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => handleSelect(color)}
              disabled={isPending}
              className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-semibold transition-all ${
                selected === color ? "ring-2 ring-offset-2" : "hover:scale-110"
              } disabled:opacity-50`}
              style={{
                backgroundColor: avatarColors[color].bg,
                color: avatarColors[color].text,
                ...(selected === color
                  ? ({
                      "--tw-ring-color": avatarColors[color].ring,
                    } as React.CSSProperties)
                  : {}),
              }}
              title={avatarColors[color].label}
            >
              {firstName[0].toUpperCase()}
              {lastName[0].toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function PasswordSection({ inputClass }: { inputClass: string }) {
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

      {passwordState?.error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {passwordState.error}
        </div>
      )}
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
