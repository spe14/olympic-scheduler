export const phaseLabels: Record<string, string> = {
  preferences: "Entering Preferences",
  schedule_review: "Reviewing Schedules",
  conflict_resolution: "Resolving Conflicts",
  completed: "Completed",
};

export const MAX_GROUP_MEMBERS = 12;

// Session timeout constants (in seconds)
export const MAX_SESSION_DURATION = 7 * 24 * 60 * 60; // 7 days
export const INACTIVITY_TIMEOUT = 30 * 60; // 30 minutes

export type AvatarColor = "blue" | "yellow" | "pink" | "green";

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
};

export const statusLabels: Record<string, string> = {
  pending_approval: "Pending Approval",
  joined: "Joined",
  preferences_set: "Entered Preferences",
  schedule_review_pending: "Reviewing Schedule",
  schedule_review_confirmed: "Confirmed Schedule",
  conflict_resolution_pending: "Resolving Conflicts",
  conflict_resolution_confirmed: "Resolved Conflicts",
};
