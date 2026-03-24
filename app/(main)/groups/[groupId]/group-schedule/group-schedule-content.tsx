"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useGroup } from "../_components/group-context";
import { useSidePanel } from "../_components/side-panel-context";
import { getGroupSchedule } from "./actions";
import type { GroupScheduleMemberCombo } from "./actions";
import type { AvatarColor } from "@/lib/constants";
import {
  type SportColor,
  FALLBACK_SPORT_COLOR,
  buildSportColorMap,
  RANK_LABELS,
  RANK_SHORT_LABELS,
  RANK_TAG_COLORS,
  HOUR_START,
  HOUR_END,
  TOTAL_HOURS,
  HOUR_HEIGHT,
  OLYMPIC_DAYS_SET,
  OLYMPIC_DAYS_LIST,
  timeToMinutes,
  formatHourLabel,
  addDays,
  buildWeeks,
  daysInRange,
  matchesSearch,
  computeOverlapLayout,
  type LayoutInfo,
} from "@/lib/schedule-utils";
import { Maximize2, User } from "lucide-react";
import Modal from "@/components/modal";
import UserAvatar from "@/components/user-avatar";
import StatusBadge from "@/components/status-badge";
import { PageError, PageEmpty } from "@/components/page-state";
import SidebarSearch from "@/components/sidebar-search";
import FilterPill, { FilterGroup } from "@/components/filter-pill";
import type {
  PurchaseData,
  ReportedPriceData,
} from "../schedule/purchase-actions";
import {
  formatSessionTime,
  formatSessionDate,
  formatSessionDateHeader,
} from "@/lib/utils";

// ── Rank helpers ─────────────────────────────────────────────────────────────
type ComboRank = "primary" | "backup1" | "backup2";

// ── Session with member info ──────────────────────────────────────────────────
type GroupSessionMember = {
  memberId: string;
  firstName: string;
  lastName: string;
  avatarColor: AvatarColor;
  ranks: ComboRank[];
};

type GroupSession = {
  sessionCode: string;
  sport: string;
  sessionType: string;
  sessionDescription: string | null;
  venue: string;
  zone: string;
  startTime: string;
  endTime: string;
  members: GroupSessionMember[];
  // Purchase data
  purchases: PurchaseData[];
  isSoldOut: boolean;
  isOutOfBudget: boolean;
  reportedPrices: ReportedPriceData[];
};

// ── Main component ────────────────────────────────────────────────────────────
// ── Member filter types ─────────────────────────────────────────────────────
type MemberInfo = {
  id: string;
  firstName: string;
  lastName: string;
  avatarColor: AvatarColor;
};
type FilterMode = "any" | "all";

