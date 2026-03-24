"use client";

import { useState } from "react";
import { useGroup } from "../../_components/group-context";
import { inputClass } from "@/lib/constants";
import UserAvatar from "@/components/user-avatar";
import type { AvatarColor } from "@/lib/constants";

type BuddySelection = { memberId: string; type: "hard" | "soft" };

type Props = {
  initialMinBuddies: number;
  initialBuddies: BuddySelection[];
  onChange: (data: {
    minBuddies: number;
    buddies: BuddySelection[];
    isValid: boolean;
  }) => void;
};

export default function BuddiesStep({
  initialMinBuddies,
  initialBuddies,
  onChange,
}: Props) {
  const group = useGroup();
  const [minBuddies, setMinBuddies] = useState(String(initialMinBuddies));
  const [buddies, setBuddies] = useState<BuddySelection[]>(initialBuddies);

  const eligibleMembers = group.members.filter(
    (m) =>
      m.status !== "pending_approval" &&
      m.status !== "denied" &&
      m.id !== group.myMemberId
  );

  const hardBuddyCount = buddies.filter((b) => b.type === "hard").length;
  const parsedMin = parseInt(minBuddies) || 0;
  const minBuddiesError =
    hardBuddyCount > 0 && parsedMin < hardBuddyCount
      ? "The number of minimum buddies should be greater than or equal to the number of required buddies."
      : null;

  function emitChange(
    mb: string = minBuddies,
    buddyList: BuddySelection[] = buddies
  ) {
    const hardCount = buddyList.filter((b) => b.type === "hard").length;
    const parsed = parseInt(mb) || 0;
    const isValid = parsed >= hardCount;
    onChange({
      minBuddies: parsed,
      buddies: buddyList,
      isValid,
    });
  }

  function handleBuddyToggle(memberId: string) {
    const existing = buddies.find((b) => b.memberId === memberId);
    let next: BuddySelection[];

    if (!existing) {
      next = [...buddies, { memberId, type: "hard" }];
    } else if (existing.type === "hard") {
      next = buddies.map((b) =>
        b.memberId === memberId ? { ...b, type: "soft" as const } : b
      );
    } else {
      next = buddies.filter((b) => b.memberId !== memberId);
    }

    setBuddies(next);
    emitChange(minBuddies, next);
  }

  function getBuddyState(memberId: string): "none" | "hard" | "soft" {
    const b = buddies.find((b) => b.memberId === memberId);
    return b?.type ?? "none";
  }

  const buddyStateStyles = {
    none: "border-slate-200 bg-white text-slate-600",
    hard: "border-[#009de5] bg-[#009de5]/10 text-[#009de5]",
    soft: "border-amber-400 bg-amber-50 text-amber-600",
  };

  const buddyStateLabels = {
    none: "None",
    hard: "Required",
    soft: "Preferred",
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-1 text-base font-semibold text-slate-900">
          Minimum Buddies
        </h3>
        <p className="mb-0 text-sm text-slate-500">
          Minimum number of group members you want to attend sessions with. This
          will impact all sessions on your schedule.
        </p>
        <p className="mb-2 text-sm text-slate-500">
          Default is 0 - you are fine with attending sessions alone.
        </p>
        <input
          type="number"
          min="0"
          max={eligibleMembers.length}
          step="1"
          placeholder="0"
          disabled={eligibleMembers.length === 0}
          className={
            inputClass +
            " max-w-xs disabled:cursor-not-allowed disabled:opacity-50"
          }
          value={minBuddies}
          onKeyDown={(e) => {
            if (
              e.key === "-" ||
              e.key === "e" ||
              e.key === "E" ||
              e.key === "+"
            ) {
              e.preventDefault();
            }
          }}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            const clamped = isNaN(val)
              ? ""
              : String(Math.min(Math.max(val, 0), eligibleMembers.length));
            setMinBuddies(clamped);
            emitChange(clamped, buddies);
          }}
        />
        {minBuddiesError && (
          <p className="mt-1.5 text-sm text-red-600">{minBuddiesError}</p>
        )}
      </div>

      <div>
        <h3 className="mb-1 text-base font-semibold text-slate-900">
          Buddy Preferences
        </h3>
        <p className="mb-1 text-sm text-slate-500">
          Click a member to cycle: None → Required → Preferred → None.
        </p>
        <p className="mb-0 text-sm text-slate-500">
          None - I have no preference about attending sessions with this member.
        </p>
        <p className="mb-0 text-sm text-slate-500">
          Required - I will only attend a session if this member is also
          attending. This will impact all sessions on your schedule.
        </p>
        <p className="mb-2 text-sm text-slate-500">
          Preferred - I would like to attend sessions with this member, but
          it&apos;s not a dealbreaker.
        </p>
        {eligibleMembers.length === 0 ? (
          <p className="text-base text-[#d97706]">
            There are no other members in this group yet.
          </p>
        ) : (
          <div className="space-y-2">
            {eligibleMembers.map((m) => {
              const state = getBuddyState(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleBuddyToggle(m.id)}
                  className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${buddyStateStyles[state]}`}
                >
                  <UserAvatar
                    firstName={m.firstName}
                    lastName={m.lastName}
                    avatarColor={m.avatarColor as AvatarColor}
                    size="sm"
                  />
                  <span className="flex-1 text-sm font-medium">
                    {m.firstName} {m.lastName}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      state === "hard"
                        ? "bg-[#009de5]/20 text-[#009de5]"
                        : state === "soft"
                          ? "bg-amber-100 text-amber-600"
                          : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {buddyStateLabels[state]}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
