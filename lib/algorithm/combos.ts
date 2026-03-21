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
  maxPerDay: number = 3
): ScoredCombo[] {
  const subsets = generateSubsets(daySessions, maxPerDay);
  const feasible = subsets.filter((subset) =>
    isTravelFeasible(subset, travelMatrix)
  );

  const scored = feasible.map((subset) =>
    scoreCombo(subset, memberData, softBuddyInterestMap)
  );

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
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

  const allCombos: DayComboResult[] = [];

  for (const [day, daySessions] of sessionsByDay) {
    const scored = generateDayCombos(
      daySessions,
      travelMatrix,
      memberData,
      softBuddyInterestMap
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
