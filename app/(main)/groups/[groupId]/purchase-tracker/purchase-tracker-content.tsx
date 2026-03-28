"use client";

import React, {
  useState,
  useEffect,
  useTransition,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useGroup } from "../_components/group-context";
import { useSidePanel } from "../_components/side-panel-context";
import { useNavigationGuard } from "../_components/navigation-guard-context";
import {
  getPurchaseTrackerData,
  lookupSession,
  searchSessionCodes,
} from "./actions";
import type {
  PurchaseTrackerData,
  TrackerDay,
  TrackerSession,
  TrackerMember,
  OffScheduleSession,
  ExcludedSession,
  SessionSuggestion,
} from "./actions";
import {
  savePurchasePlanEntry,
  removePurchasePlanEntry,
  batchSavePurchasePlan,
  markAsPurchased,
  markAsSoldOut,
  unmarkSoldOut,
  reportSessionPrice,
  updateReportedPrice,
  deleteReportedPrice,
  removePurchaseAssignee,
  updatePurchaseAssigneePrice,
  markAsOutOfBudget,
  unmarkOutOfBudget,
} from "../schedule/purchase-actions";
import type {
  PurchaseData,
  ReportedPriceData,
} from "../schedule/purchase-actions";
import { PageError, PageEmpty } from "@/components/page-state";
import FilterPill, { FilterGroup } from "@/components/filter-pill";
import SidebarSearch from "@/components/sidebar-search";
import {
  type SportColor,
  FALLBACK_SPORT_COLOR,
  buildSportColorMap,
} from "@/lib/schedule-utils";
import {
  formatSessionTime,
  formatSessionDate,
  formatActionTimestamp,
  formatPrice,
} from "@/lib/utils";
import type { AvatarColor } from "@/lib/constants";
import UserAvatar from "@/components/user-avatar";
import * as Sentry from "@sentry/nextjs";
import {
  ChevronDown,
  ChevronUp,
  Check,
  X,
  ClipboardList,
  DollarSign,
  Search,
  ShoppingCart,
  Pencil,
  Trash2,
  Ban,
} from "lucide-react";
import { useScrollLock } from "@/lib/use-scroll-lock";

// ── Sport color helper ───────────────────────────────────────────────────────
const OFF_SCHEDULE_COLOR: SportColor = {
  bg: "#f1f5f9",
  border: "#94a3b8",
  text: "#475569",
  title: "#334155",
};

function formatDateRange(start: string, end: string): string {
  const s = new Date(start + "T12:00:00");
  const e = new Date(end + "T12:00:00");
  const sStr = s.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const eStr = e.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  return `${sStr} – ${eStr}`;
}

// ── Currency input ────────────────────────────────────────────────────────────
function CurrencyInput({
  value,
  onChange,
  placeholder,
  disabled,
  className,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  autoFocus?: boolean;
}) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    let raw = e.target.value.replace(/[^0-9.]/g, "");
    // Don't allow starting with "."
    if (raw === ".") return;
    // Allow only one decimal point, max 2 decimal places
    const parts = raw.split(".");
    if (parts.length > 2) return;
    if (parts[1] && parts[1].length > 2) return;
    // No leading zeros unless it's "0" or "0."
    if (parts[0].length > 1 && parts[0].startsWith("0")) {
      parts[0] = parts[0].replace(/^0+/, "") || "0";
      raw = parts.join(".");
    }
    onChange(raw);
  }

  function handleBlur() {
    if (!value) return;
    if (value.includes(".")) {
      const [whole, dec = ""] = value.split(".");
      onChange(`${whole}.${dec.padEnd(2, "0")}`);
    }
  }

  return (
    <div className={`relative ${className ?? ""}`}>
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">
        $
      </span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        className="w-full rounded-lg border border-slate-200 py-2 pl-7 pr-2.5 text-sm text-slate-700 focus:border-[#009de5] focus:outline-none focus:ring-1 focus:ring-[#009de5] disabled:opacity-50"
      />
    </div>
  );
}

// ── Session-level overrides (shared across combos) ───────────────────────────
type SessionOverrides = {
  ceilings?: Map<string, number | null>;
  soldOut?: boolean;
  outOfBudget?: boolean;
  purchases?: PurchaseData[];
  reportedPrices?: ReportedPriceData[];
};

// ── Main component ───────────────────────────────────────────────────────────
export default function PurchaseTrackerContent() {
  const group = useGroup();
  const { setPanel } = useSidePanel();
  const [data, setData] = useState<PurchaseTrackerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeWindowId, setActiveWindowId] = useState<string | null>(
    group.dateMode === "specific" ? "specific-range" : null
  );
  // Shared overrides keyed by session code — applies to all combos containing this session
  const [sessionOverrides, setSessionOverrides] = useState<
    Map<string, SessionOverrides>
  >(new Map());
  // Global expand/collapse: incremented on each toggle, odd = expanded, even = collapsed
  // DayCards sync to this value so it applies across filter/window changes
  const [expandCounter, setExpandCounter] = useState(1); // start expanded (odd)
  const globalExpanded = expandCounter % 2 === 1;
  // True when any session row is editing or saving — disables all other rows
  const [globalBusy, setGlobalBusy] = useState(false);
  // Purchase status filter
  const [statusFilter, setStatusFilter] = useState<
    "all" | "purchased" | "not_purchased"
  >("all");
  const [soldOutFilter, setSoldOutFilter] = useState<
    "all" | "sold_out" | "available"
  >("all");
  // Search within on-schedule sessions
  const [scheduledSearch, setScheduledSearch] = useState("");

  // Navigation guard — warn if editing in progress
  const { setDirtyChecker } = useNavigationGuard();
  const dirtyChecker = useCallback(
    () => (globalBusy ? ["Purchase Tracker"] : []),
    [globalBusy]
  );
  useEffect(() => {
    setDirtyChecker(dirtyChecker);
    return () => setDirtyChecker(null);
  }, [dirtyChecker, setDirtyChecker]);

  // Render filters into the side panel
  useEffect(() => {
    if (loading || !data || data.days.length === 0) {
      setPanel(null);
      return () => setPanel(null);
    }
    setPanel(
      <PurchaseTrackerSidebar
        group={group}
        data={data}
        activeWindowId={activeWindowId}
        onSetActiveWindowId={setActiveWindowId}
        statusFilter={statusFilter}
        onSetStatusFilter={setStatusFilter}
        soldOutFilter={soldOutFilter}
        onSetSoldOutFilter={setSoldOutFilter}
        disabled={globalBusy}
      />
    );
    return () => setPanel(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    setPanel,
    loading,
    data,
    activeWindowId,
    statusFilter,
    soldOutFilter,
    globalBusy,
  ]);

  // Also guard browser reload/close
  useEffect(() => {
    if (!globalBusy) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [globalBusy]);

  const fetchData = () => {
    setLoading(true);
    getPurchaseTrackerData(group.id).then((result) => {
      setLoading(false);
      if (result.error) {
        setError(result.error);
      } else {
        setData(result.data ?? null);
        // Clear stale optimistic overrides — fresh server data is authoritative
        setSessionOverrides(new Map());
        if (result.data) {
          setActiveWindowId((prev) => {
            if (prev !== null) return prev; // already set
            // Default to top-ranked window, then null (show all)
            return result.data!.windowRankings[0]?.id ?? null;
          });
        }
      }
    });
  };

  const hasSchedules = !!group.scheduleGeneratedAt;
  const hasTimeslotKey = !!group.myTimeslot;
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    group.id,
    hasSchedules,
    group.membersWithNoCombos.length,
    group.dateMode,
    group.startDate,
    group.endDate,
    group.consecutiveDays,
    hasTimeslotKey,
  ]);

  // Re-fetch when the user clicks the same nav tab
  useEffect(() => {
    const handler = () => fetchData();
    window.addEventListener("tab-refetch", handler);
    return () => window.removeEventListener("tab-refetch", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sportColorMap = useMemo(() => {
    if (!data) return new Map<string, SportColor>();
    // Extract unique sports from days for color mapping
    const trackerSports: string[] = [];
    const seenSports = new Set<string>();
    for (const day of data.days) {
      for (const s of [...day.primary, ...day.backup1, ...day.backup2]) {
        if (!seenSports.has(s.sport)) {
          seenSports.add(s.sport);
          trackerSports.push(s.sport);
        }
      }
    }
    return buildSportColorMap(trackerSports);
  }, [data]);

  const onScheduleCodes = useMemo(() => {
    if (!data) return new Set<string>();
    const codes = new Set<string>();
    for (const day of data.days) {
      for (const s of day.primary) codes.add(s.sessionCode);
      for (const s of day.backup1) codes.add(s.sessionCode);
      for (const s of day.backup2) codes.add(s.sessionCode);
    }
    return codes;
  }, [data]);

  const excludedCodes = useMemo(() => {
    if (!data) return new Set<string>();
    return new Set(data.excludedSessions.map((s) => s.sessionCode));
  }, [data]);

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center">
        <p className="text-sm text-slate-500">Loading...</p>
      </div>
    );
  }

  if (error) {
    return <PageError message={error} />;
  }

  if (!data) {
    return null;
  }

  return (
    <section>
      <h2 className="mb-1 text-lg font-semibold text-slate-900">
        Purchase Planner & Tracker
      </h2>
      <p className="mb-3 text-sm text-slate-400">
        All session times are displayed in Pacific Time. Purchased sessions are
        guaranteed to appear on any future schedule generations.
      </p>

      {/* Scheduled sessions by day */}
      {!group.scheduleGeneratedAt ? (
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Scheduled Sessions
          </h3>
          <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-10 text-center">
            <p className="text-sm text-slate-500">
              Scheduled sessions will appear here once the owner has generated
              schedules for the group.
            </p>
          </div>
        </div>
      ) : group.membersWithNoCombos.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Scheduled Sessions
          </h3>
          <div className="mt-4 rounded-xl border border-dashed border-red-200 bg-red-50/50 px-6 py-10 text-center">
            <p className="text-sm font-bold text-red-600">
              Some members received no sessions on their schedules.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              This may occur if there isn&apos;t enough session interest overlap
              to fulfill buddy requirements. Wait for affected members to update
              their preferences and then regenerate schedules.
            </p>
          </div>
        </div>
      ) : (
        (() => {
          const activeWindow = data.windowRankings.find(
            (w) => w.id === activeWindowId
          );
          // For specific mode, "specific-range" sentinel filters by the fixed date range
          const specificStart =
            activeWindowId === "specific-range" && group.dateMode === "specific"
              ? group.startDate
              : null;
          const specificEnd =
            activeWindowId === "specific-range" && group.dateMode === "specific"
              ? group.endDate
              : null;
          const filteredDays = activeWindow
            ? data.days.filter(
                (d) =>
                  d.day >= activeWindow.startDate &&
                  d.day <= activeWindow.endDate
              )
            : specificStart && specificEnd
              ? data.days.filter(
                  (d) => d.day >= specificStart && d.day <= specificEnd
                )
              : data.days;

          // Apply search filter to sessions within each day
          const searchQ = scheduledSearch.trim().toLowerCase();
          const searchFilteredDays = searchQ
            ? filteredDays
                .map((day) => {
                  const matchSession = (s: TrackerSession) => {
                    const haystack =
                      `${s.sport} ${s.sessionCode} ${s.sessionType} ${s.sessionDescription ?? ""} ${s.venue} ${s.zone}`.toLowerCase();
                    return haystack.includes(searchQ);
                  };
                  return {
                    ...day,
                    primary: day.primary.filter(matchSession),
                    backup1: day.backup1.filter(matchSession),
                    backup2: day.backup2.filter(matchSession),
                  };
                })
                .filter(
                  (day) =>
                    day.primary.length > 0 ||
                    day.backup1.length > 0 ||
                    day.backup2.length > 0
                )
            : filteredDays;

          // Check if any day has sessions matching the active filters + search
          const hasMatchingSessions =
            searchFilteredDays.length > 0 &&
            ((statusFilter === "all" && soldOutFilter === "all") ||
              searchFilteredDays.some((day) => {
                const allSessions = [
                  ...day.primary,
                  ...day.backup1,
                  ...day.backup2,
                ];
                return allSessions.some((s) => {
                  const overrides = sessionOverrides.get(s.sessionCode);
                  if (statusFilter !== "all") {
                    const purchases = overrides?.purchases ?? s.purchases;
                    const hasPurchases = purchases.length > 0;
                    if (statusFilter === "purchased" && !hasPurchases)
                      return false;
                    if (statusFilter === "not_purchased" && hasPurchases)
                      return false;
                  }
                  if (soldOutFilter !== "all") {
                    const isSoldOut = overrides?.soldOut ?? s.isSoldOut;
                    if (soldOutFilter === "sold_out" && !isSoldOut)
                      return false;
                    if (soldOutFilter === "available" && isSoldOut)
                      return false;
                  }
                  return true;
                });
              }));

          return filteredDays.length > 0 ? (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-900">
                Scheduled Sessions
              </h3>
              <p className="text-sm text-slate-500">
                Expand each session accordion to plan or enter ticket purchase
                information. Currently displaying the sessions from the selected
                attendance window. You can update the selected window in the
                filters.
              </p>
              <div className="flex items-center justify-end">
                {globalExpanded ? (
                  <button
                    onClick={() => setExpandCounter((c) => c + 1)}
                    disabled={globalBusy}
                    className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-50"
                  >
                    <ChevronUp size={14} />
                    Collapse All
                  </button>
                ) : (
                  <button
                    onClick={() => setExpandCounter((c) => c + 1)}
                    disabled={globalBusy}
                    className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-50"
                  >
                    <ChevronDown size={14} />
                    Expand All
                  </button>
                )}
              </div>
              <SidebarSearch
                value={scheduledSearch}
                onChange={setScheduledSearch}
                disabled={globalBusy}
                placeholder="Search by code, sport, venue..."
              />
              {hasMatchingSessions ? (
                searchFilteredDays.map((day) => (
                  <DayCard
                    key={day.day}
                    day={day}
                    members={data.members}
                    groupId={group.id}
                    currentMemberId={group.myMemberId}
                    statusFilter={statusFilter}
                    soldOutFilter={soldOutFilter}
                    sessionOverrides={sessionOverrides}
                    onSessionOverride={(code, overrides) => {
                      setSessionOverrides((prev) => {
                        const next = new Map(prev);
                        next.set(code, { ...prev.get(code), ...overrides });
                        return next;
                      });
                    }}
                    onRefresh={fetchData}
                    globalBusy={globalBusy}
                    onSetGlobalBusy={setGlobalBusy}
                    expandCounter={expandCounter}
                    sportColorMap={sportColorMap}
                    hasTimeslot={data.hasTimeslot}
                  />
                ))
              ) : searchQ ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 px-6 py-10 text-center">
                  <p className="text-sm text-slate-500">
                    No scheduled sessions match your search.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 px-6 py-10 text-center">
                  <p className="text-sm text-slate-500">
                    No sessions match the current filters.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 px-6 py-10 text-center">
              <p className="text-sm text-slate-500">
                {activeWindow
                  ? "No sessions in this window."
                  : "Schedules need to be regenerated due to status changes. Check the Overview page."}
              </p>
            </div>
          );
        })()
      )}

      {/* Off-schedule purchases */}
      <div className="mt-8">
        <OffSchedulePurchase
          groupId={group.id}
          currentMemberId={group.myMemberId}
          members={data.members}
          initialSessions={data.offScheduleSessions}
          sportColorMap={sportColorMap}
          disabled={globalBusy}
          hasTimeslot={data.hasTimeslot}
          onScheduleCodes={onScheduleCodes}
          excludedCodes={excludedCodes}
          onRefresh={fetchData}
          onSetGlobalBusy={setGlobalBusy}
        />
      </div>

      {/* Excluded sessions — only relevant after schedule generation */}
      {group.scheduleGeneratedAt && (
        <div className="mt-8">
          <ExcludedSessions
            groupId={group.id}
            initialSessions={data.excludedSessions}
            disabled={globalBusy}
            hasTimeslot={data.hasTimeslot}
          />
        </div>
      )}
    </section>
  );
}

