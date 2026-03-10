"use client";

import { useGroup } from "../../_components/group-context";
import UserAvatar from "@/components/user-avatar";
import type { AvatarColor } from "@/lib/constants";
import type { SessionData, SessionPreferenceData } from "./preference-wizard";

type BuddySelection = { memberId: string; type: "hard" | "soft" };

type Props = {
  budget: number | null;
  minBuddies: number;
  buddies: BuddySelection[];
  sportRankings: string[];
  sessionPreferences: Map<string, SessionPreferenceData>;
  sessions: SessionData[];
};

const SPORT_COLORS = [
  "#009de5",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#6366f1",
  "#84cc16",
];

const INTEREST_COLORS: Record<string, { bg: string; text: string }> = {
  low: { bg: "rgba(255, 0, 128, 0.15)", text: "#ff0080" },
  medium: { bg: "rgba(250, 204, 21, 0.2)", text: "#d97706" },
  high: { bg: "rgba(0, 157, 229, 0.2)", text: "#009de5" },
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(timeStr: string): string {
  const [hours, minutes] = timeStr.split(":");
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${minutes} ${ampm}`;
}

function formatWillingness(value: number | null): string {
  if (value === null) return "$1000+";
  return `<$${value}`;
}

export default function ReviewStep({
  budget,
  minBuddies,
  buddies,
  sportRankings,
  sessionPreferences,
  sessions,
}: Props) {
  const group = useGroup();

  const memberMap = new Map(group.members.map((m) => [m.id, m]));

  // Build selected sessions with their preferences, sorted by date/time
  const selectedSessions = sessions
    .filter((s) => sessionPreferences.has(s.sessionCode))
    .sort((a, b) => {
      const dateCompare = a.sessionDate.localeCompare(b.sessionDate);
      if (dateCompare !== 0) return dateCompare;
      return a.startTime.localeCompare(b.startTime);
    });

  // Group selected sessions by date
  const sessionsByDate = new Map<string, SessionData[]>();
  for (const session of selectedSessions) {
    const existing = sessionsByDate.get(session.sessionDate) ?? [];
    existing.push(session);
    sessionsByDate.set(session.sessionDate, existing);
  }

  const sportColorMap = new Map(
    sportRankings.map((sport, i) => [
      sport,
      SPORT_COLORS[i % SPORT_COLORS.length],
    ])
  );

  const hardBuddies = buddies.filter((b) => b.type === "hard");
  const softBuddies = buddies.filter((b) => b.type === "soft");

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900">
        Review Your Preferences
      </h2>
      <p className="mb-6 mt-1 text-sm text-slate-500">
        You can go back to any step to make changes.
      </p>

      {/* Budget & Buddies + Sport Rankings side by side */}
      <div className="mb-6 grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-slate-200 p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">
            Buddies & Budget
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Budget</span>
              <span className="text-sm font-medium text-slate-900">
                {budget !== null ? `$${budget.toLocaleString()}` : "Not set"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">
                Minimum Buddies Required Per Session
              </span>
              <span className="text-sm font-medium text-slate-900">
                {minBuddies}
              </span>
            </div>
            {hardBuddies.length > 0 && (
              <div>
                <span className="text-sm text-slate-600">Required Buddies</span>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {hardBuddies.map((b) => {
                    const member = memberMap.get(b.memberId);
                    if (!member) return null;
                    return (
                      <div
                        key={b.memberId}
                        className="flex items-center gap-1.5 rounded-full bg-slate-100 py-1 pl-1 pr-2.5"
                      >
                        <UserAvatar
                          firstName={member.firstName}
                          lastName={member.lastName}
                          avatarColor={member.avatarColor as AvatarColor}
                          size="sm"
                        />
                        <span className="text-xs font-medium text-slate-700">
                          {member.firstName} {member.lastName}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {softBuddies.length > 0 && (
              <div>
                <span className="text-sm text-slate-600">
                  Preferred Buddies
                </span>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {softBuddies.map((b) => {
                    const member = memberMap.get(b.memberId);
                    if (!member) return null;
                    return (
                      <div
                        key={b.memberId}
                        className="flex items-center gap-1.5 rounded-full bg-slate-100 py-1 pl-1 pr-2.5"
                      >
                        <UserAvatar
                          firstName={member.firstName}
                          lastName={member.lastName}
                          avatarColor={member.avatarColor as AvatarColor}
                          size="sm"
                        />
                        <span className="text-xs font-medium text-slate-700">
                          {member.firstName} {member.lastName}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {buddies.length === 0 && (
              <p className="text-sm text-slate-400">No buddies selected</p>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">
            Sport Rankings
          </h3>
          {sportRankings.length > 0 ? (
            <ol className="space-y-1.5">
              {sportRankings.map((sport, i) => (
                <li key={sport} className="flex items-center gap-2.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-600">
                    {i + 1}
                  </span>
                  <span className="text-sm text-slate-700">{sport}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-slate-400">No sports ranked</p>
          )}
        </div>
      </div>

      {/* Session Interests */}
      <div className="rounded-lg border border-slate-200 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">
            Session Interests
          </h3>
          <div className="flex items-center gap-3">
            {(["high", "medium", "low"] as const).map((level) => {
              const count = selectedSessions.filter(
                (s) => sessionPreferences.get(s.sessionCode)?.interest === level
              ).length;
              if (count === 0) return null;
              return (
                <span
                  key={level}
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={{
                    backgroundColor: INTEREST_COLORS[level].bg,
                    color: INTEREST_COLORS[level].text,
                  }}
                >
                  {count} {level.charAt(0).toUpperCase() + level.slice(1)}
                </span>
              );
            })}
            <span className="text-xs text-slate-500">
              {selectedSessions.length} session
              {selectedSessions.length !== 1 ? "s" : ""} selected
            </span>
          </div>
        </div>
        <p className="mb-3 text-xs text-slate-500">
          <strong>
            Only the sessions listed below may appear on your schedule. You can
            add/remove sessions on the Session Interests page.
          </strong>
        </p>
        {selectedSessions.length > 0 ? (
          <div className="space-y-4">
            {Array.from(sessionsByDate.entries()).map(
              ([date, dateSessions]) => (
                <div key={date}>
                  <p className="mb-2 text-xs font-medium text-slate-500">
                    {formatDate(date)}
                  </p>
                  <div className="space-y-1.5">
                    {dateSessions.map((session) => {
                      const pref = sessionPreferences.get(session.sessionCode);
                      if (!pref) return null;
                      const colors = INTEREST_COLORS[pref.interest] ?? {
                        bg: "rgba(100, 116, 139, 0.15)",
                        text: "#475569",
                      };
                      return (
                        <div
                          key={session.sessionCode}
                          className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span
                                className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-white"
                                style={{
                                  backgroundColor:
                                    sportColorMap.get(session.sport) ??
                                    "#94a3b8",
                                }}
                              >
                                {session.sport}
                              </span>
                              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                                {session.sessionType}
                              </span>
                            </div>
                            {session.sessionDescription && (
                              <p className="mt-0.5 truncate text-xs text-slate-500">
                                {session.sessionDescription}
                              </p>
                            )}
                            <p className="mt-0.5 text-[10px] text-slate-400">
                              {formatTime(session.startTime)} &ndash;{" "}
                              {formatTime(session.endTime)} &middot;{" "}
                              {session.venue}
                            </p>
                          </div>
                          <div className="ml-3 flex shrink-0 items-center gap-2">
                            <span
                              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                              style={{
                                backgroundColor: colors.bg,
                                color: colors.text,
                              }}
                            >
                              {pref.interest.charAt(0).toUpperCase() +
                                pref.interest.slice(1)}
                            </span>
                            <span
                              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                              style={{
                                backgroundColor: colors.bg,
                                color: colors.text,
                              }}
                            >
                              {formatWillingness(pref.maxWillingness)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-400">No sessions selected</p>
        )}
      </div>
    </div>
  );
}
