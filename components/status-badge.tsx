import { Check, X, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

const variants = {
  purchased: {
    bg: "bg-emerald-100",
    text: "text-emerald-700",
    icon: Check,
    label: "Purchased",
  },
  sold_out: {
    bg: "bg-red-100",
    text: "text-red-700",
    icon: X,
    label: "Sold Out",
  },
  out_of_budget: {
    bg: "bg-amber-100",
    text: "text-amber-700",
    icon: DollarSign,
    label: "Out of Budget",
  },
} as const;

type BadgeVariant = keyof typeof variants;

/**
 * Pill-style status badge for purchase/availability states.
 * Two sizes: "sm" (10px icon, text-[10px]) and "md" (12px icon, text-xs).
 */
export default function StatusBadge({
  variant,
  size = "md",
  className,
}: {
  variant: BadgeVariant;
  size?: "sm" | "md";
  className?: string;
}) {
  const v = variants[variant];
  const Icon = v.icon;
  const iconSize = size === "sm" ? 10 : 12;
  const padding = size === "sm" ? "px-2 py-0.5" : "px-2.5 py-1";
  const fontSize = size === "sm" ? "text-[10px]" : "text-xs";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium",
        v.bg,
        v.text,
        padding,
        fontSize,
        className
      )}
    >
      <Icon size={iconSize} /> {v.label}
    </span>
  );
}
