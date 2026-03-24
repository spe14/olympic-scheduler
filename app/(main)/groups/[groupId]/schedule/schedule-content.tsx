"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useGroup } from "../_components/group-context";
import { useSidePanel } from "../_components/side-panel-context";
import { getMySchedule } from "./actions";
import type { ScheduleDay, ScheduleCombo } from "./actions";
import {
  type SportColor,
  FALLBACK_SPORT_COLOR,
  buildSportColorMap,
  RANK_LABELS,
  RANK_SHORT_LABELS,
  RANK_TAG_COLORS,
  RANK_FILTER_STYLES,
  HOUR_START,
  HOUR_END,
  TOTAL_HOURS,
  HOUR_HEIGHT,
  OLYMPIC_DAYS_SET,
  timeToMinutes,
  formatHourLabel,
  addDays,
  buildWeeks,
  matchesSearch,
  computeOverlapLayout,
  type LayoutInfo,
} from "@/lib/schedule-utils";
import { Maximize2 } from "lucide-react";
import { PageError, PageEmpty } from "@/components/page-state";
import SidebarSearch from "@/components/sidebar-search";
import FilterPill, { FilterGroup } from "@/components/filter-pill";
import { formatSessionTime, formatSessionDateHeader } from "@/lib/utils";
import SessionDetailModal from "./_components/session-detail-modal";

// ── Merged session: deduplicate across combos, tag with ranks ─────────────────
type MergedSession = {
  session: ScheduleCombo["sessions"][0];
  ranks: string[];
};

