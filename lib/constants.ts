// Application constants

export const MAX_GROUP_MEMBERS = 12;
export const DEFAULT_MAX_SESSIONS_PER_DAY = 2;
export const DEFAULT_TIME_BUFFER_HOURS = 3.0;
export const MAX_TICKETS_PER_BUYER = 12;

// Interest level points
export const INTEREST_POINTS = {
  high: 10,
  medium: 5,
  low: 2,
  no_interest: 0,
  no_interest_penalty: -3,
} as const;