export default function GroupScheduleContent() {
  const group = useGroup();
  const { setPanel } = useSidePanel();
  const [schedule, setSchedule] = useState<GroupScheduleMemberCombo[] | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fetchCounterRef = useRef(0);
  const [selectedSession, setSelectedSession] = useState<{
    session: GroupSession;
    day: string;
  } | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<Set<string> | "all">(
    "all"
  );
  const [filterMode, setFilterMode] = useState<FilterMode>("any");
  const [purchasedFilter, setPurchasedFilter] = useState<
    "all" | "purchased" | "not_purchased"
  >("all");
  const [soldOutFilter, setSoldOutFilter] = useState<
    "all" | "sold_out" | "available"
  >("all");
  const [displayMode, setDisplayMode] = useState<"calendar" | "list">(
    "calendar"
  );
  const [calendarScale, setCalendarScale] = useState<"week" | "day">("week");
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const isOwner = group.myRole === "owner";
  const hasSchedules = !!group.scheduleGeneratedAt;
  const hasDateConfig = !!group.dateMode;
  const windowRankings = group.windowRankings;
  const myMemberId = group.myMemberId;

  // Track which window is highlighted (client-only, defaults to top-ranked)
  const topWindowId = windowRankings.length > 0 ? windowRankings[0].id : null;
  const [highlightedWindowId, setHighlightedWindowId] = useState<string | null>(
    null
  );
  const activeWindowId = highlightedWindowId ?? topWindowId;
  const activeWindow =
    windowRankings.find((w) => w.id === activeWindowId) ?? null;

  const weeks = useMemo(() => buildWeeks(), []);

  // Find the week index that contains a given date
  function weekIndexForDate(dateStr: string): number {
    for (let i = 0; i < weeks.length; i++) {
      if (weeks[i].includes(dateStr)) return i;
    }
    return 0;
  }

  // Find the Olympic day index for a given date
  function dayIndexForDate(dateStr: string): number {
    const idx = OLYMPIC_DAYS_LIST.indexOf(dateStr);
    return idx >= 0 ? idx : 0;
  }

  // Default week/day index to the top window's first day
  const topWindow = windowRankings.length > 0 ? windowRankings[0] : null;
  const [weekIndex, setWeekIndex] = useState(() =>
    topWindow ? weekIndexForDate(topWindow.startDate) : 0
  );
  const [dayIndex, setDayIndex] = useState(() =>
    topWindow ? dayIndexForDate(topWindow.startDate) : 0
  );

  // When a window is clicked, jump the calendar to its first day
  function handleSelectWindow(windowId: string) {
    setHighlightedWindowId(windowId);
    const w = windowRankings.find((wr) => wr.id === windowId);
    if (w) {
      setWeekIndex(weekIndexForDate(w.startDate));
      setDayIndex(dayIndexForDate(w.startDate));
    }
  }

  const fetchSchedule = () => {
    if (!hasSchedules || group.membersWithNoCombos.length > 0) return;
    setError("");
    setLoading(true);
    const fetchId = ++fetchCounterRef.current;
    getGroupSchedule(group.id)
      .then((result) => {
        if (fetchId !== fetchCounterRef.current) return;
        if (result.error) {
          setError(result.error);
        } else {
          setSchedule(result.data ?? []);
        }
      })
      .catch(() => {
        if (fetchId !== fetchCounterRef.current) return;
        setError("Failed to load group schedule.");
      })
      .finally(() => {
        if (fetchId === fetchCounterRef.current) {
          setLoading(false);
        }
      });
  };

  useEffect(() => {
    fetchSchedule();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.id, hasSchedules, group.membersWithNoCombos.length]);

  // Build sport color map from all sessions
  const sportColorMap = useMemo(() => {
    if (!schedule) return new Map<string, SportColor>();
    const sports: string[] = [];
    for (const c of schedule) {
      for (const s of c.sessions) {
        sports.push(s.sport);
      }
    }
    return buildSportColorMap(sports);
  }, [schedule]);

  // Build unique member list from schedule data
  const members = useMemo<MemberInfo[]>(() => {
    if (!schedule) return [];
    const seen = new Map<string, MemberInfo>();
    for (const c of schedule) {
      if (!seen.has(c.memberId)) {
        seen.set(c.memberId, {
          id: c.memberId,
          firstName: c.firstName,
          lastName: c.lastName,
          avatarColor: c.avatarColor,
        });
      }
    }
    return [...seen.values()];
  }, [schedule]);

  // Highlighted window days as a set for calendar background
  const windowDaysSet = useMemo(() => {
    if (!activeWindow) return new Set<string>();
    return daysInRange(activeWindow.startDate, activeWindow.endDate);
  }, [activeWindow]);

  // Build grouped sessions for ALL olympic days (not just window)
  const daySessionMap = useMemo(() => {
    const map = new Map<string, GroupSession[]>();
    if (!schedule) return map;

    const allDays = new Set<string>();
    for (const c of schedule) {
      allDays.add(c.day);
    }

    for (const day of allDays) {
      const sessionsForDay = new Map<string, GroupSession>();
      const combosForDay = schedule.filter((c) => c.day === day);

      for (const c of combosForDay) {
        for (const s of c.sessions) {
          const existing = sessionsForDay.get(s.sessionCode);
          if (existing) {
            const existingMember = existing.members.find(
              (m) => m.memberId === c.memberId
            );
            if (existingMember) {
              if (!existingMember.ranks.includes(c.rank)) {
                existingMember.ranks.push(c.rank);
              }
            } else {
              existing.members.push({
                memberId: c.memberId,
                firstName: c.firstName,
                lastName: c.lastName,
                avatarColor: c.avatarColor,
                ranks: [c.rank],
              });
            }
          } else {
            sessionsForDay.set(s.sessionCode, {
              ...s,
              members: [
                {
                  memberId: c.memberId,
                  firstName: c.firstName,
                  lastName: c.lastName,
                  avatarColor: c.avatarColor,
                  ranks: [c.rank],
                },
              ],
            });
          }
        }
      }
      map.set(day, [...sessionsForDay.values()]);
    }
    return map;
  }, [schedule]);

  function toggleMember(memberId: string) {
    setSelectedMembers((prev) => {
      // If currently "all", switch to individual selection with just this member
      if (prev === "all") {
        return new Set([memberId]);
      }
      const next = new Set(prev);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      // If nothing selected, go back to "all"
      if (next.size === 0) return "all";
      return next;
    });
  }

  function selectAll() {
    setSelectedMembers("all");
  }

  // The actual set of selected IDs for filtering / sidebar display
  const selectedMemberSet: Set<string> =
    selectedMembers === "all"
      ? new Set(members.map((m) => m.id))
      : selectedMembers;
  const isAllSelected = selectedMembers === "all";

  // Filter a session list by member selection
  function filterSessions(sessions: GroupSession[]): GroupSession[] {
    let result = sessions;

    // Member filter
    if (
      !(isAllSelected && filterMode === "any") &&
      selectedMemberSet.size > 0
    ) {
      result = result.filter((s) => {
        const memberIds = new Set(s.members.map((m) => m.memberId));
        if (filterMode === "any") {
          return [...selectedMemberSet].some((id) => memberIds.has(id));
        } else {
          return [...selectedMemberSet].every((id) => memberIds.has(id));
        }
      });
    }

    // Purchased filter
    if (purchasedFilter === "purchased") {
      result = result.filter((s) => s.purchases.length > 0);
    } else if (purchasedFilter === "not_purchased") {
      result = result.filter((s) => s.purchases.length === 0);
    }

    // Sold out filter
    if (soldOutFilter === "sold_out") {
      result = result.filter((s) => s.isSoldOut);
    } else if (soldOutFilter === "available") {
      result = result.filter((s) => !s.isSoldOut);
    }

    // Search filter
    if (searchQuery) {
      result = result.filter((s) => matchesSearch(s, searchQuery));
    }

    return result;
  }

  // Render sidebar into the side panel
  useEffect(() => {
    if (!hasSchedules || !hasDateConfig || !schedule || schedule.length === 0) {
      setPanel(null);
      return () => setPanel(null);
    }

    setPanel(
      <GroupScheduleSidebar
        displayMode={displayMode}
        onSetDisplayMode={setDisplayMode}
        dateConfig={{
          dateMode: group.dateMode!,
          consecutiveDays: group.consecutiveDays,
          startDate: group.startDate,
          endDate: group.endDate,
        }}
        windowRankings={windowRankings.slice(0, 3)}
        activeWindowId={activeWindowId}
        onSelectWindow={handleSelectWindow}
        members={members}
        selectedMembers={selectedMemberSet}
        isAllSelected={isAllSelected}
        filterMode={filterMode}
        purchasedFilter={purchasedFilter}
        searchQuery={searchQuery}
        onToggleMember={toggleMember}
        onSetFilterMode={setFilterMode}
        onSetPurchasedFilter={setPurchasedFilter}
        soldOutFilter={soldOutFilter}
        onSetSoldOutFilter={setSoldOutFilter}
        onSelectAll={selectAll}
        onSetSearchQuery={setSearchQuery}
      />
    );

    return () => setPanel(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    setPanel,
    hasSchedules,
    hasDateConfig,
    schedule,
    group.dateMode,
    group.consecutiveDays,
    group.startDate,
    group.endDate,
    windowRankings,
    activeWindowId,
    members,
    selectedMembers,
    isAllSelected,
    filterMode,
    purchasedFilter,
    soldOutFilter,
    searchQuery,
    displayMode,
  ]);

  // List view: all sessions grouped by date, sorted by time
  const listGroups = useMemo(() => {
    if (displayMode !== "list") return [];
    const groups: { date: string; label: string; sessions: GroupSession[] }[] =
      [];
    const sortedDays = [...daySessionMap.keys()].sort();
    for (const day of sortedDays) {
      const filtered = filterSessions(daySessionMap.get(day) ?? []);
      if (filtered.length === 0) continue;
      const sorted = [...filtered].sort(
        (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
      );
      const hdr = formatSessionDateHeader(day);
      groups.push({
        date: day,
        label: `${hdr.weekday}, ${hdr.monthDay}`,
        sessions: sorted,
      });
    }
    return groups;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    displayMode,
    daySessionMap,
    selectedMembers,
    filterMode,
    purchasedFilter,
    soldOutFilter,
    searchQuery,
  ]);

  // State 1: No schedules
  if (!hasSchedules) {
    return (
      <PageEmpty title="Group Schedule">
        <p className="text-base text-slate-500">
          The group schedule will appear here once the owner has generated
          schedules and configured dates.
        </p>
      </PageEmpty>
    );
  }

  // No date config takes precedence over no combos
  if (!hasDateConfig) {
    return (
      <PageEmpty title="Group Schedule">
        <p className="text-base font-normal text-slate-500">
          Owner needs to configure dates before the group schedule can be
          viewed.
        </p>
        {isOwner && (
          <p className="mt-2 text-sm text-slate-500">
            Open Group Settings to set your date configuration.
          </p>
        )}
      </PageEmpty>
    );
  }

  if (group.membersWithNoCombos.length > 0) {
    return (
      <PageEmpty title="Group Schedule">
        <p className="text-base font-bold text-red-600">
          Some members received no sessions on their schedules.
        </p>
        <p className="mt-2 text-sm text-slate-500">
          This may occur if there isn&apos;t enough session interest overlap to
          fulfill buddy requirements. Wait for affected members to update their
          preferences and then regenerate schedules.
        </p>
      </PageEmpty>
    );
  }

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

  if (!schedule || schedule.length === 0) {
    return (
      <PageEmpty title="Group Schedule">
        <p className="text-base text-slate-500">No schedule data available.</p>
      </PageEmpty>
    );
  }

  // State 3: Full calendar UI
  const gridHeight = TOTAL_HOURS * HOUR_HEIGHT;

  // Week view navigation
  const currentWeek = weeks[weekIndex];
  const canPrevWeek = weekIndex > 0;
  const canNextWeek = weekIndex < weeks.length - 1;
  const weekStart = formatSessionDateHeader(currentWeek[0]);
  const weekEnd = formatSessionDateHeader(currentWeek[6]);
  const weekLabel = `${weekStart.monthDay} - ${weekEnd.monthDay}, 2028`;

  // Day view navigation
  const currentDay = OLYMPIC_DAYS_LIST[dayIndex];
  const canPrevDay = dayIndex > 0;
  const canNextDay = dayIndex < OLYMPIC_DAYS_LIST.length - 1;
  const currentDayHeader = formatSessionDateHeader(currentDay);
  const dayLabel = `${currentDayHeader.weekday}, ${currentDayHeader.monthDay}, 2028`;

  // Which days to render in the grid
  const visibleDays = calendarScale === "week" ? currentWeek : [currentDay];
  const gridCols =
    calendarScale === "week"
      ? "grid-cols-[60px_repeat(7,1fr)]"
      : "grid-cols-[60px_1fr]";

  // In week view, cap overlapping columns and collect hidden sessions
  const MAX_WEEK_COLS = 3;

  function jumpToDay(dayStr: string) {
    setDayIndex(dayIndexForDate(dayStr));
    setCalendarScale("day");
    setHoveredDay(null);
  }

  // Shared session block renderer
  function renderSessionBlock(
    s: GroupSession,
    dayStr: string,
    overlapLayout: Map<string, LayoutInfo>
  ) {
    const startMin = timeToMinutes(s.startTime);
    const endMin = timeToMinutes(s.endTime);
    const topPx = ((startMin - HOUR_START * 60) / 60) * HOUR_HEIGHT;
    const heightPx = ((endMin - startMin) / 60) * HOUR_HEIGHT;
    const color = sportColorMap.get(s.sport) ?? FALLBACK_SPORT_COLOR;
    const layout = overlapLayout.get(s.sessionCode);
    const colIndex = layout?.colIndex ?? 0;
    const totalCols = layout?.totalCols ?? 1;
    const widthPct = `calc(${100 / totalCols}% - ${3 + 3 / totalCols}px)`;
    const leftPct = `calc(${(colIndex * 100) / totalCols}% + 3px)`;

    return (
      <button
        key={s.sessionCode}
        className="absolute cursor-pointer rounded-lg px-2 py-1.5 text-left transition-shadow hover:shadow-md"
        style={{
          top: `${topPx}px`,
          height: `${Math.max(heightPx, 24)}px`,
          left: leftPct,
          width: widthPct,
          backgroundColor: color.bg,
          borderLeft: `4px solid ${color.border}`,
          zIndex: 2,
        }}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedSession({ session: s, day: dayStr });
        }}
      >
        <Maximize2
          size={12}
          className="absolute right-1.5 top-1.5 opacity-70"
          style={{ color: color.text }}
        />

        <div
          className="overflow-hidden pr-4"
          style={{ height: `${Math.max(heightPx, 24) - 24}px` }}
        >
          <p
            className="truncate text-sm font-semibold leading-tight"
            style={{ color: color.text }}
          >
            {s.sessionCode}
          </p>
          <p
            className="truncate text-sm font-semibold leading-tight"
            style={{ color: color.text }}
          >
            {s.sport}
          </p>
          {heightPx >= 44 && (
            <p className="mt-0.5 truncate text-[13px] leading-tight text-slate-600">
              {formatSessionTime(s.startTime)} - {formatSessionTime(s.endTime)}
            </p>
          )}
          {heightPx >= 64 && s.sessionDescription && (
            <p className="mt-0.5 truncate text-[13px] leading-tight text-slate-600">
              {s.sessionDescription}
            </p>
          )}
          {heightPx >= 82 && (
            <p className="mt-0.5 truncate text-[13px] leading-tight text-slate-600">
              {s.venue}
            </p>
          )}
          {heightPx >= 96 && s.zone && (
            <p className="mt-0.5 truncate text-[13px] leading-tight text-slate-600">
              {s.zone}
            </p>
          )}
        </div>

        {s.members.some((m) => m.memberId === myMemberId) && (
          <div className="flex items-center gap-0.5">
            <User size={10} className="text-slate-500" />
            <span className="text-[10px] font-medium leading-none text-slate-500">
              You
            </span>
          </div>
        )}
      </button>
    );
  }

  return (
    <section>
      {/* Top bar */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">Group Schedule</h2>
        {group.scheduleGeneratedAt && (
          <p className="text-sm text-[#d97706]">
            Schedule Last Updated On:{" "}
            {new Date(group.scheduleGeneratedAt).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        )}
        <p className="mt-1 text-xs text-slate-400">
          All session times are displayed in Pacific Time.
        </p>
      </div>

      {/* Calendar navigation — only in calendar mode */}
      {displayMode === "calendar" && (
        <div className="mb-3 flex items-center justify-between">
          {/* Week / Day toggle */}
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5">
            {(["week", "day"] as const).map((scale) => (
              <button
                key={scale}
                onClick={() => {
                  if (scale === "day" && calendarScale !== "day") {
                    const firstOlympic = currentWeek.find((d) =>
                      OLYMPIC_DAYS_SET.has(d)
                    );
                    if (firstOlympic)
                      setDayIndex(dayIndexForDate(firstOlympic));
                  } else if (scale === "week" && calendarScale === "day") {
                    setWeekIndex(weekIndexForDate(currentDay));
                  }
                  setCalendarScale(scale);
                }}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  calendarScale === scale
                    ? "bg-white text-slate-700 shadow-sm"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                {scale === "week" ? "Week" : "Day"}
              </button>
            ))}
          </div>

          {/* Prev / label / Next */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                if (calendarScale === "week") {
                  setWeekIndex((i) => i - 1);
                } else {
                  setDayIndex((i) => i - 1);
                }
                setSelectedSession(null);
              }}
              disabled={calendarScale === "week" ? !canPrevWeek : !canPrevDay}
              className="rounded-lg border border-slate-200 p-2 text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
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
            </button>
            <span className="min-w-[220px] text-center text-sm font-semibold text-slate-700">
              {calendarScale === "week" ? weekLabel : dayLabel}
            </span>
            <button
              onClick={() => {
                if (calendarScale === "week") {
                  setWeekIndex((i) => i + 1);
                } else {
                  setDayIndex((i) => i + 1);
                }
                setSelectedSession(null);
              }}
              disabled={calendarScale === "week" ? !canNextWeek : !canNextDay}
              className="rounded-lg border border-slate-200 p-2 text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
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
                  d="M8.25 4.5l7.5 7.5-7.5 7.5"
                />
              </svg>
            </button>
          </div>

          {/* Spacer to balance */}
          <div className="w-[106px]" />
        </div>
      )}

      {/* List view */}
      {displayMode === "list" && (
        <div className="space-y-4">
          {listGroups.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-slate-200 py-10 text-center">
              <p className="text-sm text-slate-500">
                No sessions match the current filters.
              </p>
            </div>
          ) : (
            listGroups.map((group) => (
              <div key={group.date}>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {group.label}
                </h4>
                <div className="space-y-1.5">
                  {group.sessions.map((s) => {
                    const color =
                      sportColorMap.get(s.sport) ?? FALLBACK_SPORT_COLOR;
                    const isMine = s.members.some(
                      (m) => m.memberId === myMemberId
                    );
                    return (
                      <div
                        key={s.sessionCode}
                        className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 transition-colors hover:border-slate-300 hover:bg-slate-50"
                        role="button"
                        tabIndex={0}
                        onClick={() =>
                          setSelectedSession({
                            session: s,
                            day: group.date,
                          })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedSession({
                              session: s,
                              day: group.date,
                            });
                          }
                        }}
                      >
                        <div
                          className="w-1 flex-shrink-0 self-stretch rounded-full"
                          style={{ backgroundColor: color.border }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span
                              className="text-base font-bold"
                              style={{ color: color.border }}
                            >
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
                          {s.sessionDescription && (
                            <p className="mt-0.5 truncate text-sm text-slate-700">
                              {s.sessionDescription}
                            </p>
                          )}
                          <p className="mt-0.5 text-sm text-slate-400">
                            {formatSessionTime(s.startTime)} &ndash;{" "}
                            {formatSessionTime(s.endTime)} &middot; {s.venue}{" "}
                            &middot; {s.zone}
                          </p>
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-2">
                          {isMine && (
                            <span className="flex items-center gap-1 rounded-full bg-[#009de5]/10 px-2 py-0.5 text-xs font-medium text-[#009de5]">
                              <User size={10} />
                              You
                            </span>
                          )}
                          <span className="text-xs text-slate-400">
                            {s.members.length}{" "}
                            {s.members.length === 1 ? "member" : "members"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Calendar (week + day views) */}
      {displayMode === "calendar" && (
        <div className="rounded-xl border border-slate-200 bg-white">
          {/* Column headers */}
          <div className={`grid ${gridCols} border-b border-slate-200`}>
            <div />
            {visibleDays.map((dayStr) => {
              const { weekday, monthDay } = formatSessionDateHeader(dayStr);
              const isOlympic = OLYMPIC_DAYS_SET.has(dayStr);
              const isInWindow = windowDaysSet.has(dayStr);
              const canClick = calendarScale === "week" && isOlympic;
              const isHovered = hoveredDay === dayStr;
              return (
                <div
                  key={dayStr}
                  role={canClick ? "button" : undefined}
                  tabIndex={canClick ? 0 : undefined}
                  onClick={canClick ? () => jumpToDay(dayStr) : undefined}
                  onKeyDown={
                    canClick
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            jumpToDay(dayStr);
                          }
                        }
                      : undefined
                  }
                  onMouseEnter={
                    canClick ? () => setHoveredDay(dayStr) : undefined
                  }
                  onMouseLeave={
                    canClick ? () => setHoveredDay(null) : undefined
                  }
                  className={`border-l border-slate-300 px-1 py-3 text-center transition-colors ${
                    isHovered
                      ? "bg-slate-200/60"
                      : isInWindow
                        ? "bg-slate-100"
                        : !isOlympic
                          ? "bg-slate-50/70"
                          : ""
                  }`}
                >
                  <div
                    className={`text-xs font-medium ${isOlympic ? "text-slate-500" : "text-slate-300"}`}
                  >
                    {weekday}
                  </div>
                  <div
                    className={`text-sm font-semibold ${isOlympic ? "text-slate-700" : "text-slate-300"}`}
                  >
                    {monthDay}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Time grid */}
          <div className={`grid ${gridCols}`}>
            {/* Time gutter */}
            <div className="relative" style={{ height: `${gridHeight}px` }}>
              {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => {
                const hour = HOUR_START + i;
                if (hour === 6 || hour === 25) return null;
                return (
                  <div
                    key={i}
                    className="absolute right-3 -translate-y-1/2 text-xs text-slate-500"
                    style={{ top: `${i * HOUR_HEIGHT}px` }}
                  >
                    {formatHourLabel(hour)}
                  </div>
                );
              })}
            </div>

            {/* Day columns */}
            {visibleDays.map((dayStr) => {
              const isOlympic = OLYMPIC_DAYS_SET.has(dayStr);
              const isInWindow = windowDaysSet.has(dayStr);
              const daySessions = filterSessions(
                daySessionMap.get(dayStr) ?? []
              );
              const overlapLayout = computeOverlapLayout(
                daySessions.map((s) => ({
                  code: s.sessionCode,
                  startTime: s.startTime,
                  endTime: s.endTime,
                }))
              );

              // In week view, cap columns and collect "+N more" badges
              const shouldCap = calendarScale === "week";
              let visibleSessions = daySessions;
              let moreBadges: { top: number; count: number }[] = [];

              if (shouldCap) {
                const hidden: GroupSession[] = [];
                visibleSessions = daySessions.filter((s) => {
                  const layout = overlapLayout.get(s.sessionCode);
                  if (
                    layout &&
                    layout.totalCols > MAX_WEEK_COLS &&
                    layout.colIndex >= MAX_WEEK_COLS
                  ) {
                    hidden.push(s);
                    return false;
                  }
                  return true;
                });

                if (hidden.length > 0) {
                  const hiddenByStart = [...hidden].sort(
                    (a, b) =>
                      timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
                  );
                  let clusterStart = timeToMinutes(hiddenByStart[0].startTime);
                  let clusterEnd = timeToMinutes(hiddenByStart[0].endTime);
                  let clusterCount = 1;

                  for (let i = 1; i < hiddenByStart.length; i++) {
                    const sStart = timeToMinutes(hiddenByStart[i].startTime);
                    const sEnd = timeToMinutes(hiddenByStart[i].endTime);
                    if (sStart < clusterEnd) {
                      clusterEnd = Math.max(clusterEnd, sEnd);
                      clusterCount++;
                    } else {
                      moreBadges.push({
                        top:
                          ((clusterStart - HOUR_START * 60) / 60) * HOUR_HEIGHT,
                        count: clusterCount,
                      });
                      clusterStart = sStart;
                      clusterEnd = sEnd;
                      clusterCount = 1;
                    }
                  }
                  moreBadges.push({
                    top: ((clusterStart - HOUR_START * 60) / 60) * HOUR_HEIGHT,
                    count: clusterCount,
                  });
                }

                if (hidden.length > 0) {
                  const cappedLayout = computeOverlapLayout(
                    visibleSessions.map((s) => ({
                      code: s.sessionCode,
                      startTime: s.startTime,
                      endTime: s.endTime,
                    }))
                  );
                  const isColHovered = hoveredDay === dayStr;
                  return (
                    <div
                      key={dayStr}
                      className={`relative border-l border-slate-300 transition-colors ${
                        isColHovered
                          ? "bg-slate-200/60"
                          : isInWindow
                            ? "bg-slate-100/60"
                            : !isOlympic
                              ? "bg-slate-50/50"
                              : ""
                      }`}
                      style={{ height: `${gridHeight}px` }}
                      onClick={
                        shouldCap && isOlympic
                          ? () => jumpToDay(dayStr)
                          : undefined
                      }
                      onMouseEnter={
                        shouldCap && isOlympic
                          ? () => setHoveredDay(dayStr)
                          : undefined
                      }
                      onMouseLeave={
                        shouldCap && isOlympic
                          ? () => setHoveredDay(null)
                          : undefined
                      }
                    >
                      {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => (
                        <div
                          key={i}
                          className="absolute left-0 right-0 border-t border-slate-200"
                          style={{ top: `${i * HOUR_HEIGHT}px` }}
                        />
                      ))}
                      {visibleSessions.map((s) =>
                        renderSessionBlock(s, dayStr, cappedLayout)
                      )}
                      {moreBadges.map((badge, i) => (
                        <button
                          key={`more-${i}`}
                          onClick={() => jumpToDay(dayStr)}
                          className="absolute right-1 rounded-full bg-slate-600 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm transition-colors hover:bg-slate-700"
                          style={{ top: `${badge.top}px`, zIndex: 20 }}
                        >
                          +{badge.count} more
                        </button>
                      ))}
                    </div>
                  );
                }
              }

              const isColHovered = hoveredDay === dayStr;
              return (
                <div
                  key={dayStr}
                  className={`relative border-l border-slate-300 transition-colors ${
                    isColHovered
                      ? "bg-slate-200/60"
                      : isInWindow
                        ? "bg-slate-100/60"
                        : !isOlympic
                          ? "bg-slate-50/50"
                          : ""
                  }`}
                  style={{ height: `${gridHeight}px` }}
                  onClick={
                    shouldCap && isOlympic ? () => jumpToDay(dayStr) : undefined
                  }
                  onMouseEnter={
                    shouldCap && isOlympic
                      ? () => setHoveredDay(dayStr)
                      : undefined
                  }
                  onMouseLeave={
                    shouldCap && isOlympic
                      ? () => setHoveredDay(null)
                      : undefined
                  }
                >
                  {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => (
                    <div
                      key={i}
                      className="absolute left-0 right-0 border-t border-slate-200"
                      style={{ top: `${i * HOUR_HEIGHT}px` }}
                    />
                  ))}
                  {visibleSessions.map((s) =>
                    renderSessionBlock(s, dayStr, overlapLayout)
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Session detail modal */}
      {selectedSession && (
        <GroupSessionDetailModal
          session={selectedSession.session}
          day={selectedSession.day}
          sportColor={
            sportColorMap.get(selectedSession.session.sport) ??
            FALLBACK_SPORT_COLOR
          }
          onClose={() => setSelectedSession(null)}
        />
      )}
    </section>
  );
}

// ── Sidebar ─────────────────────────────────────────────────────────────────
function GroupScheduleSidebar({
  displayMode,
  onSetDisplayMode,
  dateConfig,
  windowRankings,
  activeWindowId,
  onSelectWindow,
  members,
  selectedMembers,
  isAllSelected,
  filterMode,
  purchasedFilter,
  soldOutFilter,
  searchQuery,
  onToggleMember,
  onSetFilterMode,
  onSetPurchasedFilter,
  onSetSoldOutFilter,
  onSelectAll,
  onSetSearchQuery,
}: {
  displayMode: "calendar" | "list";
  onSetDisplayMode: (mode: "calendar" | "list") => void;
  dateConfig: {
    dateMode: "consecutive" | "specific";
    consecutiveDays: number | null;
    startDate: string | null;
    endDate: string | null;
  };
  windowRankings: {
    id: string;
    startDate: string;
    endDate: string;
    score: number;
  }[];
  activeWindowId: string | null;
  onSelectWindow: (id: string) => void;
  members: MemberInfo[];
  selectedMembers: Set<string>;
  isAllSelected: boolean;
  filterMode: FilterMode;
  purchasedFilter: "all" | "purchased" | "not_purchased";
  searchQuery: string;
  onToggleMember: (id: string) => void;
  onSetFilterMode: (mode: FilterMode) => void;
  onSetPurchasedFilter: (v: "all" | "purchased" | "not_purchased") => void;
  soldOutFilter: "all" | "sold_out" | "available";
  onSetSoldOutFilter: (v: "all" | "sold_out" | "available") => void;
  onSelectAll: () => void;
  onSetSearchQuery: (query: string) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Calendar / List toggle */}
      <div>
        <h4 className="mb-2 text-sm font-semibold text-slate-900">View As</h4>
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5">
          {(["calendar", "list"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => onSetDisplayMode(mode)}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                displayMode === mode
                  ? "bg-white text-slate-700 shadow-sm"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              {mode === "calendar" ? "Calendar" : "List"}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <SidebarSearch value={searchQuery} onChange={onSetSearchQuery} />

      {/* Date configuration */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h4 className="mb-2 text-sm font-semibold text-slate-900">
          Selected Dates
        </h4>
        {dateConfig.dateMode === "specific" ? (
          <p className="text-xs text-slate-600">
            {formatSessionDateHeader(dateConfig.startDate!).monthDay} –{" "}
            {formatSessionDateHeader(dateConfig.endDate!).monthDay}
          </p>
        ) : (
          <p className="text-xs text-slate-600">
            {dateConfig.consecutiveDays} consecutive day
            {dateConfig.consecutiveDays !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* Window rankings (consecutive mode only) */}
      {dateConfig.dateMode === "consecutive" && windowRankings.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h4 className="mb-1 text-sm font-semibold text-slate-900">
            Top Windows
          </h4>
          <p className="group/score relative mb-3 inline-flex items-center gap-1 text-xs text-slate-600">
            Ranked by Group Score
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
            <span className="pointer-events-none absolute bottom-full left-0 z-10 mb-1.5 w-56 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-normal leading-snug text-white opacity-0 shadow-lg transition-opacity group-hover/score:opacity-100">
              Scores reflect how well each window matches the group&apos;s
              combined session preferences, weighted by interest level and
              schedule fit.
            </span>
          </p>
          <div className="space-y-2">
            {windowRankings.map((w, i) => {
              const wStart = formatSessionDateHeader(w.startDate);
              const wEnd = formatSessionDateHeader(w.endDate);
              const isActive = w.id === activeWindowId;
              const isClickable = displayMode === "calendar";
              return (
                <div
                  key={w.id}
                  role={isClickable ? "button" : undefined}
                  tabIndex={isClickable ? 0 : undefined}
                  onClick={() => isClickable && onSelectWindow(w.id)}
                  onKeyDown={
                    isClickable
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onSelectWindow(w.id);
                          }
                        }
                      : undefined
                  }
                  className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                    isActive
                      ? "border-[#009de5] bg-[#009de5]/5 text-[#009de5]"
                      : `border-slate-200 text-slate-500 ${isClickable ? "hover:bg-slate-50" : ""}`
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
                        isActive
                          ? "bg-[#009de5] text-white"
                          : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className="font-medium">
                      {wStart.monthDay} - {wEnd.monthDay}
                    </span>
                  </div>
                  <span
                    className={`text-xs font-medium ${isActive ? "text-[#009de5]" : "text-slate-600"}`}
                  >
                    {w.score.toFixed(1)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Member filter */}
      {members.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h4 className="mb-3 text-sm font-semibold text-slate-900">
            Filter by Members
          </h4>

          {/* Any / All toggle */}
          <div className="mb-3 flex items-center gap-1 rounded-lg bg-slate-100 p-0.5">
            {(["any", "all"] as const).map((mode) => {
              const isActive = filterMode === mode;
              const tooltip =
                mode === "any"
                  ? "Display sessions that at least 1 selected member is attending or interested in attending."
                  : "Display sessions that all selected members are attending or interested in attending.";
              return (
                <button
                  key={mode}
                  onClick={() => onSetFilterMode(mode)}
                  className={`group/toggle relative flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-white text-slate-700 shadow-sm"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  {mode === "any" ? "Any" : "All"}
                  <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 w-48 -translate-x-1/2 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-normal leading-snug text-white opacity-0 shadow-lg transition-opacity group-hover/toggle:opacity-100">
                    {tooltip}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={onSelectAll}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                isAllSelected
                  ? "bg-[#009de5]/10 text-[#009de5] ring-1 ring-[#009de5]/30"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
            >
              All Members
            </button>
            {members.map((m) => {
              const isActive = !isAllSelected && selectedMembers.has(m.id);
              return (
                <button
                  key={m.id}
                  onClick={() => onToggleMember(m.id)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-[#009de5]/10 text-[#009de5] ring-1 ring-[#009de5]/30"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  {m.firstName} {m.lastName}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter by Purchase Status */}
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
            active={purchasedFilter === key}
            onClick={() => onSetPurchasedFilter(key)}
          />
        ))}
      </FilterGroup>

      {/* Filter by Sold Out Status */}
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
          />
        ))}
      </FilterGroup>
    </div>
  );
}

// ── Session Detail Modal ────────────────────────────────────────────────────
function GroupSessionDetailModal({
  session,
  day,
  sportColor,
  onClose,
}: {
  session: GroupSession;
  day: string;
  sportColor: SportColor;
  onClose: () => void;
}) {
  const hasPurchases = session.purchases.length > 0;
  const hasReportedPrices = session.reportedPrices.length > 0;

  // Members with purchased tickets — exclude them from interested list
  const attendingMemberIds = new Set(
    session.purchases.flatMap((p) => p.assignees.map((a) => a.memberId))
  );
  const interestedOnly = session.members.filter(
    (m) => !attendingMemberIds.has(m.memberId)
  );

  return (
    <Modal title="Session Details" onClose={onClose} size="lg">
      {/* Status badges */}
      {(hasPurchases || session.isSoldOut || session.isOutOfBudget) && (
        <div className="mb-3 flex flex-wrap gap-2">
          {hasPurchases && <StatusBadge variant="purchased" />}
          {session.isSoldOut && <StatusBadge variant="sold_out" />}
          {session.isOutOfBudget && <StatusBadge variant="out_of_budget" />}
        </div>
      )}

      {/* Session info header */}
      <div
        className="mb-4 space-y-0.5 rounded-lg p-3.5"
        style={{ backgroundColor: `${sportColor.bg}99` }}
      >
        <div className="flex items-center gap-2">
          <span
            className="text-base font-semibold"
            style={{ color: sportColor.title }}
          >
            {session.sport}
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
            style={{ backgroundColor: sportColor.border }}
          >
            {session.sessionCode}
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
            style={{ backgroundColor: sportColor.border }}
          >
            {session.sessionType}
          </span>
        </div>
        <p className="flex items-center gap-1.5 text-sm font-medium text-slate-600">
          <span>{formatSessionDate(day)}</span>
          <span style={{ color: sportColor.border }}>|</span>
          <span>
            {formatSessionTime(session.startTime)} &ndash;{" "}
            {formatSessionTime(session.endTime)} PT
          </span>
        </p>
        <p className="flex items-center gap-1.5 text-sm font-medium text-slate-600">
          <span>{session.venue}</span>
          <span style={{ color: sportColor.border }}>|</span>
          <span>{session.zone}</span>
        </p>
        {session.sessionDescription && (
          <ul className="space-y-0.5 text-sm text-slate-600">
            {session.sessionDescription.split(";").map((event, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: sportColor.border }}
                />
                {event.trim()}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Attending members — only those with purchased tickets */}
      {hasPurchases && (
        <div className="mb-4">
          <p className="mb-2 text-sm font-semibold text-slate-700">
            Attending Members:
          </p>
          <div className="space-y-2">
            {session.purchases.map((p) =>
              p.assignees.map((a) => (
                <div
                  key={`${p.purchaseId}-${a.memberId}`}
                  className="flex items-center gap-2.5"
                >
                  <UserAvatar
                    firstName={a.firstName}
                    lastName={a.lastName}
                    avatarColor={a.avatarColor}
                    size="sm"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-slate-800">
                      {a.firstName} {a.lastName}
                    </span>
                    {(a.pricePaid != null || p.pricePerTicket > 0) && (
                      <span className="text-xs text-emerald-600">
                        ${a.pricePaid ?? p.pricePerTicket} / ticket
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Interested members — excludes those already attending */}
      {interestedOnly.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-sm font-semibold text-slate-700">
            Interested Members:
          </p>
          <div className="space-y-2">
            {interestedOnly.map((m) => (
              <div key={m.memberId} className="flex items-center gap-2.5">
                <UserAvatar
                  firstName={m.firstName}
                  lastName={m.lastName}
                  avatarColor={m.avatarColor}
                  size="sm"
                />
                <span className="text-sm font-medium text-slate-800">
                  {m.firstName} {m.lastName}
                </span>
                <div className="flex gap-1">
                  {(m.ranks ?? []).map((r) => (
                    <span
                      key={r}
                      className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold leading-none text-white"
                      style={{
                        backgroundColor: RANK_TAG_COLORS[r].bg,
                      }}
                    >
                      {RANK_SHORT_LABELS[r]}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reported prices */}
      {hasReportedPrices && (
        <div className="mt-4 rounded-lg bg-slate-50 p-3">
          <p className="mb-1.5 text-xs font-semibold text-slate-600">
            Reported Prices:
          </p>
          <div className="space-y-1">
            {session.reportedPrices.map((rp, i) => (
              <div key={i} className="text-xs text-slate-500">
                <p>
                  {rp.minPrice != null && rp.maxPrice != null
                    ? `$${rp.minPrice} – $${rp.maxPrice}`
                    : rp.minPrice != null
                      ? `From $${rp.minPrice}`
                      : rp.maxPrice != null
                        ? `Up to $${rp.maxPrice}`
                        : "Comment"}{" "}
                  reported by {rp.reporterFirstName} {rp.reporterLastName} on{" "}
                  {new Date(rp.createdAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
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
    </Modal>
  );
}
