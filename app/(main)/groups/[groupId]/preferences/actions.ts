"use server";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { member, buddyConstraint, session } from "@/lib/db/schema";
import { eq, and, notInArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "../actions";

async function getMembership(groupId: string) {
  const user = await getCurrentUser();
  if (!user) return null;

  const [membership] = await db
    .select({
      id: member.id,
      role: member.role,
      status: member.status,
      preferenceStep: member.preferenceStep,
    })
    .from(member)
    .where(
      and(
        eq(member.groupId, groupId),
        eq(member.userId, user.id),
        notInArray(member.status, ["pending_approval", "denied"])
      )
    )
    .limit(1);

  return membership ?? null;
}

export async function saveBuddiesBudget(
  groupId: string,
  data: {
    budget: number | null;
    minBuddies: number;
    buddies: { memberId: string; type: "hard" | "soft" }[];
  }
): Promise<ActionResult> {
  const membership = await getMembership(groupId);
  if (!membership) {
    return { error: "You are not an active member of this group." };
  }

  const { budget, minBuddies, buddies } = data;

  if (
    budget !== null &&
    (typeof budget !== "number" || budget <= 0 || !Number.isInteger(budget))
  ) {
    return { error: "Budget must be a positive whole number." };
  }

  // Fetch eligible members (active, not self)
  const validMembers = await db
    .select({ id: member.id })
    .from(member)
    .where(
      and(
        eq(member.groupId, groupId),
        notInArray(member.status, ["pending_approval", "denied"])
      )
    );

  const otherMemberCount = validMembers.filter(
    (m) => m.id !== membership.id
  ).length;

  if (
    typeof minBuddies !== "number" ||
    minBuddies < 0 ||
    !Number.isInteger(minBuddies)
  ) {
    return { error: "Minimum buddies must be a non-negative integer." };
  }

  if (minBuddies > otherMemberCount) {
    return {
      error: `Minimum buddies cannot exceed ${otherMemberCount} (other group members).`,
    };
  }

  // Validate no duplicate buddy member IDs
  const buddyIds = buddies.map((b) => b.memberId);
  if (new Set(buddyIds).size !== buddyIds.length) {
    return { error: "Duplicate buddy selections." };
  }

  // Validate buddy IDs are real members in this group (not self, not pending)
  if (buddyIds.length > 0) {
    const validIds = new Set(validMembers.map((m) => m.id));
    for (const buddyId of buddyIds) {
      if (buddyId === membership.id) {
        return { error: "You cannot select yourself as a buddy." };
      }
      if (!validIds.has(buddyId)) {
        return { error: "Invalid buddy selection." };
      }
    }
  }

  try {
    await db.transaction(async (tx) => {
      // Update member preferences
      const wasComplete = membership.status === "preferences_set";
      await tx
        .update(member)
        .set({
          budget,
          minBuddies,
          preferenceStep: "buddies_budget",
          ...(wasComplete ? { status: "joined" } : {}),
        })
        .where(eq(member.id, membership.id));

      // Delete old buddy constraints
      await tx
        .delete(buddyConstraint)
        .where(eq(buddyConstraint.memberId, membership.id));

      // Insert new buddy constraints
      if (buddies.length > 0) {
        await tx.insert(buddyConstraint).values(
          buddies.map((b) => ({
            memberId: membership.id,
            buddyMemberId: b.memberId,
            type: b.type,
          }))
        );
      }
    });
  } catch {
    return { error: "Failed to save preferences. Please try again." };
  }

  revalidatePath(`/groups/${groupId}`);
  return { success: true };
}

export async function saveSportRankings(
  groupId: string,
  data: { sportRankings: string[] }
): Promise<ActionResult> {
  const membership = await getMembership(groupId);
  if (!membership) {
    return { error: "You are not an active member of this group." };
  }

  const { sportRankings } = data;

  if (
    !Array.isArray(sportRankings) ||
    sportRankings.length < 1 ||
    sportRankings.length > 10
  ) {
    return { error: "You must rank between 1 and 10 sports." };
  }

  // Validate all sport names exist in session table
  const validSports = await db
    .selectDistinct({ sport: session.sport })
    .from(session);
  const validSportNames = new Set(validSports.map((s) => s.sport));

  for (const sport of sportRankings) {
    if (!validSportNames.has(sport)) {
      return { error: `Invalid sport: ${sport}` };
    }
  }

  if (new Set(sportRankings).size !== sportRankings.length) {
    return { error: "Duplicate sports in rankings." };
  }

  try {
    const wasComplete = membership.status === "preferences_set";
    await db
      .update(member)
      .set({
        sportRankings,
        preferenceStep: "sport_rankings",
        ...(wasComplete ? { status: "joined" } : {}),
      })
      .where(eq(member.id, membership.id));
  } catch {
    return { error: "Failed to save sport rankings. Please try again." };
  }

  revalidatePath(`/groups/${groupId}`);
  return { success: true };
}

export async function saveSessionsPlaceholder(
  groupId: string
): Promise<ActionResult> {
  const membership = await getMembership(groupId);
  if (!membership) {
    return { error: "You are not an active member of this group." };
  }

  if (
    membership.preferenceStep !== "sport_rankings" &&
    membership.preferenceStep !== "sessions"
  ) {
    return { error: "You must complete previous steps first." };
  }

  try {
    await db
      .update(member)
      .set({
        preferenceStep: "sessions",
        status: "preferences_set",
      })
      .where(eq(member.id, membership.id));
  } catch {
    return { error: "Failed to save preferences. Please try again." };
  }

  revalidatePath(`/groups/${groupId}`);
  return { success: true };
}
