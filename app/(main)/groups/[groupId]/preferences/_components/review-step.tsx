"use client";

import { useState } from "react";
import { useGroup } from "../../_components/group-context";
import UserAvatar from "@/components/user-avatar";
import Modal from "@/components/modal";
import { type AvatarColor, SPORT_COLORS } from "@/lib/constants";
import SessionCard, { formatTime } from "./session-card";
import type { SessionData, SessionPreferenceData } from "./preference-wizard";

type BuddySelection = { memberId: string; type: "hard" | "soft" };

type Props = {
  minBuddies: number;
  buddies: BuddySelection[];
  sportRankings: string[];
  sessionPreferences: Map<string, SessionPreferenceData>;
  sessions: SessionData[];
  affectedBuddyNames?: string[];
  onConfirmReview?: () => Promise<void>;
  isNoCombos?: boolean;
  loading?: boolean;
};

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

export default function ReviewStep({
  minBuddies,
  buddies,
  sportRankings,
  sessionPreferences,
  sessions,
  affectedBuddyNames,
  onConfirmReview,
  isNoCombos,
  loading,
}: Props) {
  const group = useGroup();
  const [confirming, setConfirming] = useState(false);

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

  const [modalSession, setModalSession] = useState<SessionData | null>(null);

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
          <h3 className="mb-3 text-base font-semibold text-slate-900">
            Buddies
          </h3>
          {affectedBuddyNames && affectedBuddyNames.length > 0 && (
            <div className="mb-3 rounded-lg border border-[#009de5]/20 bg-[#009de5]/5 px-4 py-3 text-sm text-[#009de5]">
              {affectedBuddyNames.map((name) => (
                <p key={name}>
                  {name} was automatically removed from your required buddies
                  list because they recently left or were removed from the
                  group. Update your buddy preferences as needed.
                </p>
              ))}
              {onConfirmReview && (
                <button
                  type="button"
                  onClick={async () => {
                    setConfirming(true);
                    await onConfirmReview();
                    setConfirming(false);
                  }}
                  disabled={confirming}
                  className="mt-2 rounded-lg bg-[#009de5] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#0088c9] disabled:opacity-50"
                >
                  {confirming ? "Confirming..." : "Confirm"}
                </button>
              )}
            </div>
          )}
          <div className="space-y-3">
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
          <h3 className="mb-3 text-base font-semibold text-slate-900">
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
          <h3 className="text-base font-semibold text-slate-900">
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
        <p className="mb-3 text-sm text-[#d97706]">
          Only the sessions listed below may appear on your schedule.
        </p>
        {loading ? (
          <p className="py-4 text-center text-sm text-slate-400">
            Loading sessions...
          </p>
        ) : selectedSessions.length > 0 ? (
          <div className="space-y-4">
            {Array.from(sessionsByDate.entries()).map(
              ([date, dateSessions]) => (
                <div key={date}>
                  <p className="mb-2 text-sm font-medium text-slate-500">
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
                      const sportColor = sportColorMap.get(session.sport);
                      return (
                        <SessionCard
                          key={session.sessionCode}
                          session={session}
                          sportColor={sportColor?.accent ?? "#94a3b8"}
                          onClick={() => setModalSession(session)}
                          interestBadge={
                            <span
                              className="rounded-full px-2 py-0.5 text-xs font-semibold"
                              style={{
                                backgroundColor: colors.bg,
                                color: colors.text,
                              }}
                            >
                              {pref.interest.charAt(0).toUpperCase() +
                                pref.interest.slice(1)}
                            </span>
                          }
                        />
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

      {isNoCombos && (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          <p className="font-semibold">
            No schedule combos were generated for you.
          </p>
          <p className="mt-1">
            This may occur if there isn&apos;t enough session interest overlap
            to fulfill your buddy requirements. Go back and update at least one
            preference step so the owner can regenerate schedules.
          </p>
        </div>
      )}

      {/* Session detail modal */}
      {modalSession &&
        (() => {
          const sc = sportColorMap.get(modalSession.sport);
          const accent = sc?.accent ?? "#94a3b8";
          const bg = sc?.bg ?? "#f1f5f9";
          return (
            <Modal
              title="Session Details"
              onClose={() => setModalSession(null)}
            >
              <div
                className="space-y-0.5 rounded-lg p-3.5"
                style={{ backgroundColor: `${bg}99` }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="text-base font-bold"
                    style={{ color: accent }}
                  >
                    {modalSession.sessionCode}
                  </span>
                  <span
                    className="rounded px-1.5 py-0.5 text-xs font-semibold text-white"
                    style={{ backgroundColor: accent }}
                  >
                    {modalSession.sport}
                  </span>
                  <span className="rounded bg-slate-200 px-1.5 py-0.5 text-xs font-medium text-slate-600">
                    {modalSession.sessionType}
                  </span>
                </div>
                <p className="flex items-center gap-1.5 text-sm font-medium text-slate-600">
                  <span>{formatDate(modalSession.sessionDate)}</span>
                  <span style={{ color: accent }}>|</span>
                  <span>
                    {formatTime(modalSession.startTime)} &ndash;{" "}
                    {formatTime(modalSession.endTime)} PT
                  </span>
                </p>
                <p className="flex items-center gap-1.5 text-sm font-medium text-slate-600">
                  <span>{modalSession.venue}</span>
                  <span style={{ color: accent }}>|</span>
                  <span>{modalSession.zone}</span>
                </p>
                {modalSession.sessionDescription && (
                  <ul className="space-y-0.5 text-sm text-slate-600">
                    {modalSession.sessionDescription
                      .split(";")
                      .map((event, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span
                            className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ backgroundColor: accent }}
                          />
                          {event.trim()}
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            </Modal>
          );
        })()}
    </div>
  );
}
