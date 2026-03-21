"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useGroup } from "../_components/group-context";
import { getMySchedule } from "./actions";
import type { ScheduleDay, ScheduleCombo } from "./actions";
import { SPORT_COLORS } from "@/lib/constants";
import { Maximize2 } from "lucide-react";
import SessionDetailModal from "./_components/session-detail-modal";

// ── Sport color helper ───────────────────────────────────────────────────────
type SportColor = { bg: string; border: string; text: string; title: string };
const FALLBACK_COLOR: SportColor = {
  bg: "#f1f5f9",
  border: "#94a3b8",
  text: "#475569",
  title: "#64748b",
};

function buildSportColorMap(rankings: string[]): Map<string, SportColor> {
  const map = new Map<string, SportColor>();
  rankings.forEach((sport, i) => {
    const c = SPORT_COLORS[i % SPORT_COLORS.length];
    map.set(sport, {
      bg: c.bg,
      border: c.accent,
      text: c.text,
      title: c.title,
    });
  });
  return map;
}

// ── Rank styling ──────────────────────────────────────────────────────────────
const rankLabels: Record<string, string> = {
  primary: "Primary",
  backup1: "Backup 1",
  backup2: "Backup 2",
};
const rankShortLabels: Record<string, string> = {
  primary: "P",
  backup1: "B1",
  backup2: "B2",
};
const rankFilterStyles: Record<
  string,
  { bg: string; text: string; ring: string }
> = {
  primary: {
    bg: "bg-[#009de5]/10",
    text: "text-[#009de5]",
    ring: "ring-[#009de5]/30",
  },
  backup1: {
    bg: "bg-[#d97706]/10",
    text: "text-[#d97706]",
    ring: "ring-[#d97706]/30",
  },
  backup2: {
    bg: "bg-[#ff0080]/10",
    text: "text-[#ff0080]",
    ring: "ring-[#ff0080]/30",
  },
};
const rankTagStyles: Record<string, { bg: string; text: string }> = {
  primary: { bg: "#009de5", text: "#ffffff" },
  backup1: { bg: "#d97706", text: "#ffffff" },
  backup2: { bg: "#ff0080", text: "#ffffff" },
};

// ── Time grid config ──────────────────────────────────────────────────────────
// Sessions span 7 AM - 12 AM, but we add a buffer hour before and after
// so the 7 AM and 12 AM lines have room for labels above/below.
const HOUR_START = 6; // grid starts at 6 AM
const HOUR_END = 25; // grid ends at 1 AM
const SESSION_HOUR_START = 7; // actual earliest session
const TOTAL_HOURS = HOUR_END - HOUR_START;
const HOUR_HEIGHT = 64; // px per hour

// ── Olympic dates ─────────────────────────────────────────────────────────────
const OLYMPIC_DAYS_SET = new Set<string>();
const OLYMPIC_START_DATE = new Date("2028-07-12T12:00:00");
for (let i = 0; i < 19; i++) {
  const d = new Date(OLYMPIC_START_DATE);
  d.setDate(d.getDate() + i);
  OLYMPIC_DAYS_SET.add(d.toISOString().split("T")[0]);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m;
  // Treat 00:00 as midnight (end of day)
  return total === 0 ? 24 * 60 : total;
}

