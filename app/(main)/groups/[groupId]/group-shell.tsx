"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { phaseLabels } from "@/lib/constants";
import type { GroupDetail } from "@/lib/types";
import { updateGroupName } from "./actions";
import GroupSettingsModal from "./group-settings-modal";
import { GroupProvider } from "./group-context";

const phaseBadgeStyles: Record<
  string,
  { backgroundColor: string; color: string }
> = {
  preferences: { backgroundColor: "rgba(250, 204, 21, 0.2)", color: "#d97706" },
  schedule_review: {
    backgroundColor: "rgba(250, 204, 21, 0.2)",
    color: "#d97706",
  },
  conflict_resolution: {
    backgroundColor: "rgba(250, 204, 21, 0.2)",
    color: "#d97706",
  },
  completed: { backgroundColor: "rgba(16, 185, 129, 0.2)", color: "#059669" },
};

type NavStatus = {
  type: "complete" | "warning" | "none";
  tooltip?: string;
};

type NavItem = {
  key: string;
  label: string;
  href: string;
  visible: boolean;
  status: NavStatus;
};

function getDateDisplay(group: GroupDetail): string {
  if (group.dateMode === "consecutive" && group.consecutiveDays) {
    return `${group.consecutiveDays} consecutive days`;
  }
  if (group.dateMode === "specific" && group.startDate && group.endDate) {
    const fmt = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    });
    const start = new Date(group.startDate + "T00:00:00");
    const end = new Date(group.endDate + "T00:00:00");
    return `${fmt.format(start)} - ${fmt.format(end)}, 2028`;
  }
  return "Dates not set";
}

export default function GroupShell({
  group,
  children,
}: {
  group: GroupDetail;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isOwner = group.myRole === "owner";
  const [showSettings, setShowSettings] = useState(false);

  const basePath = `/groups/${group.id}`;
  const myStatus = group.myStatus;

  const prefsComplete =
    myStatus !== "joined" && myStatus !== "pending_approval";
  const scheduleConfirmed = [
    "schedule_review_confirmed",
    "conflict_resolution_pending",
    "conflict_resolution_confirmed",
  ].includes(myStatus);
  const conflictsResolved = myStatus === "conflict_resolution_confirmed";
  const scheduleComplete = scheduleConfirmed && conflictsResolved;

  function getScheduleWarning(): string | undefined {
    if (
      myStatus === "schedule_review_pending" ||
      myStatus === "schedule_review_confirmed"
    )
      return "You haven't confirmed your schedule yet.";
    if (myStatus === "conflict_resolution_pending")
      return "You haven't resolved all conflicts yet.";
    return undefined;
  }

  const navItems: NavItem[] = [
    {
      key: "overview",
      label: "Overview",
      href: basePath,
      visible: true,
      status: { type: "none" },
    },
    {
      key: "preferences",
      label: "Preferences",
      href: `${basePath}/preferences`,
      visible: true,
      status: prefsComplete
        ? { type: "complete" }
        : {
            type: "warning",
            tooltip: "You haven't entered your preferences yet.",
          },
    },
    {
      key: "schedule",
      label: "My Schedule",
      href: `${basePath}/schedule`,
      visible: true,
      status: scheduleComplete
        ? { type: "complete" }
        : getScheduleWarning()
          ? { type: "warning", tooltip: getScheduleWarning() }
          : { type: "none" },
    },
    {
      key: "group-schedule",
      label: "Group Schedule",
      href: `${basePath}/group-schedule`,
      visible: true,
      status: { type: "none" },
    },
  ];

  const activeKey =
    navItems.find(
      (item) => item.key !== "overview" && pathname.startsWith(item.href)
    )?.key ?? "overview";

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-slate-700"
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
            d="M15.75 19.5L8.25 12l7.5-7.5"
          />
        </svg>
        Back to Groups
      </Link>

      <Header
        group={group}
        isOwner={isOwner}
        onOpenSettings={() => setShowSettings(true)}
        onNameSaved={() => router.refresh()}
      />

      <div className="mt-8 flex gap-8">
        <nav className="w-52 shrink-0">
          <ul className="space-y-1">
            {navItems
              .filter((item) => item.visible)
              .map((item) => (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    className={`group/nav relative flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      activeKey === item.key
                        ? "bg-[#009de5]/10 text-[#009de5]"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    {item.label}
                    {item.status.type === "complete" && <NavCheckIcon />}
                    {item.status.type === "warning" && (
                      <span className="relative">
                        <NavWarningIcon />
                        {item.status.tooltip && (
                          <span className="pointer-events-none absolute left-full top-1/2 z-10 ml-2 w-48 -translate-y-1/2 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-normal text-white opacity-0 shadow-lg transition-opacity group-hover/nav:opacity-100">
                            {item.status.tooltip}
                          </span>
                        )}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
          </ul>
        </nav>

        <div className="min-w-0 flex-1">
          <GroupProvider group={group}>{children}</GroupProvider>
        </div>
      </div>

      {showSettings && (
        <GroupSettingsModal
          group={group}
          isOwner={isOwner}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

function Header({
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
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(group.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const badgeStyle =
    phaseBadgeStyles[group.phase] ?? phaseBadgeStyles.preferences;
  const activeCount = group.members.filter(
    (m) => m.status !== "pending_approval"
  ).length;
  const dateDisplay = getDateDisplay(group);

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

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-2xl font-bold text-slate-900 focus:border-[#009de5] focus:outline-none focus:ring-1 focus:ring-[#009de5]"
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
              {isOwner && (
                <div className="flex items-center gap-0.5">
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
                </div>
              )}
            </div>
          )}
          {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex items-center gap-2">
          <span
            className="rounded-full px-3 py-1 text-sm font-medium"
            style={badgeStyle}
          >
            {phaseLabels[group.phase] ?? group.phase}
          </span>
          <span className="rounded-full bg-[#009de5]/10 px-3 py-1 text-sm font-medium text-[#009de5]">
            {group.myRole === "owner" ? "Owner" : "Member"}
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[15px] text-slate-500">
        <span className="group/members relative flex items-center gap-1.5">
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
          <span className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover/members:opacity-100">
            Groups are limited to 12 members.
          </span>
        </span>
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
        <span className="group/date relative flex items-center gap-1.5">
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
          {isOwner && (
            <span className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover/date:opacity-100">
              Click the settings icon to update.
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

function Sep() {
  return <span className="text-slate-300">|</span>;
}

function PencilIcon() {
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

function NavCheckIcon() {
  return (
    <span
      className="flex h-4 w-4 items-center justify-center rounded-full"
      style={{ backgroundColor: "rgba(16, 185, 129, 0.2)" }}
    >
      <svg
        className="h-2.5 w-2.5"
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

function NavWarningIcon() {
  return (
    <svg
      className="h-4 w-4"
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
  );
}
