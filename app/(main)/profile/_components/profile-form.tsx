"use client";

import { disabledInputClass } from "@/lib/constants";
import type { AvatarColor } from "@/lib/constants";
import EditableField, { validateField } from "./editable-field";
import AvatarColorPicker from "./avatar-color-picker";
import PasswordSection from "./password-section";
import DeleteAccountSection from "./delete-account-section";

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
  return (
    <div className="grid flex-1 grid-cols-1 gap-8 lg:grid-cols-2">
      {/* Left column */}
      <div className="flex flex-col gap-8">
        <div className="flex-1 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 lg:p-8">
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
                className={disabledInputClass}
              />
            </div>

            <EditableField
              label="Username"
              field="username"
              initialValue={username}
              validate={(v) => validateField("username", v)}
            />

            <EditableField
              label="First Name"
              field="firstName"
              initialValue={firstName}
              validate={(v) => validateField("firstName", v)}
            />

            <EditableField
              label="Last Name"
              field="lastName"
              initialValue={lastName}
              validate={(v) => validateField("lastName", v)}
            />
          </div>
        </div>

        <DeleteAccountSection />
      </div>

      {/* Right column */}
      <div className="flex flex-col gap-8">
        <AvatarColorPicker
          initialColor={avatarColor}
          firstName={firstName}
          lastName={lastName}
        />
        <PasswordSection />
      </div>
    </div>
  );
}
