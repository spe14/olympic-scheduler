import type {
  MemberData,
  CandidateSession,
  TravelEntry,
  GenerationResult,
  ConstraintViolation,
  ConvergenceInfo,
} from "./types";
import { buildTravelMatrix } from "./travel";
import { filterCandidateSessions } from "./filter";
import { generateAllMemberCombos } from "./combos";
import { validatePostGeneration } from "./validation";

const MAX_CONVERGENCE_ITERATIONS = 5;

export function runScheduleGeneration(
  members: MemberData[],
  travelEntries: TravelEntry[],
  days: string[]
): GenerationResult {
  const travelMatrix = buildTravelMatrix(travelEntries);

  // Shallow-copy members so we can prune candidateSessions without mutating input
  let currentMembers = members.map((m) => ({
    ...m,
    candidateSessions: [...m.candidateSessions],
  }));

  let lastViolations: ConstraintViolation[] = [];
  let iterations = 0;

  for (iterations = 1; iterations <= MAX_CONVERGENCE_ITERATIONS; iterations++) {
    // Build session interest counts
    const sessionInterestCounts = new Map<string, number>();
    for (const m of currentMembers) {
      for (const s of m.candidateSessions) {
        sessionInterestCounts.set(
          s.sessionCode,
          (sessionInterestCounts.get(s.sessionCode) ?? 0) + 1
        );
      }
    }

    // Pass 1: Filter candidates for all members
    const allFilteredSessions = new Map<string, CandidateSession[]>();
    for (const memberData of currentMembers) {
      const filteredSessions = filterCandidateSessions(
        memberData,
        currentMembers,
        sessionInterestCounts
      );
      allFilteredSessions.set(memberData.memberId, filteredSessions);
    }

    // Pass 2: Generate combos using filtered sessions (including for soft buddy bonus)
    const allCombos = [];
    const membersWithNoCombos: string[] = [];

    for (const memberData of currentMembers) {
      const filteredSessions = allFilteredSessions.get(memberData.memberId)!;

      const combos = generateAllMemberCombos(
        memberData,
        filteredSessions,
        days,
        travelMatrix,
        allFilteredSessions
      );

      if (combos.length === 0) {
        membersWithNoCombos.push(memberData.memberId);
      }

      allCombos.push(...combos);
    }

    // Validate post-generation constraints
    const violations = validatePostGeneration(allCombos, currentMembers);

    if (violations.length === 0) {
      return {
        combos: allCombos,
        membersWithNoCombos,
        convergence: {
          iterations,
          converged: true,
          violations: [],
        },
      };
    }

    // Last iteration — return with remaining violations
    if (iterations === MAX_CONVERGENCE_ITERATIONS) {
      return {
        combos: allCombos,
        membersWithNoCombos,
        convergence: {
          iterations,
          converged: false,
          violations,
        },
      };
    }

    lastViolations = violations;

    // Deduplicate violations by (memberId, sessionCode) before pruning
    const toPrune = new Set<string>();
    for (const v of violations) {
      toPrune.add(`${v.memberId}:${v.sessionCode}`);
    }

    // Prune violating sessions from candidates (never prune locked sessions)
    currentMembers = currentMembers.map((m) => {
      const lockedCodes = new Set(m.lockedSessionCodes ?? []);
      return {
        ...m,
        candidateSessions: m.candidateSessions.filter(
          (s) =>
            lockedCodes.has(s.sessionCode) ||
            !toPrune.has(`${m.memberId}:${s.sessionCode}`)
        ),
      };
    });
  }

  // Shouldn't reach here, but satisfy TypeScript
  return {
    combos: [],
    membersWithNoCombos: currentMembers.map((m) => m.memberId),
    convergence: {
      iterations,
      converged: false,
      violations: lastViolations,
    },
  };
}
