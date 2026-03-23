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
  // Locked (purchased) sessions bypass all constraint filters — they must
  // always appear on the member's schedule regardless of buddy/minBuddies.
  const lockedCodes = new Set(memberData.lockedSessionCodes ?? []);
  const locked = memberData.candidateSessions.filter((s) =>
    lockedCodes.has(s.sessionCode)
  );
  const unlocked = memberData.candidateSessions.filter(
    (s) => !lockedCodes.has(s.sessionCode)
  );

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

  let filtered = applyHardBuddyFilter(unlocked, hardBuddySessionSets);
  filtered = applyMinBuddiesFilter(
    filtered,
    memberData.minBuddies,
    sessionInterestCounts
  );

  return [...locked, ...filtered];
}
