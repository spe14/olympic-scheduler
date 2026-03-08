"use client";

export default function SessionsStep() {
  return (
    <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 px-6 py-16 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-slate-400"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </div>
      <h3 className="mb-1 text-base font-semibold text-slate-900">
        Session Selection Coming Soon
      </h3>
      <p className="text-sm text-slate-500">
        You&apos;ll be able to select and configure individual sessions in a
        future update. Click Finish to complete your preferences for now.
      </p>
    </div>
  );
}
