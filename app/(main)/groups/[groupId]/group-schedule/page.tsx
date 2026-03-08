"use client";

import { useGroup } from "../_components/group-context";

export default function GroupSchedulePage() {
  const group = useGroup();

  if (group.phase !== "completed") {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 px-6 py-16 text-center">
        <h2 className="mb-2 text-lg font-semibold text-slate-900">
          Group Schedule
        </h2>
        <p className="text-base text-slate-500">
          All members must confirm their schedules and resolve conflicts before
          the group schedule is available.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 px-6 py-16 text-center">
      <h2 className="mb-2 text-lg font-semibold text-slate-900">
        Group Schedule
      </h2>
      <p className="text-base text-slate-500">
        View the aggregated group calendar and manage window selection.
      </p>
    </div>
  );
}
