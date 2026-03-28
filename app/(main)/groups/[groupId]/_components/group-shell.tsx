"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { GroupDetail } from "@/lib/types";
import GroupHeader from "./group-header";
import GroupSettingsModal from "./group-settings-modal";
import { GroupSyncProvider } from "./group-context";
import { SidePanelProvider, useSidePanel } from "./side-panel-context";
import {
  NavigationGuardProvider,
  useNavigationGuard,
} from "./navigation-guard-context";

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
  group: layoutGroup,
  children,
}: {
  group: GroupDetail;
  children: React.ReactNode;
}) {
  // Pages push fresh data via GroupSyncProvider so the sidebar stays current
  // even when the layout serves stale props (Next.js layout caching).
  const [syncedGroup, setSyncedGroup] = useState<GroupDetail | null>(null);
  const handleSync = useCallback((g: GroupDetail) => setSyncedGroup(g), []);
  const group = syncedGroup ?? layoutGroup;

  const pathname = usePathname();
  const router = useRouter();
  const isOwner = group.myRole === "owner";
  const [showSettings, setShowSettings] = useState(false);

  const basePath = `/groups/${group.id}`;
  const myStatus = group.myStatus;

  const prefsComplete =
    myStatus !== "joined" && myStatus !== "pending_approval";
  const hasAffectedBuddyReview = group.myMemberId in group.affectedBuddyMembers;
  const inScheduleReview = group.phase === "schedule_review";
  const myHasNoCombos = group.membersWithNoCombos.includes(group.myMemberId);
  const anyMemberHasNoCombos = group.membersWithNoCombos.length > 0;
  const hasDateConfig = !!group.dateMode;

  function getScheduleWarning(): string | undefined {
    if (anyMemberHasNoCombos)
      return "Schedules unavailable — some members didn't receive any sessions.";
    return undefined;
  }

  const activeMembers = group.members.filter(
    (m) => m.status !== "pending_approval" && m.status !== "denied"
  );
  const hasUpdatedPrefs =
    !!group.scheduleGeneratedAt &&
    activeMembers.some(
      (m) =>
        m.status === "preferences_set" &&
        m.statusChangedAt &&
        new Date(m.statusChangedAt) > new Date(group.scheduleGeneratedAt!) &&
        !(
          m.joinedAt &&
          new Date(m.joinedAt) > new Date(group.scheduleGeneratedAt!)
        )
    );
  const hasDepartedMembers = group.departedMembers.some(
    (d) => !d.rejoinedAt && d.wasPartOfSchedule !== false
  );
  const hasAffectedBuddyMembers =
    Object.keys(group.affectedBuddyMembers).length > 0;
  const hasNewlyJoinedMembers =
    !!group.scheduleGeneratedAt &&
    activeMembers.some((m) => m.status === "joined");
  const hasNewMembersWithPrefs =
    !!group.scheduleGeneratedAt &&
    activeMembers.some(
      (m) =>
        m.status === "preferences_set" &&
        m.joinedAt &&
        new Date(m.joinedAt) > new Date(group.scheduleGeneratedAt!)
    );
  const hasNoCombosNotUpdated = group.membersWithNoCombos.some((id) => {
    const m = activeMembers.find((am) => am.id === id);
    if (!m) return false;
    return !(
      m.statusChangedAt &&
      group.scheduleGeneratedAt &&
      new Date(m.statusChangedAt) > new Date(group.scheduleGeneratedAt)
    );
  });
  const hasPurchaseChanges = !!(
    group.purchaseDataChangedAt &&
    group.scheduleGeneratedAt &&
    new Date(group.purchaseDataChangedAt) > new Date(group.scheduleGeneratedAt)
  );
  const schedulesNeedAttention =
    hasUpdatedPrefs ||
    hasDepartedMembers ||
    hasAffectedBuddyMembers ||
    hasNewlyJoinedMembers ||
    hasNewMembersWithPrefs ||
    hasNoCombosNotUpdated ||
    hasPurchaseChanges;

  const navItems: NavItem[] = [
    {
      key: "overview",
      label: "Overview",
      href: basePath,
      visible: true,
      status: schedulesNeedAttention
        ? { type: "warning", tooltip: "Schedules may need to be regenerated." }
        : { type: "none" },
    },
    {
      key: "preferences",
      label: "Preferences",
      href: `${basePath}/preferences`,
      visible: true,
      status: hasAffectedBuddyReview
        ? {
            type: "warning",
            tooltip: "You need to review your preferences.",
          }
        : prefsComplete && myHasNoCombos && !!group.scheduleGeneratedAt
          ? {
              type: "warning",
              tooltip:
                "You didn't receive any sessions on your schedule. Review and update your preferences.",
            }
          : !prefsComplete
            ? {
                type: "warning",
                tooltip: "You haven't entered your preferences yet.",
              }
            : { type: "complete" },
    },
    {
      key: "schedule",
      label: "My Schedule",
      href: `${basePath}/schedule`,
      visible: true,
      status: !group.scheduleGeneratedAt
        ? { type: "warning", tooltip: "Schedules have not been generated yet." }
        : anyMemberHasNoCombos
          ? { type: "warning", tooltip: getScheduleWarning() }
          : schedulesNeedAttention
            ? {
                type: "warning",
                tooltip: "Schedules may need to be regenerated.",
              }
            : { type: "complete" },
    },
    {
      key: "group-schedule",
      label: "Group Schedule",
      href: `${basePath}/group-schedule`,
      visible: true,
      status: !group.scheduleGeneratedAt
        ? { type: "warning", tooltip: "Schedules have not been generated yet." }
        : !hasDateConfig
          ? {
              type: "warning",
              tooltip:
                "Owner needs to configure dates before the group schedule can be viewed.",
            }
          : anyMemberHasNoCombos
            ? {
                type: "warning",
                tooltip:
                  "Schedules unavailable — some members didn't receive any sessions.",
              }
            : schedulesNeedAttention
              ? {
                  type: "warning",
                  tooltip: "Schedules may need to be regenerated.",
                }
              : inScheduleReview && group.windowRankings.length > 0
                ? { type: "complete" }
                : { type: "none" },
    },
    {
      key: "purchase-tracker",
      label: "Purchase Planner & Tracker",
      href: `${basePath}/purchase-tracker`,
      visible: true,
      status: !group.scheduleGeneratedAt
        ? { type: "warning", tooltip: "Schedules have not been generated yet." }
        : anyMemberHasNoCombos
          ? {
              type: "warning",
              tooltip:
                "Schedules unavailable — some members didn't receive any sessions.",
            }
          : schedulesNeedAttention
            ? {
                type: "warning",
                tooltip: "Schedules may need to be regenerated.",
              }
            : group.myTimeslot
              ? { type: "complete" }
              : {
                  type: "warning",
                  tooltip: "You haven't entered your purchase timeslot yet.",
                },
    },
  ];

  const activeKey =
    navItems.find(
      (item) => item.key !== "overview" && pathname.startsWith(item.href)
    )?.key ?? "overview";

  return (
    <NavigationGuardProvider>
      <SidePanelProvider>
        <GroupSyncProvider onSync={handleSync}>
          <div className="px-4 py-4 md:px-6 md:py-8">
            <GuardedLink
              href="/groups"
              className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-slate-700 md:mb-6"
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
            </GuardedLink>

            <GroupHeader
              group={group}
              isOwner={isOwner}
              onOpenSettings={() => setShowSettings(true)}
              onNameSaved={() => router.refresh()}
            />

            <GroupContentArea navItems={navItems} activeKey={activeKey}>
              {children}
            </GroupContentArea>

            {showSettings && (
              <GroupSettingsModal
                group={group}
                isOwner={isOwner}
                onClose={() => setShowSettings(false)}
              />
            )}
          </div>
        </GroupSyncProvider>
      </SidePanelProvider>
    </NavigationGuardProvider>
  );
}

