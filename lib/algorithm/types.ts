export type CandidateSession = {
  sessionCode: string;
  sport: string;
  zone: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  interest: "low" | "medium" | "high";
  /** Marked true for sessions re-included in backup generation after convergence pruning */
  pruned?: boolean;
};

export type MemberData = {
  memberId: string;
  sportRankings: string[];
  minBuddies: number;
  hardBuddies: string[];
  softBuddies: string[];
  candidateSessions: CandidateSession[];
  /** Session codes that are purchased and must be locked into primary combo */
  lockedSessionCodes?: string[];
};

export type TravelEntry = {
  originZone: string;
  destinationZone: string;
  drivingMinutes: number;
  transitMinutes: number | null;
};

export type ScoredCombo = {
  sessions: CandidateSession[];
  score: number;
  sportMultiplierSum: number;
  sessionCount: number;
};

export type DayComboResult = {
  memberId: string;
  day: string;
  rank: "primary" | "backup1" | "backup2";
  score: number;
  sessionCodes: string[];
};

export type ConstraintViolation = {
  memberId: string;
  sessionCode: string;
  day: string;
  type: "minBuddies" | "hardBuddies";
  detail: string;
};

export type ConvergenceInfo = {
  iterations: number;
  converged: boolean;
  violations: ConstraintViolation[];
  timedOut?: boolean;
};

export type GenerationResult = {
  combos: DayComboResult[];
  membersWithNoCombos: string[];
  convergence: ConvergenceInfo;
};
