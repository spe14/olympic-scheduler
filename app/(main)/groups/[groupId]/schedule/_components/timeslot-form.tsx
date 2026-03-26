"use client";

import { useState, useTransition, useRef } from "react";
import { saveTimeslot } from "../purchase-actions";
import type { TimeslotData } from "../purchase-actions";

type Props = {
  groupId: string;
  timeslot: TimeslotData | null;
  onSaved: () => void;
};

// All timeslot date/time input is interpreted as Pacific Time (LA 2028 Olympics).

const PT = "America/Los_Angeles";

/** Formats a UTC Date as "YYYY-MM-DD" in Pacific Time (for date input value). */
function toDateInputPT(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PT,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  return `${y}-${m}-${d}`;
}

/** Extracts HH, MM, AM/PM from a UTC Date interpreted in Pacific Time. */
function extractTimePT(date: Date): {
  hh: string;
  mm: string;
  ampm: "AM" | "PM";
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PT,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(date);
  const h = parts.find((p) => p.type === "hour")!.value;
  const m = parts.find((p) => p.type === "minute")!.value;
  const dp = parts.find((p) => p.type === "dayPeriod")!.value.toUpperCase() as
    | "AM"
    | "PM";
  return { hh: h, mm: m, ampm: dp };
}

/**
 * Builds a UTC Date from date/time components intended as Pacific Time.
 * Uses a two-pass approach: create a UTC estimate, determine the PT offset
 * at that time, then correct.
 */
function buildDatePT(
  dateStr: string,
  hh: string,
  mm: string,
  ampm: "AM" | "PM"
): Date | null {
  if (!dateStr) return null;
  const [yyyy, mo, dd] = dateStr.split("-").map(Number);
  if (!yyyy || !mo || !dd) return null;

  const hour = parseInt(hh, 10);
  const min = parseInt(mm, 10);
  if (isNaN(hour) || isNaN(min)) return null;
  if (hour < 1 || hour > 12 || min < 0 || min > 59) return null;

  let h24 = hour;
  if (ampm === "PM" && hour !== 12) h24 = hour + 12;
  if (ampm === "AM" && hour === 12) h24 = 0;

  // Treat input as UTC first, then compute PT offset to correct
  const asUtc = new Date(Date.UTC(yyyy, mo - 1, dd, h24, min));
  const utcRef = new Date(asUtc.toLocaleString("en-US", { timeZone: "UTC" }));
  const ptRef = new Date(asUtc.toLocaleString("en-US", { timeZone: PT }));
  const offsetMs = utcRef.getTime() - ptRef.getTime();

  const corrected = new Date(asUtc.getTime() + offsetMs);
  return isNaN(corrected.getTime()) ? null : corrected;
}

// ── Time picker with separate HH, MM, AM/PM ────────────────────────────────

function TimePicker({
  hh,
  mm,
  ampm,
  onHHChange,
  onMMChange,
  onAmPmChange,
}: {
  hh: string;
  mm: string;
  ampm: "AM" | "PM";
  onHHChange: (v: string) => void;
  onMMChange: (v: string) => void;
  onAmPmChange: (v: "AM" | "PM") => void;
}) {
  const mmRef = useRef<HTMLInputElement>(null);

  function handleHHChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^0-9]/g, "").slice(0, 2);
    if (raw === "" || raw === "0") {
      onHHChange("");
      return;
    }

    if (raw.length === 1) {
      onHHChange(raw);
      return;
    }

    // Two digits
    const n = parseInt(raw, 10);
    if (n < 1) {
      onHHChange("");
      return;
    }
    onHHChange(String(Math.min(n, 12)));
    mmRef.current?.focus();
    mmRef.current?.select();
  }

  function handleHHBlur() {
    if (hh === "" || hh === "0") {
      onHHChange("");
      return;
    }
    const n = parseInt(hh, 10);
    if (isNaN(n) || n < 1) onHHChange("");
    else if (n > 12) onHHChange("12");
  }

  function handleMMChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^0-9]/g, "");
    if (raw === "") {
      onMMChange("");
      return;
    }
    if (raw.length === 1) {
      if (parseInt(raw, 10) >= 6) {
        onMMChange("0" + raw);
        return;
      }
      onMMChange(raw);
      return;
    }
    const n = parseInt(raw.slice(0, 2), 10);
    onMMChange(String(Math.min(n, 59)).padStart(2, "0"));
  }

  function handleMMBlur() {
    if (mm === "") return;
    const n = parseInt(mm, 10);
    if (isNaN(n)) {
      onMMChange("");
      return;
    }
    onMMChange(String(Math.min(n, 59)).padStart(2, "0"));
  }

  const fieldClass =
    "w-10 rounded-lg border border-slate-200 px-1 py-2 text-center text-sm text-slate-700 focus:border-[#009de5] focus:outline-none focus:ring-1 focus:ring-[#009de5]";

  return (
    <div className="flex items-center gap-1">
      <input
        type="text"
        inputMode="numeric"
        maxLength={2}
        value={hh}
        onChange={handleHHChange}
        onFocus={(e) => e.target.select()}
        onBlur={handleHHBlur}
        placeholder="HH"
        className={fieldClass}
      />
      <span className="text-sm font-semibold text-slate-400">:</span>
      <input
        ref={mmRef}
        type="text"
        inputMode="numeric"
        maxLength={2}
        value={mm}
        onChange={handleMMChange}
        onFocus={(e) => e.target.select()}
        onBlur={handleMMBlur}
        placeholder="MM"
        className={fieldClass}
      />
      <div className="ml-1 flex overflow-hidden rounded-lg border border-slate-200">
        <button
          type="button"
          onClick={() => onAmPmChange("AM")}
          className={`px-2.5 py-2 text-xs font-semibold transition-colors ${
            ampm === "AM"
              ? "bg-[#009de5] text-white"
              : "bg-white text-slate-500 hover:bg-slate-50"
          }`}
        >
          AM
        </button>
        <button
          type="button"
          onClick={() => onAmPmChange("PM")}
          className={`border-l border-slate-200 px-2.5 py-2 text-xs font-semibold transition-colors ${
            ampm === "PM"
              ? "bg-[#009de5] text-white"
              : "bg-white text-slate-500 hover:bg-slate-50"
          }`}
        >
          PM
        </button>
      </div>
    </div>
  );
}

