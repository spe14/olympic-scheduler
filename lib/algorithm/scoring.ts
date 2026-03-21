import type { CandidateSession, MemberData, ScoredCombo } from "./types";

export function getSportMultiplier(rank: number, totalSports: number): number {
  if (totalSports <= 1) return 2.0;
  return 2.0 - ((rank - 1) / (totalSports - 1)) * 1.0;
}

export function getSessionAdjustment(
  interest: "low" | "medium" | "high"
): number {
  switch (interest) {
    case "high":
      return 1.0;
    case "medium":
      return 0.7;
    case "low":
      return 0.4;
  }
}

export function getSoftBuddyBonus(count: number): number {
  if (count < 1) return 1.0;
  return 1.0 + 0.25 + 0.1 * (count - 1);
}

export function calculateSessionScore(
  session: CandidateSession,
  memberData: MemberData,
  softBuddyInterestMap: Map<string, number>
): number {
  const rankIndex = memberData.sportRankings.indexOf(session.sport);
  const rank = rankIndex >= 0 ? rankIndex + 1 : memberData.sportRankings.length;
  const sportMultiplier = getSportMultiplier(
    rank,
    memberData.sportRankings.length
  );
  const sessionAdjustment = getSessionAdjustment(session.interest);
  const softBuddyCount = softBuddyInterestMap.get(session.sessionCode) ?? 0;
  const buddyBonus = getSoftBuddyBonus(softBuddyCount);

  return sportMultiplier * sessionAdjustment * buddyBonus;
}

export function scoreCombo(
  sessions: CandidateSession[],
  memberData: MemberData,
  softBuddyInterestMap: Map<string, number>
): ScoredCombo {
  let score = 0;
  let sportMultiplierSum = 0;

  for (const session of sessions) {
    const sessionScore = calculateSessionScore(
      session,
      memberData,
      softBuddyInterestMap
    );
    score += sessionScore;

    const rankIndex = memberData.sportRankings.indexOf(session.sport);
    const rank =
      rankIndex >= 0 ? rankIndex + 1 : memberData.sportRankings.length;
    sportMultiplierSum += getSportMultiplier(
      rank,
      memberData.sportRankings.length
    );
  }

  return {
    sessions,
    score,
    sportMultiplierSum,
    sessionCount: sessions.length,
  };
}
