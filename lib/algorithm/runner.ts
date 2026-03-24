import type {
  MemberData,
  CandidateSession,
  TravelEntry,
  GenerationResult,
  ConstraintViolation,
  DayComboResult,
} from "./types";
import { buildTravelMatrix } from "./travel";
import { filterCandidateSessions } from "./filter";
import {
  generateAllMemberCombos,
  generateDayCombos,
  assignRankedCombosWithForcedPrimary,
  buildSoftBuddyInterestMap,
} from "./combos";
import { validatePostGeneration } from "./validation";

const MAX_CONVERGENCE_ITERATIONS = 5;
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export function runScheduleGeneration(
  members: MemberData[],
  travelEntries: TravelEntry[],
  days: string[],
  options?: { timeoutMs?: number }
): GenerationResult {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const startTime = Date.now();
  const isTimedOut = () => Date.now() - startTime > timeoutMs;

  const travelMatrix = buildTravelMatrix(travelEntries);

  // Shallow-copy members so we can prune candidateSessions without mutating input
  let currentMembers = members.map((m) => ({
    ...m,
    candidateSessions: [...m.candidateSessions],
  }));

  let lastViolations: ConstraintViolation[] = [];
  let iterations = 0;

  // Track pruned sessions per member across convergence iterations
  const prunedSessionsByMember = new Map<string, Set<string>>();

  // Saved from first iteration for backup enhancement
  let firstIterationFilteredSessions: Map<string, CandidateSession[]> | null =
    null;

  // Hoisted so it's accessible after the loop for backup enhancement
  let allFilteredSessions = new Map<string, CandidateSession[]>();

  // Result components set inside the loop
  let finalCombos: DayComboResult[] = [];
  let finalMembersWithNoCombos: string[] = [];
  let converged = false;
  let finalViolations: ConstraintViolation[] = [];

  for (iterations = 1; iterations <= MAX_CONVERGENCE_ITERATIONS; iterations++) {
    // Timeout check (skip first iteration — we just started)
    if (iterations > 1 && isTimedOut()) {
      return {
        combos: finalCombos,
        membersWithNoCombos: finalMembersWithNoCombos,
        convergence: {
          iterations: iterations - 1,
          converged: false,
          violations: lastViolations,
          timedOut: true,
        },
      };
    }

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
    allFilteredSessions = new Map<string, CandidateSession[]>();
    for (const memberData of currentMembers) {
      const filteredSessions = filterCandidateSessions(
        memberData,
        currentMembers,
        sessionInterestCounts
      );
      allFilteredSessions.set(memberData.memberId, filteredSessions);
    }

    // Save first iteration's filtered sessions for backup enhancement
    if (iterations === 1) {
      firstIterationFilteredSessions = new Map();
      for (const [memberId, sessions] of allFilteredSessions) {
        firstIterationFilteredSessions.set(
          memberId,
          sessions.map((s) => ({ ...s }))
        );
      }
    }

    // Pass 2: Generate combos using filtered sessions
    const allCombos: DayComboResult[] = [];
    const membersWithNoCombos: string[] = [];

    for (const memberData of currentMembers) {
      // Timeout check between members
      if (isTimedOut()) {
        return {
          combos: allCombos,
          membersWithNoCombos: currentMembers
            .filter((m) => !allCombos.some((c) => c.memberId === m.memberId))
            .map((m) => m.memberId),
          convergence: {
            iterations,
            converged: false,
            violations: lastViolations,
            timedOut: true,
          },
        };
      }

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
      finalCombos = allCombos;
      finalMembersWithNoCombos = membersWithNoCombos;
      converged = true;
      finalViolations = [];
      break;
    }

    // Last iteration — save result and exit loop
    if (iterations === MAX_CONVERGENCE_ITERATIONS) {
      finalCombos = allCombos;
      finalMembersWithNoCombos = membersWithNoCombos;
      converged = false;
      finalViolations = violations;
      break;
    }

    // Save for possible timeout return
    finalCombos = allCombos;
    finalMembersWithNoCombos = membersWithNoCombos;
    lastViolations = violations;

    // Deduplicate violations by (memberId, sessionCode) before pruning
    const toPrune = new Set<string>();
    for (const v of violations) {
      toPrune.add(`${v.memberId}:${v.sessionCode}`);

      // Track pruned sessions for backup enhancement
      const existing =
        prunedSessionsByMember.get(v.memberId) ?? new Set<string>();
      existing.add(v.sessionCode);
      prunedSessionsByMember.set(v.memberId, existing);
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

  // --- Backup Enhancement ---
  // For members that had sessions pruned during convergence, re-generate
  // backup combos from the wider (first-iteration) pool. Pruned sessions
  // are marked so scoring penalises them, keeping primary combos valid.
  if (
    prunedSessionsByMember.size > 0 &&
    firstIterationFilteredSessions &&
    !isTimedOut()
  ) {
    const enhancedCombos: DayComboResult[] = [];

    for (const memberData of currentMembers) {
      const prunedCodes = prunedSessionsByMember.get(memberData.memberId);
      const memberCombos = finalCombos.filter(
        (c) => c.memberId === memberData.memberId
      );

      if (!prunedCodes || prunedCodes.size === 0) {
        // No pruning — keep original combos
        enhancedCombos.push(...memberCombos);
        continue;
      }

      if (isTimedOut()) {
        enhancedCombos.push(...memberCombos);
        continue;
      }

      // Build wide pool: final filtered sessions (normal) + convergence-pruned
      // sessions (penalised). Exclude sessions that were naturally filtered out
      // (e.g. interest count dropped) — those aren't viable backup candidates.
      const firstIterSessions =
        firstIterationFilteredSessions.get(memberData.memberId) ?? [];
      const finalFilteredCodes = new Set(
        (allFilteredSessions.get(memberData.memberId) ?? []).map(
          (s) => s.sessionCode
        )
      );
      const widePool: CandidateSession[] = firstIterSessions
        .filter(
          (s) =>
            finalFilteredCodes.has(s.sessionCode) ||
            prunedCodes.has(s.sessionCode)
        )
        .map((s) => ({
          ...s,
          pruned: prunedCodes.has(s.sessionCode) ? true : undefined,
        }));

      // Build enhanced filtered map for soft buddy interest:
      // use final iteration's sessions for other members, wide pool for this member
      const enhancedFilteredMap = new Map(allFilteredSessions);
      enhancedFilteredMap.set(memberData.memberId, widePool);

      const softBuddyInterestMap = buildSoftBuddyInterestMap(
        memberData,
        widePool,
        enhancedFilteredMap
      );

      const lockedSet = memberData.lockedSessionCodes
        ? new Set(memberData.lockedSessionCodes)
        : undefined;

      // Group wide pool sessions by day
      const wideByDay = new Map<string, CandidateSession[]>();
      for (const s of widePool) {
        if (!days.includes(s.sessionDate)) continue;
        const existing = wideByDay.get(s.sessionDate) ?? [];
        existing.push(s);
        wideByDay.set(s.sessionDate, existing);
      }

      // Get primary combos by day for this member
      const primaryByDay = new Map<string, DayComboResult>();
      for (const c of memberCombos) {
        if (c.rank === "primary") primaryByDay.set(c.day, c);
      }

      for (const [day, primary] of primaryByDay) {
        const wideDaySessions = wideByDay.get(day) ?? [];
        const dayLockedCodes = lockedSet
          ? new Set(
              wideDaySessions
                .filter((s) => lockedSet.has(s.sessionCode))
                .map((s) => s.sessionCode)
            )
          : undefined;
        const hasLocked = dayLockedCodes && dayLockedCodes.size > 0;

        const scored = generateDayCombos(
          wideDaySessions,
          travelMatrix,
          memberData,
          softBuddyInterestMap,
          3,
          hasLocked ? dayLockedCodes : undefined
        );

        const enhanced = assignRankedCombosWithForcedPrimary(
          primary,
          scored,
          memberData.memberId,
          day
        );
        enhancedCombos.push(...enhanced);
      }
    }

    finalCombos = enhancedCombos;
  }

  return {
    combos: finalCombos,
    membersWithNoCombos: finalMembersWithNoCombos,
    convergence: {
      iterations,
      converged,
      violations: finalViolations,
    },
  };
}
