/**
 * Reusable error alert box for form-level errors.
 * Renders nothing when message is falsy.
 */
export default function ErrorAlert({
  message,
  className = "mb-4",
}: {
  message?: string | null;
  className?: string;
}) {
  if (!message) return null;
  return (
    <div
      className={`rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 ${className}`}
    >
      {message}
    </div>
  );
}
