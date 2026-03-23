import { cn } from "@/lib/utils";

/**
 * Reusable hover tooltip. Wraps children with a positioned tooltip label.
 * Uses CSS group-hover so no JS needed.
 */
export default function Tooltip({
  label,
  children,
  className,
  width,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  width?: string;
}) {
  if (!label) {
    return <span className={className}>{children}</span>;
  }

  return (
    <span className={cn("group/tip relative", className)}>
      {children}
      <span
        className={cn(
          "pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-normal text-white opacity-0 shadow-lg transition-opacity group-hover/tip:opacity-100",
          width ?? "whitespace-nowrap"
        )}
      >
        {label}
      </span>
    </span>
  );
}
