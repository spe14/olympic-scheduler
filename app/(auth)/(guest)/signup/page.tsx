"use client";

import { signUp } from "@/app/(auth)/actions";
import { useActionState, useState } from "react";
import Link from "next/link";
import PasswordInput from "@/components/password-input";
import PrivacyPolicyModal from "@/components/privacy-policy-modal";
import ErrorAlert from "@/components/error-alert";
import {
  signUpSchema,
  usernameSchema,
  emailSchema,
  passwordSchema,
} from "@/lib/validations";
import { inputClass, avatarColors, type AvatarColor } from "@/lib/constants";

export default function SignUpPage() {
  const [state, formAction, pending] = useActionState(signUp, null);
  const [firstName, setFirstName] = useState(state?.values?.firstName ?? "");
  const [lastName, setLastName] = useState(state?.values?.lastName ?? "");
  const [username, setUsername] = useState(state?.values?.username ?? "");
  const [email, setEmail] = useState(state?.values?.email ?? "");
  const [password, setPassword] = useState("");
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [avatarColor, setAvatarColor] = useState<AvatarColor>(
    (state?.values?.avatarColor as AvatarColor) ?? "blue"
  );

  const usernameResult = usernameSchema.safeParse(username);
  const usernameHints =
    username.length > 0 && !usernameResult.success
      ? usernameResult.error.issues.map((i) => i.message)
      : [];
  const emailResult = emailSchema.safeParse(email);
  const emailHint =
    email.length > 0 && !emailResult.success
      ? emailResult.error.issues[0].message
      : null;
  const passwordResult = passwordSchema.safeParse(password);
  const passwordHints =
    password.length > 0 && !passwordResult.success
      ? passwordResult.error.issues.map((i) => i.message)
      : [];
  const isValid = signUpSchema.safeParse({
    firstName,
    lastName,
    username,
    email,
    password,
    avatarColor,
  }).success;

  return (
    <>
      <div className="flex min-h-screen items-start justify-center bg-white px-4 py-10">
        {/* Subtle background texture */}
        <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#009de5]/10 via-white to-white" />

        <div className="relative w-full max-w-md">
          {/* Header */}
          <div className="mb-8 text-center">
            <div className="mb-4 inline-flex items-center gap-2">
              <svg viewBox="0 0 32 32" className="h-8 w-8">
                <defs>
                  <linearGradient id="sGold" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#ffe14d" />
                    <stop offset="50%" stopColor="#ffc107" />
                    <stop offset="100%" stopColor="#e5a100" />
                  </linearGradient>
                  <linearGradient id="sGoldLight" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#fff176" />
                    <stop offset="50%" stopColor="#ffd54f" />
                    <stop offset="100%" stopColor="#ffca28" />
                  </linearGradient>
                </defs>
                <circle cx="16" cy="16" r="15" fill="url(#sGold)" />
                <circle cx="16" cy="16" r="13.5" fill="url(#sGoldLight)" />
                <circle
                  cx="16"
                  cy="16"
                  r="11.5"
                  fill="url(#sGold)"
                  stroke="#e5a100"
                  strokeWidth="0.4"
                />
                <circle cx="16" cy="16" r="10.5" fill="url(#sGoldLight)" />
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
              Create your account
            </h1>
            <p className="mt-2 text-slate-500">
              Collaboratively plan your LA 2028 Olympic experience!
            </p>
          </div>

          {/* Form card */}
          <div className="rounded-2xl border border-[#009de5]/10 bg-white p-8 shadow-xl shadow-[#009de5]/5 backdrop-blur-sm">
            {/* General error */}
            <ErrorAlert message={state?.error} className="mb-6" />

            <form action={formAction} className="space-y-5">
              {/* Name row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="firstName"
                    className="mb-1.5 block text-sm font-medium text-slate-600"
                  >
                    First Name
                  </label>
                  <input
                    id="firstName"
                    type="text"
                    name="firstName"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className={inputClass}
                    placeholder="Jane"
                  />
                  {state?.fieldErrors?.firstName?.map((err) => (
                    <p key={err} className="mt-1 text-sm text-red-500">
                      {err}
                    </p>
                  ))}
                </div>
                <div>
                  <label
                    htmlFor="lastName"
                    className="mb-1.5 block text-sm font-medium text-slate-600"
                  >
                    Last Name
                  </label>
                  <input
                    id="lastName"
                    type="text"
                    name="lastName"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className={inputClass}
                    placeholder="Doe"
                  />
                  {state?.fieldErrors?.lastName?.map((err) => (
                    <p key={err} className="mt-1 text-sm text-red-500">
                      {err}
                    </p>
                  ))}
                </div>
              </div>

              {/* Username */}
              <div>
                <label
                  htmlFor="username"
                  className="mb-1.5 block text-sm font-medium text-slate-600"
                >
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  name="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={inputClass}
                  placeholder="janedoe"
                />
                {state?.fieldErrors?.username?.map((err) => (
                  <p key={err} className="mt-1 text-sm text-red-500">
                    {err}
                  </p>
                ))}
                {usernameHints.map((hint) => (
                  <p key={hint} className="mt-1 text-sm text-slate-400">
                    {hint}
                  </p>
                ))}
              </div>

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
                  <p className="mt-1 text-sm text-slate-400">
                    Please enter a valid email address.
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

              {/* Avatar Color */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-600">
                  Avatar Color
                </label>
                <input type="hidden" name="avatarColor" value={avatarColor} />
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                    style={{
                      backgroundColor: avatarColors[avatarColor].bg,
                      color: avatarColors[avatarColor].text,
                    }}
                  >
                    {(firstName[0] || "J").toUpperCase()}
                    {(lastName[0] || "D").toUpperCase()}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(avatarColors) as AvatarColor[]).map(
                      (color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setAvatarColor(color)}
                          className={`h-8 w-8 rounded-full transition-all ${
                            avatarColor === color
                              ? "ring-2 ring-offset-2"
                              : "hover:scale-110"
                          }`}
                          style={{
                            backgroundColor: avatarColors[color].bg,
                            ...(avatarColor === color
                              ? ({
                                  "--tw-ring-color": avatarColors[color].ring,
                                } as React.CSSProperties)
                              : {}),
                          }}
                          title={avatarColors[color].label}
                        />
                      )
                    )}
                  </div>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={!isValid || pending}
                className="w-full rounded-lg bg-[#009de5] px-4 py-2.5 font-semibold text-white shadow-lg shadow-[#009de5]/20 transition-all duration-200 hover:bg-[#0088c9] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending ? "Creating account..." : "Create Account"}
              </button>
              <p className="text-center text-xs text-slate-400">
                By creating an account, you acknowledge our{" "}
                <button
                  type="button"
                  onClick={() => setShowPrivacy(true)}
                  className="text-[#009de5] hover:underline"
                >
                  Privacy Policy
                </button>
                .
              </p>
            </form>

            {/* Divider */}
            <div className="mt-6 border-t border-slate-100 pt-6 text-center">
              <p className="text-sm text-slate-500">
                Already have an account?{" "}
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
      {showPrivacy && (
        <PrivacyPolicyModal onClose={() => setShowPrivacy(false)} />
      )}
    </>
  );
}