function formatTime(time: string) {
  const [h, m] = time.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${display}:${m} ${ampm}`;
}

function formatHourLabel(hour: number) {
  const h = hour % 24;
  if (h === 0) return "12 AM";
  if (h === 12) return "12 PM";
  return h > 12 ? `${h - 12} PM` : `${h} AM`;
}

function formatDateHeader(dateStr: string) {
  const date = new Date(dateStr + "T12:00:00");
  const weekday = date.toLocaleDateString("en-US", { weekday: "short" });
  const month = date.toLocaleDateString("en-US", { month: "short" });
  const day = date.getDate();
  return { weekday, monthDay: `${month} ${day}` };
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

function buildWeeks(): string[][] {
  const firstOlympic = "2028-07-12";
  const lastOlympic = "2028-07-30";
  // Find the Sunday on or before the first Olympic day
  const firstDate = new Date(firstOlympic + "T12:00:00");
  const dow = firstDate.getDay(); // 0=Sun
  const weekStart = addDays(firstOlympic, -dow);
  // Find the Saturday on or after the last Olympic day
  const lastDate = new Date(lastOlympic + "T12:00:00");
  const lastDow = lastDate.getDay();
  const saturdayOffset = lastDow === 6 ? 0 : 6 - lastDow;
  const weekEnd = addDays(lastOlympic, saturdayOffset);

  const weeks: string[][] = [];
  let current = weekStart;
  let currentWeek: string[] = [];
  while (current <= weekEnd) {
    currentWeek.push(current);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    current = addDays(current, 1);
  }
  return weeks;
}

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

// ── Overlap layout ───────────────────────────────────────────────────────────
type LayoutInfo = { colIndex: number; totalCols: number };

function computeOverlapLayout(
  sessions: MergedSession[]
): Map<string, LayoutInfo> {
  const result = new Map<string, LayoutInfo>();
  if (sessions.length === 0) return result;

  // Sort by start time, then by end time (longer first)
  const sorted = [...sessions].sort((a, b) => {
    const aStart = timeToMinutes(a.session.startTime);
    const bStart = timeToMinutes(b.session.startTime);
    if (aStart !== bStart) return aStart - bStart;
    return timeToMinutes(b.session.endTime) - timeToMinutes(a.session.endTime);
  });

  // Assign columns using a greedy approach
  const columns: { end: number; code: string }[][] = [];

  for (const ms of sorted) {
    const start = timeToMinutes(ms.session.startTime);
    const end = timeToMinutes(ms.session.endTime);

    // Find the first column where this session doesn't overlap
    let placed = false;
    for (let col = 0; col < columns.length; col++) {
      const lastInCol = columns[col][columns[col].length - 1];
      if (lastInCol.end <= start) {
        columns[col].push({ end, code: ms.session.sessionCode });
        result.set(ms.session.sessionCode, { colIndex: col, totalCols: 0 });
        placed = true;
        break;
      }
    }
    if (!placed) {
      columns.push([{ end, code: ms.session.sessionCode }]);
      result.set(ms.session.sessionCode, {
        colIndex: columns.length - 1,
        totalCols: 0,
      });
    }
  }

  // Now determine totalCols for each overlap group.
  // Two sessions are in the same group if they transitively overlap.
  // We find the max columns needed for each connected group.
  const entries = sorted.map((ms) => ({
    code: ms.session.sessionCode,
    start: timeToMinutes(ms.session.startTime),
    end: timeToMinutes(ms.session.endTime),
  }));

  // Build overlap groups
  const groups: number[][] = [];
  let currentGroup: number[] = [];
  let groupEnd = 0;

  for (let i = 0; i < entries.length; i++) {
    if (currentGroup.length === 0 || entries[i].start < groupEnd) {
      currentGroup.push(i);
      groupEnd = Math.max(groupEnd, entries[i].end);
    } else {
      groups.push(currentGroup);
      currentGroup = [i];
      groupEnd = entries[i].end;
    }
  }
  if (currentGroup.length > 0) groups.push(currentGroup);

  for (const group of groups) {
    // Count distinct columns used in this group
    const colsUsed = new Set(
      group.map((i) => result.get(entries[i].code)!.colIndex)
    );
    const totalCols = colsUsed.size;
    for (const i of group) {
      const info = result.get(entries[i].code)!;
      info.totalCols = totalCols;
    }
  }

  return result;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ScheduleContent() {
  const group = useGroup();
  const [schedule, setSchedule] = useState<ScheduleDay[] | null>(null);
  const [error, setError] = useState("");
  const fetchCounterRef = useRef(0);
  const ALL_RANKS = ["primary", "backup1", "backup2"];
  const [activeFilters, setActiveFilters] = useState<Set<string>>(
    new Set(ALL_RANKS)
  );
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

  useEffect(() => {
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
  }, [group.id, shouldFetch]);

  if (group.membersWithNoCombos.length > 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 px-6 py-16 text-center">
        <h2 className="mb-2 text-lg font-semibold text-slate-900">
          My Schedule
        </h2>
        <p className="text-base font-bold text-red-600">
          Some members received no sessions on their schedules.
        </p>
        <p className="mt-2 text-sm text-slate-500">
          This may occur if there isn&apos;t enough session interest overlap to
          fulfill buddy requirements. Wait for affected members to update their
          preferences and then regenerate schedules.
        </p>
      </div>
    );
  }

  if (group.phase === "preferences") {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 px-6 py-16 text-center">
        <h2 className="mb-2 text-lg font-semibold text-slate-900">
          My Schedule
        </h2>
        <p className="text-base text-slate-500">
          Your schedule will be available once the owner has generated schedules
          for the group.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center">
        <p className="text-sm text-slate-500">Loading schedule...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-16 text-center">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (!schedule || schedule.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 px-6 py-16 text-center">
        <h2 className="mb-2 text-lg font-semibold text-slate-900">
          My Schedule
        </h2>
        <p className="text-base text-slate-500">No schedule data available.</p>
      </div>
    );
  }

  function toggleFilter(rank: string) {
    setActiveFilters((prev) => {
      // If all are selected, narrow down to just the clicked one
      if (prev.size === ALL_RANKS.length) {
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

  const scheduleByDay = new Map<string, ScheduleDay>();
  for (const day of schedule) {
    scheduleByDay.set(day.day, day);
  }

  const currentWeek = weeks[weekIndex];
  const canPrev = weekIndex > 0;
  const canNext = weekIndex < weeks.length - 1;
  const weekStart = formatDateHeader(currentWeek[0]);
  const weekEnd = formatDateHeader(currentWeek[6]);
  const weekLabel = `${weekStart.monthDay} - ${weekEnd.monthDay}, 2028`;
  const gridHeight = TOTAL_HOURS * HOUR_HEIGHT;

  return (
    <section>
      {/* Top bar */}
      <div className="mb-4 flex items-center justify-between">
        <div>
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
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveFilters(new Set(ALL_RANKS))}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              activeFilters.size === ALL_RANKS.length
                ? "bg-slate-600 text-white"
                : "bg-slate-100 text-slate-400"
            }`}
          >
            All
          </button>
          {(["primary", "backup1", "backup2"] as const).map((rank) => (
            <button
              key={rank}
              onClick={() => toggleFilter(rank)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                activeFilters.has(rank) && activeFilters.size < ALL_RANKS.length
                  ? `${rankFilterStyles[rank].bg} ${rankFilterStyles[rank].text} ring-1 ${rankFilterStyles[rank].ring}`
                  : "bg-slate-100 text-slate-400"
              }`}
            >
              {rankLabels[rank]}
            </button>
          ))}
        </div>
      </div>

      {/* Week navigation */}
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
            const { weekday, monthDay } = formatDateHeader(dayStr);
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
            const merged = allMerged.filter((ms) =>
              ms.ranks.some((r) => activeFilters.has(r))
            );
            const overlapLayout = computeOverlapLayout(merged);

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
                    sportColorMap.get(session.sport) ?? FALLBACK_COLOR;
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
                        style={{ height: `${Math.max(heightPx, 24) - 24}px` }}
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
                          <p className="mt-0.5 truncate text-[13px] leading-tight text-slate-500">
                            {formatTime(session.startTime)} -{" "}
                            {formatTime(session.endTime)}
                          </p>
                        )}

                        {/* Description */}
                        {heightPx >= 64 && session.sessionDescription && (
                          <p className="mt-0.5 truncate text-[13px] leading-tight text-slate-500">
                            {session.sessionDescription}
                          </p>
                        )}

                        {/* Venue */}
                        {heightPx >= 82 && (
                          <p className="mt-0.5 truncate text-[13px] leading-tight text-slate-400">
                            {session.venue}
                          </p>
                        )}

                        {/* Zone */}
                        {heightPx >= 96 && session.zone && (
                          <p className="mt-0.5 truncate text-[13px] leading-tight text-slate-400">
                            {session.zone}
                          </p>
                        )}
                      </div>

                      {/* Rank tags — always visible, pinned to bottom */}
                      <div className="flex gap-1">
                        {ranks.map((r) => (
                          <span
                            key={r}
                            className="rounded px-1.5 py-0.5 text-[10px] font-bold leading-none"
                            style={{
                              backgroundColor: rankTagStyles[r].bg,
                              color: rankTagStyles[r].text,
                            }}
                          >
                            {rankShortLabels[r]}
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

      {/* Session detail modal */}
      {selectedSession && (
        <SessionDetailModal
          session={selectedSession.session}
          ranks={selectedSession.ranks}
          day={selectedSession.day}
          sportColor={
            sportColorMap.get(selectedSession.session.sport) ?? FALLBACK_COLOR
          }
          onClose={() => setSelectedSession(null)}
        />
      )}
    </section>
  );
}
