"use client";

import { useState } from "react";

const STORAGE_KEY = "mobile-warning-dismissed";

export default function MobileWarning() {
  const [show, setShow] = useState(() => {
    if (typeof window === "undefined") return false;
    if (window.innerWidth >= 768) return false;
    return !localStorage.getItem(STORAGE_KEY);
  });

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white p-5 shadow-xl sm:p-7">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#d97706"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
              <line x1="12" y1="18" x2="12.01" y2="18" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-slate-900">
            Mobile Experience
          </h2>
        </div>
        <p className="mb-6 text-sm leading-relaxed text-slate-600">
          This app is best experienced on a desktop or laptop. Features may be
          harder to use on a smaller screen. Are you sure you want to continue
          with mobile view?
        </p>
        <button
          type="button"
          onClick={() => {
            localStorage.setItem(STORAGE_KEY, "1");
            setShow(false);
          }}
          className="w-full rounded-lg bg-[#009de5] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#0088c9]"
        >
          Continue on Mobile
        </button>
      </div>
    </div>
  );
}
