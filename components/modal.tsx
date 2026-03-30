"use client";

import { useScrollLock } from "@/lib/use-scroll-lock";

const sizeClasses = {
  default: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
};

export default function Modal({
  title,
  onClose,
  children,
  size = "default",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: "default" | "lg" | "xl" | "2xl";
}) {
  useScrollLock();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div
        className={`w-full ${sizeClasses[size]} flex max-h-[85vh] flex-col rounded-2xl bg-white shadow-xl`}
      >
        <div className="flex shrink-0 items-center justify-between px-5 pb-4 pt-5 sm:px-7 sm:pb-5 sm:pt-7">
          <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-5 sm:px-7 sm:pb-7">
          {children}
        </div>
      </div>
    </div>
  );
}
