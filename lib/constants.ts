export const phaseLabels: Record<string, string> = {
  preferences: "Entering Preferences",
  schedule_review: "Reviewing Schedules",
};

export const MAX_GROUP_MEMBERS = 12;
export const MAX_GROUPS_PER_USER = 10;

// Session timeout constants (in seconds)
export const MAX_SESSION_DURATION = 7 * 24 * 60 * 60; // 7 days
export const INACTIVITY_TIMEOUT = 30 * 60; // 30 minutes

export type AvatarColor =
  | "blue"
  | "yellow"
  | "pink"
  | "green"
  | "purple"
  | "orange"
  | "teal";

export const avatarColors: Record<
  AvatarColor,
  { bg: string; text: string; ring: string; label: string }
> = {
  blue: {
    bg: "rgba(0, 157, 229, 0.2)",
    text: "#009de5",
    ring: "#009de5",
    label: "Blue",
  },
  yellow: {
    bg: "rgba(250, 204, 21, 0.2)",
    text: "#d97706",
    ring: "#d97706",
    label: "Yellow",
  },
  pink: {
    bg: "rgba(255, 0, 128, 0.15)",
    text: "#ff0080",
    ring: "#ff0080",
    label: "Pink",
  },
  green: {
    bg: "rgba(16, 185, 129, 0.2)",
    text: "#059669",
    ring: "#059669",
    label: "Green",
  },
  purple: {
    bg: "rgba(139, 92, 246, 0.2)",
    text: "#7c3aed",
    ring: "#7c3aed",
    label: "Purple",
  },
  orange: {
    bg: "rgba(249, 115, 22, 0.2)",
    text: "#ea580c",
    ring: "#ea580c",
    label: "Orange",
  },
  teal: {
    bg: "rgba(20, 184, 166, 0.2)",
    text: "#0d9488",
    ring: "#0d9488",
    label: "Teal",
  },
};

export const inputClass =
  "w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-slate-900 placeholder-slate-400 transition-colors focus:border-[#009de5]/40 focus:outline-none focus:ring-2 focus:ring-[#009de5]/20";

export const disabledInputClass =
  "w-full rounded-lg border border-slate-200 bg-slate-100 px-3.5 py-2.5 text-slate-500 cursor-not-allowed";

// Shared button class strings
export const btnPrimaryClass =
  "rounded-lg bg-[#009de5] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0088c9] disabled:opacity-50";

export const btnSecondaryClass =
  "rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50";

export const btnDangerClass =
  "rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50";

// Shared sport color palette – 20 hand-picked colors.
// Each entry has an accent (border), light bg, dark text, and title color.
// Colors wrap around when more than 20 sports appear.
export const SPORT_COLORS = [
  { accent: "#009de5", bg: "#d0edfa", text: "#006a9e", title: "#0084c2" }, // Blue
  { accent: "#10b981", bg: "#d1fae5", text: "#047857", title: "#0a996c" }, // Green
  { accent: "#f59e0b", bg: "#fef3c7", text: "#b45309", title: "#d4780a" }, // Amber
  { accent: "#ef4444", bg: "#fee2e2", text: "#b91c1c", title: "#d53030" }, // Red
  { accent: "#8b5cf6", bg: "#ede9fe", text: "#6d28d9", title: "#7c42e8" }, // Purple
  { accent: "#ec4899", bg: "#fce7f3", text: "#be185d", title: "#d5307b" }, // Pink
  { accent: "#14b8a6", bg: "#ccfbf1", text: "#0f766e", title: "#12978a" }, // Teal
  { accent: "#f97316", bg: "#ffedd5", text: "#c2410c", title: "#e05a11" }, // Orange
  { accent: "#6366f1", bg: "#e0e7ff", text: "#4338ca", title: "#534fe6" }, // Indigo
  { accent: "#84cc16", bg: "#ecfccb", text: "#4d7c0f", title: "#69a413" }, // Lime
  { accent: "#06b6d4", bg: "#cffafe", text: "#0e7490", title: "#0891b2" }, // Cyan
  { accent: "#e11d48", bg: "#ffe4e6", text: "#9f1239", title: "#be123c" }, // Rose
  { accent: "#a855f7", bg: "#f3e8ff", text: "#7e22ce", title: "#9333ea" }, // Violet
  { accent: "#ea580c", bg: "#fff7ed", text: "#9a3412", title: "#c2410c" }, // Dark Orange
  { accent: "#0d9488", bg: "#f0fdfa", text: "#115e59", title: "#0f766e" }, // Dark Teal
  { accent: "#ca8a04", bg: "#fefce8", text: "#854d0e", title: "#a16207" }, // Yellow
  { accent: "#2563eb", bg: "#dbeafe", text: "#1e40af", title: "#1d4ed8" }, // Royal Blue
  { accent: "#c026d3", bg: "#fae8ff", text: "#86198f", title: "#a21caf" }, // Fuchsia
  { accent: "#16a34a", bg: "#dcfce7", text: "#166534", title: "#15803d" }, // Emerald
  { accent: "#dc2626", bg: "#fef2f2", text: "#991b1b", title: "#b91c1c" }, // Crimson
];

// Ordered member statuses for ordinal comparison
export const MEMBER_STATUS_ORDER = [
  "pending_approval",
  "denied",
  "joined",
  "preferences_set",
] as const;

export function isStatusAtLeast(
  current: string,
  target: (typeof MEMBER_STATUS_ORDER)[number]
): boolean {
  const currentIndex = MEMBER_STATUS_ORDER.indexOf(current as typeof target);
  const targetIndex = MEMBER_STATUS_ORDER.indexOf(target);
  return currentIndex >= targetIndex;
}

// Ordered group phases for ordinal comparison
export const GROUP_PHASE_ORDER = ["preferences", "schedule_review"] as const;

export function isPhaseAfter(
  current: string,
  target: (typeof GROUP_PHASE_ORDER)[number]
): boolean {
  const currentIndex = GROUP_PHASE_ORDER.indexOf(current as typeof target);
  const targetIndex = GROUP_PHASE_ORDER.indexOf(target);
  return currentIndex > targetIndex;
}

export const statusLabels: Record<string, string> = {
  pending_approval: "Pending Approval",
  joined: "Joined",
  preferences_set: "Entered Preferences",
};

// ── Interest level styling ──────────────────────────────────────────────────

export const INTEREST_COLORS: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  low: { bg: "rgba(255, 0, 128, 0.15)", text: "#ff0080", border: "#ff0080" },
  medium: {
    bg: "rgba(250, 204, 21, 0.2)",
    text: "#d97706",
    border: "#d97706",
  },
  high: { bg: "rgba(0, 157, 229, 0.2)", text: "#009de5", border: "#009de5" },
};

export const INTEREST_LEVELS = [
  { value: "low" as const, label: "Low" },
  { value: "medium" as const, label: "Medium" },
  { value: "high" as const, label: "High" },
];
