"use client";

import { consecutiveDaysSchema } from "@/lib/validations";

type DateMode = "consecutive" | "specific";

const dateInputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 transition-colors focus:border-[#009de5]/40 focus:outline-none focus:ring-2 focus:ring-[#009de5]/20";

export function useDateValidation(
  dateMode: DateMode,
  consecutiveDays: string,
  startDate: string,
  endDate: string
) {
  const daysResult = consecutiveDaysSchema.safeParse(consecutiveDays);
  const daysHints =
    dateMode === "consecutive" &&
    consecutiveDays.length > 0 &&
    !daysResult.success
      ? daysResult.error.issues.map((i) => i.message)
      : [];

  const dateRangeHints =
    dateMode === "specific" &&
    startDate.length > 0 &&
    endDate.length > 0 &&
    endDate < startDate
      ? ["End date must be on or after the start date."]
      : [];

  const isValid =
    (dateMode === "consecutive" && daysResult.success) ||
    (dateMode === "specific" &&
      startDate.length > 0 &&
      endDate.length > 0 &&
      dateRangeHints.length === 0);

  return { daysHints, dateRangeHints, isValid };
}

export function DateModeOption({
  selected,
  onClick,
  label,
  description,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-all ${
        selected
          ? "border-[#009de5]/40 bg-[#009de5]/5 ring-1 ring-[#009de5]/20"
          : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <div
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
          selected ? "border-[#009de5]" : "border-slate-300"
        }`}
      >
        {selected && <div className="h-2 w-2 rounded-full bg-[#009de5]" />}
      </div>
      <div>
        <p
          className={`text-sm font-medium ${
            selected ? "text-slate-900" : "text-slate-700"
          }`}
        >
          {label}
        </p>
        <p className="text-sm text-slate-400">{description}</p>
      </div>
    </button>
  );
}

export function ConsecutiveDaysInput({
  value,
  onChange,
  name,
  hints,
}: {
  value: string;
  onChange: (value: string) => void;
  name?: string;
  hints: string[];
}) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
      <label className="mb-1.5 block text-sm font-medium text-slate-600">
        Number of Days
      </label>
      <input
        type="number"
        name={name}
        min={1}
        max={19}
        value={value}
        onChange={(e) => {
          const val = e.target.value;
          if (val === "" || /^\d+$/.test(val)) {
            onChange(val);
          }
        }}
        placeholder="e.g. 5"
        className="w-24 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-[#009de5]/40 focus:outline-none focus:ring-2 focus:ring-[#009de5]/20"
      />
      <p className="mt-2 text-sm text-slate-400">Olympic Period: 19 days</p>
      {hints.map((h) => (
        <p key={h} className="mt-1.5 text-sm text-red-500">
          {h}
        </p>
      ))}
    </div>
  );
}

export function SpecificDatesInput({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  startName,
  endName,
  hints,
}: {
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  startName?: string;
  endName?: string;
  hints: string[];
}) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="mb-1.5 block text-sm font-medium text-slate-600">
            Start Date
          </label>
          <input
            type="date"
            name={startName}
            min="2028-07-12"
            max="2028-07-30"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            className={dateInputClass}
          />
        </div>
        <div className="flex-1">
          <label className="mb-1.5 block text-sm font-medium text-slate-600">
            End Date
          </label>
          <input
            type="date"
            name={endName}
            min="2028-07-12"
            max="2028-07-30"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            className={dateInputClass}
          />
        </div>
      </div>
      <p className="mt-2 text-sm text-slate-400">
        Olympic Period: Jul 12, 2028 - Jul 30, 2028
      </p>
      {hints.map((h) => (
        <p key={h} className="mt-1.5 text-sm text-red-500">
          {h}
        </p>
      ))}
    </div>
  );
}
