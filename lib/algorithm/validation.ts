import type { DayComboResult, MemberData, ConstraintViolation } from "./types";

/**
 * Post-generation validation: checks that buddy constraints are satisfied
 * in the final combo output (not just at the input filtering stage).
 *
 * Checks each member's PRIMARY combo sessions against:
 * - minBuddies: attendance count - 1 must be >= member's minBuddies
 * - hardBuddies: each hard buddy must have the session in any combo (P/B1/B2)
 *   for the same day
 */
export function validatePostGeneration(
  combos: DayComboResult[],
  members: MemberData[]
): ConstraintViolation[] {
  // Build attendance map: sessionCode+day → set of memberIds who have it in ANY combo
  const attendance = new Map<string, Set<string>>();
  for (const c of combos) {
    for (const sessionCode of c.sessionCodes) {
      const key = `${sessionCode}:${c.day}`;
      if (!attendance.has(key)) {
        attendance.set(key, new Set());
      }
      attendance.get(key)!.add(c.memberId);
    }
  }

  const memberMap = new Map(members.map((m) => [m.memberId, m]));
  const violations: ConstraintViolation[] = [];

  // Build locked session codes per member for skipping validation
  const lockedByMember = new Map<string, Set<string>>();
  for (const m of members) {
    if (m.lockedSessionCodes?.length) {
      lockedByMember.set(m.memberId, new Set(m.lockedSessionCodes));
    }
  }

  // Check each member's PRIMARY combo sessions
  const primaryCombos = combos.filter((c) => c.rank === "primary");

  for (const combo of primaryCombos) {
    const memberData = memberMap.get(combo.memberId);
    if (!memberData) continue;
    const lockedCodes = lockedByMember.get(combo.memberId);

    for (const sessionCode of combo.sessionCodes) {
      // Skip constraint checks on locked (purchased) sessions — they must
      // appear regardless of buddy/minBuddies constraints.
      if (lockedCodes?.has(sessionCode)) continue;

      const key = `${sessionCode}:${combo.day}`;
      const attendees = attendance.get(key) ?? new Set();

      // minBuddies check: other attendees (across all ranks) must be >= minBuddies
      if (memberData.minBuddies > 0) {
        const othersCount = attendees.size - 1; // exclude self
        if (othersCount < memberData.minBuddies) {
          violations.push({
            memberId: combo.memberId,
            sessionCode,
            day: combo.day,
            type: "minBuddies",
            detail: `Needs ${memberData.minBuddies} buddies but only ${othersCount} other member(s) have this session`,
          });
        }
      }

      // hardBuddies check: each hard buddy must have the session in any combo for same day
      for (const buddyId of memberData.hardBuddies) {
        if (!attendees.has(buddyId)) {
          violations.push({
            memberId: combo.memberId,
            sessionCode,
            day: combo.day,
            type: "hardBuddies",
            detail: `Hard buddy ${buddyId} does not have session ${sessionCode} on ${combo.day}`,
          });
        }
      }
    }
  }

  return violations;
}
