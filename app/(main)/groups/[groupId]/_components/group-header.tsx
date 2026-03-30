"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getDateDisplay } from "@/lib/utils";
import type { GroupDetail } from "@/lib/types";
import { updateGroupName, leaveGroup } from "../actions";
import { useNavigationGuard } from "./navigation-guard-context";
import ConfirmMemberRemovalModal, {
  OwnerLeaveModal,
} from "./confirm-member-removal-modal";
import Tooltip from "@/components/tooltip";
import TimeslotForm from "../schedule/_components/timeslot-form";
import { useScrollLock } from "@/lib/use-scroll-lock";

export default function GroupHeader({
  group,
  isOwner,
  onOpenSettings,
  onNameSaved,
}: {
  group: GroupDetail;
  isOwner: boolean;
  onOpenSettings: () => void;
  onNameSaved: () => void;
}) {
  const router = useRouter();
  const { guardNavigation } = useNavigationGuard();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(group.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveError, setLeaveError] = useState("");
  const [showTimeslot, setShowTimeslot] = useState(false);

  const activeCount = group.members.filter(
    (m) => m.status !== "pending_approval"
  ).length;
  const dateDisplay = getDateDisplay(group);
  const hasPurchaseData = group.membersWithPurchaseData.includes(
    group.myMemberId
  );

  async function handleSaveName() {
    setSaving(true);
    setError("");
    const fd = new FormData();
    fd.set("name", name);
    const result = await updateGroupName(group.id, fd);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      setName(group.name);
    } else {
      setIsEditing(false);
      onNameSaved();
    }
  }

  function handleCopyInviteCode() {
    navigator.clipboard.writeText(group.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleLeaveConfirm() {
    setLeaveLoading(true);
    setLeaveError("");
    const result = await leaveGroup(group.id);
    setLeaveLoading(false);
    if (result.error) {
      setLeaveError(result.error);
    } else {
      router.push("/");
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          {isEditing ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-lg font-bold text-slate-900 focus:border-[#009de5] focus:outline-none focus:ring-1 focus:ring-[#009de5] sm:text-2xl"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveName();
                  if (e.key === "Escape") {
                    setIsEditing(false);
                    setName(group.name);
                    setError("");
                  }
                }}
              />
              <button
                onClick={handleSaveName}
                disabled={saving}
                className="rounded-lg bg-[#009de5] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#0088c9] disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setName(group.name);
                  setError("");
                }}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">{name}</h1>
              <div className="flex items-center gap-0.5">
                {isOwner && (
                  <>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                      title="Rename group"
                    >
                      <PencilIcon />
                    </button>
                    <button
                      onClick={onOpenSettings}
                      className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                      title="Group settings"
                    >
                      <SettingsIcon />
                    </button>
                  </>
                )}
                <button
                  onClick={() => {
                    if (!guardNavigation("/")) return;
                    setShowLeaveModal(true);
                  }}
                  className="flex items-center gap-1 rounded-md p-1 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                  title="Leave group"
                >
                  <LeaveIcon />
                  Leave Group
                </button>
              </div>
            </div>
          )}
          {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[#009de5]/10 px-3 py-1 text-sm font-medium text-[#009de5]">
            {group.myRole === "owner" ? "Owner" : "Member"}
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[15px] text-slate-500">
        <Tooltip
          label="Groups are limited to 12 members."
          className="flex items-center gap-1.5"
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
              d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
            />
          </svg>
          {activeCount} {activeCount === 1 ? "member" : "members"}
        </Tooltip>
        <Sep />
        <button
          onClick={handleCopyInviteCode}
          className="flex items-center gap-1.5 transition-colors hover:text-slate-700"
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
          {copied ? "Copied!" : `Invite Code: ${group.inviteCode}`}
        </button>
        <Sep />
        <Tooltip
          label={isOwner ? "Click the settings icon to update." : null}
          className="flex items-center gap-1.5"
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
              d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
            />
          </svg>
          {dateDisplay}
        </Tooltip>
        <Sep />
        {group.myTimeslot ? (
          <span className="flex items-center gap-1.5">
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
                d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            My Timeslot:{" "}
            {new Date(group.myTimeslot.timeslotStart).toLocaleString("en-US", {
              timeZone: "America/Los_Angeles",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}{" "}
            PT &ndash;{" "}
            {new Date(group.myTimeslot.timeslotEnd).toLocaleString("en-US", {
              timeZone: "America/Los_Angeles",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}{" "}
            PT
            <button
              onClick={() => setShowTimeslot(true)}
              className="ml-0.5 rounded-md p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              title="Edit timeslot"
            >
              <PencilIcon size={14} />
            </button>
          </span>
        ) : (
          <button
            onClick={() => setShowTimeslot(true)}
            className="flex items-center gap-1.5 rounded-lg bg-[#009de5]/10 px-2.5 py-1 text-sm font-medium text-[#009de5] transition-colors hover:bg-[#009de5]/20"
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
                d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Enter Purchase Timeslot
          </button>
        )}
      </div>

      {showTimeslot && (
        <TimeslotModal
          groupId={group.id}
          myTimeslot={group.myTimeslot}
          onClose={() => setShowTimeslot(false)}
        />
      )}

      {showLeaveModal &&
        (isOwner ? (
          <OwnerLeaveModal onClose={() => setShowLeaveModal(false)} />
        ) : (
          <ConfirmMemberRemovalModal
            type="leave"
            groupPhase={group.phase}
            loading={leaveLoading}
            error={leaveError}
            hasPurchaseData={hasPurchaseData}
            onConfirm={handleLeaveConfirm}
            onClose={() => {
              setShowLeaveModal(false);
              setLeaveError("");
            }}
          />
        ))}
    </div>
  );
}

function Sep() {
  return <span className="text-slate-300">|</span>;
}

function PencilIcon({ size }: { size?: number }) {
  return (
    <svg
      className={size ? undefined : "h-5 w-5"}
      width={size}
      height={size}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
      />
    </svg>
  );
}

function SettingsIcon() {
  return (
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
        d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
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
  useScrollLock();

  const timeslotForForm = myTimeslot
    ? {
        id: "",
        timeslotStart: new Date(myTimeslot.timeslotStart),
        timeslotEnd: new Date(myTimeslot.timeslotEnd),
      }
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 mx-4 max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-xl sm:p-8">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
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
                d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
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

function LeaveIcon() {
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
        d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
      />
    </svg>
  );
}
