"use client";

import Link from "next/link";

export default function AuthError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <h2 className="mb-2 text-lg font-semibold text-slate-900">
        Something went wrong
      </h2>
      <p className="mb-6 text-sm text-slate-500">
        An unexpected error occurred. Please try again.
      </p>
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={reset}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Try again
        </button>
        <Link
          href="/login"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Back to login
        </Link>
      </div>
    </div>
  );
}
