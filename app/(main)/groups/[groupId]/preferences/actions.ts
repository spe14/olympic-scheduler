"use server";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  member,
  buddyConstraint,
  session,
  sessionPreference,
} from "@/lib/db/schema";
import { eq, and, notInArray, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "../actions";

const PREFERENCE_STEP_ORDER = [
  null,
  "buddies_budget",
  "sport_rankings",
  "sessions",
] as const;

function shouldAdvanceStep(current: string | null, next: string): boolean {
  const currentIndex = PREFERENCE_STEP_ORDER.indexOf(
    current as (typeof PREFERENCE_STEP_ORDER)[number]
  );
  const nextIndex = PREFERENCE_STEP_ORDER.indexOf(
    next as (typeof PREFERENCE_STEP_ORDER)[number]
  );
  return nextIndex > currentIndex;
}

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
      await tx
        .update(member)
        .set({
          budget,
          minBuddies,
          ...(shouldAdvanceStep(membership.preferenceStep, "buddies_budget")
            ? { preferenceStep: "buddies_budget" }
            : {}),
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

  revalidatePath(`/groups/${groupId}`, "layout");
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
    await db.transaction(async (tx) => {
      await tx
        .update(member)
        .set({
          sportRankings,
          ...(shouldAdvanceStep(membership.preferenceStep, "sport_rankings")
            ? { preferenceStep: "sport_rankings" }
            : {}),
        })
        .where(eq(member.id, membership.id));

      // Delete session preferences for sports no longer ranked
      const existingPrefs = await tx
        .select({ sessionId: sessionPreference.sessionId })
        .from(sessionPreference)
        .where(eq(sessionPreference.memberId, membership.id));

      if (existingPrefs.length > 0) {
        const rankedSportSet = new Set(sportRankings);
        const sessionCodes = existingPrefs.map((p) => p.sessionId);
        const sessions = await tx
          .select({ sessionCode: session.sessionCode, sport: session.sport })
          .from(session)
          .where(inArray(session.sessionCode, sessionCodes));

        const sessionSportMap = new Map(
          sessions.map((s) => [s.sessionCode, s.sport])
        );
        const staleSessionIds = existingPrefs
          .filter((p) => {
            const sport = sessionSportMap.get(p.sessionId);
            return sport && !rankedSportSet.has(sport);
          })
          .map((p) => p.sessionId);

        if (staleSessionIds.length > 0) {
          await tx
            .delete(sessionPreference)
            .where(
              and(
                eq(sessionPreference.memberId, membership.id),
                inArray(sessionPreference.sessionId, staleSessionIds)
              )
            );
        }
      }
    });
  } catch {
    return { error: "Failed to save sport rankings. Please try again." };
  }

  revalidatePath(`/groups/${groupId}`, "layout");
  return { success: true };
}

const VALID_WILLINGNESS_VALUES = [50, 100, 150, 200, 250, 300, 400, 500, 1000];

export async function saveSessionPreferences(
  groupId: string,
  data: {
    preferences: {
      sessionId: string;
      interest: "low" | "medium" | "high";
      maxWillingness: number | null;
    }[];
  }
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

  const { preferences } = data;

  if (!Array.isArray(preferences) || preferences.length < 1) {
    return { error: "You must select at least one session." };
  }

  // Validate no duplicate session IDs
  const sessionIds = preferences.map((p) => p.sessionId);
  if (new Set(sessionIds).size !== sessionIds.length) {
    return { error: "Duplicate session selections." };
  }

  // Validate interest values
  const validInterests = new Set(["low", "medium", "high"]);
  for (const pref of preferences) {
    if (!validInterests.has(pref.interest)) {
      return { error: "Invalid interest level." };
    }
  }

  // Validate willingness values
  for (const pref of preferences) {
    if (
      pref.maxWillingness !== null &&
      !VALID_WILLINGNESS_VALUES.includes(pref.maxWillingness)
    ) {
      return { error: "Invalid willingness value." };
    }
  }

  // Fetch member's sport rankings to validate sessions are within ranked sports
  const [memberData] = await db
    .select({ sportRankings: member.sportRankings })
    .from(member)
    .where(eq(member.id, membership.id))
    .limit(1);

  const rankedSports = (memberData?.sportRankings as string[]) ?? [];
  if (rankedSports.length === 0) {
    return { error: "You must complete sport rankings first." };
  }

  // Validate all session IDs exist and belong to ranked sports
  const validSessions = await db
    .select({ sessionCode: session.sessionCode, sport: session.sport })
    .from(session)
    .where(inArray(session.sport, rankedSports));

  const validSessionMap = new Map(
    validSessions.map((s) => [s.sessionCode, s.sport])
  );

  for (const pref of preferences) {
    if (!validSessionMap.has(pref.sessionId)) {
      return { error: `Invalid session: ${pref.sessionId}` };
    }
  }

  try {
    await db.transaction(async (tx) => {
      // Delete old session preferences
      await tx
        .delete(sessionPreference)
        .where(eq(sessionPreference.memberId, membership.id));

      // Insert new session preferences
      await tx.insert(sessionPreference).values(
        preferences.map((p) => ({
          sessionId: p.sessionId,
          memberId: membership.id,
          interest: p.interest,
          maxWillingness: p.maxWillingness,
        }))
      );

      // Update member step and status
      await tx
        .update(member)
        .set({
          preferenceStep: "sessions",
          status: "preferences_set",
        })
        .where(eq(member.id, membership.id));
    });
  } catch {
    return { error: "Failed to save session preferences. Please try again." };
  }

  revalidatePath(`/groups/${groupId}`, "layout");
  return { success: true };
}
