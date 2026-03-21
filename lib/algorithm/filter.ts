import type { CandidateSession, MemberData } from "./types";

export function applyHardBuddyFilter(
  sessions: CandidateSession[],
  hardBuddySessionSets: Map<string, Set<string>>
): CandidateSession[] {
  if (hardBuddySessionSets.size === 0) return sessions;

  return sessions.filter((session) => {
    for (const [, buddySessionSet] of hardBuddySessionSets) {
      if (!buddySessionSet.has(session.sessionCode)) {
        return false;
      }
    }
    return true;
  });
}

export function applyMinBuddiesFilter(
  sessions: CandidateSession[],
  minBuddies: number,
  sessionInterestCounts: Map<string, number>
): CandidateSession[] {
  if (minBuddies <= 0) return sessions;

  return sessions.filter((session) => {
    const count = (sessionInterestCounts.get(session.sessionCode) ?? 0) - 1;
    return count >= minBuddies;
  });
}

export function filterCandidateSessions(
  memberData: MemberData,
  allMembersData: MemberData[],
  sessionInterestCounts: Map<string, number>
): CandidateSession[] {
  const hardBuddySessionSets = new Map<string, Set<string>>();
  for (const buddyId of memberData.hardBuddies) {
    const buddy = allMembersData.find((m) => m.memberId === buddyId);
    if (buddy) {
      hardBuddySessionSets.set(
        buddyId,
        new Set(buddy.candidateSessions.map((s) => s.sessionCode))
      );
    }
  }

  let filtered = applyHardBuddyFilter(
    memberData.candidateSessions,
    hardBuddySessionSets
  );
  filtered = applyMinBuddiesFilter(
    filtered,
    memberData.minBuddies,
    sessionInterestCounts
  );

  return filtered;
}
