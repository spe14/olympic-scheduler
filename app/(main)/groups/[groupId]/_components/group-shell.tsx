"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { GroupDetail } from "@/lib/types";
import GroupHeader from "./group-header";
import GroupSettingsModal from "./group-settings-modal";
import { GroupProvider } from "./group-context";

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

      <GroupHeader
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
