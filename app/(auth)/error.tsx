"use client";

export default function AuthError() {
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <h2 className="mb-2 text-lg font-semibold text-red-600">
        Something went wrong
      </h2>
      <p className="text-sm text-slate-500">
        An unexpected error occurred. Please try refreshing the page.
      </p>
    </div>
  );
}