// ── Main form ───────────────────────────────────────────────────────────────

export default function TimeslotForm({ groupId, timeslot, onSaved }: Props) {
  const [isPending, startTransition] = useTransition();

  const initStart = timeslot ? extractTimePT(timeslot.timeslotStart) : null;
  const initEnd = timeslot ? extractTimePT(timeslot.timeslotEnd) : null;

  const [startDate, setStartDate] = useState(
    timeslot ? toDateInputPT(timeslot.timeslotStart) : ""
  );
  const [startHH, setStartHH] = useState(initStart?.hh ?? "");
  const [startMM, setStartMM] = useState(initStart?.mm ?? "");
  const [startAmPm, setStartAmPm] = useState<"AM" | "PM">(
    initStart?.ampm ?? "AM"
  );

  const [endDate, setEndDate] = useState(
    timeslot ? toDateInputPT(timeslot.timeslotEnd) : ""
  );
  const [endHH, setEndHH] = useState(initEnd?.hh ?? "");
  const [endMM, setEndMM] = useState(initEnd?.mm ?? "");
  const [endAmPm, setEndAmPm] = useState<"AM" | "PM">(initEnd?.ampm ?? "AM");

  const [error, setError] = useState("");

  const parsedStart = buildDatePT(startDate, startHH, startMM, startAmPm);
  const parsedEnd = buildDatePT(endDate, endHH, endMM, endAmPm);

  // Date-only check (for showing errors before time is filled in)
  const endDateBeforeStart =
    startDate !== "" && endDate !== "" && endDate < startDate;

  // Full datetime checks
  const endBeforeStart =
    !!parsedEnd && !!parsedStart && parsedEnd <= parsedStart;

  const startValid = !!parsedStart;
  const endValid = !!parsedEnd && !!parsedStart && parsedEnd > parsedStart;
  const canSave = startValid && endValid && !isPending;

  function handleSave() {
    if (!parsedStart || !parsedEnd) return;
    setError("");
    startTransition(async () => {
      try {
        const result = await saveTimeslot(groupId, {
          start: parsedStart.toISOString(),
          end: parsedEnd.toISOString(),
        });
        if (result.error) {
          setError(result.error);
        } else {
          onSaved();
        }
      } catch {
        setError("An unexpected error occurred. Please try again.");
      }
    });
  }

  const dateInputClass =
    "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-[#009de5] focus:outline-none focus:ring-1 focus:ring-[#009de5]";

  return (
    <div>
      <p className="mb-4 text-sm text-slate-500">
        Enter the date and time of your ticket purchase window. All times are in
        Pacific Time (PT).
      </p>
      <div className="mb-4 space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-600">
            Start Date/Time
          </label>
          <div className="flex items-end gap-3">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={dateInputClass}
            />
            <TimePicker
              hh={startHH}
              mm={startMM}
              ampm={startAmPm}
              onHHChange={setStartHH}
              onMMChange={setStartMM}
              onAmPmChange={setStartAmPm}
            />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-600">
            End Date/Time
          </label>
          <div className="flex items-end gap-3">
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={dateInputClass}
            />
            <TimePicker
              hh={endHH}
              mm={endMM}
              ampm={endAmPm}
              onHHChange={setEndHH}
              onMMChange={setEndMM}
              onAmPmChange={setEndAmPm}
            />
          </div>
          {(endDateBeforeStart || endBeforeStart) && (
            <p className="mt-1 text-xs text-red-500">
              End date/time must be after start date/time.
            </p>
          )}
        </div>
      </div>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <button
        onClick={handleSave}
        disabled={!canSave}
        className="rounded-lg bg-[#009de5] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0086c3] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Saving..." : "Save Timeslot"}
      </button>
    </div>
  );
}
