"use client";

import { useState } from "react";
import Modal from "@/components/modal";
import {
  btnPrimaryClass,
  INTEREST_COLORS,
  INTEREST_LEVELS,
} from "@/lib/constants";
import { formatSessionDate, formatSessionTime } from "@/lib/utils";
import type { SessionData, SessionPreferenceData } from "./preference-wizard";

type SportColor = { accent: string; bg: string; text: string; title: string };

type Props = {
  session: SessionData;
  sportColor: SportColor;
  existingPreference: SessionPreferenceData | null;
  onSave: (pref: SessionPreferenceData) => void;
  onClear: (sessionId: string) => void;
  onClose: () => void;
};

export default function SessionInterestModal({
  session,
  sportColor,
  existingPreference,
  onSave,
  onClear,
  onClose,
}: Props) {
  const [interest, setInterest] = useState<"low" | "medium" | "high" | null>(
    existingPreference?.interest ?? null
  );
  const [showInterestInfo, setShowInterestInfo] = useState(false);

  const canSave = interest !== null;

  function handleSave() {
    if (!canSave) return;
    onSave({
      sessionId: session.sessionCode,
      interest: interest!,
    });
  }

  return (
    <Modal title="Session Interest" onClose={onClose}>
      {/* Session info */}
      <div
        className="mb-5 space-y-0.5 rounded-lg p-3.5"
        style={{ backgroundColor: `${sportColor.bg}99` }}
      >
        <div className="flex items-center gap-2">
          <span
            className="text-base font-bold"
            style={{ color: sportColor.accent }}
          >
            {session.sessionCode}
          </span>
          <span
            className="rounded px-1.5 py-0.5 text-xs font-semibold text-white"
            style={{ backgroundColor: sportColor.accent }}
          >
            {session.sport}
          </span>
          <span className="rounded bg-slate-200 px-1.5 py-0.5 text-xs font-medium text-slate-600">
            {session.sessionType}
          </span>
        </div>
        <p className="flex items-center gap-1.5 text-sm font-medium text-slate-600">
          <span>{formatSessionDate(session.sessionDate)}</span>
          <span style={{ color: sportColor.accent }}>|</span>
          <span>
            {formatSessionTime(session.startTime)} &ndash;{" "}
            {formatSessionTime(session.endTime)} PT
          </span>
        </p>
        <p className="flex items-center gap-1.5 text-sm font-medium text-slate-600">
          <span>{session.venue}</span>
          <span style={{ color: sportColor.accent }}>|</span>
          <span>{session.zone}</span>
        </p>
        {session.sessionDescription && (
          <ul className="space-y-0.5 text-sm text-slate-600">
            {session.sessionDescription.split(";").map((event, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: sportColor.accent }}
                />
                {event.trim()}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Interest level */}
      <div className="mb-5">
        <div className="mb-2 flex items-center gap-2">
          <label className="text-sm font-medium text-slate-700">
            Interest Level
          </label>
          <div
            className="relative"
            onMouseEnter={() => setShowInterestInfo(true)}
            onMouseLeave={() => setShowInterestInfo(false)}
          >
            <button
              type="button"
              onClick={() => setShowInterestInfo(!showInterestInfo)}
              className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-xs font-medium text-slate-400 transition-colors hover:border-slate-400 hover:text-slate-500"
            >
              ?
            </button>
            {showInterestInfo && (
              <div className="absolute bottom-full left-1/2 z-10 mb-2 w-72 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
                <p className="mb-1.5 text-xs leading-relaxed text-slate-500">
                  How interested are you in attending this session?
                </p>
                <p className="mb-1 text-xs text-slate-500">
                  <span className="font-medium text-slate-600">Low</span>{" "}
                  &mdash; I would attend, but it&apos;s not a priority for me.
                </p>
                <p className="mb-1 text-xs text-slate-500">
                  <span className="font-medium text-slate-600">Medium</span>{" "}
                  &mdash; I would like to attend.
                </p>
                <p className="text-xs text-slate-500">
                  <span className="font-medium text-slate-600">High</span>{" "}
                  &mdash; I really want to attend.
                </p>
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {INTEREST_LEVELS.map((level) => (
            <button
              key={level.value}
              type="button"
              onClick={() =>
                setInterest((prev) =>
                  prev === level.value ? null : level.value
                )
              }
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                interest !== level.value
                  ? "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  : ""
              }`}
              style={
                interest === level.value
                  ? {
                      backgroundColor: INTEREST_COLORS[level.value].bg,
                      color: INTEREST_COLORS[level.value].text,
                      borderColor: INTEREST_COLORS[level.value].border,
                    }
                  : undefined
              }
            >
              {level.label}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between border-t border-slate-100 pt-4">
        <div>
          {existingPreference && (
            <button
              type="button"
              onClick={() => onClear(session.sessionCode)}
              className="text-sm text-red-500 hover:text-red-700"
            >
              Remove Session Interest
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className={btnPrimaryClass}
          >
            Apply
          </button>
        </div>
      </div>
    </Modal>
  );
}
