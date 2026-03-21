"use client";

import Modal from "@/components/modal";
import UserAvatar from "@/components/user-avatar";
import type { InterestedMember, ScheduledMember } from "../actions";

type SessionInfo = {
  sessionCode: string;
  sport: string;
  sessionType: string;
  sessionDescription: string | null;
  venue: string;
  zone: string;
  startTime: string;
  endTime: string;
  interest: "low" | "medium" | "high";
  scheduledMembers: ScheduledMember[];
  interestedMembers: InterestedMember[];
};

type Props = {
  session: SessionInfo;
  ranks: string[];
  day: string;
  sportColor: { bg: string; border: string; text: string; title: string };
  onClose: () => void;
};

const rankLabels: Record<string, string> = {
  primary: "Primary",
  backup1: "Backup 1",
  backup2: "Backup 2",
};

const rankTagStyles: Record<string, { bg: string; text: string }> = {
  primary: { bg: "rgba(0, 157, 229, 0.1)", text: "#009de5" },
  backup1: { bg: "rgba(217, 119, 6, 0.1)", text: "#d97706" },
  backup2: { bg: "rgba(255, 0, 128, 0.1)", text: "#ff0080" },
};

function formatDate(dateStr: string): string {
  const normalized = dateStr.includes("T") ? dateStr : dateStr + "T12:00:00";
  const date = new Date(normalized);
  if (isNaN(date.getTime())) return dateStr;
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

export default function SessionDetailModal({
  session,
  ranks,
  day,
  sportColor,
  onClose,
}: Props) {
  return (
    <Modal title="Session Details" onClose={onClose} size="lg">
      {/* Session info */}
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
            className="group/code relative rounded-full px-2 py-0.5 text-xs font-medium text-white"
            style={{ backgroundColor: sportColor.border }}
          >
            {session.sessionCode}
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-normal text-white opacity-0 shadow-lg transition-opacity group-hover/code:opacity-100">
              Session Code
            </span>
          </span>
          <span
            className="group/type relative rounded-full px-2 py-0.5 text-xs font-medium text-white"
            style={{ backgroundColor: sportColor.border }}
          >
            {session.sessionType}
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-normal text-white opacity-0 shadow-lg transition-opacity group-hover/type:opacity-100">
              Session Type
            </span>
          </span>
          <span
            className="group/interest relative rounded-full px-2 py-0.5 text-xs font-medium capitalize text-white"
            style={{ backgroundColor: sportColor.border }}
          >
            {session.interest}
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-normal text-white opacity-0 shadow-lg transition-opacity group-hover/interest:opacity-100">
              Interest Level
            </span>
          </span>
        </div>
        <p className="flex items-center gap-1.5 text-sm font-medium text-slate-600">
          <span>{formatDate(day)}</span>
          <span style={{ color: sportColor.border }}>|</span>
          <span>
            {formatTime(session.startTime)} &ndash;{" "}
            {formatTime(session.endTime)} PT
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

      {/* Rank tags */}
      <div className="mb-4 flex gap-1.5">
        {ranks.map((r) => (
          <span
            key={r}
            className="rounded px-2 py-1 text-sm font-semibold leading-none"
            style={{
              backgroundColor: rankTagStyles[r]?.bg,
              color: rankTagStyles[r]?.text,
            }}
          >
            {rankLabels[r] ?? r}
          </span>
        ))}
      </div>

      {/* Scheduled members grouped by rank */}
      {session.scheduledMembers.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-sm font-semibold text-slate-700">
            Scheduled Members:
          </p>
          {(["primary", "backup1", "backup2"] as const).map((rank) => {
            const members = session.scheduledMembers.filter(
              (m) => m.rank === rank
            );
            if (members.length === 0) return null;
            return (
              <div key={rank} className="mb-2">
                <span
                  className="mb-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold leading-none text-white"
                  style={{
                    backgroundColor:
                      rank === "primary"
                        ? "#009de5"
                        : rank === "backup1"
                          ? "#d97706"
                          : "#ff0080",
                  }}
                >
                  {rankLabels[rank]}
                </span>
                <div className="mt-1 space-y-2">
                  {members.map((m) => (
                    <div key={m.username} className="flex items-center gap-2.5">
                      <UserAvatar
                        firstName={m.firstName}
                        lastName={m.lastName}
                        avatarColor={m.avatarColor}
                        size="sm"
                      />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-800">
                          {m.firstName} {m.lastName}
                        </span>
                        <span className="text-xs text-slate-500">
                          @{m.username}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Other interested members */}
      <div>
        {session.interestedMembers.length > 0 ? (
          <>
            <p className="mb-2 text-sm font-semibold text-slate-700">
              Other Interested Members:
            </p>
            <div className="space-y-2">
              {session.interestedMembers.map((m) => (
                <div key={m.username} className="flex items-center gap-2.5">
                  <UserAvatar
                    firstName={m.firstName}
                    lastName={m.lastName}
                    avatarColor={m.avatarColor}
                    size="sm"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-slate-800">
                      {m.firstName} {m.lastName}
                    </span>
                    <span className="text-xs text-slate-500">
                      @{m.username}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : session.scheduledMembers.length === 0 ? (
          <p className="text-base text-slate-500">
            No other members are interested in this session.
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
