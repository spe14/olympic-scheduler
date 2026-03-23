// ── Shared error/status message constants ───────────────────────────────────
// Centralizes strings used in 2+ places to keep wording consistent.

export const MSG_NOT_LOGGED_IN = "You must be logged in.";
export const MSG_NOT_MEMBER = "You are not an active member of this group.";
export const MSG_GROUP_NOT_FOUND = "Group not found.";
export const MSG_GROUP_FULL =
  "This group is full. Groups are limited to 12 members.";
export const MSG_MEMBER_NOT_FOUND = "Member not found.";
export const MSG_MEMBER_NOT_PENDING = "Member is not pending approval.";
export const MSG_USERNAME_TAKEN = "This username is already taken.";

/**
 * Returns a generic "Failed to {action}. Please try again." error string.
 */
export function failedAction(action: string): string {
  return `Failed to ${action}. Please try again.`;
}
