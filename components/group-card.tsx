"use client";

import { useState } from "react";
import Link from "next/link";
import { phaseLabels, statusLabels } from "@/lib/constants";
import UserAvatar from "@/components/user-avatar";
import { Group } from "@/lib/types";
import { removeMembership } from "@/app/(main)/actions";

export default function GroupCard({
  group: g,
  onRemoved,
}: {
  group: Group;
  onRemoved: () => void;
}) {
  const isPending = g.myStatus === "pending_approval";
  const isDenied = g.myStatus === "denied";
  const isInactive = isPending || isDenied;
  const [copied, setCopied] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState("");

  function handleCopyInviteCode(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(g.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleRemove() {
    setRemoving(true);
    setRemoveError("");
    const result = await removeMembership(g.myMemberId);
    if (result.success) {
      onRemoved();
    } else {
      setRemoveError(
        isPending
          ? "Failed to withdraw join request. Please try again."
          : "Failed to remove group. Please try again."
      );
    }
    setRemoving(false);
  }

  return (
    <div className="relative">
      <Link
        href={isInactive ? "#" : `/groups/${g.id}`}
        className={`group relative block rounded-2xl border p-6 transition-all ${
          isInactive
            ? "cursor-default border-slate-200 bg-slate-50 opacity-70"
            : "border-slate-200 bg-white shadow-sm hover:border-[#009de5]/30 hover:shadow-md"
        }`}
        onClick={isInactive ? (e) => e.preventDefault() : undefined}
      >
        <div className="mb-3 flex items-start justify-between">
          <h3
            className={`text-lg font-semibold ${isInactive ? "text-slate-500" : "text-slate-900"}`}
          >
            {g.name}
          </h3>
          <div className="flex items-center gap-2">
            {isDenied && (
              <span className="rounded-full bg-red-500/10 px-3 py-1 text-sm font-medium text-red-500">
                Join Request Denied
              </span>
            )}
            {isPending && (
              <span className="rounded-full bg-[#ff0080]/10 px-3 py-1 text-sm font-medium text-[#ff0080]">
                Pending
              </span>
            )}
            {g.myRole === "owner" && !isInactive && (
              <span className="rounded-full bg-[#009de5]/10 px-3 py-1 text-sm font-medium text-[#009de5]">
                Owner
              </span>
            )}
            {isInactive && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setRemoveError("");
                  setShowConfirm(true);
                }}
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>

        {!isInactive && (
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <span className="flex items-center gap-1">
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
                />
              </svg>
              {g.memberCount} {g.memberCount === 1 ? "member" : "members"}
            </span>
            <span className="flex items-center gap-1">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  g.phase === "completed" ? "bg-green-500" : "bg-yellow-500"
                }`}
              />
              Group Status: {phaseLabels[g.phase] ?? g.phase}
            </span>
          </div>
        )}

        {g.myRole === "owner" && g.pendingCount > 0 && (
          <div className="mt-3 flex items-center gap-1.5 text-sm font-medium text-[#ff0080]">
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ff0080]/10 px-1.5 text-[11px] font-semibold">
              {g.pendingCount}
            </span>
            Pending Join {g.pendingCount === 1 ? "Request" : "Requests"}
          </div>
        )}

        {!isInactive && g.members.length > 0 && (
          <div className="mt-4 flex items-center gap-1.5">
            {g.members.map((m, i) => (
              <div key={i} className="group/avatar relative">
                <UserAvatar
                  firstName={m.firstName}
                  lastName={m.lastName}
                  avatarColor={m.avatarColor ?? "blue"}
                />
                <div className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-800 px-3.5 py-2 text-sm text-white opacity-0 shadow-lg transition-opacity group-hover/avatar:opacity-100">
                  {m.firstName} {m.lastName}
                </div>
              </div>
            ))}
          </div>
        )}

        {!isInactive && (
          <div className="mt-3 flex items-center justify-between">
            <p className="text-sm text-slate-400">
              Your Status: {statusLabels[g.myStatus] ?? g.myStatus}
            </p>
            <button
              onClick={handleCopyInviteCode}
              className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"
                />
              </svg>
              {copied ? "Copied!" : "Copy Invite Code"}
            </button>
          </div>
        )}

        {isPending && (
          <p className="mt-3 text-sm text-slate-400">
            Waiting for the group owner to approve your request.
          </p>
        )}

        {isDenied && (
          <p className="mt-3 text-sm text-slate-400">
            Your join request was denied by the group owner.
          </p>
        )}
      </Link>

      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setShowConfirm(false)}
        >
          <div
            className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 text-lg font-semibold text-slate-900">
              {isPending ? "Withdraw Join Request" : "Remove Group"}
            </h3>
            <p className="mb-2 text-base text-slate-500">
              {isPending
                ? "Are you sure you want to withdraw your join request?"
                : "Are you sure you want to remove this group?"}
            </p>
            {removeError && (
              <p className="mb-3 text-base text-red-500">{removeError}</p>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={removing}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-base font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRemove}
                disabled={removing}
                className="rounded-xl bg-red-500 px-5 py-2.5 text-base font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-50"
              >
                {removing ? "Removing..." : isPending ? "Withdraw" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