function GroupContentArea({
  navItems,
  activeKey,
  children,
}: {
  navItems: NavItem[];
  activeKey: string;
  children: React.ReactNode;
}) {
  const { panel } = useSidePanel();
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  return (
    <div className="mt-4 md:mt-8">
      {/* Mobile: horizontal scrollable tabs */}
      <nav className="mb-4 md:hidden">
        <div className="-mx-4 overflow-x-auto px-4">
          <ul className="flex gap-1 pb-2">
            {navItems
              .filter((item) => item.visible)
              .map((item) => (
                <li key={item.key} className="shrink-0">
                  <GuardedLink
                    href={item.href}
                    className={`group/nav relative flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      activeKey === item.key
                        ? "bg-[#009de5]/10 text-[#009de5]"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    {item.label}
                    {item.status.type === "complete" && <NavCheckIcon />}
                    {item.status.type === "warning" && <NavWarningIcon />}
                  </GuardedLink>
                </li>
              ))}
          </ul>
        </div>
      </nav>

      <div className="flex gap-8">
        {/* Desktop: Navigation sidebar */}
        <nav className="hidden w-48 shrink-0 md:block">
          <ul className="space-y-1">
            {navItems
              .filter((item) => item.visible)
              .map((item) => (
                <li key={item.key}>
                  <GuardedLink
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
                  </GuardedLink>
                </li>
              ))}
          </ul>
        </nav>

        {/* Main content */}
        <div className="min-w-0 flex-1 overflow-x-hidden">{children}</div>

        {/* Desktop: Side panel */}
        {panel && (
          <aside className="hidden w-72 shrink-0 lg:block">
            <div className="sticky top-3">{panel}</div>
          </aside>
        )}
      </div>

      {/* Mobile: Filters toggle button */}
      {panel && (
        <button
          onClick={() => setShowMobileFilters(true)}
          className="fixed bottom-4 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[#009de5] text-white shadow-lg transition-transform hover:scale-105 lg:hidden"
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
              d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75"
            />
          </svg>
        </button>
      )}

      {/* Mobile: Filters slide-up panel */}
      {panel && showMobileFilters && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowMobileFilters(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Filters</h3>
              <button
                onClick={() => setShowMobileFilters(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
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
            {panel}
          </div>
        </div>
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

function GuardedLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { guardNavigation } = useNavigationGuard();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <Link
      href={href}
      className={className}
      onClick={(e) => {
        if (!guardNavigation(href)) {
          e.preventDefault();
          return;
        }
        // If already on this page, refresh to get fresh data
        if (pathname === href) {
          e.preventDefault();
          router.refresh();
          window.dispatchEvent(new CustomEvent("tab-refetch"));
        }
      }}
    >
      {children}
    </Link>
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