// ── Day card ─────────────────────────────────────────────────────────────────
function DayCard({
  day,
  members,
  groupId,
  currentMemberId,
  statusFilter,
  soldOutFilter,
  sessionOverrides,
  onSessionOverride,
  onRefresh,
  globalBusy,
  onSetGlobalBusy,
  expandCounter,
  sportColorMap,
  hasTimeslot,
}: {
  day: TrackerDay;
  members: TrackerMember[];
  groupId: string;
  currentMemberId: string;
  statusFilter: "all" | "purchased" | "not_purchased";
  soldOutFilter: "all" | "sold_out" | "available";
  sessionOverrides: Map<string, SessionOverrides>;
  onSessionOverride: (
    code: string,
    overrides: Partial<SessionOverrides>
  ) => void;
  onRefresh: () => void;
  globalBusy: boolean;
  onSetGlobalBusy: (busy: boolean) => void;
  expandCounter: number;
  sportColorMap: Map<string, SportColor>;
  hasTimeslot: boolean;
}) {
  const shouldExpand = expandCounter % 2 === 1;
  const [expanded, setExpanded] = useState(shouldExpand);
  const [showBackups, setShowBackups] = useState(shouldExpand);
  const [prevExpandCounter, setPrevExpandCounter] = useState(expandCounter);

  function filterSession(s: TrackerSession): boolean {
    const overrides = sessionOverrides.get(s.sessionCode);
    // Purchase status filter
    if (statusFilter !== "all") {
      const purchases = overrides?.purchases ?? s.purchases;
      const hasPurchases = purchases.length > 0;
      if (statusFilter === "purchased" && !hasPurchases) return false;
      if (statusFilter === "not_purchased" && hasPurchases) return false;
    }
    // Sold out filter
    if (soldOutFilter !== "all") {
      const isSoldOut = overrides?.soldOut ?? s.isSoldOut;
      if (soldOutFilter === "sold_out" && !isSoldOut) return false;
      if (soldOutFilter === "available" && isSoldOut) return false;
    }
    return true;
  }

  const filteredPrimary = day.primary.filter(filterSession);
  const filteredBackup1 = day.backup1.filter(filterSession);
  const filteredBackup2 = day.backup2.filter(filterSession);
  const hasBackups = filteredBackup1.length > 0 || filteredBackup2.length > 0;
  const hasAnySessions = filteredPrimary.length > 0 || hasBackups;

  if (prevExpandCounter !== expandCounter) {
    setPrevExpandCounter(expandCounter);
    setExpanded(expandCounter % 2 === 1);
    setShowBackups(expandCounter % 2 === 1);
  }

  function toggleDay() {
    if (expanded) {
      setExpanded(false);
      setShowBackups(false);
    } else {
      setExpanded(true);
      setShowBackups(true);
    }
  }

  if (!hasAnySessions) return null;

  return (
    <div className="rounded-xl border border-slate-300 bg-white">
      {/* Day header */}
      <button
        onClick={() => !globalBusy && toggleDay()}
        className={`flex w-full items-center justify-between px-5 py-3 text-left transition-colors ${globalBusy ? "opacity-75" : "hover:bg-slate-50"}`}
      >
        <div>
          <h4 className="text-sm font-semibold text-slate-900">
            {formatSessionDate(day.day)}
          </h4>
          <p className="group/priority relative inline-flex items-center gap-1 text-sm text-slate-500">
            Priority Score:{" "}
            <span className="font-semibold">
              {day.primaryScore.toFixed(2).replace(/0$/, "")}
            </span>
            <svg
              className="h-4 w-4 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
              />
            </svg>
            <span className="pointer-events-none absolute bottom-full left-0 z-10 mb-1.5 w-64 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-normal leading-snug text-white opacity-0 shadow-lg transition-opacity group-hover/priority:opacity-100">
              This score is calculated based on your interest level in this
              day&apos;s sessions. A higher priority score indicates you had
              more interest in this day&apos;s sessions.
            </span>
          </p>
        </div>
        {expanded ? (
          <ChevronUp size={20} className="text-slate-400" />
        ) : (
          <ChevronDown size={20} className="text-slate-400" />
        )}
      </button>

      {/* Primary combo */}
      {expanded && filteredPrimary.length > 0 && (
        <div className="border-t border-slate-200 px-5 py-3">
          <div className="mb-2 flex items-center gap-1.5">
            <span
              className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold leading-none text-white"
              style={{ backgroundColor: "#009de5" }}
            >
              P
            </span>
            <span className="text-xs font-semibold text-slate-500">
              Primary
            </span>
          </div>
          <div className="space-y-2">
            {filteredPrimary.map((s) => (
              <SessionRow
                key={s.sessionCode}
                session={s}
                members={members}
                groupId={groupId}
                currentMemberId={currentMemberId}
                overrides={sessionOverrides.get(s.sessionCode)}
                onOverride={(o) => onSessionOverride(s.sessionCode, o)}
                onRefresh={onRefresh}
                globalBusy={globalBusy}
                onSetGlobalBusy={onSetGlobalBusy}
                sportColorMap={sportColorMap}
                hasTimeslot={hasTimeslot}
              />
            ))}
          </div>
        </div>
      )}

      {/* Backup combos */}
      {expanded && hasBackups && (
        <>
          <div className="flex items-center justify-between border-t border-slate-200 px-5 py-2">
            <p className="text-sm text-slate-500">
              If you&apos;re unable to purchase sessions in your primary combo,
              move on to the backup combo sessions.
            </p>
            <button
              onClick={() => !globalBusy && setShowBackups(!showBackups)}
              className={`flex flex-shrink-0 items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 transition-colors ${globalBusy ? "opacity-50" : "hover:bg-slate-50"}`}
            >
              {showBackups ? "Hide" : "Show"} Backups
              {showBackups ? (
                <ChevronUp size={20} />
              ) : (
                <ChevronDown size={20} />
              )}
            </button>
          </div>
          {showBackups && filteredBackup1.length > 0 && (
            <div className="border-t border-slate-200 px-5 py-3">
              <div className="mb-2 flex items-center gap-1.5">
                <span
                  className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold leading-none text-white"
                  style={{ backgroundColor: "#d97706" }}
                >
                  B1
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  Backup 1
                </span>
              </div>
              <div className="space-y-2">
                {filteredBackup1.map((s) => (
                  <SessionRow
                    key={s.sessionCode}
                    session={s}
                    members={members}
                    groupId={groupId}
                    currentMemberId={currentMemberId}
                    overrides={sessionOverrides.get(s.sessionCode)}
                    onOverride={(o) => onSessionOverride(s.sessionCode, o)}
                    onRefresh={onRefresh}
                    globalBusy={globalBusy}
                    onSetGlobalBusy={onSetGlobalBusy}
                    sportColorMap={sportColorMap}
                    hasTimeslot={hasTimeslot}
                  />
                ))}
              </div>
            </div>
          )}
          {showBackups && filteredBackup2.length > 0 && (
            <div className="border-t border-slate-200 px-5 py-3">
              <div className="mb-2 flex items-center gap-1.5">
                <span
                  className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold leading-none text-white"
                  style={{ backgroundColor: "#ff0080" }}
                >
                  B2
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  Backup 2
                </span>
              </div>
              <div className="space-y-2">
                {filteredBackup2.map((s) => (
                  <SessionRow
                    key={s.sessionCode}
                    session={s}
                    members={members}
                    groupId={groupId}
                    currentMemberId={currentMemberId}
                    overrides={sessionOverrides.get(s.sessionCode)}
                    onOverride={(o) => onSessionOverride(s.sessionCode, o)}
                    onRefresh={onRefresh}
                    globalBusy={globalBusy}
                    onSetGlobalBusy={onSetGlobalBusy}
                    sportColorMap={sportColorMap}
                    hasTimeslot={hasTimeslot}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Session row ──────────────────────────────────────────────────────────────
function SessionRow({
  session: s,
  members,
  groupId,
  currentMemberId,
  overrides,
  onOverride,
  onRefresh,
  globalBusy,
  onSetGlobalBusy,
  sportColorMap,
  hasTimeslot,
}: {
  session: TrackerSession;
  members: TrackerMember[];
  groupId: string;
  currentMemberId: string;
  overrides: SessionOverrides | undefined;
  onOverride: (o: Partial<SessionOverrides>) => void;
  onRefresh: () => void;
  globalBusy: boolean;
  onSetGlobalBusy: (busy: boolean) => void;
  sportColorMap: Map<string, SportColor>;
  hasTimeslot: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [activeModal, setActiveModal] = useState<
    | "ceiling"
    | "soldout"
    | "price"
    | "purchase"
    | "outofbudget"
    | "info"
    | "edit-price"
    | null
  >(null);
  const [editingAssignee, setEditingAssignee] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editingPriceData, setEditingPriceData] =
    useState<ReportedPriceData | null>(null);
  const [editingCeiling, setEditingCeiling] = useState<string | null>(null);
  const [editCeilingValue, setEditCeilingValue] = useState("");
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  // Inline error anchored to a specific row (e.g. "purchase-id-member-id" or "ceiling-member-id")
  const [rowError, setRowError] = useState<{
    key: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (actionError) {
      const timer = setTimeout(() => setActionError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [actionError]);

  // This row is actively editing/saving
  const localBusy =
    isPending || editingAssignee !== null || editingCeiling !== null;
  // Disabled if any row on the page is busy (including this one for non-edit buttons)
  const busy = globalBusy;

  // Sync local busy state to global — use effect for cleanup (when localBusy goes false)
  useEffect(() => {
    if (!localBusy) onSetGlobalBusy(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localBusy]);

  // Use overrides if available, otherwise fall back to server data
  const localCeilings: Map<string, number | null> =
    overrides?.ceilings ??
    new Map(
      s.purchasePlanEntries.map(
        (e) => [e.assigneeMemberId, e.priceCeiling] as [string, number | null]
      )
    );
  const localSoldOut: boolean = overrides?.soldOut ?? s.isSoldOut;
  const localPurchases: PurchaseData[] = overrides?.purchases ?? s.purchases;
  const localReportedPrices: ReportedPriceData[] =
    overrides?.reportedPrices ?? s.reportedPrices;
  const localOutOfBudget: boolean = overrides?.outOfBudget ?? s.isOutOfBudget;
  const [showPriceHistory, setShowPriceHistory] = useState(false);
  const [showPurchaseHistory, setShowPurchaseHistory] = useState(false);

  const color = sportColorMap.get(s.sport) ?? FALLBACK_SPORT_COLOR;
  const hasPurchases = localPurchases.length > 0;

  // Members who already have tickets for this session
  const attendingMemberIds = new Set(
    localPurchases.flatMap((p) => p.assignees.map((a) => a.memberId))
  );
  // Interested members minus attending — for plan purchases modal
  const eligibleMembers = s.interestedMembers.filter(
    (m) => !attendingMemberIds.has(m.memberId)
  );
  // All group members minus attending — for record purchase modal
  const purchaseEligibleMembers = members.filter(
    (m) => !attendingMemberIds.has(m.memberId)
  );
  const allMembersAttending =
    purchaseEligibleMembers.length === 0 && members.length > 0;

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      {/* Session summary row */}
      <button
        onClick={() => !busy && setExpanded(!expanded)}
        className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${busy ? "opacity-75" : "hover:bg-slate-50"}`}
      >
        <div
          className="w-1 flex-shrink-0 self-stretch rounded-full"
          style={{ backgroundColor: color.border }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold" style={{ color: color.border }}>
              {s.sessionCode}
            </span>
            <span
              className="rounded px-1.5 py-0.5 text-xs font-semibold text-white"
              style={{ backgroundColor: color.border }}
            >
              {s.sport}
            </span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">
              {s.sessionType}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <p className="text-xs text-slate-400">
              {formatSessionTime(s.startTime)} &ndash;{" "}
              {formatSessionTime(s.endTime)} &middot; {s.venue}
            </p>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                setActiveModal("info");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  e.preventDefault();
                  setActiveModal("info");
                }
              }}
              className="text-xs font-medium transition-colors hover:underline"
              style={{ color: color.border }}
            >
              View Full Session Details
            </span>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {hasPurchases && (
            <span className="group/purchased relative flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100">
              <Check size={10} className="text-emerald-600" />
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-800 px-2 py-1 text-xs font-normal text-white opacity-0 shadow-lg transition-opacity group-hover/purchased:opacity-100">
                At least 1 user has purchased tickets for this session.
              </span>
            </span>
          )}
          {localSoldOut && (
            <span className="group/soldout relative flex h-5 w-5 items-center justify-center rounded-full bg-red-100">
              <X size={10} className="text-red-600" />
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-800 px-2 py-1 text-xs font-normal text-white opacity-0 shadow-lg transition-opacity group-hover/soldout:opacity-100">
                Sold Out
              </span>
            </span>
          )}
          {localOutOfBudget && (
            <span className="group/oob relative flex h-5 w-5 items-center justify-center rounded-full bg-amber-100">
              <Ban size={10} className="text-amber-600" />
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-800 px-2 py-1 text-xs font-normal text-white opacity-0 shadow-lg transition-opacity group-hover/oob:opacity-100">
                Out of Budget
              </span>
            </span>
          )}
          {expanded ? (
            <ChevronUp size={20} className="text-slate-400" />
          ) : (
            <ChevronDown size={20} className="text-slate-400" />
          )}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="space-y-4 border-t border-slate-100 px-4 py-3">
          {/* Purchase plan & recorded purchases side by side */}
          {(localCeilings.size > 0 || hasPurchases) && (
            <div className="flex gap-6">
              {/* Purchase plan */}
              {localCeilings.size > 0 && (
                <div className="flex-1">
                  <p className="mb-2 text-sm font-semibold text-slate-600">
                    Planned Purchases:
                  </p>
                  <table className="w-auto border-collapse">
                    <thead>
                      <tr>
                        <th className="pb-1 pr-6 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Member
                        </th>
                        <th className="pb-1 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Price Ceiling (Optional)
                        </th>
                        <th className="pb-1 text-left text-xs font-semibold uppercase tracking-wide text-slate-400" />
                      </tr>
                    </thead>
                    <tbody>
                      {[...localCeilings.entries()].map(
                        ([memberId, ceiling]) => {
                          const m = members.find(
                            (mm) => mm.memberId === memberId
                          );
                          if (!m) return null;
                          const name =
                            memberId === currentMemberId
                              ? "Yourself"
                              : `${m.firstName} ${m.lastName}`;
                          const isCeilingEditing = editingCeiling === memberId;
                          const ceilingRowKey = `ceiling-${memberId}`;
                          return (
                            <React.Fragment key={memberId}>
                              <tr>
                                <td className="py-1 pr-6">
                                  <div className="flex items-center gap-2">
                                    <UserAvatar
                                      firstName={m.firstName}
                                      lastName={m.lastName}
                                      avatarColor={m.avatarColor}
                                      size="sm"
                                    />
                                    <span className="text-sm font-medium text-slate-700">
                                      {name}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-1 pr-4 text-sm text-slate-500">
                                  {isCeilingEditing ? (
                                    <div className="flex items-center gap-1">
                                      <CurrencyInput
                                        value={editCeilingValue}
                                        onChange={setEditCeilingValue}
                                        className="w-24"
                                        autoFocus
                                      />
                                      <button
                                        onClick={() => {
                                          const price =
                                            editCeilingValue === ""
                                              ? null
                                              : parseFloat(editCeilingValue);
                                          startTransition(async () => {
                                            try {
                                              const result =
                                                await savePurchasePlanEntry(
                                                  groupId,
                                                  {
                                                    sessionId: s.sessionCode,
                                                    assigneeMemberId: memberId,
                                                    priceCeiling:
                                                      price != null
                                                        ? price
                                                        : null,
                                                  }
                                                );
                                              if (result.error) {
                                                setActionError(result.error);
                                                return;
                                              }
                                              const next = new Map(
                                                localCeilings
                                              );
                                              next.set(
                                                memberId,
                                                price != null ? price : null
                                              );
                                              onOverride({ ceilings: next });
                                              setEditingCeiling(null);
                                              setRowError(null);
                                            } catch (err) {
                                              Sentry.captureException(err, {
                                                extra: {
                                                  context:
                                                    "savePurchasePlanEntry ceiling",
                                                  groupId,
                                                },
                                              });
                                              setRowError({
                                                key: `ceiling-${memberId}`,
                                                message:
                                                  "An unexpected error occurred. Please try again.",
                                              });
                                            }
                                          });
                                        }}
                                        disabled={isPending}
                                        className="rounded p-1 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
                                      >
                                        <Check size={14} />
                                      </button>
                                      <button
                                        onClick={() => {
                                          setEditingCeiling(null);
                                          setRowError(null);
                                        }}
                                        className="rounded p-1 text-slate-400 hover:bg-slate-100"
                                      >
                                        <X size={14} />
                                      </button>
                                    </div>
                                  ) : ceiling != null ? (
                                    `$${ceiling}`
                                  ) : (
                                    "—"
                                  )}
                                </td>
                                <td className="py-1">
                                  {!isCeilingEditing && (
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => {
                                          onSetGlobalBusy(true);
                                          setEditingCeiling(memberId);
                                          setEditCeilingValue(
                                            ceiling != null
                                              ? String(ceiling)
                                              : ""
                                          );
                                        }}
                                        disabled={busy}
                                        className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
                                        title="Edit price ceiling"
                                      >
                                        <Pencil size={12} />
                                      </button>
                                      <button
                                        onClick={() => {
                                          startTransition(async () => {
                                            try {
                                              const result =
                                                await removePurchasePlanEntry(
                                                  groupId,
                                                  {
                                                    sessionId: s.sessionCode,
                                                    assigneeMemberId: memberId,
                                                  }
                                                );
                                              if (result.error) {
                                                setActionError(result.error);
                                                return;
                                              }
                                              const next = new Map(
                                                localCeilings
                                              );
                                              next.delete(memberId);
                                              onOverride({ ceilings: next });
                                              setRowError(null);
                                            } catch (err) {
                                              Sentry.captureException(err, {
                                                extra: {
                                                  context:
                                                    "removePurchasePlanEntry ceiling",
                                                  groupId,
                                                },
                                              });
                                              setRowError({
                                                key: `ceiling-${memberId}`,
                                                message:
                                                  "An unexpected error occurred. Please try again.",
                                              });
                                            }
                                          });
                                        }}
                                        disabled={busy}
                                        className="rounded p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                                        title="Remove from plan"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                              {rowError?.key === ceilingRowKey && (
                                <tr>
                                  <td colSpan={3} className="pb-1 pt-0.5">
                                    <p className="text-xs text-red-600">
                                      {rowError.message}
                                    </p>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        }
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Your purchases (editable) */}
              {(() => {
                const myPurchases = localPurchases.filter(
                  (p) => p.buyerMemberId === currentMemberId
                );
                const otherPurchases = localPurchases.filter(
                  (p) => p.buyerMemberId !== currentMemberId
                );
                return (
                  <>
                    {myPurchases.length > 0 && (
                      <div className="flex-1">
                        <p className="mb-2 text-sm font-semibold text-slate-600">
                          Your Purchases:
                        </p>
                        <table className="w-auto border-collapse">
                          <thead>
                            <tr>
                              <th className="pb-1 pr-6 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                                Member
                              </th>
                              <th className="pb-1 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                                Purchase Price
                              </th>
                              <th className="pb-1 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                                Purchase Recorded On
                              </th>
                              <th className="pb-1 text-left text-xs font-semibold uppercase tracking-wide text-slate-400" />
                            </tr>
                          </thead>
                          <tbody>
                            {myPurchases.flatMap((p) =>
                              p.assignees.map((a) => {
                                const isEditing =
                                  editingAssignee ===
                                  `${p.purchaseId}-${a.memberId}`;
                                const purchaseRowKey = `${p.purchaseId}-${a.memberId}`;
                                return (
                                  <React.Fragment key={purchaseRowKey}>
                                    <tr>
                                      <td className="py-1 pr-6">
                                        <div className="flex items-center gap-2">
                                          <UserAvatar
                                            firstName={a.firstName}
                                            lastName={a.lastName}
                                            avatarColor={a.avatarColor}
                                            size="sm"
                                          />
                                          <span className="text-sm font-medium text-slate-700">
                                            {a.memberId === currentMemberId
                                              ? "Yourself"
                                              : `${a.firstName} ${a.lastName}`}
                                          </span>
                                        </div>
                                      </td>
                                      <td className="py-1 pr-4 text-sm text-slate-500">
                                        {isEditing ? (
                                          <div className="flex items-center gap-1">
                                            <CurrencyInput
                                              value={editPrice}
                                              onChange={setEditPrice}
                                              className="w-24"
                                              autoFocus
                                            />
                                            <button
                                              onClick={() => {
                                                const price =
                                                  editPrice === ""
                                                    ? null
                                                    : parseFloat(editPrice);
                                                startTransition(async () => {
                                                  try {
                                                    const result =
                                                      await updatePurchaseAssigneePrice(
                                                        groupId,
                                                        {
                                                          purchaseId:
                                                            p.purchaseId,
                                                          memberId: a.memberId,
                                                          pricePaid:
                                                            price != null
                                                              ? price
                                                              : null,
                                                        }
                                                      );
                                                    if (result.error) {
                                                      setActionError(
                                                        result.error
                                                      );
                                                      return;
                                                    }
                                                    onOverride({
                                                      purchases:
                                                        localPurchases.map(
                                                          (pp) =>
                                                            pp.purchaseId ===
                                                            p.purchaseId
                                                              ? {
                                                                  ...pp,
                                                                  assignees:
                                                                    pp.assignees.map(
                                                                      (aa) =>
                                                                        aa.memberId ===
                                                                        a.memberId
                                                                          ? {
                                                                              ...aa,
                                                                              pricePaid:
                                                                                price !=
                                                                                null
                                                                                  ? price
                                                                                  : null,
                                                                            }
                                                                          : aa
                                                                    ),
                                                                }
                                                              : pp
                                                        ),
                                                    });
                                                    setEditingAssignee(null);
                                                    setRowError(null);
                                                  } catch (err) {
                                                    Sentry.captureException(
                                                      err,
                                                      {
                                                        extra: {
                                                          context:
                                                            "updatePurchaseAssigneePrice",
                                                          groupId,
                                                        },
                                                      }
                                                    );
                                                    setRowError({
                                                      key: purchaseRowKey,
                                                      message:
                                                        "An unexpected error occurred. Please try again.",
                                                    });
                                                  }
                                                });
                                              }}
                                              disabled={isPending}
                                              className="rounded p-1 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
                                            >
                                              <Check size={14} />
                                            </button>
                                            <button
                                              onClick={() => {
                                                setEditingAssignee(null);
                                                setRowError(null);
                                              }}
                                              className="rounded p-1 text-slate-400 hover:bg-slate-100"
                                            >
                                              <X size={14} />
                                            </button>
                                          </div>
                                        ) : a.pricePaid != null ? (
                                          formatPrice(a.pricePaid)
                                        ) : (
                                          "—"
                                        )}
                                      </td>
                                      <td className="py-1 pr-4 text-sm text-slate-400">
                                        {formatActionTimestamp(p.createdAt)}
                                      </td>
                                      <td className="py-1">
                                        {!isEditing && (
                                          <div className="flex items-center gap-1">
                                            <button
                                              onClick={() => {
                                                onSetGlobalBusy(true);
                                                setEditingAssignee(
                                                  `${p.purchaseId}-${a.memberId}`
                                                );
                                                setEditPrice(
                                                  a.pricePaid != null
                                                    ? String(a.pricePaid)
                                                    : ""
                                                );
                                              }}
                                              disabled={busy}
                                              className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
                                              title="Edit price"
                                            >
                                              <Pencil size={12} />
                                            </button>
                                            <button
                                              onClick={() => {
                                                startTransition(async () => {
                                                  try {
                                                    const result =
                                                      await removePurchaseAssignee(
                                                        groupId,
                                                        {
                                                          purchaseId:
                                                            p.purchaseId,
                                                          memberId: a.memberId,
                                                        }
                                                      );
                                                    if (result.error) {
                                                      setActionError(
                                                        result.error
                                                      );
                                                      return;
                                                    }
                                                    onOverride({
                                                      purchases: localPurchases
                                                        .map((pp) =>
                                                          pp.purchaseId ===
                                                          p.purchaseId
                                                            ? {
                                                                ...pp,
                                                                assignees:
                                                                  pp.assignees.filter(
                                                                    (aa) =>
                                                                      aa.memberId !==
                                                                      a.memberId
                                                                  ),
                                                              }
                                                            : pp
                                                        )
                                                        .filter(
                                                          (pp) =>
                                                            pp.assignees
                                                              .length > 0
                                                        ),
                                                    });
                                                    setRowError(null);
                                                  } catch (err) {
                                                    Sentry.captureException(
                                                      err,
                                                      {
                                                        extra: {
                                                          context:
                                                            "removePurchaseAssignee",
                                                          groupId,
                                                        },
                                                      }
                                                    );
                                                    setRowError({
                                                      key: purchaseRowKey,
                                                      message:
                                                        "An unexpected error occurred. Please try again.",
                                                    });
                                                  }
                                                });
                                              }}
                                              disabled={busy}
                                              className="rounded p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                                              title="Remove purchase"
                                            >
                                              <Trash2 size={12} />
                                            </button>
                                          </div>
                                        )}
                                      </td>
                                    </tr>
                                    {rowError?.key === purchaseRowKey && (
                                      <tr>
                                        <td colSpan={4} className="pb-1 pt-0.5">
                                          <p className="text-xs text-red-600">
                                            {rowError.message}
                                          </p>
                                        </td>
                                      </tr>
                                    )}
                                  </React.Fragment>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Purchase history (others' purchases, read-only, collapsible) */}
                    {otherPurchases.length > 0 && (
                      <div className="flex-1">
                        <button
                          onClick={() =>
                            setShowPurchaseHistory(!showPurchaseHistory)
                          }
                          disabled={busy}
                          className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 transition-colors hover:text-slate-800 disabled:opacity-50"
                        >
                          Purchase History (
                          {otherPurchases.flatMap((p) => p.assignees).length})
                          {showPurchaseHistory ? (
                            <ChevronUp size={14} />
                          ) : (
                            <ChevronDown size={14} />
                          )}
                        </button>
                        {showPurchaseHistory && (
                          <table className="mt-2 w-auto border-collapse">
                            <thead>
                              <tr>
                                <th className="pb-1 pr-6 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                                  Member
                                </th>
                                <th className="pb-1 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                                  Purchase Price
                                </th>
                                <th className="pb-1 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                                  Purchased By
                                </th>
                                <th className="pb-1 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                                  Purchase Recorded On
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {otherPurchases.flatMap((p) =>
                                p.assignees.map((a) => (
                                  <tr key={`${p.purchaseId}-${a.memberId}`}>
                                    <td className="py-1 pr-6">
                                      <div className="flex items-center gap-2">
                                        <UserAvatar
                                          firstName={a.firstName}
                                          lastName={a.lastName}
                                          avatarColor={a.avatarColor}
                                          size="sm"
                                        />
                                        <span className="text-sm font-medium text-slate-700">
                                          {a.memberId === currentMemberId
                                            ? "Yourself"
                                            : `${a.firstName} ${a.lastName}`}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="py-1 pr-4 text-sm text-slate-500">
                                      {a.pricePaid != null
                                        ? formatPrice(a.pricePaid)
                                        : "—"}
                                    </td>
                                    <td className="py-1 pr-4 text-sm text-slate-500">
                                      {`${p.buyerFirstName} ${p.buyerLastName}`}
                                    </td>
                                    <td className="py-1 text-sm text-slate-400">
                                      {formatActionTimestamp(p.createdAt)}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {/* Reported prices — collapsible */}
          {localReportedPrices.length > 0 && (
            <div>
              <button
                onClick={() => setShowPriceHistory(!showPriceHistory)}
                disabled={busy}
                className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 transition-colors hover:text-slate-800 disabled:opacity-50"
              >
                Reported Prices ({localReportedPrices.length})
                {showPriceHistory ? (
                  <ChevronUp size={14} />
                ) : (
                  <ChevronDown size={14} />
                )}
              </button>
              {showPriceHistory && (
                <div className="mt-2 space-y-2">
                  {localReportedPrices.map((rp) => (
                    <div key={rp.id} className="text-sm text-slate-500">
                      <p>
                        {rp.minPrice != null && rp.maxPrice != null
                          ? `${formatPrice(rp.minPrice!)} – ${formatPrice(rp.maxPrice!)}`
                          : rp.minPrice != null
                            ? `From ${formatPrice(rp.minPrice!)}`
                            : rp.maxPrice != null
                              ? `Up to ${formatPrice(rp.maxPrice!)}`
                              : "Comment"}{" "}
                        by {rp.reporterFirstName} {rp.reporterLastName} on{" "}
                        {formatActionTimestamp(rp.createdAt)}
                        {rp.reporterMemberId === currentMemberId && (
                          <>
                            <button
                              onClick={() => {
                                setEditingPriceData(rp);
                                setActiveModal("edit-price");
                              }}
                              disabled={busy}
                              className="ml-1.5 inline-flex rounded p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
                              title="Edit reported price"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              onClick={() => {
                                onSetGlobalBusy(true);
                                startTransition(async () => {
                                  try {
                                    const result = await deleteReportedPrice(
                                      groupId,
                                      { reportedPriceId: rp.id }
                                    );
                                    if (result.error) {
                                      setActionError(result.error);
                                      return;
                                    }
                                    onOverride({
                                      reportedPrices:
                                        localReportedPrices.filter(
                                          (p) => p.id !== rp.id
                                        ),
                                    });
                                  } catch (err) {
                                    Sentry.captureException(err, {
                                      extra: {
                                        context:
                                          "deleteReportedPrice (on-schedule)",
                                        groupId,
                                      },
                                    });
                                    setActionError(
                                      "An unexpected error occurred. Please try again."
                                    );
                                  }
                                });
                              }}
                              disabled={busy}
                              className="ml-0.5 inline-flex rounded p-0.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                              title="Delete reported price"
                            >
                              <Trash2 size={12} />
                            </button>
                          </>
                        )}
                      </p>
                      {rp.comments && (
                        <p className="mt-0.5 italic text-slate-400">
                          &ldquo;{rp.comments}&rdquo;
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {actionError && (
            <div className="mb-2 rounded border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-600">
              {actionError}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            {/* Plan Purchases */}
            <button
              onClick={() => setActiveModal("ceiling")}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-50"
            >
              <ClipboardList size={12} />
              Plan Purchases
            </button>
            {/* Report Prices */}
            <span className={!hasTimeslot ? "group/notp relative" : ""}>
              <button
                onClick={() => setActiveModal("price")}
                disabled={busy || !hasTimeslot}
                className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-50"
              >
                <DollarSign size={12} />
                Report Prices
              </button>
              {!hasTimeslot && (
                <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 w-56 -translate-x-1/2 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-normal leading-snug text-white opacity-0 shadow-lg transition-opacity group-hover/notp:opacity-100">
                  Enter your purchase timeslot on the Overview page to use this
                  action.
                </span>
              )}
            </span>
            {/* Record Purchases */}
            <span
              className={
                allMembersAttending
                  ? "group/allattend relative"
                  : !hasTimeslot
                    ? "group/notpr relative"
                    : ""
              }
            >
              <button
                onClick={() => setActiveModal("purchase")}
                disabled={busy || allMembersAttending || !hasTimeslot}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-600 transition-colors hover:bg-emerald-100 disabled:opacity-50"
              >
                <ShoppingCart size={12} />
                Record Purchases
              </button>
              {allMembersAttending && (
                <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 w-52 -translate-x-1/2 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-normal leading-snug text-white opacity-0 shadow-lg transition-opacity group-hover/allattend:opacity-100">
                  All members have already purchased tickets for this session.
                </span>
              )}
              {!hasTimeslot && !allMembersAttending && (
                <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 w-56 -translate-x-1/2 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-normal leading-snug text-white opacity-0 shadow-lg transition-opacity group-hover/notpr:opacity-100">
                  Enter your purchase timeslot on the Overview page to use this
                  action.
                </span>
              )}
            </span>
            {/* Mark as Out of Budget */}
            <button
              onClick={() => setActiveModal("outofbudget")}
              disabled={busy}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                localOutOfBudget
                  ? "bg-amber-100 text-amber-600 hover:bg-amber-200"
                  : "bg-amber-50 text-amber-600 hover:bg-amber-100"
              }`}
            >
              <Ban size={12} />
              {localOutOfBudget
                ? "Undo Out of Budget"
                : "Mark as Out of Budget"}
            </button>
            {/* Mark as Sold Out */}
            <span className={!hasTimeslot ? "group/nots relative" : ""}>
              <button
                onClick={() => setActiveModal("soldout")}
                disabled={busy || !hasTimeslot}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                  localSoldOut
                    ? "bg-red-100 text-red-700 hover:bg-red-200"
                    : "bg-red-50 text-red-600 hover:bg-red-100"
                }`}
              >
                <X size={12} />
                {localSoldOut ? "Undo Sold Out" : "Mark as Sold Out"}
              </button>
              {!hasTimeslot && (
                <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 w-56 -translate-x-1/2 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-normal leading-snug text-white opacity-0 shadow-lg transition-opacity group-hover/nots:opacity-100">
                  Enter your purchase timeslot on the Overview page to use this
                  action.
                </span>
              )}
            </span>
          </div>

          {/* Modals */}
          {activeModal === "ceiling" && (
            <PriceCeilingModal
              members={eligibleMembers}
              currentMemberId={currentMemberId}
              initialCeilings={localCeilings}
              onSave={async (ceilings) => {
                const result = await batchSavePurchasePlan(groupId, {
                  sessionId: s.sessionCode,
                  entries: [...ceilings.entries()].map(
                    ([assigneeMemberId, priceCeiling]) => ({
                      assigneeMemberId,
                      priceCeiling,
                    })
                  ),
                });
                if (result.error) return result.error;
                onOverride({ ceilings });
                setActiveModal(null);
                return null;
              }}
              onClose={() => setActiveModal(null)}
            />
          )}
          {activeModal === "soldout" && (
            <SoldOutModal
              sessionCode={s.sessionCode}
              isSoldOut={localSoldOut}
              onConfirm={async () => {
                if (localSoldOut) {
                  const result = await unmarkSoldOut(groupId, {
                    sessionId: s.sessionCode,
                  });
                  if (result.error) return result.error;
                } else {
                  const result = await markAsSoldOut(groupId, {
                    sessionId: s.sessionCode,
                  });
                  if (result.error) return result.error;
                }
                onOverride({ soldOut: !localSoldOut });
                setActiveModal(null);
                return null;
              }}
              onClose={() => setActiveModal(null)}
            />
          )}
          {activeModal === "price" && (
            <RecordPriceModal
              sessionCode={s.sessionCode}
              onConfirm={async (minPrice, maxPrice, comments) => {
                const result = await reportSessionPrice(groupId, {
                  sessionId: s.sessionCode,
                  minPrice,
                  maxPrice,
                  comments,
                });
                if (result.error) return result.error;
                const realId =
                  (result.data?.reportedPriceId as string) ??
                  crypto.randomUUID();
                onOverride({
                  reportedPrices: [
                    ...localReportedPrices,
                    {
                      id: realId,
                      reporterMemberId: currentMemberId,
                      reporterFirstName: "You",
                      reporterLastName: "",
                      minPrice,
                      maxPrice,
                      comments,
                      createdAt: new Date(),
                    },
                  ],
                });
                setActiveModal(null);
                return null;
              }}
              onClose={() => setActiveModal(null)}
            />
          )}
          {activeModal === "edit-price" && editingPriceData && (
            <RecordPriceModal
              sessionCode={s.sessionCode}
              editMode
              initialMin={editingPriceData.minPrice}
              initialMax={editingPriceData.maxPrice}
              initialComments={editingPriceData.comments}
              onConfirm={async (minPrice, maxPrice, comments) => {
                const result = await updateReportedPrice(groupId, {
                  reportedPriceId: editingPriceData.id,
                  minPrice,
                  maxPrice,
                  comments,
                });
                if (result.error) return result.error;
                onOverride({
                  reportedPrices: localReportedPrices.map((p) =>
                    p.id === editingPriceData.id
                      ? { ...p, minPrice, maxPrice, comments }
                      : p
                  ),
                });
                setEditingPriceData(null);
                setActiveModal(null);
                return null;
              }}
              onClose={() => {
                setEditingPriceData(null);
                setActiveModal(null);
              }}
            />
          )}
          {activeModal === "purchase" && (
            <RecordPurchaseModal
              members={purchaseEligibleMembers}
              currentMemberId={currentMemberId}
              onConfirm={async (assignees) => {
                const prices = assignees
                  .map((a) => a.price)
                  .filter((p): p is number => p != null);
                const avgPrice =
                  prices.length > 0
                    ? prices.reduce((sum, p) => sum + p, 0) / prices.length
                    : undefined;
                const result = await markAsPurchased(groupId, {
                  sessionId: s.sessionCode,
                  pricePerTicket: avgPrice,
                  assignees: assignees.map((a) => ({
                    memberId: a.memberId,
                    pricePaid: a.price,
                  })),
                });
                if (result.error) return result.error;
                const newPurchaseId =
                  (result.data?.purchaseId as string) ?? crypto.randomUUID();
                onOverride({
                  purchases: [
                    ...localPurchases,
                    {
                      purchaseId: newPurchaseId,
                      buyerMemberId: currentMemberId,
                      buyerFirstName: "You",
                      buyerLastName: "",
                      pricePerTicket: avgPrice ?? null,
                      assignees: assignees.map((a) => {
                        const m = members.find(
                          (m) => m.memberId === a.memberId
                        );
                        return {
                          memberId: a.memberId,
                          firstName: m?.firstName ?? "",
                          lastName: m?.lastName ?? "",
                          avatarColor:
                            m?.avatarColor ?? ("blue" as AvatarColor),
                          pricePaid: a.price,
                        };
                      }),
                      createdAt: new Date(),
                    },
                  ],
                });
                setActiveModal(null);
                return null;
              }}
              onClose={() => setActiveModal(null)}
            />
          )}
          {activeModal === "outofbudget" && (
            <OutOfBudgetModal
              sessionCode={s.sessionCode}
              isOutOfBudget={localOutOfBudget}
              onConfirm={async () => {
                if (localOutOfBudget) {
                  const result = await unmarkOutOfBudget(groupId, {
                    sessionId: s.sessionCode,
                  });
                  if (result.error) return result.error;
                } else {
                  const result = await markAsOutOfBudget(groupId, {
                    sessionId: s.sessionCode,
                  });
                  if (result.error) return result.error;
                }
                onOverride({ outOfBudget: !localOutOfBudget });
                setActiveModal(null);
                return null;
              }}
              onClose={() => setActiveModal(null)}
            />
          )}
        </div>
      )}
      {activeModal === "info" && (
        <SessionInfoModal
          session={s}
          color={color}
          neutral={false}
          onClose={() => setActiveModal(null)}
        />
      )}
    </div>
  );
}

// ── Shared modal shell ────────────────────────────────────────────────────────
function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useScrollLock();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-xl bg-white p-8 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Session info modal ───────────────────────────────────────────────────────
function SessionInfoModal({
  session: s,
  color,
  neutral,
  onClose,
}: {
  session: {
    sessionCode: string;
    sport: string;
    sessionType: string;
    sessionDescription: string | null;
    venue: string;
    zone: string;
    sessionDate: string;
    startTime: string;
    endTime: string;
  };
  color: SportColor;
  neutral?: boolean;
  onClose: () => void;
}) {
  return (
    <ModalShell title="Session Details" onClose={onClose}>
      <div
        className="space-y-0.5 rounded-lg p-3.5"
        style={{ backgroundColor: `${color.bg}99` }}
      >
        <div className="flex items-center gap-2">
          <span
            className={`text-base font-semibold ${neutral ? "text-slate-900" : ""}`}
            style={neutral ? undefined : { color: color.border }}
          >
            {s.sport}
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
            style={{ backgroundColor: color.border }}
          >
            {s.sessionCode}
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
            style={{ backgroundColor: color.border }}
          >
            {s.sessionType}
          </span>
        </div>
        <p className="flex items-center gap-1.5 text-sm font-medium text-slate-600">
          <span>{formatSessionDate(s.sessionDate)}</span>
          <span style={{ color: color.border }}>|</span>
          <span>
            {formatSessionTime(s.startTime)} &ndash;{" "}
            {formatSessionTime(s.endTime)} PT
          </span>
        </p>
        <p className="flex items-center gap-1.5 text-sm font-medium text-slate-600">
          <span>{s.venue}</span>
          <span style={{ color: color.border }}>|</span>
          <span>{s.zone}</span>
        </p>
        {s.sessionDescription && (
          <ul className="space-y-0.5 text-sm text-slate-600">
            {s.sessionDescription.split(";").map((event, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: color.border }}
                />
                {event.trim()}
              </li>
            ))}
          </ul>
        )}
      </div>
    </ModalShell>
  );
}

// ── Price ceiling modal ──────────────────────────────────────────────────────
function PriceCeilingModal({
  members,
  currentMemberId,
  initialCeilings,
  onSave,
  onClose,
}: {
  members: TrackerMember[];
  currentMemberId: string;
  initialCeilings: Map<string, number | null>;
  onSave: (ceilings: Map<string, number | null>) => Promise<string | null>;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Sort: current user first
  const sortedMembers = [...members].sort((a, b) => {
    if (a.memberId === currentMemberId) return -1;
    if (b.memberId === currentMemberId) return 1;
    return 0;
  });
  const [draft, setDraft] = useState<Map<string, string>>(() => {
    const m = new Map<string, string>();
    for (const [memberId, price] of initialCeilings) {
      m.set(memberId, price != null ? String(price) : "");
    }
    return m;
  });

  function toggleMember(memberId: string) {
    setDraft((prev) => {
      const next = new Map(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.set(memberId, "");
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = new Map<string, number | null>();
    for (const [memberId, value] of draft) {
      const price = value === "" ? null : parseFloat(value);
      if (value !== "" && (isNaN(price!) || price! < 0)) continue;
      result.set(memberId, price);
    }
    const err = await onSave(result);
    setSaving(false);
    if (err) setError(err);
  }

  return (
    <ModalShell title="Plan Purchases" onClose={onClose}>
      <p className="mb-2 text-sm text-slate-500">
        Select any members that you would be willing to purchase tickets for and
        optionally, enter a price ceiling for each member. A price ceiling is
        the maximum amount that a member is willing to pay for a ticket to this
        session.
      </p>
      <p className="mb-4 text-sm text-slate-400">
        Selecting a member does not guarantee that you will purchase a ticket
        for them. This is only for planning purposes.
      </p>
      <p className="mb-2 text-sm font-semibold text-slate-700">
        Interested Members:
      </p>
      {sortedMembers.length === 0 ? (
        <p className="mb-4 text-sm text-slate-400">
          No other members are interested in this session or all interested
          members have already purchased tickets for this session.
        </p>
      ) : (
        <div className="space-y-2">
          {sortedMembers.map((m) => {
            const isChecked = draft.has(m.memberId);
            const name =
              m.memberId === currentMemberId
                ? "Yourself"
                : `${m.firstName} ${m.lastName}`;
            return (
              <div key={m.memberId} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleMember(m.memberId)}
                  disabled={saving}
                  className="h-4 w-4 rounded border-slate-300 text-[#009de5] focus:ring-[#009de5]"
                />
                <UserAvatar
                  firstName={m.firstName}
                  lastName={m.lastName}
                  avatarColor={m.avatarColor}
                  size="sm"
                />
                <span className="flex-1 text-sm font-medium text-slate-700">
                  {name}
                </span>
                {isChecked && (
                  <CurrencyInput
                    value={draft.get(m.memberId) ?? ""}
                    onChange={(v) =>
                      setDraft((prev) => new Map(prev).set(m.memberId, v))
                    }
                    disabled={saving}
                    className="w-24"
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={onClose}
          disabled={saving}
          className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving || sortedMembers.length === 0}
          className="rounded-lg bg-[#009de5] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0088c9] disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </ModalShell>
  );
}

// ── Sold out modal ───────────────────────────────────────────────────────────
function SoldOutModal({
  sessionCode,
  isSoldOut,
  onConfirm,
  onClose,
}: {
  sessionCode: string;
  isSoldOut: boolean;
  onConfirm: () => Promise<string | null>;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setSaving(true);
    setError(null);
    const err = await onConfirm();
    setSaving(false);
    if (err) setError(err);
  }

  return (
    <ModalShell
      title={isSoldOut ? "Undo Sold Out" : "Mark as Sold Out"}
      onClose={onClose}
    >
      <p className="mb-5 text-sm text-slate-500">
        {isSoldOut ? (
          <>
            Are you sure you want to undo the sold out status for{" "}
            <span className="font-bold text-slate-700">{sessionCode}</span>?
            This session will be available for future schedule generations.
          </>
        ) : (
          <>
            Mark the session{" "}
            <span className="font-bold text-slate-700">{sessionCode}</span> as
            sold out? This will exclude it from future schedule generations for
            all members.
          </>
        )}
      </p>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          disabled={saving}
          className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={saving}
          className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50 ${
            isSoldOut
              ? "bg-slate-600 hover:bg-slate-700"
              : "bg-red-600 hover:bg-red-700"
          }`}
        >
          {saving ? "Saving..." : "Confirm"}
        </button>
      </div>
    </ModalShell>
  );
}

// ── Out of budget modal ───────────────────────────────────────────────────────
function OutOfBudgetModal({
  sessionCode,
  isOutOfBudget,
  onConfirm,
  onClose,
}: {
  sessionCode: string;
  isOutOfBudget: boolean;
  onConfirm: () => Promise<string | null>;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setSaving(true);
    setError(null);
    const err = await onConfirm();
    setSaving(false);
    if (err) setError(err);
  }

  return (
    <ModalShell
      title={isOutOfBudget ? "Undo Out of Budget" : "Mark as Out of Budget"}
      onClose={onClose}
    >
      <p className="mb-5 text-sm text-slate-500">
        {isOutOfBudget ? (
          <>
            Are you sure you want to undo the out of budget status for{" "}
            <span className="font-bold text-slate-700">{sessionCode}</span>?
            This session will appear on your future schedules again.
          </>
        ) : (
          <>
            Mark the session{" "}
            <span className="font-bold text-slate-700">{sessionCode}</span> as
            out of budget? This will exclude it from your future schedule
            generations.
          </>
        )}
      </p>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          disabled={saving}
          className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={saving}
          className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50 ${
            isOutOfBudget
              ? "bg-slate-600 hover:bg-slate-700"
              : "bg-amber-600 hover:bg-amber-700"
          }`}
        >
          {saving ? "Saving..." : "Confirm"}
        </button>
      </div>
    </ModalShell>
  );
}

// ── Record price modal ────────────────────────────────────────────────────────
function RecordPriceModal({
  sessionCode,
  onConfirm,
  onClose,
  initialMin,
  initialMax,
  initialComments,
  editMode,
}: {
  sessionCode: string;
  onConfirm: (
    minPrice: number | null,
    maxPrice: number | null,
    comments: string | null
  ) => Promise<string | null>;
  onClose: () => void;
  initialMin?: number | null;
  initialMax?: number | null;
  initialComments?: string | null;
  editMode?: boolean;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minValue, setMinValue] = useState(
    initialMin != null ? String(initialMin) : ""
  );
  const [maxValue, setMaxValue] = useState(
    initialMax != null ? String(initialMax) : ""
  );
  const [comments, setComments] = useState(initialComments ?? "");

  const min = minValue === "" ? null : parseFloat(minValue);
  const max = maxValue === "" ? null : parseFloat(maxValue);
  const hasContent =
    minValue !== "" || maxValue !== "" || comments.trim() !== "";
  const maxLessThanMin = min != null && max != null && max < min;

  async function handleConfirm() {
    if (maxLessThanMin) return;
    if (!hasContent) return;
    setSaving(true);
    setError(null);
    const err = await onConfirm(
      min != null ? min : null,
      max != null ? max : null,
      comments.trim() || null
    );
    setSaving(false);
    if (err) setError(err);
  }

  return (
    <ModalShell
      title={editMode ? "Edit Reported Price" : "Report Price"}
      onClose={onClose}
    >
      <p className="mb-4 text-sm text-slate-500">
        Report the minimum and maximum prices that you saw for the session{" "}
        <span className="font-semibold text-slate-700">{sessionCode}</span>.
        This can help other group members determine whether they want to keep
        this session on their schedule or mark it as out of budget.
      </p>
      <div className="mb-4 flex items-center gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Min Price
          </label>
          <CurrencyInput
            value={minValue}
            onChange={setMinValue}
            disabled={saving}
            autoFocus
            className="w-28"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Max Price
          </label>
          <CurrencyInput
            value={maxValue}
            onChange={setMaxValue}
            disabled={saving}
            className="w-28"
          />
        </div>
      </div>
      {maxLessThanMin && (
        <p className="mb-3 text-xs text-red-500">
          Max price cannot be less than min price.
        </p>
      )}
      <div className="mb-5">
        <label className="mb-1 block text-xs font-medium text-slate-600">
          Additional Comments (optional)
        </label>
        <textarea
          value={comments}
          onChange={(e) => {
            if (e.target.value.length <= 200) setComments(e.target.value);
          }}
          placeholder="e.g. prices were higher for front row seats"
          disabled={saving}
          maxLength={200}
          rows={2}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-[#009de5] focus:outline-none focus:ring-1 focus:ring-[#009de5]"
        />
        <p className="mt-1 text-right text-xs text-slate-400">
          {comments.length}/200
        </p>
      </div>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          disabled={saving}
          className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={saving || !hasContent || maxLessThanMin}
          className="rounded-lg bg-[#009de5] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0088c9] disabled:opacity-50"
        >
          {saving ? "Saving..." : editMode ? "Update" : "Submit"}
        </button>
      </div>
    </ModalShell>
  );
}

// ── Record purchase modal ────────────────────────────────────────────────────
function RecordPurchaseModal({
  members,
  currentMemberId,
  onConfirm,
  onClose,
}: {
  members: TrackerMember[];
  currentMemberId: string;
  onConfirm: (
    assignees: { memberId: string; price: number | null }[]
  ) => Promise<string | null>;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Sort: current user first
  const sortedMembers = [...members].sort((a, b) => {
    if (a.memberId === currentMemberId) return -1;
    if (b.memberId === currentMemberId) return 1;
    return 0;
  });
  const [selected, setSelected] = useState<Map<string, string>>(
    () => new Map<string, string>()
  );

  function toggleMember(memberId: string) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.set(memberId, "");
      return next;
    });
  }

  function updatePrice(memberId: string, value: string) {
    setSelected((prev) => new Map(prev).set(memberId, value));
  }

  async function handleConfirm() {
    if (selected.size === 0) return;
    // At least one member must have a price
    const assignees = [...selected.entries()].map(([memberId, value]) => ({
      memberId,
      price: value === "" ? null : parseFloat(value),
    }));
    setSaving(true);
    setError(null);
    const err = await onConfirm(assignees);
    setSaving(false);
    if (err) setError(err);
  }

  return (
    <ModalShell title="Record Purchases" onClose={onClose}>
      <p className="mb-4 text-sm text-slate-500">
        Select the members for whom you purchased tickets and optionally, enter
        the price paid for each ticket.
      </p>
      <div className="mb-5 space-y-2">
        {sortedMembers.map((m) => {
          const isChecked = selected.has(m.memberId);
          const name =
            m.memberId === currentMemberId
              ? "Yourself"
              : `${m.firstName} ${m.lastName}`;
          return (
            <div key={m.memberId} className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => toggleMember(m.memberId)}
                disabled={saving}
                className="h-4 w-4 rounded border-slate-300 text-[#009de5] focus:ring-[#009de5]"
              />
              <UserAvatar
                firstName={m.firstName}
                lastName={m.lastName}
                avatarColor={m.avatarColor}
                size="sm"
              />
              <span className="flex-1 text-sm font-medium text-slate-700">
                {name}
              </span>
              {isChecked && (
                <CurrencyInput
                  value={selected.get(m.memberId) ?? ""}
                  onChange={(v) => updatePrice(m.memberId, v)}
                  disabled={saving}
                  className="w-24"
                />
              )}
            </div>
          );
        })}
      </div>
      {sortedMembers.length > 0 && (
        <div className="mb-4 rounded-lg border border-[#009de5]/20 bg-[#009de5]/5 px-3 py-2.5 text-sm text-[#009de5]">
          Purchased sessions are guaranteed to appear on future schedule
          generations for the selected members.
        </div>
      )}
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          disabled={saving}
          className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={saving || selected.size === 0}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Confirm Purchase"}
        </button>
      </div>
    </ModalShell>
  );
}

// ── Off-schedule purchases ───────────────────────────────────────────────────
function OffSchedulePurchase({
  groupId,
  currentMemberId,
  members,
  initialSessions,
  sportColorMap,
  disabled: externalDisabled,
  hasTimeslot,
  onScheduleCodes,
  excludedCodes,
  onRefresh,
  onSetGlobalBusy,
}: {
  groupId: string;
  currentMemberId: string;
  members: TrackerMember[];
  initialSessions: OffScheduleSession[];
  sportColorMap: Map<string, SportColor>;
  disabled: boolean;
  hasTimeslot: boolean;
  onScheduleCodes: Set<string>;
  excludedCodes: Set<string>;
  onRefresh: () => void;
  onSetGlobalBusy: (busy: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [sessionCode, setSessionCode] = useState("");
  const [lookupError, setLookupError] = useState("");
  // Persisted off-schedule sessions (from server) + newly looked-up ones
  const [sessions, setSessions] =
    useState<OffScheduleSession[]>(initialSessions);
  // Local overrides keyed by session code
  const [overrides, setOverrides] = useState<
    Map<
      string,
      {
        purchases?: PurchaseData[];
        reportedPrices?: ReportedPriceData[];
        soldOut?: boolean;
      }
    >
  >(new Map());
  // Autocomplete
  const [suggestions, setSuggestions] = useState<SessionSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [prevInitialSessions, setPrevInitialSessions] =
    useState(initialSessions);

  // Keep in sync when initialSessions changes (e.g. parent re-fetches data)
  if (prevInitialSessions !== initialSessions) {
    setPrevInitialSessions(initialSessions);
    setSessions(initialSessions);
    setOverrides(new Map());
  }

  // Close suggestions on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleInputChange(value: string) {
    setSessionCode(value);
    setLookupError("");
    setHighlightedIndex(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = value.trim();
    if (!trimmed) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const { data, error } = await searchSessionCodes(trimmed.toUpperCase());
      if (error) {
        setLookupError(error);
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }
      setSuggestions(data);
      setShowSuggestions(data.length > 0);
    }, 200);
  }

  function selectSession(code: string) {
    setSessionCode(code);
    setShowSuggestions(false);
    setSuggestions([]);
    handleLookupCode(code);
  }

  function handleLookup() {
    if (!sessionCode.trim()) return;
    setShowSuggestions(false);
    setSuggestions([]);
    handleLookupCode(sessionCode.trim().toUpperCase());
  }

  function handleLookupCode(code: string) {
    // If already on the user's schedule, reject
    if (onScheduleCodes.has(code)) {
      setLookupError(
        `${code} is already on your schedule. You can manage it from the sessions listed above.`
      );
      setSessionCode("");
      return;
    }
    // If already displayed in off-schedule list
    if (sessions.some((s) => s.sessionCode === code)) {
      setLookupError(`${code} is already displayed below.`);
      setSessionCode("");
      return;
    }
    // If in excluded sessions list
    if (excludedCodes.has(code)) {
      setLookupError(
        `${code} is in the excluded sessions list. You can manage it from the Excluded Sessions section below.`
      );
      setSessionCode("");
      return;
    }
    setLookupError("");
    startTransition(async () => {
      try {
        const result = await lookupSession(code, groupId);
        if (result.error) {
          setLookupError(result.error);
        } else if (result.data) {
          setSessions((prev) => [...prev, result.data!]);
          setSessionCode("");
        }
      } catch (err) {
        Sentry.captureException(err, {
          extra: { context: "lookupSession", groupId },
        });
        setLookupError("An unexpected error occurred. Please try again.");
      }
    });
  }

  function handleOverride(
    code: string,
    patch: {
      purchases?: PurchaseData[];
      reportedPrices?: ReportedPriceData[];
      soldOut?: boolean;
    }
  ) {
    setOverrides((prev) => {
      const next = new Map(prev);
      next.set(code, { ...prev.get(code), ...patch });
      return next;
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="mb-1 text-sm font-semibold text-slate-900">
        Off-Schedule Sessions
      </h3>
      <p className="mb-4 text-sm text-slate-500">
        Search for sessions that are not on your schedule to record additional
        prices or purchases.
      </p>

      {/* Lookup form with autocomplete */}
      <div className="mb-4">
        <div ref={wrapperRef} className="relative">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={sessionCode}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => {
              if (suggestions.length > 0) setShowSuggestions(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setShowSuggestions(false);
              } else if (e.key === "ArrowDown" && showSuggestions) {
                e.preventDefault();
                setHighlightedIndex((prev) =>
                  prev < suggestions.length - 1 ? prev + 1 : 0
                );
              } else if (e.key === "ArrowUp" && showSuggestions) {
                e.preventDefault();
                setHighlightedIndex((prev) =>
                  prev > 0 ? prev - 1 : suggestions.length - 1
                );
              } else if (e.key === "Enter") {
                if (showSuggestions && highlightedIndex >= 0) {
                  e.preventDefault();
                  selectSession(suggestions[highlightedIndex].sessionCode);
                } else if (!externalDisabled) {
                  handleLookup();
                }
              }
            }}
            disabled={externalDisabled}
            placeholder="Search for a session code..."
            autoComplete="off"
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-8 text-sm text-slate-700 placeholder-slate-400 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300 disabled:opacity-50"
          />
          {sessionCode && (
            <button
              onClick={() => {
                setSessionCode("");
                setSuggestions([]);
                setShowSuggestions(false);
                setLookupError("");
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
          {showSuggestions && (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
              {suggestions.map((s, i) => (
                <button
                  key={s.sessionCode}
                  onClick={() => selectSession(s.sessionCode)}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors ${
                    i === highlightedIndex
                      ? "bg-[#009de5]/10 text-[#009de5]"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className="font-semibold">{s.sessionCode}</span>
                  <span className="text-xs text-slate-400">
                    {s.sport} &middot; {s.sessionType}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {lookupError && (
        <p className="mb-3 text-sm text-red-600">{lookupError}</p>
      )}

      {/* Session cards */}
      {sessions.length > 0 && (
        <div className="space-y-3">
          {sessions.map((s) => (
            <OffScheduleSessionCard
              key={s.sessionCode}
              session={s}
              overrides={overrides.get(s.sessionCode)}
              groupId={groupId}
              currentMemberId={currentMemberId}
              members={members}
              sportColorMap={sportColorMap}
              busy={isPending || externalDisabled}
              hasTimeslot={hasTimeslot}
              onOverride={(patch) => handleOverride(s.sessionCode, patch)}
              onRefresh={onRefresh}
              onSetGlobalBusy={onSetGlobalBusy}
              onDismiss={() => {
                setSessions((prev) =>
                  prev.filter((ss) => ss.sessionCode !== s.sessionCode)
                );
                setOverrides((prev) => {
                  const next = new Map(prev);
                  next.delete(s.sessionCode);
                  return next;
                });
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Single off-schedule session card ────────────────────────────────────────
function OffScheduleSessionCard({
  session: s,
  overrides,
  groupId,
  currentMemberId,
  members,
  sportColorMap,
  busy: externalBusy,
  hasTimeslot,
  onOverride,
  onRefresh,
  onDismiss,
  onSetGlobalBusy,
}: {
  session: OffScheduleSession;
  overrides:
    | {
        purchases?: PurchaseData[];
        reportedPrices?: ReportedPriceData[];
        soldOut?: boolean;
      }
    | undefined;
  groupId: string;
  currentMemberId: string;
  members: TrackerMember[];
  sportColorMap: Map<string, SportColor>;
  busy: boolean;
  hasTimeslot: boolean;
  onOverride: (patch: {
    purchases?: PurchaseData[];
    reportedPrices?: ReportedPriceData[];
    soldOut?: boolean;
  }) => void;
  onRefresh: () => void;
  onDismiss: () => void;
  onSetGlobalBusy: (busy: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [activeModal, setActiveModal] = useState<
    "price" | "purchase" | "soldout" | "info" | "edit-price" | null
  >(null);
  const [showPriceHistory, setShowPriceHistory] = useState(false);
  const [showPurchaseHistory, setShowPurchaseHistory] = useState(false);
  const [editingAssignee, setEditingAssignee] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editingPriceData, setEditingPriceData] =
    useState<ReportedPriceData | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{
    key: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (actionError) {
      const timer = setTimeout(() => setActionError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [actionError]);

  // This row is actively editing/saving
  const localBusy = isPending || editingAssignee !== null;
  // Sync local busy state to global — when localBusy goes false, clear global
  useEffect(() => {
    if (!localBusy) onSetGlobalBusy(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localBusy]);

  const busy = externalBusy || localBusy;

  const localPurchases = overrides?.purchases ?? s.purchases;
  const localReportedPrices = overrides?.reportedPrices ?? s.reportedPrices;
  const localSoldOut = overrides?.soldOut ?? s.isSoldOut;
  const hasPurchases = localPurchases.length > 0;
  const hasAnyData =
    hasPurchases || localReportedPrices.length > 0 || localSoldOut;
  const mappedColor = sportColorMap.get(s.sport);
  const color = mappedColor ?? OFF_SCHEDULE_COLOR;
  const isNeutral = !mappedColor;

  const attendingMemberIds = new Set(
    localPurchases.flatMap((p) => p.assignees.map((a) => a.memberId))
  );
  const purchaseEligibleMembers = members.filter(
    (m) => !attendingMemberIds.has(m.memberId)
  );
  const allMembersAttending =
    purchaseEligibleMembers.length === 0 && members.length > 0;

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`text-sm font-bold ${isNeutral ? "text-slate-700" : ""}`}
              style={isNeutral ? undefined : { color: color.border }}
            >
              {s.sessionCode}
            </span>
            <span
              className={`rounded px-1.5 py-0.5 text-xs font-semibold ${isNeutral ? "bg-slate-100 text-slate-600" : "text-white"}`}
              style={isNeutral ? undefined : { backgroundColor: color.border }}
            >
              {s.sport}
            </span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">
              {s.sessionType}
            </span>
            {hasPurchases && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                <Check size={10} /> Purchased
              </span>
            )}
            {localSoldOut && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
                <X size={10} /> Sold Out
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <p className="text-xs text-slate-400">
              {formatSessionDate(s.sessionDate)} &middot;{" "}
              {formatSessionTime(s.startTime)} &ndash;{" "}
              {formatSessionTime(s.endTime)} &middot; {s.venue}
            </p>
            <button
              onClick={() => setActiveModal("info")}
              disabled={busy}
              className={`text-xs font-medium transition-colors hover:underline disabled:opacity-50 ${isNeutral ? "text-slate-500 hover:text-slate-700" : ""}`}
              style={isNeutral ? undefined : { color: color.border }}
            >
              View Full Session Details
            </button>
          </div>
        </div>
        {!hasAnyData && (
          <button
            onClick={onDismiss}
            disabled={busy}
            className="ml-2 flex-shrink-0 rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
            title="Dismiss"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Purchases — split into yours (editable) and others (read-only) */}
      {hasPurchases &&
        (() => {
          const myPurchases = localPurchases.filter(
            (p) => p.buyerMemberId === currentMemberId
          );
          const otherPurchases = localPurchases.filter(
            (p) => p.buyerMemberId !== currentMemberId
          );
          return (
            <>
              {myPurchases.length > 0 && (
                <div className="mb-3">
                  <p className="mb-1.5 text-sm font-semibold text-slate-600">
                    Your Purchases:
                  </p>
                  <table className="w-auto border-collapse">
                    <thead>
                      <tr>
                        <th className="pb-1 pr-6 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Member
                        </th>
                        <th className="pb-1 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Purchase Price
                        </th>
                        <th className="pb-1 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Purchase Recorded On
                        </th>
                        <th className="pb-1 text-left text-xs font-semibold uppercase tracking-wide text-slate-400" />
                      </tr>
                    </thead>
                    <tbody>
                      {myPurchases.flatMap((p) =>
                        p.assignees.map((a) => {
                          const isEditing =
                            editingAssignee === `${p.purchaseId}-${a.memberId}`;
                          const offPurchaseRowKey = `${p.purchaseId}-${a.memberId}`;
                          return (
                            <React.Fragment key={offPurchaseRowKey}>
                              <tr>
                                <td className="py-1 pr-6">
                                  <div className="flex items-center gap-2">
                                    <UserAvatar
                                      firstName={a.firstName}
                                      lastName={a.lastName}
                                      avatarColor={a.avatarColor}
                                      size="sm"
                                    />
                                    <span className="text-sm font-medium text-slate-700">
                                      {a.memberId === currentMemberId
                                        ? "Yourself"
                                        : `${a.firstName} ${a.lastName}`}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-1 pr-4 text-sm text-slate-500">
                                  {isEditing ? (
                                    <div className="flex items-center gap-1">
                                      <CurrencyInput
                                        value={editPrice}
                                        onChange={setEditPrice}
                                        className="w-24"
                                        autoFocus
                                      />
                                      <button
                                        onClick={() => {
                                          const price =
                                            editPrice === ""
                                              ? null
                                              : parseFloat(editPrice);
                                          startTransition(async () => {
                                            try {
                                              const result =
                                                await updatePurchaseAssigneePrice(
                                                  groupId,
                                                  {
                                                    purchaseId: p.purchaseId,
                                                    memberId: a.memberId,
                                                    pricePaid:
                                                      price != null
                                                        ? price
                                                        : null,
                                                  }
                                                );
                                              if (result.error) {
                                                setActionError(result.error);
                                                return;
                                              }
                                              onOverride({
                                                purchases: localPurchases.map(
                                                  (pp) =>
                                                    pp.purchaseId ===
                                                    p.purchaseId
                                                      ? {
                                                          ...pp,
                                                          assignees:
                                                            pp.assignees.map(
                                                              (aa) =>
                                                                aa.memberId ===
                                                                a.memberId
                                                                  ? {
                                                                      ...aa,
                                                                      pricePaid:
                                                                        price !=
                                                                        null
                                                                          ? price
                                                                          : null,
                                                                    }
                                                                  : aa
                                                            ),
                                                        }
                                                      : pp
                                                ),
                                              });
                                              setEditingAssignee(null);
                                              setRowError(null);
                                            } catch (err) {
                                              Sentry.captureException(err, {
                                                extra: {
                                                  context:
                                                    "updatePurchaseAssigneePrice (off-schedule)",
                                                  groupId,
                                                },
                                              });
                                              setRowError({
                                                key: offPurchaseRowKey,
                                                message:
                                                  "An unexpected error occurred. Please try again.",
                                              });
                                            }
                                          });
                                        }}
                                        disabled={isPending}
                                        className="rounded p-1 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
                                      >
                                        <Check size={14} />
                                      </button>
                                      <button
                                        onClick={() => {
                                          setEditingAssignee(null);
                                          setRowError(null);
                                        }}
                                        className="rounded p-1 text-slate-400 hover:bg-slate-100"
                                      >
                                        <X size={14} />
                                      </button>
                                    </div>
                                  ) : a.pricePaid != null ? (
                                    formatPrice(a.pricePaid)
                                  ) : (
                                    "—"
                                  )}
                                </td>
                                <td className="py-1 pr-4 text-sm text-slate-400">
                                  {formatActionTimestamp(p.createdAt)}
                                </td>
                                <td className="py-1">
                                  {!isEditing && (
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => {
                                          onSetGlobalBusy(true);
                                          setEditingAssignee(
                                            `${p.purchaseId}-${a.memberId}`
                                          );
                                          setEditPrice(
                                            a.pricePaid != null
                                              ? String(a.pricePaid)
                                              : ""
                                          );
                                        }}
                                        disabled={busy}
                                        className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
                                        title="Edit price"
                                      >
                                        <Pencil size={12} />
                                      </button>
                                      <button
                                        onClick={() => {
                                          onSetGlobalBusy(true);
                                          startTransition(async () => {
                                            try {
                                              const result =
                                                await removePurchaseAssignee(
                                                  groupId,
                                                  {
                                                    purchaseId: p.purchaseId,
                                                    memberId: a.memberId,
                                                  }
                                                );
                                              if (result.error) {
                                                setActionError(result.error);
                                                return;
                                              }
                                              onOverride({
                                                purchases: localPurchases
                                                  .map((pp) =>
                                                    pp.purchaseId ===
                                                    p.purchaseId
                                                      ? {
                                                          ...pp,
                                                          assignees:
                                                            pp.assignees.filter(
                                                              (aa) =>
                                                                aa.memberId !==
                                                                a.memberId
                                                            ),
                                                        }
                                                      : pp
                                                  )
                                                  .filter(
                                                    (pp) =>
                                                      pp.assignees.length > 0
                                                  ),
                                              });
                                              setRowError(null);
                                            } catch (err) {
                                              Sentry.captureException(err, {
                                                extra: {
                                                  context:
                                                    "removePurchaseAssignee (off-schedule)",
                                                  groupId,
                                                },
                                              });
                                              setRowError({
                                                key: offPurchaseRowKey,
                                                message:
                                                  "An unexpected error occurred. Please try again.",
                                              });
                                            }
                                          });
                                        }}
                                        disabled={busy}
                                        className="rounded p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                                        title="Remove purchase"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                              {rowError?.key === offPurchaseRowKey && (
                                <tr>
                                  <td colSpan={4} className="pb-1 pt-0.5">
                                    <p className="text-xs text-red-600">
                                      {rowError.message}
                                    </p>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
              {otherPurchases.length > 0 && (
                <div className="mb-3">
                  <button
                    onClick={() => setShowPurchaseHistory(!showPurchaseHistory)}
                    disabled={busy}
                    className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 transition-colors hover:text-slate-800 disabled:opacity-50"
                  >
                    Purchase History (
                    {otherPurchases.flatMap((p) => p.assignees).length})
                    {showPurchaseHistory ? (
                      <ChevronUp size={14} />
                    ) : (
                      <ChevronDown size={14} />
                    )}
                  </button>
                  {showPurchaseHistory && (
                    <table className="mt-2 w-auto border-collapse">
                      <thead>
                        <tr>
                          <th className="pb-1 pr-6 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                            Member
                          </th>
                          <th className="pb-1 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                            Purchase Price
                          </th>
                          <th className="pb-1 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                            Purchased By
                          </th>
                          <th className="pb-1 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                            Purchase Recorded On
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {otherPurchases.flatMap((p) =>
                          p.assignees.map((a) => (
                            <tr key={`${p.purchaseId}-${a.memberId}`}>
                              <td className="py-1 pr-6">
                                <div className="flex items-center gap-2">
                                  <UserAvatar
                                    firstName={a.firstName}
                                    lastName={a.lastName}
                                    avatarColor={a.avatarColor}
                                    size="sm"
                                  />
                                  <span className="text-sm font-medium text-slate-700">
                                    {a.memberId === currentMemberId
                                      ? "Yourself"
                                      : `${a.firstName} ${a.lastName}`}
                                  </span>
                                </div>
                              </td>
                              <td className="py-1 pr-4 text-sm text-slate-500">
                                {a.pricePaid != null
                                  ? formatPrice(a.pricePaid)
                                  : "—"}
                              </td>
                              <td className="py-1 pr-4 text-sm text-slate-500">{`${p.buyerFirstName} ${p.buyerLastName}`}</td>
                              <td className="py-1 text-sm text-slate-400">
                                {formatActionTimestamp(p.createdAt)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </>
          );
        })()}

      {/* Reported prices — collapsible */}
      {localReportedPrices.length > 0 && (
        <div className="mb-3">
          <button
            onClick={() => setShowPriceHistory(!showPriceHistory)}
            disabled={busy}
            className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 transition-colors hover:text-slate-800 disabled:opacity-50"
          >
            Reported Prices ({localReportedPrices.length})
            {showPriceHistory ? (
              <ChevronUp size={14} />
            ) : (
              <ChevronDown size={14} />
            )}
          </button>
          {showPriceHistory && (
            <div className="mt-2 space-y-2">
              {localReportedPrices.map((rp) => (
                <div key={rp.id} className="text-sm text-slate-500">
                  <p>
                    {rp.minPrice != null && rp.maxPrice != null
                      ? `${formatPrice(rp.minPrice!)} – ${formatPrice(rp.maxPrice!)}`
                      : rp.minPrice != null
                        ? `From ${formatPrice(rp.minPrice!)}`
                        : rp.maxPrice != null
                          ? `Up to ${formatPrice(rp.maxPrice!)}`
                          : "Comment"}{" "}
                    by {rp.reporterFirstName} {rp.reporterLastName} on{" "}
                    {formatActionTimestamp(rp.createdAt)}
                    {rp.reporterMemberId === currentMemberId && (
                      <>
                        <button
                          onClick={() => {
                            setEditingPriceData(rp);
                            setActiveModal("edit-price");
                          }}
                          disabled={busy}
                          className="ml-1.5 inline-flex rounded p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
                          title="Edit reported price"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => {
                            onSetGlobalBusy(true);
                            startTransition(async () => {
                              try {
                                const result = await deleteReportedPrice(
                                  groupId,
                                  { reportedPriceId: rp.id }
                                );
                                if (result.error) {
                                  setActionError(result.error);
                                  return;
                                }
                                onOverride({
                                  reportedPrices: localReportedPrices.filter(
                                    (p) => p.id !== rp.id
                                  ),
                                });
                              } catch (err) {
                                Sentry.captureException(err, {
                                  extra: {
                                    context:
                                      "deleteReportedPrice (off-schedule)",
                                    groupId,
                                  },
                                });
                                setActionError(
                                  "An unexpected error occurred. Please try again."
                                );
                              }
                            });
                          }}
                          disabled={busy}
                          className="ml-0.5 inline-flex rounded p-0.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                          title="Delete reported price"
                        >
                          <Trash2 size={12} />
                        </button>
                      </>
                    )}
                  </p>
                  {rp.comments && (
                    <p className="mt-0.5 italic text-slate-400">
                      &ldquo;{rp.comments}&rdquo;
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {actionError && (
        <div className="mb-2 rounded border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-600">
          {actionError}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <span className={!hasTimeslot ? "group/notp2 relative" : ""}>
          <button
            onClick={() => setActiveModal("price")}
            disabled={busy || !hasTimeslot}
            className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-50"
          >
            <DollarSign size={12} />
            Report Prices
          </button>
          {!hasTimeslot && (
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 w-56 -translate-x-1/2 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-normal leading-snug text-white opacity-0 shadow-lg transition-opacity group-hover/notp2:opacity-100">
              Enter your purchase timeslot on the Overview page to use this
              action.
            </span>
          )}
        </span>
        <span
          className={
            localSoldOut
              ? "group/soldout2 relative"
              : allMembersAttending
                ? "group/allattend relative"
                : !hasTimeslot
                  ? "group/notpr2 relative"
                  : ""
          }
        >
          <button
            onClick={() => setActiveModal("purchase")}
            disabled={
              busy || allMembersAttending || !hasTimeslot || localSoldOut
            }
            className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-600 transition-colors hover:bg-emerald-100 disabled:opacity-50"
          >
            <ShoppingCart size={12} />
            Record Purchases
          </button>
          {localSoldOut && (
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 w-52 -translate-x-1/2 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-normal leading-snug text-white opacity-0 shadow-lg transition-opacity group-hover/soldout2:opacity-100">
              This session has been marked as sold out.
            </span>
          )}
          {!localSoldOut && allMembersAttending && (
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 w-52 -translate-x-1/2 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-normal leading-snug text-white opacity-0 shadow-lg transition-opacity group-hover/allattend:opacity-100">
              All members have already purchased tickets for this session.
            </span>
          )}
          {!localSoldOut && !allMembersAttending && !hasTimeslot && (
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 w-56 -translate-x-1/2 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-normal leading-snug text-white opacity-0 shadow-lg transition-opacity group-hover/notpr2:opacity-100">
              Enter your purchase timeslot on the Overview page to use this
              action.
            </span>
          )}
        </span>
        <span className={!hasTimeslot ? "group/nots2 relative" : ""}>
          <button
            onClick={() => setActiveModal("soldout")}
            disabled={busy || !hasTimeslot}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
              localSoldOut
                ? "bg-red-100 text-red-700 hover:bg-red-200"
                : "bg-red-50 text-red-600 hover:bg-red-100"
            }`}
          >
            <X size={12} />
            {localSoldOut ? "Undo Sold Out" : "Mark as Sold Out"}
          </button>
          {!hasTimeslot && (
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 w-56 -translate-x-1/2 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-normal leading-snug text-white opacity-0 shadow-lg transition-opacity group-hover/nots2:opacity-100">
              Enter your purchase timeslot on the Overview page to use this
              action.
            </span>
          )}
        </span>
      </div>

      {/* Modals */}
      {activeModal === "info" && (
        <SessionInfoModal
          session={s}
          color={color}
          neutral={isNeutral}
          onClose={() => setActiveModal(null)}
        />
      )}
      {activeModal === "soldout" && (
        <SoldOutModal
          sessionCode={s.sessionCode}
          isSoldOut={localSoldOut}
          onConfirm={async () => {
            const result = localSoldOut
              ? await unmarkSoldOut(groupId, { sessionId: s.sessionCode })
              : await markAsSoldOut(groupId, { sessionId: s.sessionCode });
            if (result.error) return result.error;
            onOverride({ soldOut: !localSoldOut });
            setActiveModal(null);
            return null;
          }}
          onClose={() => setActiveModal(null)}
        />
      )}
      {activeModal === "price" && (
        <RecordPriceModal
          sessionCode={s.sessionCode}
          onConfirm={async (minPrice, maxPrice, comments) => {
            const result = await reportSessionPrice(groupId, {
              sessionId: s.sessionCode,
              minPrice,
              maxPrice,
              comments,
            });
            if (result.error) return result.error;
            const realId =
              (result.data?.reportedPriceId as string) ?? crypto.randomUUID();
            onOverride({
              reportedPrices: [
                ...localReportedPrices,
                {
                  id: realId,
                  reporterMemberId: currentMemberId,
                  reporterFirstName: "You",
                  reporterLastName: "",
                  minPrice,
                  maxPrice,
                  comments,
                  createdAt: new Date(),
                },
              ],
            });
            setShowPriceHistory(true);
            setActiveModal(null);
            return null;
          }}
          onClose={() => setActiveModal(null)}
        />
      )}
      {activeModal === "edit-price" && editingPriceData && (
        <RecordPriceModal
          sessionCode={s.sessionCode}
          editMode
          initialMin={editingPriceData.minPrice}
          initialMax={editingPriceData.maxPrice}
          initialComments={editingPriceData.comments}
          onConfirm={async (minPrice, maxPrice, comments) => {
            const result = await updateReportedPrice(groupId, {
              reportedPriceId: editingPriceData.id,
              minPrice,
              maxPrice,
              comments,
            });
            if (result.error) return result.error;
            onOverride({
              reportedPrices: localReportedPrices.map((p) =>
                p.id === editingPriceData.id
                  ? { ...p, minPrice, maxPrice, comments }
                  : p
              ),
            });
            setEditingPriceData(null);
            setActiveModal(null);
            return null;
          }}
          onClose={() => {
            setEditingPriceData(null);
            setActiveModal(null);
          }}
        />
      )}
      {activeModal === "purchase" && (
        <RecordPurchaseModal
          members={purchaseEligibleMembers}
          currentMemberId={currentMemberId}
          onConfirm={async (assignees) => {
            const prices = assignees
              .map((a) => a.price)
              .filter((p): p is number => p != null);
            const avgPrice =
              prices.length > 0
                ? prices.reduce((sum, p) => sum + p, 0) / prices.length
                : undefined;
            const result = await markAsPurchased(groupId, {
              sessionId: s.sessionCode,
              pricePerTicket: avgPrice,
              assignees: assignees.map((a) => ({
                memberId: a.memberId,
                pricePaid: a.price,
              })),
            });
            if (result.error) return result.error;
            const newPurchaseId =
              (result.data?.purchaseId as string) ?? crypto.randomUUID();
            onOverride({
              purchases: [
                ...localPurchases,
                {
                  purchaseId: newPurchaseId,
                  buyerMemberId: currentMemberId,
                  buyerFirstName: "You",
                  buyerLastName: "",
                  pricePerTicket: avgPrice ?? null,
                  assignees: assignees.map((a) => {
                    const m = members.find((mm) => mm.memberId === a.memberId);
                    return {
                      memberId: a.memberId,
                      firstName: m?.firstName ?? "",
                      lastName: m?.lastName ?? "",
                      avatarColor: m?.avatarColor ?? ("blue" as AvatarColor),
                      pricePaid: a.price,
                    };
                  }),
                  createdAt: new Date(),
                },
              ],
            });
            setActiveModal(null);
            return null;
          }}
          onClose={() => setActiveModal(null)}
        />
      )}
    </div>
  );
}

// ── Sidebar ──────────────────────────────────────────────────────────────────
function PurchaseTrackerSidebar({
  group,
  data,
  activeWindowId,
  onSetActiveWindowId,
  statusFilter,
  onSetStatusFilter,
  soldOutFilter,
  onSetSoldOutFilter,
  disabled,
}: {
  group: {
    dateMode: "consecutive" | "specific" | null;
    consecutiveDays: number | null;
    startDate: string | null;
    endDate: string | null;
    purchasedDatesOutsideRange: string[];
  };
  data: PurchaseTrackerData;
  activeWindowId: string | null;
  onSetActiveWindowId: (id: string | null) => void;
  statusFilter: "all" | "purchased" | "not_purchased";
  onSetStatusFilter: (v: "all" | "purchased" | "not_purchased") => void;
  soldOutFilter: "all" | "sold_out" | "available";
  onSetSoldOutFilter: (v: "all" | "sold_out" | "available") => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-4">
      {/* Attendance window */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h4 className="mb-2 text-sm font-semibold text-slate-900">
          Filter by Attendance Window
        </h4>
        {group.dateMode === "specific" && group.startDate && group.endDate ? (
          <>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() =>
                  onSetActiveWindowId(
                    activeWindowId === "specific-range"
                      ? null
                      : "specific-range"
                  )
                }
                disabled={disabled}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                  activeWindowId === "specific-range"
                    ? "bg-[#009de5]/10 text-[#009de5] ring-1 ring-[#009de5]/30"
                    : "bg-slate-100 text-slate-400 hover:text-slate-600"
                }`}
              >
                {formatDateRange(group.startDate, group.endDate)}
              </button>
              <span className="group/allwin relative">
                <button
                  onClick={() => onSetActiveWindowId(null)}
                  disabled={disabled}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                    activeWindowId === null
                      ? "bg-[#009de5]/10 text-[#009de5] ring-1 ring-[#009de5]/30"
                      : "bg-slate-100 text-slate-400 hover:text-slate-600"
                  }`}
                >
                  All
                </button>
                <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 w-48 -translate-x-1/2 rounded-lg bg-slate-800 px-2.5 py-1.5 text-center text-xs font-normal leading-snug text-white opacity-0 shadow-lg transition-opacity group-hover/allwin:opacity-100">
                  Display all sessions from your schedule.
                </span>
              </span>
            </div>
            {group.purchasedDatesOutsideRange.length > 0 && (
              <p className="mt-2 text-xs text-red-600">
                Some purchased sessions fall outside the selected date range.
              </p>
            )}
          </>
        ) : data.windowRankings.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {data.windowRankings.map((w, i) => {
              const isActive = w.id === activeWindowId;
              return (
                <button
                  key={w.id}
                  onClick={() => onSetActiveWindowId(isActive ? null : w.id)}
                  disabled={disabled}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                    isActive
                      ? "bg-[#009de5]/10 text-[#009de5] ring-1 ring-[#009de5]/30"
                      : "bg-slate-100 text-slate-400 hover:text-slate-600"
                  }`}
                >
                  #{i + 1} {formatDateRange(w.startDate, w.endDate)}
                </button>
              );
            })}
            <span className="group/allwin relative">
              <button
                onClick={() => onSetActiveWindowId(null)}
                disabled={disabled}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                  activeWindowId === null
                    ? "bg-[#009de5]/10 text-[#009de5] ring-1 ring-[#009de5]/30"
                    : "bg-slate-100 text-slate-400 hover:text-slate-600"
                }`}
              >
                All
              </button>
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 w-48 -translate-x-1/2 rounded-lg bg-slate-800 px-2.5 py-1.5 text-center text-xs font-normal leading-snug text-white opacity-0 shadow-lg transition-opacity group-hover/allwin:opacity-100">
                Display all sessions from your schedule.
              </span>
            </span>
          </div>
        ) : group.dateMode === "consecutive" && group.consecutiveDays ? (
          <p className="text-sm text-red-600">
            No feasible {group.consecutiveDays}-day windows. Purchased sessions
            span more days than the window size allows. Displaying all sessions
            from your schedule.
          </p>
        ) : (
          <p className="text-sm text-amber-600">
            The owner has not set a date configuration yet. Displaying all
            sessions from your schedule.
          </p>
        )}
      </div>

      {/* Purchase status */}
      <FilterGroup title="Filter by Purchase Status">
        {(
          [
            { key: "all", label: "All" },
            { key: "purchased", label: "Purchased" },
            { key: "not_purchased", label: "Not Purchased" },
          ] as const
        ).map(({ key, label }) => (
          <FilterPill
            key={key}
            label={label}
            active={statusFilter === key}
            onClick={() => onSetStatusFilter(key)}
            disabled={disabled}
          />
        ))}
      </FilterGroup>

      {/* Sold out status */}
      <FilterGroup title="Filter by Sold Out Status">
        {(
          [
            { key: "all", label: "All" },
            { key: "available", label: "Available" },
            { key: "sold_out", label: "Sold Out" },
          ] as const
        ).map(({ key, label }) => (
          <FilterPill
            key={key}
            label={label}
            active={soldOutFilter === key}
            onClick={() => onSetSoldOutFilter(key)}
            disabled={disabled}
          />
        ))}
      </FilterGroup>
    </div>
  );
}

// ── Excluded session row ──────────────────────────────────────────────────────
function ExcludedSessionRow({
  session: s,
  soldOutNow,
  oobNow,
  hasPendingChanges,
  showUndoSoldOut,
  showRedoSoldOut,
  showUndoOob,
  showRedoOob,
  changedStatuses,
  busy,
  hasTimeslot,
  onUndo,
  onRedo,
  onViewDetails,
}: {
  session: ExcludedSession;
  soldOutNow: boolean;
  oobNow: boolean;
  hasPendingChanges: boolean;
  showUndoSoldOut: boolean;
  showRedoSoldOut: boolean;
  showUndoOob: boolean;
  showRedoOob: boolean;
  changedStatuses: string[];
  busy: boolean;
  hasTimeslot: boolean;
  onUndo: (action: "sold_out" | "out_of_budget") => void;
  onRedo: (action: "sold_out" | "out_of_budget") => void;
  onViewDetails: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasPurchases = s.purchases.length > 0;
  const hasReportedPrices = s.reportedPrices.length > 0;
  const hasHistory = hasPurchases || hasReportedPrices;

  return (
    <div
      className={`rounded-lg border ${
        hasPendingChanges
          ? "border-amber-200 bg-amber-50/50"
          : "border-slate-200"
      }`}
    >
      <div className="flex items-center justify-between px-4 py-2.5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-slate-700">
              {s.sessionCode}
            </span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-600">
              {s.sport}
            </span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">
              {s.sessionType}
            </span>
            {soldOutNow && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
                Sold Out
              </span>
            )}
            {oobNow && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-600">
                Out of Budget
              </span>
            )}
            {hasPendingChanges && (
              <span className="group/pending relative inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-600">
                Pending Schedule Regeneration
                <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 w-60 -translate-x-1/2 rounded-lg bg-slate-800 px-2.5 py-1.5 text-center text-xs font-normal leading-snug text-white opacity-0 shadow-lg transition-opacity group-hover/pending:opacity-100">
                  There were changes to this session&apos;s status. These
                  changes will be reflected in the next schedule generation.
                </span>
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <p className="text-xs text-slate-400">
              {formatSessionDate(s.sessionDate)} &middot;{" "}
              {formatSessionTime(s.startTime)} &ndash;{" "}
              {formatSessionTime(s.endTime)} &middot; {s.venue}
            </p>
            <button
              onClick={onViewDetails}
              className="text-xs font-medium text-slate-500 transition-colors hover:text-slate-700 hover:underline"
            >
              View Full Session Details
            </button>
            {hasHistory && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-0.5 text-xs font-medium text-slate-500 transition-colors hover:text-slate-700"
              >
                {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {expanded ? "Hide History" : "Show History"}
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {showUndoSoldOut && (
            <span className={!hasTimeslot ? "group/exus relative" : ""}>
              <button
                onClick={() => onUndo("sold_out")}
                disabled={busy || !hasTimeslot}
                className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
              >
                Undo Sold Out
              </button>
              {!hasTimeslot && (
                <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 w-56 -translate-x-1/2 rounded-lg bg-slate-800 px-2.5 py-1.5 text-center text-xs font-normal leading-snug text-white opacity-0 shadow-lg transition-opacity group-hover/exus:opacity-100">
                  Enter your purchase timeslot on the Overview page to use this
                  action.
                </span>
              )}
            </span>
          )}
          {showRedoSoldOut && (
            <span className={!hasTimeslot ? "group/exms relative" : ""}>
              <button
                onClick={() => onRedo("sold_out")}
                disabled={busy || !hasTimeslot}
                className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
              >
                Redo Sold Out
              </button>
              {!hasTimeslot && (
                <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 w-56 -translate-x-1/2 rounded-lg bg-slate-800 px-2.5 py-1.5 text-center text-xs font-normal leading-snug text-white opacity-0 shadow-lg transition-opacity group-hover/exms:opacity-100">
                  Enter your purchase timeslot on the Overview page to use this
                  action.
                </span>
              )}
            </span>
          )}
          {showUndoOob && (
            <button
              onClick={() => onUndo("out_of_budget")}
              disabled={busy}
              className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-600 transition-colors hover:bg-amber-100 disabled:opacity-50"
            >
              Undo Out of Budget
            </button>
          )}
          {showRedoOob && (
            <button
              onClick={() => onRedo("out_of_budget")}
              disabled={busy}
              className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-600 transition-colors hover:bg-amber-100 disabled:opacity-50"
            >
              Redo Out of Budget
            </button>
          )}
        </div>
      </div>

      {/* Expandable purchase & price history */}
      {expanded && hasHistory && (
        <div className="space-y-3 border-t border-slate-200 px-4 py-3">
          {hasPurchases && (
            <div>
              <h4 className="mb-1.5 text-xs font-semibold text-slate-600">
                Recorded Purchases
              </h4>
              <div className="space-y-1.5">
                {s.purchases.map((p) => (
                  <div key={p.purchaseId} className="text-xs text-slate-500">
                    {p.assignees.map((a) => (
                      <p key={a.memberId}>
                        {a.firstName} {a.lastName}
                        {a.pricePaid != null &&
                          ` — ${formatPrice(a.pricePaid)}`}
                      </p>
                    ))}
                    <p className="text-slate-400">
                      Purchased by {p.buyerFirstName} {p.buyerLastName} on{" "}
                      {formatActionTimestamp(p.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {hasReportedPrices && (
            <div>
              <h4 className="mb-1.5 text-xs font-semibold text-slate-600">
                Reported Prices
              </h4>
              <div className="space-y-1.5">
                {s.reportedPrices.map((rp, i) => (
                  <div key={i} className="text-xs text-slate-500">
                    <p>
                      {rp.minPrice != null && rp.maxPrice != null
                        ? `${formatPrice(rp.minPrice!)} – ${formatPrice(rp.maxPrice!)}`
                        : rp.minPrice != null
                          ? `From ${formatPrice(rp.minPrice!)}`
                          : rp.maxPrice != null
                            ? `Up to ${formatPrice(rp.maxPrice!)}`
                            : "Comment"}{" "}
                      by {rp.reporterFirstName} {rp.reporterLastName} on{" "}
                      {formatActionTimestamp(rp.createdAt)}
                    </p>
                    {rp.comments && (
                      <p className="mt-0.5 italic text-slate-400">
                        &ldquo;{rp.comments}&rdquo;
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Excluded sessions ─────────────────────────────────────────────────────────
function ExcludedSessions({
  groupId,
  initialSessions,
  disabled,
  hasTimeslot,
}: {
  groupId: string;
  initialSessions: ExcludedSession[];
  disabled: boolean;
  hasTimeslot: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [sessions, setSessions] = useState<ExcludedSession[]>(initialSessions);
  const [searchQuery, setSearchQuery] = useState("");
  // Optimistic local state for undo/redo clicks (before page refresh)
  const [locallyUnmarked, setLocallyUnmarked] = useState<Set<string>>(
    new Set()
  );
  const [locallyRemarked, setLocallyRemarked] = useState<Set<string>>(
    new Set()
  );
  const [confirmTarget, setConfirmTarget] = useState<{
    session: ExcludedSession;
    action: "sold_out" | "out_of_budget";
  } | null>(null);
  const [infoTarget, setInfoTarget] = useState<ExcludedSession | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [prevExcludedSessions, setPrevExcludedSessions] =
    useState(initialSessions);

  useEffect(() => {
    if (actionError) {
      const timer = setTimeout(() => setActionError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [actionError]);

  if (prevExcludedSessions !== initialSessions) {
    setPrevExcludedSessions(initialSessions);
    setSessions(initialSessions);
    setLocallyUnmarked(new Set());
    setLocallyRemarked(new Set());
  }

  const busy = isPending || disabled;
  const query = searchQuery.trim().toLowerCase();

  const filteredSessions = useMemo(() => {
    if (!query) return sessions;
    return sessions.filter((s) => {
      const haystack =
        `${s.sport} ${s.sessionCode} ${s.sessionType} ${s.sessionDescription ?? ""} ${s.venue} ${s.zone}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [sessions, query]);

  function handleConfirmUnmark() {
    if (!confirmTarget) return;
    const { session: target, action } = confirmTarget;
    const key = `${target.sessionCode}:${action}`;
    startTransition(async () => {
      try {
        if (action === "sold_out") {
          const result = await unmarkSoldOut(groupId, {
            sessionId: target.sessionCode,
          });
          if (result.error) {
            setActionError(result.error);
            setConfirmTarget(null);
            return;
          }
        } else {
          const result = await unmarkOutOfBudget(groupId, {
            sessionId: target.sessionCode,
          });
          if (result.error) {
            setActionError(result.error);
            setConfirmTarget(null);
            return;
          }
        }
        setLocallyUnmarked((prev) => new Set(prev).add(key));
        setLocallyRemarked((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
        setConfirmTarget(null);
      } catch (err) {
        Sentry.captureException(err, {
          extra: { context: "handleUnmark", groupId },
        });
        setActionError("An unexpected error occurred. Please try again.");
        setConfirmTarget(null);
      }
    });
  }

  function handleRemark(code: string, action: "sold_out" | "out_of_budget") {
    const key = `${code}:${action}`;
    startTransition(async () => {
      try {
        if (action === "sold_out") {
          const result = await markAsSoldOut(groupId, { sessionId: code });
          if (result.error) {
            setActionError(result.error);
            return;
          }
        } else {
          const result = await markAsOutOfBudget(groupId, { sessionId: code });
          if (result.error) {
            setActionError(result.error);
            return;
          }
        }
        setLocallyRemarked((prev) => new Set(prev).add(key));
        setLocallyUnmarked((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      } catch (err) {
        Sentry.captureException(err, {
          extra: { context: "handleRemark", groupId },
        });
        setActionError("An unexpected error occurred. Please try again.");
      }
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="mb-1 text-sm font-semibold text-slate-900">
        Excluded Sessions
      </h3>
      <p className="mb-4 text-sm text-slate-500">
        These sessions were excluded from the latest schedule generation due to
        being marked as out of budget or sold out. If this was a mistake, you
        can undo these changes here to allow them to appear in future schedule
        generations.
      </p>

      {actionError && (
        <div className="mb-2 rounded border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-600">
          {actionError}
        </div>
      )}

      {sessions.length === 0 ? (
        <p className="text-sm text-slate-400">No excluded sessions.</p>
      ) : (
        <>
          {/* Search */}
          <div className="mb-4">
            <SidebarSearch
              value={searchQuery}
              onChange={setSearchQuery}
              disabled={busy}
              placeholder="Search by code, sport, venue..."
            />
          </div>

          {filteredSessions.length > 0 ? (
            <div className="space-y-2">
              {filteredSessions.map((s) => {
                // "at generation" = snapshot stored when schedules were last generated
                // "now" = current DB state, updated optimistically by local clicks
                const soldOutAtGeneration = s.wasSoldOut;
                const oobAtGeneration = s.wasOutOfBudget;

                const soldOutNow = locallyRemarked.has(
                  `${s.sessionCode}:sold_out`
                )
                  ? true
                  : locallyUnmarked.has(`${s.sessionCode}:sold_out`)
                    ? false
                    : s.isSoldOut;
                const oobNow = locallyRemarked.has(
                  `${s.sessionCode}:out_of_budget`
                )
                  ? true
                  : locallyUnmarked.has(`${s.sessionCode}:out_of_budget`)
                    ? false
                    : s.isOutOfBudget;

                // Has the status changed since generation? → pending regeneration
                const soldOutDiffers = soldOutAtGeneration !== soldOutNow;
                const oobDiffers = oobAtGeneration !== oobNow;
                const hasPendingChanges = soldOutDiffers || oobDiffers;

                // Button visibility
                const showUndoSoldOut = soldOutNow;
                const showRedoSoldOut = !soldOutNow && soldOutAtGeneration;
                const showUndoOob = oobNow;
                const showRedoOob = !oobNow && oobAtGeneration;

                // Build the pending tooltip message
                const changedStatuses: string[] = [];
                if (soldOutDiffers) changedStatuses.push("sold out");
                if (oobDiffers) changedStatuses.push("out of budget");

                return (
                  <ExcludedSessionRow
                    key={s.sessionCode}
                    session={s}
                    soldOutNow={soldOutNow}
                    oobNow={oobNow}
                    hasPendingChanges={hasPendingChanges}
                    showUndoSoldOut={showUndoSoldOut}
                    showRedoSoldOut={showRedoSoldOut}
                    showUndoOob={showUndoOob}
                    showRedoOob={showRedoOob}
                    changedStatuses={changedStatuses}
                    busy={busy}
                    hasTimeslot={hasTimeslot}
                    onUndo={(action) =>
                      setConfirmTarget({ session: s, action })
                    }
                    onRedo={(action) => handleRemark(s.sessionCode, action)}
                    onViewDetails={() => setInfoTarget(s)}
                  />
                );
              })}
            </div>
          ) : query ? (
            <p className="text-sm text-slate-400">
              No excluded sessions match your search.
            </p>
          ) : null}
        </>
      )}

      {/* Session info modal */}
      {infoTarget && (
        <SessionInfoModal
          session={infoTarget}
          color={OFF_SCHEDULE_COLOR}
          neutral
          onClose={() => setInfoTarget(null)}
        />
      )}

      {/* Undo confirmation modal */}
      {confirmTarget && (
        <ModalShell
          title={
            confirmTarget.action === "sold_out"
              ? "Undo Sold Out"
              : "Undo Out of Budget"
          }
          onClose={() => setConfirmTarget(null)}
        >
          <p className="mb-5 text-sm text-slate-500">
            Do you want to undo this{" "}
            {confirmTarget.action === "sold_out"
              ? "sold out mark"
              : "out of budget mark"}
            ? This will allow the session{" "}
            <span className="font-semibold text-slate-700">
              {confirmTarget.session.sessionCode}
            </span>{" "}
            to appear on future schedule generations.
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setConfirmTarget(null)}
              disabled={isPending}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmUnmark}
              disabled={isPending}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors disabled:opacity-50 ${
                confirmTarget.action === "sold_out"
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-amber-600 hover:bg-amber-700"
              }`}
            >
              {isPending ? "Undoing..." : "Confirm"}
            </button>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
