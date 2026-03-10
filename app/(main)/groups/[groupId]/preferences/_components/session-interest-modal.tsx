"use client";

import { useState } from "react";
import Modal from "@/components/modal";
import type { SessionData, SessionPreferenceData } from "./preference-wizard";

const INTEREST_COLORS: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  low: { bg: "rgba(255, 0, 128, 0.15)", text: "#ff0080", border: "#ff0080" },
  medium: { bg: "rgba(250, 204, 21, 0.2)", text: "#d97706", border: "#d97706" },
  high: { bg: "rgba(0, 157, 229, 0.2)", text: "#009de5", border: "#009de5" },
};

const INTEREST_LEVELS = [
  { value: "low" as const, label: "Low" },
  { value: "medium" as const, label: "Medium" },
  { value: "high" as const, label: "High" },
];

const WILLINGNESS_BUCKETS = [
  { value: 50, label: "<$50" },
  { value: 100, label: "<$100" },
  { value: 150, label: "<$150" },
  { value: 200, label: "<$200" },
  { value: 250, label: "<$250" },
  { value: 300, label: "<$300" },
  { value: 400, label: "<$400" },
  { value: 500, label: "<$500" },
  { value: 1000, label: "<$1000" },
  { value: null as number | null, label: "$1000+" },
];

type Props = {
  session: SessionData;
  existingPreference: SessionPreferenceData | null;
  onSave: (pref: SessionPreferenceData) => void;
  onClear: (sessionId: string) => void;
  onClose: () => void;
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

export default function SessionInterestModal({
  session,
  existingPreference,
  onSave,
  onClear,
  onClose,
}: Props) {
  const [interest, setInterest] = useState<"low" | "medium" | "high" | null>(
    existingPreference?.interest ?? null
  );
  const [showInterestInfo, setShowInterestInfo] = useState(false);
  const [showPriceInfo, setShowPriceInfo] = useState(false);
  const [maxWillingness, setMaxWillingness] = useState<
    number | null | undefined
  >(
    existingPreference?.maxWillingness !== undefined
      ? existingPreference.maxWillingness
      : undefined
  );

  const canSave = interest !== null && maxWillingness !== undefined;

  function handleSave() {
    if (!canSave) return;
    onSave({
      sessionId: session.sessionCode,
      interest: interest!,
      maxWillingness: maxWillingness ?? null,
    });
  }

  return (
    <Modal title="Session Interest" onClose={onClose}>
      {/* Session info */}
      <div className="mb-5 space-y-1.5 rounded-lg bg-slate-50 p-3.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-900">
            {session.sport}
          </span>
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
            {session.sessionType}
          </span>
        </div>
        {session.sessionDescription && (
          <ul className="space-y-0.5 text-sm text-slate-600">
            {session.sessionDescription.split(";").map((event, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                {event.trim()}
              </li>
            ))}
          </ul>
        )}
        <div className="space-y-1 text-xs">
          <p className="text-slate-500">
            <span className="font-medium text-slate-600">Session Code:</span>{" "}
            {session.sessionCode}
          </p>
          <p className="text-slate-500">
            <span className="font-medium text-slate-600">Date/Time (PT):</span>{" "}
            {formatDate(session.sessionDate)} &middot;{" "}
            {formatTime(session.startTime)} &ndash;{" "}
            {formatTime(session.endTime)}
          </p>
          <p className="text-slate-500">
            <span className="font-medium text-slate-600">Venue/Zone:</span>{" "}
            {session.venue} &middot; {session.zone}
          </p>
        </div>
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

      {/* Willingness bucket */}
      <div className="mb-5">
        <div className="mb-2 flex items-center gap-2">
          <label className="text-sm font-medium text-slate-700">
            Price Ceiling
          </label>
          <div
            className="relative"
            onMouseEnter={() => setShowPriceInfo(true)}
            onMouseLeave={() => setShowPriceInfo(false)}
          >
            <button
              type="button"
              onClick={() => setShowPriceInfo(!showPriceInfo)}
              className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-xs font-medium text-slate-400 transition-colors hover:border-slate-400 hover:text-slate-500"
            >
              ?
            </button>
            {showPriceInfo && (
              <div className="absolute bottom-full left-1/2 z-10 mb-2 w-72 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
                <p className="mb-2 text-xs leading-relaxed text-slate-500">
                  This is the most you&apos;d be willing to pay to attend this
                  session. Your price ceiling helps the algorithm match you with
                  group members at similar price points.
                </p>
                <p className="mb-2 text-xs leading-relaxed text-slate-500">
                  Set this based on how much the session is worth to you — not
                  your overall budget. A higher ceiling doesn&apos;t mean
                  you&apos;ll pay more; it just means you&apos;re open to
                  higher-priced tickets if needed.
                </p>
                <p className="text-xs leading-relaxed text-slate-500">
                  You can adjust this amount later as needed.
                </p>
              </div>
            )}
          </div>
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {WILLINGNESS_BUCKETS.map((bucket) => (
            <button
              key={bucket.label}
              type="button"
              onClick={() =>
                setMaxWillingness((prev) =>
                  prev === bucket.value ? undefined : bucket.value
                )
              }
              className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
                maxWillingness !== bucket.value
                  ? "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  : ""
              }`}
              style={
                maxWillingness === bucket.value &&
                interest &&
                INTEREST_COLORS[interest]
                  ? {
                      backgroundColor: INTEREST_COLORS[interest].bg,
                      color: INTEREST_COLORS[interest].text,
                      borderColor: INTEREST_COLORS[interest].border,
                    }
                  : maxWillingness === bucket.value
                    ? {
                        backgroundColor: "rgba(0, 157, 229, 0.2)",
                        color: "#009de5",
                        borderColor: "#009de5",
                      }
                    : undefined
              }
            >
              {bucket.label}
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
            className="rounded-lg bg-[#009de5] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0088c9] disabled:opacity-50"
          >
            Apply
          </button>
        </div>
      </div>
    </Modal>
  );
}
