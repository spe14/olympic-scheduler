import type {
  CandidateSession,
  MemberData,
  ScoredCombo,
  DayComboResult,
} from "./types";
import { scoreCombo } from "./scoring";
import { isTravelFeasible } from "./travel";

function generateSubsets(
  sessions: CandidateSession[],
  maxSize: number
): CandidateSession[][] {
  const subsets: CandidateSession[][] = [];

  function backtrack(start: number, current: CandidateSession[]) {
    if (current.length > 0 && current.length <= maxSize) {
      subsets.push([...current]);
    }
    if (current.length >= maxSize) return;

    for (let i = start; i < sessions.length; i++) {
      current.push(sessions[i]);
      backtrack(i + 1, current);
      current.pop();
    }
  }

  backtrack(0, []);
  return subsets;
}

export function generateDayCombos(
  daySessions: CandidateSession[],
  travelMatrix: Map<string, number>,
  memberData: MemberData,
  softBuddyInterestMap: Map<string, number>,
  maxPerDay: number = 3,
  lockedCodes?: Set<string>
): ScoredCombo[] {
  // If there are locked sessions, they must be in every combo
  const locked = lockedCodes
    ? daySessions.filter((s) => lockedCodes.has(s.sessionCode))
    : [];
  const unlocked = lockedCodes
    ? daySessions.filter((s) => !lockedCodes.has(s.sessionCode))
    : daySessions;

  const remainingSlots = maxPerDay - locked.length;

  let subsets: CandidateSession[][];
  if (remainingSlots <= 0) {
    // All slots are locked, only one possible combo
    subsets = [locked];
  } else {
    // Generate subsets from unlocked sessions, then prepend locked
    const unlockedSubsets = generateSubsets(unlocked, remainingSlots);
    subsets = unlockedSubsets.map((subset) => [...locked, ...subset]);
    // Also include the locked-only combo (if locked sessions exist)
    if (locked.length > 0) {
      subsets.push([...locked]);
    }
  }

  // Filter by travel feasibility — locked sessions are still checked so that
  // unlocked sessions paired with them must be reachable. If nothing is
  // feasible alongside the locked sessions, fall back to locked-only.
  let feasible = subsets.filter((subset) =>
    isTravelFeasible(subset, travelMatrix)
  );
  if (feasible.length === 0 && locked.length > 0) {
    feasible = [[...locked]];
  }

  const scored = feasible.map((subset) =>
    scoreCombo(subset, memberData, softBuddyInterestMap)
  );

  scored.sort((a, b) => {
    if (Math.abs(b.score - a.score) > 1e-9) return b.score - a.score;
    if (b.sessionCount !== a.sessionCount)
      return b.sessionCount - a.sessionCount;
    if (b.sportMultiplierSum !== a.sportMultiplierSum)
      return b.sportMultiplierSum - a.sportMultiplierSum;

    const aFirst = a.sessions.map((s) => s.sessionCode).sort()[0];
    const bFirst = b.sessions.map((s) => s.sessionCode).sort()[0];
    return (aFirst ?? "").localeCompare(bFirst ?? "");
  });

  return scored;
}

function comboSessionCodes(combo: ScoredCombo): Set<string> {
  return new Set(combo.sessions.map((s) => s.sessionCode));
}

function hasNewSession(
  candidate: ScoredCombo,
  reference: ScoredCombo
): boolean {
  const refCodes = comboSessionCodes(reference);
  return candidate.sessions.some((s) => !refCodes.has(s.sessionCode));
}

export function assignRankedCombos(
  sortedCombos: ScoredCombo[],
  memberId: string,
  day: string
): DayComboResult[] {
  if (sortedCombos.length === 0) return [];

  const primary = sortedCombos[0];
  const results: DayComboResult[] = [
    {
      memberId,
      day,
      rank: "primary",
      score: primary.score,
      sessionCodes: primary.sessions.map((s) => s.sessionCode),
    },
  ];

  // B1 must have at least 1 session not in P
  const b1 = sortedCombos.slice(1).find((c) => hasNewSession(c, primary));
  if (b1) {
    results.push({
      memberId,
      day,
      rank: "backup1",
      score: b1.score,
      sessionCodes: b1.sessions.map((s) => s.sessionCode),
    });

    // B2 must have at least 1 session not in B1 AND not be a pure subset of P
    const b2 = sortedCombos
      .slice(1)
      .find(
        (c) => c !== b1 && hasNewSession(c, b1) && hasNewSession(c, primary)
      );
    if (b2) {
      results.push({
        memberId,
        day,
        rank: "backup2",
        score: b2.score,
        sessionCodes: b2.sessions.map((s) => s.sessionCode),
      });
    }
  }

  return results;
}

