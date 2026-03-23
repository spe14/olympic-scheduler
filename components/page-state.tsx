/**
 * Full-page state containers for error, empty, and loading states.
 * Used in schedule, group-schedule, and purchase-tracker content views.
 */

export function PageError({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-16 text-center">
      <p className="text-sm text-red-600">{message}</p>
    </div>
  );
}

export function PageEmpty({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 px-6 py-16 text-center">
      {title && (
        <h2 className="mb-2 text-lg font-semibold text-slate-900">{title}</h2>
      )}
      {children}
    </div>
  );
}

export function PageLoading() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center">
      <p className="text-sm text-slate-500">Loading...</p>
    </div>
  );
}

export function NoFilterResults() {
  return (
    <div className="rounded-lg border-2 border-dashed border-slate-200 py-10 text-center">
      <p className="text-sm text-slate-500">
        No sessions match the current filters.
      </p>
    </div>
  );
}
