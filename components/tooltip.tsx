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
  position = "top",
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  width?: string;
  position?: "top" | "bottom";
}) {
  if (!label) {
    return <span className={className}>{children}</span>;
  }

  const positionClasses =
    position === "bottom" ? "top-full mt-2" : "bottom-full mb-2";

  return (
    <span className={cn("group/tip relative", className)}>
      {children}
      <span
        className={cn(
          "pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-normal text-white opacity-0 shadow-lg transition-opacity group-hover/tip:opacity-100",
          positionClasses,
          width ?? "whitespace-nowrap"
        )}
      >
        {label}
      </span>
    </span>
  );
}
