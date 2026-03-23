import { cn } from "@/lib/utils";

/**
 * Reusable pill-style filter button used in sidebar filter groups.
 * Active state uses the brand blue ring; inactive is a muted gray.
 */
export default function FilterPill({
  label,
  active,
  onClick,
  disabled,
  className,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-full px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50",
        active
          ? "bg-[#009de5]/10 text-[#009de5] ring-1 ring-[#009de5]/30"
          : "bg-slate-100 text-slate-400 hover:text-slate-600",
        className
      )}
    >
      {label}
    </button>
  );
}

/**
 * A labeled filter group wrapper. Renders a card with title and children (typically FilterPills).
 */
export function FilterGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h4 className="mb-2 text-sm font-semibold text-slate-900">{title}</h4>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}