function mergeSessions(combos: ScheduleCombo[]): MergedSession[] {
  const map = new Map<string, MergedSession>();
  for (const combo of combos) {
    for (const s of combo.sessions) {
      const existing = map.get(s.sessionCode);
      if (existing) {
        if (!existing.ranks.includes(combo.rank)) {
          existing.ranks.push(combo.rank);
        }
      } else {
        map.set(s.sessionCode, { session: s, ranks: [combo.rank] });
      }
    }
  }
  return [...map.values()];
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ScheduleContent() {
  const group = useGroup();
  const { setPanel } = useSidePanel();
  const [schedule, setSchedule] = useState<ScheduleDay[] | null>(null);
  const [error, setError] = useState("");
  const fetchCounterRef = useRef(0);
  const ALL_RANKS = ["primary", "backup1", "backup2"];
  const [activeFilters, setActiveFilters] = useState<Set<string>>(
    new Set(ALL_RANKS)
  );
  const [displayMode, setDisplayMode] = useState<"calendar" | "list">(
    "calendar"
  );
  const [purchasedFilter, setPurchasedFilter] = useState<
    "all" | "purchased" | "not_purchased"
  >("all");
  const [soldOutFilter, setSoldOutFilter] = useState<
    "all" | "sold_out" | "available"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [weekIndex, setWeekIndex] = useState(0);
  const [selectedSession, setSelectedSession] = useState<{
    session: ScheduleCombo["sessions"][0];
    ranks: string[];
    day: string;
  } | null>(null);

  const weeks = useMemo(() => buildWeeks(), []);
  const sportColorMap = useMemo(() => {
    if (!schedule) return new Map<string, SportColor>();
    const seen = new Set<string>();
    const sports: string[] = [];
    for (const day of schedule) {
      for (const c of day.combos) {
        for (const s of c.sessions) {
          if (!seen.has(s.sport)) {
            seen.add(s.sport);
            sports.push(s.sport);
          }
        }
      }
    }
    return buildSportColorMap(sports);
  }, [schedule]);

  const shouldFetch =
    group.phase !== "preferences" && group.membersWithNoCombos.length === 0;
  const loading = shouldFetch && schedule === null && !error;

  const fetchSchedule = () => {
    if (!shouldFetch) return;
    const fetchId = ++fetchCounterRef.current;
    getMySchedule(group.id).then((result) => {
      if (fetchId !== fetchCounterRef.current) return;
      if (result.error) {
        setError(result.error);
      } else {
        setSchedule(result.data ?? []);
      }
    });
  };

  useEffect(() => {
    fetchSchedule();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.id, shouldFetch]);

  // List view: group sessions by day, sorted by primary combo score descending
  // Must be declared here (before early returns) to satisfy Rules of Hooks
  const listGroups = useMemo(() => {
    if (displayMode !== "list" || !schedule) return [];
    // Sort days by primary score descending
    const sorted = [...schedule].sort(
      (a, b) => b.primaryScore - a.primaryScore
    );
    return sorted
      .map((day) => {
        // Merge sessions across combos and filter by active ranks
        const allMerged = mergeSessions(day.combos);
        let filtered = allMerged.filter((ms) =>
          ms.ranks.some((r) => activeFilters.has(r))
        );
        if (purchasedFilter === "purchased") {
          filtered = filtered.filter((ms) => ms.session.purchases.length > 0);
        } else if (purchasedFilter === "not_purchased") {
          filtered = filtered.filter((ms) => ms.session.purchases.length === 0);
        }
        if (soldOutFilter === "sold_out") {
          filtered = filtered.filter((ms) => ms.session.isSoldOut);
        } else if (soldOutFilter === "available") {
          filtered = filtered.filter((ms) => !ms.session.isSoldOut);
        }
        if (searchQuery.trim()) {
          filtered = filtered.filter((ms) =>
            matchesSearch(ms.session, searchQuery)
          );
        }
        const sessionsSorted = [...filtered].sort(
          (a, b) =>
            timeToMinutes(a.session.startTime) -
            timeToMinutes(b.session.startTime)
        );
        const hdr = formatSessionDateHeader(day.day);
        return {
          date: day.day,
          label: `${hdr.weekday}, ${hdr.monthDay}`,
          primaryScore: day.primaryScore,
          sessions: sessionsSorted,
        };
      })
      .filter((g) => g.sessions.length > 0);
  }, [
    displayMode,
    schedule,
    activeFilters,
    purchasedFilter,
    soldOutFilter,
    searchQuery,
  ]);

  // Render sidebar filters
  useEffect(() => {
    if (!schedule || schedule.length === 0) {
      setPanel(null);
      return () => setPanel(null);
    }

    setPanel(
      <MyScheduleSidebar
        searchQuery={searchQuery}
        onSetSearchQuery={setSearchQuery}
        displayMode={displayMode}
        onSetDisplayMode={setDisplayMode}
        activeFilters={activeFilters}
        onSetActiveFilters={setActiveFilters}
        purchasedFilter={purchasedFilter}
        onSetPurchasedFilter={setPurchasedFilter}
        soldOutFilter={soldOutFilter}
        onSetSoldOutFilter={setSoldOutFilter}
      />
    );

    return () => setPanel(null);
  }, [
    setPanel,
    schedule,
    displayMode,
    activeFilters,
    purchasedFilter,
    soldOutFilter,
    searchQuery,
  ]);

  if (group.membersWithNoCombos.length > 0) {
    return (
      <PageEmpty title="My Schedule">
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

  if (group.phase === "preferences") {
    return (
      <PageEmpty title="My Schedule">
        <p className="text-base text-slate-500">
          Your schedule will be available once the owner has generated schedules
          for the group.
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
      <PageEmpty title="My Schedule">
        <p className="text-base text-slate-500">No schedule data available.</p>
      </PageEmpty>
    );
  }

  const scheduleByDay = new Map<string, ScheduleDay>();
  for (const day of schedule) {
    scheduleByDay.set(day.day, day);
  }

  const currentWeek = weeks[weekIndex];
  const canPrev = weekIndex > 0;
  const canNext = weekIndex < weeks.length - 1;
  const weekStart = formatSessionDateHeader(currentWeek[0]);
  const weekEnd = formatSessionDateHeader(currentWeek[6]);
  const weekLabel = `${weekStart.monthDay} - ${weekEnd.monthDay}, 2028`;
  const gridHeight = TOTAL_HOURS * HOUR_HEIGHT;

  const isAffectedByNonConvergence =
    group.nonConvergenceMembers?.includes(group.myMemberId) ?? false;

  return (
    <section>
      {isAffectedByNonConvergence && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-600">
          <p>
            The algorithm was not able to meet all of your requirements during
            schedule generation. The generated schedule is the best-effort
            output. You can adjust preferences as needed in the{" "}
            <span className="font-semibold">Preferences</span> tab if you are
            unsatisfied with your schedule.
          </p>
        </div>
      )}
      {/* Top bar */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">My Schedule</h2>
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
            listGroups.map((dayGroup) => (
              <div key={dayGroup.date}>
                <div className="mb-2 flex items-center gap-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {dayGroup.label}
                  </h4>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                    Score: {dayGroup.primaryScore.toFixed(1)}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {dayGroup.sessions.map((ms) => {
                    const { session, ranks } = ms;
                    const color =
                      sportColorMap.get(session.sport) ?? FALLBACK_SPORT_COLOR;
                    return (
                      <div
                        key={session.sessionCode}
                        className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 transition-colors hover:border-slate-300 hover:bg-slate-50"
                        role="button"
                        tabIndex={0}
                        onClick={() =>
                          setSelectedSession({
                            session,
                            ranks,
                            day: dayGroup.date,
                          })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedSession({
                              session,
                              ranks,
                              day: dayGroup.date,
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
                              {session.sessionCode}
                            </span>
                            <span
                              className="rounded px-1.5 py-0.5 text-xs font-semibold text-white"
                              style={{ backgroundColor: color.border }}
                            >
                              {session.sport}
                            </span>
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">
                              {session.sessionType}
                            </span>
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium capitalize text-slate-600">
                              {session.interest}
                            </span>
                          </div>
                          {session.sessionDescription && (
                            <p className="mt-0.5 truncate text-sm text-slate-700">
                              {session.sessionDescription}
                            </p>
                          )}
                          <p className="mt-0.5 text-sm text-slate-400">
                            {formatSessionTime(session.startTime)} &ndash;{" "}
                            {formatSessionTime(session.endTime)} &middot;{" "}
                            {session.venue} &middot; {session.zone}
                          </p>
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-2">
                          {/* Rank tags */}
                          <div className="flex gap-1">
                            {ranks.map((r) => (
                              <span
                                key={r}
                                className="flex h-4 w-4 items-center justify-center rounded text-[10px] font-bold leading-none"
                                style={{
                                  backgroundColor: RANK_TAG_COLORS[r].bg,
                                  color: RANK_TAG_COLORS[r].text,
                                }}
                              >
                                {RANK_SHORT_LABELS[r]}
                              </span>
                            ))}
                          </div>
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

      {/* Week navigation — only in calendar mode */}
      {displayMode === "calendar" && (
        <>
          <div className="mb-3 flex items-center justify-center gap-4">
            <button
              onClick={() => {
                setWeekIndex((i) => i - 1);
                setSelectedSession(null);
              }}
              disabled={!canPrev}
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
              {weekLabel}
            </span>
            <button
              onClick={() => {
                setWeekIndex((i) => i + 1);
                setSelectedSession(null);
              }}
              disabled={!canNext}
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

          {/* Calendar */}
          <div className="rounded-xl border border-slate-200 bg-white">
            {/* Column headers */}
            <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-slate-200">
              <div />
              {currentWeek.map((dayStr) => {
                const { weekday, monthDay } = formatSessionDateHeader(dayStr);
                const isOlympic = OLYMPIC_DAYS_SET.has(dayStr);
                return (
                  <div
                    key={dayStr}
                    className={`border-l border-slate-300 px-1 py-3 text-center ${!isOlympic ? "bg-slate-50/70" : ""}`}
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
            <div className="grid grid-cols-[60px_repeat(7,1fr)]">
              {/* Time gutter */}
              <div className="relative" style={{ height: `${gridHeight}px` }}>
                {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => {
                  const hour = HOUR_START + i;
                  // Skip the buffer hours (6 AM and 1 AM)
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
              {currentWeek.map((dayStr) => {
                const isOlympic = OLYMPIC_DAYS_SET.has(dayStr);
                const dayData = scheduleByDay.get(dayStr);
                // Merge ALL combos so every session gets its full set of rank tags,
                // then filter to only show sessions that belong to at least one active filter.
                const allMerged = dayData ? mergeSessions(dayData.combos) : [];
                let merged = allMerged.filter((ms) =>
                  ms.ranks.some((r) => activeFilters.has(r))
                );
                if (purchasedFilter === "purchased") {
                  merged = merged.filter(
                    (ms) => ms.session.purchases.length > 0
                  );
                } else if (purchasedFilter === "not_purchased") {
                  merged = merged.filter(
                    (ms) => ms.session.purchases.length === 0
                  );
                }
                if (soldOutFilter === "sold_out") {
                  merged = merged.filter((ms) => ms.session.isSoldOut);
                } else if (soldOutFilter === "available") {
                  merged = merged.filter((ms) => !ms.session.isSoldOut);
                }
                if (searchQuery.trim()) {
                  merged = merged.filter((ms) =>
                    matchesSearch(ms.session, searchQuery)
                  );
                }
                const overlapLayout = computeOverlapLayout(
                  merged.map((ms) => ({
                    code: ms.session.sessionCode,
                    startTime: ms.session.startTime,
                    endTime: ms.session.endTime,
                  }))
                );

                return (
                  <div
                    key={dayStr}
                    className={`relative border-l border-slate-300 ${!isOlympic ? "bg-slate-50/50" : ""}`}
                    style={{ height: `${gridHeight}px` }}
                  >
                    {/* Hour lines */}
                    {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => (
                      <div
                        key={i}
                        className="absolute left-0 right-0 border-t border-slate-200"
                        style={{ top: `${i * HOUR_HEIGHT}px` }}
                      />
                    ))}

                    {/* Session blocks */}
                    {merged.map((ms) => {
                      const { session, ranks } = ms;
                      const startMin = timeToMinutes(session.startTime);
                      const endMin = timeToMinutes(session.endTime);
                      const topPx =
                        ((startMin - HOUR_START * 60) / 60) * HOUR_HEIGHT;
                      const heightPx = ((endMin - startMin) / 60) * HOUR_HEIGHT;
                      const color =
                        sportColorMap.get(session.sport) ??
                        FALLBACK_SPORT_COLOR;
                      const layout = overlapLayout.get(session.sessionCode);
                      const colIndex = layout?.colIndex ?? 0;
                      const totalCols = layout?.totalCols ?? 1;
                      const widthPct = `calc(${100 / totalCols}% - ${3 + 3 / totalCols}px)`;
                      const leftPct = `calc(${(colIndex * 100) / totalCols}% + 3px)`;

                      return (
                        <button
                          key={session.sessionCode}
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
                          onClick={() =>
                            setSelectedSession({
                              session,
                              ranks,
                              day: dayStr,
                            })
                          }
                        >
                          {/* Expand icon — always visible, top-right */}
                          <Maximize2
                            size={12}
                            className="absolute right-1.5 top-1.5 opacity-70"
                            style={{ color: color.text }}
                          />

                          {/* Scrollable content area */}
                          <div
                            className="overflow-hidden pr-4"
                            style={{
                              height: `${Math.max(heightPx, 24) - 24}px`,
                            }}
                          >
                            {/* Session code */}
                            <p
                              className="truncate text-sm font-semibold leading-tight"
                              style={{ color: color.text }}
                            >
                              {session.sessionCode}
                            </p>

                            {/* Sport name */}
                            <p
                              className="truncate text-sm font-semibold leading-tight"
                              style={{ color: color.text }}
                            >
                              {session.sport}
                            </p>

                            {/* Time */}
                            {heightPx >= 44 && (
                              <p className="mt-0.5 truncate text-[13px] leading-tight text-slate-600">
                                {formatSessionTime(session.startTime)} -{" "}
                                {formatSessionTime(session.endTime)}
                              </p>
                            )}

                            {/* Description */}
                            {heightPx >= 64 && session.sessionDescription && (
                              <p className="mt-0.5 truncate text-[13px] leading-tight text-slate-600">
                                {session.sessionDescription}
                              </p>
                            )}

                            {/* Venue */}
                            {heightPx >= 82 && (
                              <p className="mt-0.5 truncate text-[13px] leading-tight text-slate-600">
                                {session.venue}
                              </p>
                            )}

                            {/* Zone */}
                            {heightPx >= 96 && session.zone && (
                              <p className="mt-0.5 truncate text-[13px] leading-tight text-slate-600">
                                {session.zone}
                              </p>
                            )}
                          </div>

                          {/* Rank tags — always visible, pinned to bottom */}
                          <div className="flex gap-1">
                            {ranks.map((r) => (
                              <span
                                key={r}
                                className="flex h-4 w-4 items-center justify-center rounded text-[10px] font-bold leading-none"
                                style={{
                                  backgroundColor: RANK_TAG_COLORS[r].bg,
                                  color: RANK_TAG_COLORS[r].text,
                                }}
                              >
                                {RANK_SHORT_LABELS[r]}
                              </span>
                            ))}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Session detail modal */}
      {selectedSession && (
        <SessionDetailModal
          session={selectedSession.session}
          ranks={selectedSession.ranks}
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

const ALL_RANKS_CONST = ["primary", "backup1", "backup2"];

function MyScheduleSidebar({
  searchQuery,
  onSetSearchQuery,
  displayMode,
  onSetDisplayMode,
  activeFilters,
  onSetActiveFilters,
  purchasedFilter,
  onSetPurchasedFilter,
  soldOutFilter,
  onSetSoldOutFilter,
}: {
  searchQuery: string;
  onSetSearchQuery: (v: string) => void;
  displayMode: "calendar" | "list";
  onSetDisplayMode: (mode: "calendar" | "list") => void;
  activeFilters: Set<string>;
  onSetActiveFilters: React.Dispatch<React.SetStateAction<Set<string>>>;
  purchasedFilter: "all" | "purchased" | "not_purchased";
  onSetPurchasedFilter: (v: "all" | "purchased" | "not_purchased") => void;
  soldOutFilter: "all" | "sold_out" | "available";
  onSetSoldOutFilter: (v: "all" | "sold_out" | "available") => void;
}) {
  function toggleFilter(rank: string) {
    onSetActiveFilters((prev) => {
      if (prev.size === ALL_RANKS_CONST.length) {
        return new Set([rank]);
      }
      const next = new Set(prev);
      if (next.has(rank)) {
        if (next.size > 1) next.delete(rank);
      } else {
        next.add(rank);
      }
      return next;
    });
  }

  return (
    <div className="space-y-4">
      {/* View As toggle */}
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

      {/* Filter by Combo */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h4 className="mb-2 text-sm font-semibold text-slate-900">
          Filter by Combo
        </h4>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => onSetActiveFilters(new Set(ALL_RANKS_CONST))}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              activeFilters.size === ALL_RANKS_CONST.length
                ? "bg-slate-600 text-white"
                : "bg-slate-100 text-slate-400 hover:text-slate-600"
            }`}
          >
            All
          </button>
          {(["primary", "backup1", "backup2"] as const).map((rank) => (
            <button
              key={rank}
              onClick={() => toggleFilter(rank)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                activeFilters.has(rank) &&
                activeFilters.size < ALL_RANKS_CONST.length
                  ? `${RANK_FILTER_STYLES[rank].bg} ${RANK_FILTER_STYLES[rank].text} ring-1 ${RANK_FILTER_STYLES[rank].ring}`
                  : "bg-slate-100 text-slate-400 hover:text-slate-600"
              }`}
            >
              {RANK_LABELS[rank]}
            </button>
          ))}
        </div>
      </div>

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
