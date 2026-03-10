"use client";

import { useState } from "react";
import { useGroup } from "../../_components/group-context";
import { inputClass } from "@/lib/constants";
import UserAvatar from "@/components/user-avatar";
import type { AvatarColor } from "@/lib/constants";

type BuddySelection = { memberId: string; type: "hard" | "soft" };

type Props = {
  initialBudget: number | null;
  initialMinBuddies: number;
  initialBuddies: BuddySelection[];
  onChange: (data: {
    budget: number | null;
    minBuddies: number;
    buddies: BuddySelection[];
  }) => void;
};

export default function BuddiesBudgetStep({
  initialBudget,
  initialMinBuddies,
  initialBuddies,
  onChange,
}: Props) {
  const group = useGroup();
  const [budget, setBudget] = useState(
    initialBudget !== null ? String(initialBudget) : ""
  );
  const [minBuddies, setMinBuddies] = useState(String(initialMinBuddies));
  const [buddies, setBuddies] = useState<BuddySelection[]>(initialBuddies);

  const eligibleMembers = group.members.filter(
    (m) => m.status !== "pending_approval" && m.id !== group.myMemberId
  );

  function emitChange(
    b: string = budget,
    mb: string = minBuddies,
    buddyList: BuddySelection[] = buddies
  ) {
    const parsed = parseInt(b, 10);
    onChange({
      budget: b.trim() === "" ? null : isNaN(parsed) ? null : parsed,
      minBuddies: parseInt(mb) || 0,
      buddies: buddyList,
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
    emitChange(budget, minBuddies, next);
  }

  function getBuddyState(memberId: string): "none" | "hard" | "soft" {
    const b = buddies.find((b) => b.memberId === memberId);
    return b?.type ?? "none";
  }

  const buddyStateStyles = {
    none: "border-slate-200 bg-white text-slate-600",
    hard: "border-[#009de5] bg-[#009de5]/10 text-[#009de5]",
    soft: "border-amber-400 bg-amber-50 text-amber-700",
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
          Budget <span className="font-normal text-slate-400">(Optional)</span>
        </h3>
        <p className="mb-0 text-sm text-slate-500">
          Maximum amount you&apos;re willing to spend on tickets (USD).
        </p>
        <p className="mb-2 text-sm text-slate-500">
          This field is for reference only and will not impact your generated
          schedule.
        </p>
        <div className="relative max-w-xs">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
            $
          </span>
          <input
            type="text"
            inputMode="numeric"
            placeholder=""
            className={
              inputClass +
              " pl-7 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            }
            value={budget ? Number(budget).toLocaleString("en-US") : ""}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^0-9]/g, "");
              setBudget(raw);
              emitChange(raw, minBuddies, buddies);
            }}
          />
        </div>
      </div>

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
          className={inputClass + " max-w-xs"}
          value={minBuddies}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            const clamped = isNaN(val)
              ? ""
              : String(Math.min(Math.max(val, 0), eligibleMembers.length));
            setMinBuddies(clamped);
            emitChange(budget, clamped, buddies);
          }}
        />
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
          <p className="text-sm text-slate-400">
            No other members in this group yet.
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
                          ? "bg-amber-100 text-amber-700"
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
