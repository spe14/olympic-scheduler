"use client";

import { useGroup } from "../group-context";

export default function MySchedulePage() {
  const group = useGroup();

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

  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 px-6 py-16 text-center">
      <h2 className="mb-2 text-lg font-semibold text-slate-900">My Schedule</h2>
      <p className="text-base text-slate-500">
        Review your generated schedule, confirm satisfaction, and resolve
        conflicts.
      </p>
    </div>
  );
}