/**
 * Like assignRankedCombos but keeps a forced primary combo (from convergence)
 * and picks backup1/backup2 from an enhanced pool that may include pruned sessions.
 */
export function assignRankedCombosWithForcedPrimary(
  forcedPrimary: DayComboResult,
  enhancedSortedCombos: ScoredCombo[],
  memberId: string,
  day: string
): DayComboResult[] {
  const results: DayComboResult[] = [forcedPrimary];
  const primaryCodes = new Set(forcedPrimary.sessionCodes);

  // B1 must have at least 1 session not in primary
  const b1 = enhancedSortedCombos.find((c) =>
    c.sessions.some((s) => !primaryCodes.has(s.sessionCode))
  );
  if (b1) {
    results.push({
      memberId,
      day,
      rank: "backup1",
      score: b1.score,
      sessionCodes: b1.sessions.map((s) => s.sessionCode),
    });

    const b1Codes = new Set(b1.sessions.map((s) => s.sessionCode));
    const b2 = enhancedSortedCombos.find(
      (c) =>
        c !== b1 &&
        c.sessions.some((s) => !b1Codes.has(s.sessionCode)) &&
        c.sessions.some((s) => !primaryCodes.has(s.sessionCode))
    );
    if (b2) {
      results.push({
        memberId,
        day,
        rank: "backup2",
        score: b2.score,
        sessionCodes: b2.sessions.map((s) => s.sessionCode),
      });
    }
  }

  return results;
}

export function generateAllMemberCombos(
  memberData: MemberData,
  filteredSessions: CandidateSession[],
  days: string[],
  travelMatrix: Map<string, number>,
  allFilteredSessions: Map<string, CandidateSession[]>
): DayComboResult[] {
  const softBuddyInterestMap = buildSoftBuddyInterestMap(
    memberData,
    filteredSessions,
    allFilteredSessions
  );

  const sessionsByDay = new Map<string, CandidateSession[]>();
  for (const session of filteredSessions) {
    const day = session.sessionDate;
    if (!days.includes(day)) continue;
    const existing = sessionsByDay.get(day) ?? [];
    existing.push(session);
    sessionsByDay.set(day, existing);
  }

  // Build a set of locked session codes for this member
  const lockedSet = memberData.lockedSessionCodes
    ? new Set(memberData.lockedSessionCodes)
    : undefined;

  const allCombos: DayComboResult[] = [];

  for (const [day, daySessions] of sessionsByDay) {
    // Determine which locked sessions fall on this day
    const dayLockedCodes = lockedSet
      ? new Set(
          daySessions
            .filter((s) => lockedSet.has(s.sessionCode))
            .map((s) => s.sessionCode)
        )
      : undefined;
    const hasLocked = dayLockedCodes && dayLockedCodes.size > 0;

    const scored = generateDayCombos(
      daySessions,
      travelMatrix,
      memberData,
      softBuddyInterestMap,
      3,
      hasLocked ? dayLockedCodes : undefined
    );
    const ranked = assignRankedCombos(scored, memberData.memberId, day);
    allCombos.push(...ranked);
  }

  return allCombos;
}

export function buildSoftBuddyInterestMap(
  memberData: MemberData,
  filteredSessions: CandidateSession[],
  allFilteredSessions: Map<string, CandidateSession[]>
): Map<string, number> {
  const map = new Map<string, number>();

  if (memberData.softBuddies.length === 0) return map;

  for (const session of filteredSessions) {
    let count = 0;
    for (const buddyId of memberData.softBuddies) {
      const buddyFiltered = allFilteredSessions.get(buddyId);
      if (buddyFiltered?.some((s) => s.sessionCode === session.sessionCode)) {
        count++;
      }
    }
    if (count > 0) {
      map.set(session.sessionCode, count);
    }
  }

  return map;
}
