"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useSidePanel } from "../../_components/side-panel-context";
import SessionInterestModal from "./session-interest-modal";
import SessionCard from "./session-card";
import ConfirmModal from "@/components/confirm-modal";
import type { SessionData, SessionPreferenceData } from "./preference-wizard";
import { SPORT_COLORS, INTEREST_COLORS } from "@/lib/constants";
import { formatSessionDate } from "@/lib/utils";

type Props = {
  sessions: SessionData[];
  sportRankings: string[];
  initialPreferences: Map<string, SessionPreferenceData>;
  initialHiddenSessions: Set<string>;
  onChange: (prefs: Map<string, SessionPreferenceData>) => void;
  onHiddenChange: (hidden: Set<string>) => void;
  loading?: boolean;
};

export default function SessionsStep({
  sessions,
  sportRankings,
  initialPreferences,
  initialHiddenSessions,
  onChange,
  onHiddenChange,
  loading,
}: Props) {
  const [selectedSports, setSelectedSports] = useState<Set<string>>(new Set());
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [selectedZones, setSelectedZones] = useState<Set<string>>(new Set());
  const [selectedInterests, setSelectedInterests] = useState<Set<string>>(
    new Set()
  );
  const [preferences, setPreferences] = useState<
    Map<string, SessionPreferenceData>
  >(() => {
    // Filter out preferences for sessions not in the current sessions list
    // (e.g., sessions from sports that were unranked)
    const validSessionCodes = new Set(sessions.map((s) => s.sessionCode));
    const filtered = new Map<string, SessionPreferenceData>();
    for (const [id, pref] of initialPreferences) {
      if (validSessionCodes.has(id)) {
        filtered.set(id, pref);
      }
    }
    return filtered;
  });
  const [modalSession, setModalSession] = useState<SessionData | null>(null);
  const [hiddenSessions, setHiddenSessions] = useState<Set<string>>(
    () => new Set(initialHiddenSessions)
  );
  const [showHidden, setShowHidden] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);

  // Sync filtered preferences back to parent on mount
  const didSyncRef = useRef(false);
  useEffect(() => {
    if (!didSyncRef.current) {
      didSyncRef.current = true;
      if (preferences.size !== initialPreferences.size) {
        onChange(preferences);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { setPanel } = useSidePanel();

  const sportColorMap = useMemo(() => {
    const map = new Map<string, string>();
    sportRankings.forEach((sport, i) => {
      map.set(sport, SPORT_COLORS[i % SPORT_COLORS.length].accent);
    });
    return map;
  }, [sportRankings]);

  const sportColorFullMap = useMemo(() => {
    const map = new Map<string, (typeof SPORT_COLORS)[0]>();
    sportRankings.forEach((sport, i) => {
      map.set(sport, SPORT_COLORS[i % SPORT_COLORS.length]);
    });
    return map;
  }, [sportRankings]);

  const availableDates = useMemo(() => {
    const dates = new Set<string>();
    sessions.forEach((s) => dates.add(s.sessionDate));
    return Array.from(dates).sort();
  }, [sessions]);

  const availableZones = useMemo(() => {
    const zones = new Set<string>();
    sessions.forEach((s) => zones.add(s.zone));
    return Array.from(zones).sort();
  }, [sessions]);

  const availableTypes = useMemo(() => {
    const types = new Set<string>();
    sessions.forEach((s) => types.add(s.sessionType));
    return Array.from(types).sort();
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return sessions.filter((s) => {
      if (selectedSports.size > 0 && !selectedSports.has(s.sport)) return false;
      if (selectedTypes.size > 0 && !selectedTypes.has(s.sessionType))
        return false;
      if (selectedDates.size > 0 && !selectedDates.has(s.sessionDate))
        return false;
      if (selectedZones.size > 0 && !selectedZones.has(s.zone)) return false;
      if (selectedInterests.size > 0) {
        const pref = preferences.get(s.sessionCode);
        const level = pref ? pref.interest : "not_set";
        if (!selectedInterests.has(level)) return false;
      }
      if (query) {
        const haystack =
          `${s.sport} ${s.sessionCode} ${s.sessionType} ${s.sessionDescription ?? ""} ${s.venue} ${s.zone}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [
    sessions,
    selectedSports,
    selectedTypes,
    selectedDates,
    selectedZones,
    selectedInterests,
    preferences,
    searchQuery,
  ]);

  const visibleSessions = useMemo(() => {
    if (showHidden) return filteredSessions;
    return filteredSessions.filter((s) => !hiddenSessions.has(s.sessionCode));
  }, [filteredSessions, hiddenSessions, showHidden]);

  const groupedSessions = useMemo(() => {
    const groups: { date: string; sessions: SessionData[] }[] = [];
    let currentDate = "";
    for (const s of visibleSessions) {
      if (s.sessionDate !== currentDate) {
        currentDate = s.sessionDate;
        groups.push({ date: currentDate, sessions: [] });
      }
      groups[groups.length - 1].sessions.push(s);
    }
    return groups;
  }, [visibleSessions]);

  const hiddenCount = useMemo(() => {
    return filteredSessions.filter((s) => hiddenSessions.has(s.sessionCode))
      .length;
  }, [filteredSessions, hiddenSessions]);

  function updatePreferences(newPrefs: Map<string, SessionPreferenceData>) {
    setPreferences(newPrefs);
    onChange(newPrefs);
  }

  function handleSave(pref: SessionPreferenceData) {
    const newPrefs = new Map(preferences);
    newPrefs.set(pref.sessionId, pref);
    updatePreferences(newPrefs);
    setModalSession(null);
  }

  function handleClear(sessionId: string) {
    const newPrefs = new Map(preferences);
    newPrefs.delete(sessionId);
    updatePreferences(newPrefs);
    setModalSession(null);
  }

  function handleClearAllInterests() {
    updatePreferences(new Map());
    setShowClearAllConfirm(false);
  }

  const unhideAll = useCallback(() => {
    const newHidden = new Set<string>();
    setHiddenSessions(newHidden);
    onHiddenChange(newHidden);
    setShowHidden(false);
  }, [onHiddenChange]);

  function toggleHidden(sessionCode: string) {
    const newHidden = new Set(hiddenSessions);
    if (newHidden.has(sessionCode)) {
      newHidden.delete(sessionCode);
    } else {
      newHidden.add(sessionCode);
    }
    setHiddenSessions(newHidden);
    onHiddenChange(newHidden);
  }

  function getPreferenceBadge(pref: SessionPreferenceData) {
    const style = {
      backgroundColor: INTEREST_COLORS[pref.interest].bg,
      color: INTEREST_COLORS[pref.interest].text,
    };
    return (
      <span
        className="rounded-full px-2 py-0.5 text-xs font-medium"
        style={style}
      >
        {pref.interest.charAt(0).toUpperCase() + pref.interest.slice(1)}
      </span>
    );
  }

  function toggleSetItem<T>(set: Set<T>, item: T): Set<T> {
    const next = new Set(set);
    if (next.has(item)) {
      next.delete(item);
    } else {
      next.add(item);
    }
    return next;
  }

  // Render filters into the side panel
  useEffect(() => {
    if (loading) {
      setPanel(
        <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-slate-900">Filters</h4>
          <p className="text-sm text-slate-400">Loading filters...</p>
        </div>
      );
      return;
    }
    setPanel(
      <SessionFilters
        hasActiveFilters={
          selectedSports.size > 0 ||
          selectedTypes.size > 0 ||
          selectedDates.size > 0 ||
          selectedZones.size > 0 ||
          selectedInterests.size > 0
        }
        onClearAll={() => {
          setSelectedSports(new Set());
          setSelectedTypes(new Set());
          setSelectedDates(new Set());
          setSelectedZones(new Set());
          setSelectedInterests(new Set());
        }}
        sportRankings={sportRankings}
        selectedSports={selectedSports}
        onToggleSport={(sport) =>
          setSelectedSports((prev) => toggleSetItem(prev, sport))
        }
        onClearSports={() => setSelectedSports(new Set())}
        selectedTypes={selectedTypes}
        onToggleType={(type) =>
          setSelectedTypes((prev) => toggleSetItem(prev, type))
        }
        onClearTypes={() => setSelectedTypes(new Set())}
        selectedDates={selectedDates}
        onToggleDate={(date) =>
          setSelectedDates((prev) => toggleSetItem(prev, date))
        }
        onClearDates={() => setSelectedDates(new Set())}
        availableDates={availableDates}
        selectedZones={selectedZones}
        onToggleZone={(zone) =>
          setSelectedZones((prev) => toggleSetItem(prev, zone))
        }
        onClearZones={() => setSelectedZones(new Set())}
        availableZones={availableZones}
        selectedInterests={selectedInterests}
        onToggleInterest={(level) =>
          setSelectedInterests((prev) => toggleSetItem(prev, level))
        }
        onClearInterests={() => setSelectedInterests(new Set())}
        hiddenCount={hiddenCount}
        showHidden={showHidden}
        onToggleShowHidden={() => setShowHidden((v) => !v)}
        onUnhideAll={unhideAll}
        availableTypes={availableTypes}
      />
    );
  }, [
    loading,
    setPanel,
    sportRankings,
    selectedSports,
    selectedTypes,
    selectedDates,
    availableDates,
    selectedZones,
    availableZones,
    availableTypes,
    selectedInterests,
    hiddenCount,
    showHidden,
    unhideAll,
  ]);

  // Clear side panel on unmount
  useEffect(() => {
    return () => setPanel(null);
  }, [setPanel]);

  return (
    <div>
      <h3 className="mb-1 text-lg font-semibold text-slate-900">
        Session Interests
      </h3>
      <p className="mb-0 text-sm text-slate-500">
        Browse sessions from your ranked sports below. Set your interest level
        for <strong>all</strong> sessions you have interest in attending.{" "}
        <strong>
          Any sessions that you don&apos;t select will default to &apos;No
          Interest&apos; and be excluded from your final schedule.
        </strong>{" "}
        Sessions for which you have already purchased tickets will appear on
        your schedule irrespective of your preferences.
      </p>
      <p className="mt-2 text-xs text-slate-400">
        All session times are displayed in Pacific Time.
      </p>
      <div className="mb-4" />

      {/* Search */}
      <div className="relative mb-3">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search sessions..."
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-8 text-sm text-slate-700 placeholder-slate-400 transition-colors focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600"
            aria-label="Clear search"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Clear all + Hidden toggle */}
      {(preferences.size > 0 || hiddenCount > 0) && (
        <div className="mb-3 flex items-center justify-end gap-3">
          {preferences.size > 0 && (
            <button
              type="button"
              onClick={() => setShowClearAllConfirm(true)}
              className="text-xs font-medium text-red-500 hover:text-red-700"
            >
              Clear All Interests
            </button>
          )}
          {preferences.size > 0 && hiddenCount > 0 && (
            <span className="text-slate-300">|</span>
          )}
          {hiddenCount > 0 && (
            <>
              <button
                type="button"
                onClick={() => setShowHidden((v) => !v)}
                className="text-xs font-medium text-slate-500 hover:text-slate-700"
              >
                {showHidden
                  ? "Hide hidden sessions"
                  : `Show ${hiddenCount} hidden session${hiddenCount > 1 ? "s" : ""}`}
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={unhideAll}
                className="text-xs font-medium text-slate-500 hover:text-slate-700"
              >
                Unhide all sessions
              </button>
            </>
          )}
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center">
          <p className="text-sm text-slate-400">Loading sessions...</p>
        </div>
      ) : groupedSessions.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-slate-200 py-10 text-center">
          <p className="text-sm text-slate-500">
            No sessions match the current filters.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedSessions.map((group) => (
            <div key={group.date}>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {formatSessionDate(group.date)}
              </h4>
              <div className="space-y-1.5">
                {group.sessions.map((s) => {
                  const isHidden = hiddenSessions.has(s.sessionCode);
                  const pref = preferences.get(s.sessionCode);
                  const sportColor = sportColorMap.get(s.sport) ?? "#94a3b8";

                  return (
                    <SessionCard
                      key={s.sessionCode}
                      session={s}
                      sportColor={sportColor}
                      showSport
                      onClick={() => setModalSession(s)}
                      disabled={isHidden}
                      interestBadge={
                        pref ? (
                          getPreferenceBadge(pref)
                        ) : !isHidden ? (
                          <span className="group/add relative text-2xl font-medium text-slate-400">
                            +
                            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-max -translate-x-1/2 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-normal text-white opacity-0 shadow-lg transition-opacity group-hover/add:opacity-100">
                              Add Interest for Session
                            </span>
                          </span>
                        ) : null
                      }
                      rightContent={
                        isHidden ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleHidden(s.sessionCode);
                            }}
                            className="group/show relative rounded p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                            aria-label="Show Session"
                          >
                            <svg
                              width="18"
                              height="18"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-max -translate-x-1/2 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-normal text-white opacity-0 shadow-lg transition-opacity group-hover/show:opacity-100">
                              Show Session
                            </span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleHidden(s.sessionCode);
                            }}
                            className="group/hide relative rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                            aria-label="Hide Session"
                          >
                            <svg
                              width="18"
                              height="18"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                              <line x1="1" y1="1" x2="23" y2="23" />
                            </svg>
                            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-max -translate-x-1/2 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-normal text-white opacity-0 shadow-lg transition-opacity group-hover/hide:opacity-100">
                              Hide Session
                            </span>
                          </button>
                        )
                      }
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalSession && (
        <SessionInterestModal
          session={modalSession}
          sportColor={
            sportColorFullMap.get(modalSession.sport) ?? {
              accent: "#94a3b8",
              bg: "#f1f5f9",
              text: "#475569",
              title: "#64748b",
            }
          }
          existingPreference={preferences.get(modalSession.sessionCode) ?? null}
          onSave={handleSave}
          onClear={handleClear}
          onClose={() => setModalSession(null)}
        />
      )}

      {/* Clear all interests confirmation */}
      {showClearAllConfirm && (
        <ConfirmModal
          message="Are you sure you want to clear all session interests?"
          onConfirm={handleClearAllInterests}
          onCancel={() => setShowClearAllConfirm(false)}
        />
      )}
    </div>
  );
}

// ─── Side panel filter component ────────────────────────────────────

// FILTER_TYPES removed — now derived dynamically via availableTypes prop

const INTEREST_FILTER_OPTIONS = [
  {
    value: "low",
    label: "Low",
    activeBg: INTEREST_COLORS.low.bg,
    activeText: INTEREST_COLORS.low.text,
  },
  {
    value: "medium",
    label: "Medium",
    activeBg: INTEREST_COLORS.medium.bg,
    activeText: INTEREST_COLORS.medium.text,
  },
  {
    value: "high",
    label: "High",
    activeBg: INTEREST_COLORS.high.bg,
    activeText: INTEREST_COLORS.high.text,
  },
  {
    value: "not_set",
    label: "Not Set/No Interest",
    activeBg: "rgba(100, 116, 139, 0.15)",
    activeText: "#475569",
  },
];

function SessionFilters({
  hasActiveFilters,
  onClearAll,
  sportRankings,
  selectedSports,
  onToggleSport,
  onClearSports,
  selectedTypes,
  onToggleType,
  onClearTypes,
  selectedDates,
  onToggleDate,
  onClearDates,
  availableDates,
  selectedZones,
  onToggleZone,
  onClearZones,
  availableZones,
  selectedInterests,
  onToggleInterest,
  onClearInterests,
  hiddenCount,
  showHidden,
  onToggleShowHidden,
  onUnhideAll,
  availableTypes,
}: {
  hasActiveFilters: boolean;
  onClearAll: () => void;
  sportRankings: string[];
  selectedSports: Set<string>;
  onToggleSport: (sport: string) => void;
  onClearSports: () => void;
  selectedTypes: Set<string>;
  onToggleType: (type: string) => void;
  onClearTypes: () => void;
  selectedDates: Set<string>;
  onToggleDate: (date: string) => void;
  onClearDates: () => void;
  availableDates: string[];
  selectedZones: Set<string>;
  onToggleZone: (zone: string) => void;
  onClearZones: () => void;
  availableZones: string[];
  selectedInterests: Set<string>;
  onToggleInterest: (level: string) => void;
  onClearInterests: () => void;
  hiddenCount: number;
  showHidden: boolean;
  onToggleShowHidden: () => void;
  onUnhideAll: () => void;
  availableTypes: string[];
}) {
  return (
    <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-900">Filters</h4>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClearAll}
            className="text-xs font-medium text-slate-500 hover:text-slate-700"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Sport filter */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-slate-500">
          Filter by Sport:
        </label>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={onClearSports}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              selectedSports.size === 0
                ? "bg-slate-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All
          </button>
          {sportRankings.map((sport, i) => (
            <button
              key={sport}
              type="button"
              onClick={() => onToggleSport(sport)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                selectedSports.has(sport)
                  ? "text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
              style={
                selectedSports.has(sport)
                  ? {
                      backgroundColor:
                        SPORT_COLORS[i % SPORT_COLORS.length].accent,
                    }
                  : undefined
              }
            >
              {sport}
            </button>
          ))}
        </div>
      </div>

      {/* Session type filter */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-slate-500">
          Filter by Session Type:
        </label>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={onClearTypes}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              selectedTypes.size === 0
                ? "bg-slate-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All Types
          </button>
          {availableTypes.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => onToggleType(type)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                selectedTypes.has(type)
                  ? "bg-slate-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Date filter */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-slate-500">
          Filter by Date:
        </label>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={onClearDates}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              selectedDates.size === 0
                ? "bg-slate-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All Dates
          </button>
          {availableDates.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => onToggleDate(d)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                selectedDates.has(d)
                  ? "bg-slate-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {formatSessionDate(d)}
            </button>
          ))}
        </div>
      </div>

      {/* Zone filter */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-slate-500">
          Filter by Zone:
        </label>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={onClearZones}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              selectedZones.size === 0
                ? "bg-slate-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All Zones
          </button>
          {availableZones.map((zone) => (
            <button
              key={zone}
              type="button"
              onClick={() => onToggleZone(zone)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                selectedZones.has(zone)
                  ? "bg-slate-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {zone.replace(" Zone", "")}
            </button>
          ))}
        </div>
      </div>

      {/* Interest level filter */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-slate-500">
          Filter by Interest:
        </label>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={onClearInterests}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              selectedInterests.size === 0
                ? "bg-slate-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All
          </button>
          {INTEREST_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onToggleInterest(opt.value)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                !selectedInterests.has(opt.value)
                  ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  : ""
              }`}
              style={
                selectedInterests.has(opt.value)
                  ? { backgroundColor: opt.activeBg, color: opt.activeText }
                  : undefined
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Hidden toggle */}
      {hiddenCount > 0 && (
        <div className="space-y-1.5 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={onToggleShowHidden}
            className="block text-xs font-medium text-slate-500 hover:text-slate-700"
          >
            {showHidden
              ? "Hide hidden sessions"
              : `Show ${hiddenCount} hidden session${hiddenCount > 1 ? "s" : ""}`}
          </button>
          <button
            type="button"
            onClick={onUnhideAll}
            className="block text-xs font-medium text-slate-500 hover:text-slate-700"
          >
            Unhide all sessions
          </button>
        </div>
      )}
    </div>
  );
}
