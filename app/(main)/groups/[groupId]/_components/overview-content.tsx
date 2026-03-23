"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MAX_GROUP_MEMBERS, avatarColors } from "@/lib/constants";
import UserAvatar from "@/components/user-avatar";
import type { GroupDetail, GroupDetailMember } from "@/lib/types";
import { useGroup } from "./group-context";
import { approveMember, denyMember, removeMember } from "../actions";
import ConfirmMemberRemovalModal from "./confirm-member-removal-modal";
import NotificationsSection from "./notifications-section";
import GenerateScheduleSection from "./generate-schedule-section";
import TimeslotForm from "../schedule/_components/timeslot-form";
import { Clock } from "lucide-react";

export default function OverviewContent() {
  const group = useGroup();
  const router = useRouter();
  const isOwner = group.myRole === "owner";

  const activeMembers = group.members
    .filter((m) => m.status !== "pending_approval")
    .sort((a, b) => {
      if (a.role === "owner") return -1;
      if (b.role === "owner") return 1;
      if (!a.joinedAt || !b.joinedAt) return 0;
      return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
    });
  const pendingMembers = group.members.filter(
    (m) => m.status === "pending_approval"
  );
  const isFull = activeMembers.length >= MAX_GROUP_MEMBERS;

  const affectedBuddyIds = new Set(Object.keys(group.affectedBuddyMembers));
  const noCombosNotUpdatedIds = new Set(
    group.membersWithNoCombos.filter((id) => {
      const m = activeMembers.find((am) => am.id === id);
      if (!m) return false;
      return !(
        m.statusChangedAt &&
        group.scheduleGeneratedAt &&
        new Date(m.statusChangedAt) > new Date(group.scheduleGeneratedAt)
      );
    })
  );

  const timeslotMemberIds = new Set(group.memberTimeslots);
  const purchasedMemberIds = new Set(group.membersPurchased);
  const purchaseDataMemberIds = new Set(group.membersWithPurchaseData);

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold text-slate-900">
        Member Status
      </h2>

      <div className="rounded-xl border border-slate-200 bg-white">
        {/* Header */}
        <div className="grid grid-cols-[1fr_110px_110px_110px] items-center border-b border-slate-100 px-5 py-3">
          <span className="text-sm font-medium text-slate-500">Member</span>
          <span className="text-center text-sm font-medium text-slate-500">
            Entered Preferences?
          </span>
          <span className="text-center text-sm font-medium text-slate-500">
            Timeslot Assigned?
          </span>
          <span className="text-center text-sm font-medium text-slate-500">
            Purchased Tickets?
          </span>
        </div>

        {/* Active members */}
        {activeMembers.map((m, i) => (
          <ActiveMemberRow
            key={m.id}
            member={m}
            groupId={group.id}
            groupPhase={group.phase}
            isOwner={isOwner}
            isCurrentUser={m.id === group.myMemberId}
            isLast={
              i === activeMembers.length - 1 && pendingMembers.length === 0
            }
            isAffectedBuddy={affectedBuddyIds.has(m.id)}
            isNoCombosNotUpdated={noCombosNotUpdatedIds.has(m.id)}
            hasTimeslot={timeslotMemberIds.has(m.id)}
            hasPurchased={
              timeslotMemberIds.has(m.id) && purchasedMemberIds.has(m.id)
            }
            hasPurchaseData={purchaseDataMemberIds.has(m.id)}
            myTimeslot={m.id === group.myMemberId ? group.myTimeslot : null}
          />
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

      <NotificationsSection />
      <GenerateScheduleSection />
    </section>
  );
}

function ActiveMemberRow({
  member: m,
  groupId,
  groupPhase,
  isOwner,
  isCurrentUser,
  isLast,
  isAffectedBuddy,
  isNoCombosNotUpdated,
  hasTimeslot,
  hasPurchased,
  hasPurchaseData,
  myTimeslot,
}: {
  member: GroupDetailMember;
  groupId: string;
  groupPhase: string;
  isOwner: boolean;
  isCurrentUser: boolean;
  isLast: boolean;
  isAffectedBuddy: boolean;
  isNoCombosNotUpdated: boolean;
  hasTimeslot: boolean;
  hasPurchased: boolean;
  hasPurchaseData: boolean;
  myTimeslot: GroupDetail["myTimeslot"];
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [showTimeslot, setShowTimeslot] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleRemoveConfirm() {
    setLoading(true);
    setError("");
    const result = await removeMember(groupId, m.id);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      setShowConfirm(false);
      router.refresh();
    }
  }

  return (
    <div
      className={`grid grid-cols-[1fr_110px_110px_110px] items-center px-5 py-3 ${
        !isLast ? "border-b border-slate-100" : ""
      }`}
      style={
        isCurrentUser
          ? {
              backgroundColor: avatarColors[m.avatarColor ?? "blue"].bg.replace(
                /[\d.]+\)$/,
                "0.07)"
              ),
            }
          : undefined
      }
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
            className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
              m.role === "owner"
                ? "border-[#009de5]/30 bg-[#009de5]/10 text-[#009de5]"
                : "border-slate-300 bg-slate-100 text-slate-500"
            }`}
          >
            {m.role === "owner" ? "Owner" : "Member"}
          </span>
          {isOwner && m.role !== "owner" && (
            <button
              onClick={() => setShowConfirm(true)}
              className="rounded-md p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
              title={`Remove ${m.firstName}`}
            >
              <TrashIcon />
            </button>
          )}
          {isCurrentUser && !hasTimeslot && (
            <button
              onClick={() => setShowTimeslot(true)}
              className="rounded-lg bg-[#009de5] px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-[#0088c9]"
            >
              Enter Purchase Timeslot
            </button>
          )}
          {isCurrentUser && hasTimeslot && (
            <button
              onClick={() => setShowTimeslot(true)}
              className="rounded-lg bg-[#009de5] px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-[#0088c9]"
            >
              Edit Purchase Timeslot
            </button>
          )}
        </div>
      </div>
      {/* Entered Preferences? column */}
      <div className="flex justify-center">
        {m.status !== "joined" && !isAffectedBuddy && !isNoCombosNotUpdated ? (
          <CheckMark />
        ) : m.status !== "joined" &&
          (isAffectedBuddy || isNoCombosNotUpdated) ? (
          <span className="group/prefwarn relative">
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="#d97706"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 w-48 -translate-x-1/2 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-normal text-white opacity-0 shadow-lg transition-opacity group-hover/prefwarn:opacity-100">
              {isAffectedBuddy
                ? "Needs to review buddy preferences"
                : "This user didn't receive any sessions on their schedule. They will need to update their preferences."}
            </span>
          </span>
        ) : (
          <EmptyCircle />
        )}
      </div>
      {/* Timeslot Assigned? column */}
      <div className="flex justify-center">
        {hasTimeslot ? <CheckMark /> : <EmptyCircle />}
      </div>
      {/* Purchased Tickets? column */}
      <div className="flex justify-center">
        {hasPurchased ? <CheckMark /> : <EmptyCircle />}
      </div>
      {showTimeslot && (
        <TimeslotModal
          groupId={groupId}
          myTimeslot={myTimeslot}
          onClose={() => setShowTimeslot(false)}
        />
      )}
      {showConfirm && (
        <ConfirmMemberRemovalModal
          type="remove"
          memberName={`${m.firstName} ${m.lastName}`}
          groupPhase={groupPhase}
          loading={loading}
          error={error}
          hasPurchaseData={hasPurchaseData}
          onConfirm={handleRemoveConfirm}
          onClose={() => {
            setShowConfirm(false);
            setError("");
          }}
        />
      )}
    </div>
  );
}

function CheckMark() {
  return (
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
  );
}

function EmptyCircle() {
  return <span className="h-5 w-5 rounded-full border-2 border-slate-200" />;
}

function TrashIcon() {
  return (
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
        d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
      />
    </svg>
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

function TimeslotModal({
  groupId,
  myTimeslot,
  onClose,
}: {
  groupId: string;
  myTimeslot: GroupDetail["myTimeslot"];
  onClose: () => void;
}) {
  const router = useRouter();

  const timeslotForForm = myTimeslot
    ? {
        id: "",
        timeslotStart: new Date(myTimeslot.timeslotStart),
        timeslotEnd: new Date(myTimeslot.timeslotEnd),
        status: myTimeslot.status,
      }
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-xl bg-white p-8 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Clock size={20} />
            {myTimeslot ? "Edit Purchase Timeslot" : "Enter Purchase Timeslot"}
          </h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <TimeslotForm
          groupId={groupId}
          timeslot={timeslotForForm}
          onSaved={() => {
            onClose();
            router.refresh();
          }}
        />
      </div>
    </div>
  );
}
