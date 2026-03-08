"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MAX_GROUP_MEMBERS } from "@/lib/constants";
import UserAvatar from "@/components/user-avatar";
import type { GroupDetailMember } from "@/lib/types";
import { useGroup } from "./group-context";
import { approveMember, denyMember } from "../actions";

const progressSteps = [
  {
    key: "preferences",
    label: "Entered Preferences",
    check: (m: GroupDetailMember) => m.status !== "joined",
  },
  {
    key: "schedule_review",
    label: "Confirmed Schedule",
    check: (m: GroupDetailMember) =>
      [
        "schedule_review_confirmed",
        "conflict_resolution_pending",
        "conflict_resolution_confirmed",
      ].includes(m.status),
  },
  {
    key: "conflict_resolution",
    label: "Resolved Conflicts",
    check: (m: GroupDetailMember) =>
      m.status === "conflict_resolution_confirmed",
  },
];

export default function OverviewContent() {
  const group = useGroup();
  const isOwner = group.myRole === "owner";

  const activeMembers = group.members.filter(
    (m) => m.status !== "pending_approval"
  );
  const pendingMembers = group.members.filter(
    (m) => m.status === "pending_approval"
  );
  const isFull = activeMembers.length >= MAX_GROUP_MEMBERS;

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold text-slate-900">
        Member Status
      </h2>

      <div className="rounded-xl border border-slate-200 bg-white">
        {/* Header */}
        <div className="grid grid-cols-[1fr_repeat(3,100px)] items-center border-b border-slate-100 px-5 py-3">
          <span className="text-sm font-medium text-slate-500">Member</span>
          {progressSteps.map((s) => (
            <span
              key={s.key}
              className="text-center text-sm font-medium text-slate-500"
            >
              {s.label}
            </span>
          ))}
        </div>

        {/* Active members */}
        {activeMembers.map((m, i) => (
          <div
            key={m.id}
            className={`grid grid-cols-[1fr_repeat(3,100px)] items-center px-5 py-3 ${
              i < activeMembers.length - 1 || pendingMembers.length > 0
                ? "border-b border-slate-100"
                : ""
            }`}
          >
            <div className="flex items-center gap-3">
              <UserAvatar
                firstName={m.firstName}
                lastName={m.lastName}
                avatarColor={m.avatarColor ?? "blue"}
              />
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-900">
                  {m.firstName} {m.lastName}
                </span>
                <span className="text-xs text-slate-400">@{m.username}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    m.role === "owner"
                      ? "bg-[#009de5]/10 text-[#009de5]"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {m.role === "owner" ? "Owner" : "Member"}
                </span>
              </div>
            </div>
            {progressSteps.map((s) => (
              <div key={s.key} className="flex justify-center">
                {s.check(m) ? (
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full"
                    style={{ backgroundColor: "rgba(16, 185, 129, 0.2)" }}
                  >
                    <svg
                      className="h-3 w-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="#059669"
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4.5 12.75l6 6 9-13.5"
                      />
                    </svg>
                  </span>
                ) : (
                  <span className="h-5 w-5 rounded-full border-2 border-slate-200" />
                )}
              </div>
            ))}
          </div>
        ))}

        {/* Pending members */}
        {pendingMembers.length > 0 && (
          <>
            <div className="border-t border-slate-100 px-5 py-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Pending Requests
              </span>
            </div>
            {pendingMembers.map((m, i) => (
              <PendingMemberRow
                key={m.id}
                member={m}
                groupId={group.id}
                isOwner={isOwner}
                isFull={isFull}
                isLast={i === pendingMembers.length - 1}
              />
            ))}
          </>
        )}
      </div>
    </section>
  );
}

function PendingMemberRow({
  member: m,
  groupId,
  isOwner,
  isFull,
  isLast,
}: {
  member: GroupDetailMember;
  groupId: string;
  isOwner: boolean;
  isFull: boolean;
  isLast: boolean;
}) {
  const [loading, setLoading] = useState<"approve" | "deny" | null>(null);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleApprove() {
    setLoading("approve");
    setError("");
    const result = await approveMember(groupId, m.id);
    setLoading(null);
    if (result.error) {
      setError(result.error);
    } else {
      router.refresh();
    }
  }

  async function handleDeny() {
    setLoading("deny");
    setError("");
    const result = await denyMember(groupId, m.id);
    setLoading(null);
    if (result.error) {
      setError(result.error);
    } else {
      router.refresh();
    }
  }

  return (
    <div className={`px-5 py-3 ${!isLast ? "border-b border-slate-100" : ""}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <UserAvatar
            firstName={m.firstName}
            lastName={m.lastName}
            avatarColor={m.avatarColor ?? "blue"}
            className="opacity-60"
          />
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-500">
              {m.firstName} {m.lastName}
            </span>
            <span className="text-xs text-slate-400">@{m.username}</span>
            <span className="rounded-full bg-[#ff0080]/10 px-2 py-0.5 text-xs font-medium text-[#ff0080]">
              Pending
            </span>
          </div>
        </div>
        {isOwner && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleDeny}
              disabled={loading !== null}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              {loading === "deny" ? "..." : "Deny"}
            </button>
            <span className="group/approve relative">
              <button
                onClick={handleApprove}
                disabled={loading !== null || isFull}
                className="rounded-lg bg-[#009de5] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#0088c9] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading === "approve" ? "..." : "Approve"}
              </button>
              {isFull && (
                <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover/approve:opacity-100">
                  Groups are limited to 12 members.
                </span>
              )}
            </span>
          </div>
        )}
      </div>
      {error && <p className="mt-2 text-right text-sm text-red-600">{error}</p>}
    </div>
  );
}
