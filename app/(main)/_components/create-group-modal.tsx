"use client";

import { useState, useActionState, useEffect, useRef } from "react";
import { createGroup } from "../actions";
import { groupNameSchema } from "@/lib/validations";
import { btnSecondaryClass } from "@/lib/constants";
import Modal from "@/components/modal";
import {
  DateModeOption,
  ConsecutiveDaysInput,
  SpecificDatesInput,
  useDateValidation,
} from "@/components/date-mode-fields";

type DateMode = "consecutive" | "specific" | "deferred" | null;

export default function CreateGroupModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [state, formAction, pending] = useActionState(createGroup, null);
  const [name, setName] = useState("");
  const [dateMode, setDateMode] = useState<DateMode>(null);
  const [consecutiveDays, setConsecutiveDays] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showDateInfo, setShowDateInfo] = useState(false);
  const infoRef = useRef<HTMLDivElement>(null);

  const nameResult = groupNameSchema.safeParse(name);
  const nameHints =
    name.length > 0 && !nameResult.success
      ? nameResult.error.issues.map((i) => i.message)
      : [];

  const {
    daysHints,
    dateRangeHints,
    isValid: isDateFieldsValid,
  } = useDateValidation(
    dateMode === "consecutive" || dateMode === "specific"
      ? dateMode
      : "consecutive",
    consecutiveDays,
    startDate,
    endDate
  );

  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (state?.success) onCreated();
  }, [state, onCreated]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (infoRef.current && !infoRef.current.contains(e.target as Node)) {
        setShowDateInfo(false);
      }
    }
    if (showDateInfo) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showDateInfo]);

  const isDateValid = dateMode === "deferred" || isDateFieldsValid;

  const canSubmit =
    name.trim().length > 0 &&
    nameHints.length === 0 &&
    dateMode !== null &&
    isDateValid;

  const modalInputClass =
    "w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-[#009de5]/40 focus:outline-none focus:ring-2 focus:ring-[#009de5]/20";

  return (
    <Modal title="Create Group" onClose={onClose}>
      <form action={formAction} className="space-y-5">
        {/* Group Name */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-600">
            Group Name
          </label>
          <input
            ref={nameInputRef}
            type="text"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. LA Olympics Squad"
            className={modalInputClass}
          />
          {nameHints.map((h) => (
            <p key={h} className="mt-1.5 text-sm text-slate-400">
              {h}
            </p>
          ))}
        </div>

        {/* Date Mode */}
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <label className="text-sm font-medium text-slate-600">
              When are you planning to attend?
            </label>
            <div
              className="relative"
              ref={infoRef}
              onMouseEnter={() => setShowDateInfo(true)}
              onMouseLeave={() => setShowDateInfo(false)}
            >
              <button
                type="button"
                onClick={() => setShowDateInfo(!showDateInfo)}
                className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-xs font-medium text-slate-400 transition-colors hover:border-slate-400 hover:text-slate-500"
              >
                ?
              </button>
              {showDateInfo && (
                <div className="absolute left-1/2 top-6 z-10 w-72 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
                  <p className="mb-2 text-xs font-medium text-slate-700">
                    Date Mode Options
                  </p>
                  <p className="mb-1.5 text-xs text-slate-500">
                    <span className="font-medium text-slate-600">
                      Consecutive Days
                    </span>{" "}
                    — Choose how many days in a row you plan to attend (e.g. 5
                    days). The algorithm will find the best window of that
                    length.
                  </p>
                  <p className="text-xs text-slate-500">
                    <span className="font-medium text-slate-600">
                      Specific Dates
                    </span>{" "}
                    — Pick exact start and end dates if your group already knows
                    when they&apos;re going.
                  </p>
                </div>
              )}
            </div>
          </div>
          <p className="mb-3 text-sm text-slate-400">
            You can always change this later in group settings.
          </p>

          {/* Hidden input to send dateMode to the server action */}
          <input
            type="hidden"
            name="dateMode"
            value={dateMode === "deferred" || dateMode === null ? "" : dateMode}
          />

          <div className="space-y-2">
            <DateModeOption
              selected={dateMode === "consecutive"}
              onClick={() => setDateMode("consecutive")}
              label="Consecutive Days"
              description="The algorithm will find the best N-day window for your group."
            />
            <DateModeOption
              selected={dateMode === "specific"}
              onClick={() => setDateMode("specific")}
              label="Specific Dates"
              description="Your group has already chosen specific dates to attend."
            />
            <DateModeOption
              selected={dateMode === "deferred"}
              onClick={() => setDateMode("deferred")}
              label="Decide later"
              description="I'll discuss this with the group and update later."
            />
          </div>

          {/* Consecutive Days Input */}
          {dateMode === "consecutive" && (
            <div className="mt-3">
              <ConsecutiveDaysInput
                value={consecutiveDays}
                onChange={setConsecutiveDays}
                name="consecutiveDays"
                hints={daysHints}
              />
            </div>
          )}

          {/* Specific Dates Inputs */}
          {dateMode === "specific" && (
            <div className="mt-3">
              <SpecificDatesInput
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
                startName="startDate"
                endName="endDate"
                hints={dateRangeHints}
              />
            </div>
          )}
        </div>

        {state?.error && <p className="text-sm text-red-500">{state.error}</p>}

        <div className="mt-1 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className={btnSecondaryClass}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending || !canSubmit}
            className="rounded-lg bg-[#009de5] px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-[#009de5]/20 transition-colors hover:bg-[#0088c9] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Creating..." : "Create Group"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
