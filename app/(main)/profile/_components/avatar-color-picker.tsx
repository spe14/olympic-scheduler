"use client";

import { useState, useTransition } from "react";
import { updateAvatarColor } from "../actions";
import UserAvatar from "@/components/user-avatar";
import { avatarColors, type AvatarColor } from "@/lib/constants";

const colors = Object.keys(avatarColors) as AvatarColor[];

export default function AvatarColorPicker({
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

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
      <h2 className="mb-5 text-lg font-semibold text-slate-900">
        Avatar Color
      </h2>

      <div className="flex items-center gap-6">
        <UserAvatar
          firstName={firstName}
          lastName={lastName}
          avatarColor={selected}
          size="lg"
          className="font-semibold"
        />

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
