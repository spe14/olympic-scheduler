"use server";

import { requireMembership, requireOwnerMembership } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  group,
  member,
  user,
  buddyConstraint,
  sessionPreference,
  session,
  travelTime,
  combo,
  comboSession,
  windowRanking,
  ticketPurchase,
  ticketPurchaseAssignee,
  soldOutSession,
  outOfBudgetSession,
  purchaseTimeslot,
  purchasePlanEntry,
  reportedPrice,
} from "@/lib/db/schema";
import { eq, and, or, notInArray, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  groupNameSchema,
  consecutiveDaysSchema,
  dateRangeSchema,
} from "@/lib/validations";
import { MAX_GROUP_MEMBERS } from "@/lib/constants";
import type { ActionResult } from "@/lib/types";
import { runScheduleGeneration } from "@/lib/algorithm/runner";
import {
  computeWindowRankings,
  buildMemberScores,
} from "@/lib/algorithm/window-ranking";
import type { MemberData, TravelEntry } from "@/lib/algorithm/types";
import { OLYMPIC_DAYS_LIST } from "@/lib/schedule-utils";
import { groupBy, parseOrError } from "@/lib/utils";
import {
  MSG_GROUP_FULL,
  MSG_GROUP_NOT_FOUND,
  MSG_MEMBER_NOT_FOUND,
  MSG_MEMBER_NOT_PENDING,
  failedAction,
} from "@/lib/messages";

export async function updateGroupName(
  groupId: string,
  formData: FormData
): Promise<ActionResult> {
  const { membership: ownership, error: authError } =
    await requireOwnerMembership(groupId, "rename the group");
  if (authError) return authError;

  const name = formData.get("name") as string;
  const parsed = parseOrError(groupNameSchema, name);
  if ("error" in parsed) return parsed.error;

  try {
    await db
      .update(group)
      .set({ name: parsed.data })
      .where(eq(group.id, groupId));
  } catch {
    return { error: failedAction("update group name") };
  }

  revalidatePath(`/groups/${groupId}`);
  return { success: true };
}

export async function approveMember(
  groupId: string,
  memberId: string
): Promise<ActionResult> {
  const { membership: ownership, error: authError } =
    await requireOwnerMembership(groupId, "approve members");
  if (authError) return authError;

  const [target] = await db
    .select({ id: member.id, status: member.status })
    .from(member)
    .where(and(eq(member.id, memberId), eq(member.groupId, groupId)))
    .limit(1);

  if (!target || target.status !== "pending_approval") {
    return { error: MSG_MEMBER_NOT_PENDING };
  }

  try {
    const result = await db.transaction(async (tx) => {
      // Lock group row to prevent concurrent approvals exceeding the limit
      await tx
        .select({ id: group.id })
        .from(group)
        .where(eq(group.id, groupId))
        .for("update");

      const [{ count: activeCount }] = await tx
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(member)
        .where(
          and(
            eq(member.groupId, groupId),
            notInArray(member.status, ["pending_approval", "denied"])
          )
        );

      if (activeCount >= MAX_GROUP_MEMBERS) {
        return { full: true as const };
      }

      await tx
        .update(member)
        .set({ status: "joined", joinedAt: new Date() })
        .where(
          and(eq(member.id, memberId), eq(member.status, "pending_approval"))
        );

      // Only fetch user data if the UPDATE actually took effect (status is now "joined").
      // Guards against concurrent denyMember changing the status between the
      // pre-transaction check and the UPDATE, which would be a 0-row no-op.
      const [approvedUser] = await tx
        .select({
          userId: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
        })
        .from(member)
        .innerJoin(user, eq(member.userId, user.id))
        .where(and(eq(member.id, memberId), eq(member.status, "joined")))
        .limit(1);

      if (approvedUser) {
        const [grpData] = await tx
          .select({
            departedMembers: group.departedMembers,
          })
          .from(group)
          .where(eq(group.id, groupId));

        const departed =
          (grpData?.departedMembers as {
            userId: string;
            name: string;
            departedAt: string;
            rejoinedAt?: string;
            wasPartOfSchedule?: boolean;
          }[]) ?? [];
        const departedIdx = departed.findIndex(
          (d) => d.userId === approvedUser.userId
        );

        if (departedIdx !== -1) {
          const updated = departed.map((d, i) =>
            i === departedIdx
              ? { ...d, rejoinedAt: new Date().toISOString() }
              : d
          );
          await tx
            .update(group)
            .set({ departedMembers: updated })
            .where(eq(group.id, groupId));
        }
      }

      return { full: false as const };
    });

    if (result.full) {
      return { error: MSG_GROUP_FULL };
    }
  } catch {
    return {
      error: failedAction("approve member's join request"),
    };
  }

  revalidatePath(`/groups/${groupId}`);
  return { success: true };
}

export async function denyMember(
  groupId: string,
  memberId: string
): Promise<ActionResult> {
  const { membership: ownership, error: authError } =
    await requireOwnerMembership(groupId, "deny members");
  if (authError) return authError;

  const [target] = await db
    .select({ id: member.id, status: member.status })
    .from(member)
    .where(and(eq(member.id, memberId), eq(member.groupId, groupId)))
    .limit(1);

  if (!target || target.status !== "pending_approval") {
    return { error: MSG_MEMBER_NOT_PENDING };
  }

  try {
    await db
      .update(member)
      .set({ status: "denied" })
      .where(
        and(eq(member.id, memberId), eq(member.status, "pending_approval"))
      );
  } catch {
    return { error: failedAction("deny member's join request") };
  }

  revalidatePath(`/groups/${groupId}`);
  return { success: true };
}

export async function removeMemberTransaction(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  groupId: string,
  departingMemberId: string
) {
  // 1. Find members who had the departing member as a buddy
  const affectedBuddies = await tx
    .select({ memberId: buddyConstraint.memberId })
    .from(buddyConstraint)
    .where(eq(buddyConstraint.buddyMemberId, departingMemberId));
  const affectedMemberIds = affectedBuddies.map((b) => b.memberId);

  // 2. Delete buddy constraints involving the departing member
  await tx
    .delete(buddyConstraint)
    .where(
      or(
        eq(buddyConstraint.memberId, departingMemberId),
        eq(buddyConstraint.buddyMemberId, departingMemberId)
      )
    );

  // 3. Delete session preferences for the departing member
  await tx
    .delete(sessionPreference)
    .where(eq(sessionPreference.memberId, departingMemberId));

  // Departure tracking: record departed member name, delete algorithm outputs, and reset group.
  // Use scheduleGeneratedAt (not phase) to determine if schedules were previously generated,
  // since the phase may have already been reset by a prior departure.
  const [grpData] = await tx
    .select({
      departedMembers: group.departedMembers,
      affectedBuddyMembers: group.affectedBuddyMembers,
      scheduleGeneratedAt: group.scheduleGeneratedAt,
    })
    .from(group)
    .where(eq(group.id, groupId))
    .for("update");

  // Always fetch departing user data and build affected buddy map,
  // regardless of whether schedules have been generated.
  const [departingUser] = await tx
    .select({
      userId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      joinedAt: member.joinedAt,
      role: member.role,
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(eq(member.id, departingMemberId))
    .limit(1);

  // Guard against concurrent ownership transfer: if the departing member
  // became the owner between the pre-check and acquiring the group lock,
  // abort to prevent leaving the group ownerless.
  if (departingUser?.role === "owner") {
    throw new Error("Cannot remove the group owner.");
  }

  // Record affected buddy members (regardless of whether departing member was part of schedule).
  // Each affected member maps to an array of departed buddy names (supports multiple departures).
  const existingAffected =
    (grpData?.affectedBuddyMembers as Record<string, string[]>) ?? {};
  // Clean up entries for the departing member themselves (they can't be "affected" if they're leaving)
  const { [departingMemberId]: _removed, ...cleanedAffected } =
    existingAffected;
  const updatedAffected = { ...cleanedAffected };

  if (departingUser && affectedMemberIds.length > 0) {
    const name = `${departingUser.firstName} ${departingUser.lastName}`;
    for (const memberId of affectedMemberIds) {
      const existing = updatedAffected[memberId] ?? [];
      updatedAffected[memberId] = [...existing, name];
    }
  }

  if (grpData?.scheduleGeneratedAt) {
    // Check if the departing member was part of the last schedule generation
    const wasPartOfSchedule =
      departingUser &&
      departingUser.joinedAt &&
      new Date(departingUser.joinedAt) <= new Date(grpData.scheduleGeneratedAt);

    // Always record departed member with timestamp
    const existingDeparted =
      (grpData?.departedMembers as {
        userId: string;
        name: string;
        departedAt: string;
        rejoinedAt?: string;
        wasPartOfSchedule?: boolean;
      }[]) ?? [];
    const name = departingUser
      ? `${departingUser.firstName} ${departingUser.lastName}`
      : "Unknown";
    const departedAt = new Date().toISOString();

    if (wasPartOfSchedule) {
      // 7. Delete algorithm outputs in dependency order
      const comboIds = tx
        .select({ id: combo.id })
        .from(combo)
        .where(eq(combo.groupId, groupId));
      await tx
        .delete(comboSession)
        .where(inArray(comboSession.comboId, comboIds));
      await tx.delete(combo).where(eq(combo.groupId, groupId));

      await tx.delete(windowRanking).where(eq(windowRanking.groupId, groupId));

      // 8. No status or statusChangedAt changes for remaining members.
      //    Members at "joined" stay at "joined" (not ready).
      //    Members at "preferences_set" keep their original statusChangedAt.
      //    We intentionally do NOT bump statusChangedAt here — doing so would
      //    trigger a false "updated preferences" notification for all members.
      //    The departure is already signaled via departedMembers,
      //    affectedBuddyMembers, and the phase change to "preferences".

      // Update group: record departed name, regress phase to preferences,
      // and persist affected buddy map.
      await tx
        .update(group)
        .set({
          phase: "preferences",
          departedMembers: [
            ...existingDeparted,
            {
              userId: departingUser!.userId,
              name,
              departedAt,
              wasPartOfSchedule: true,
            },
          ],
          affectedBuddyMembers: updatedAffected,
          membersWithNoCombos: [],
        })
        .where(eq(group.id, groupId));
    } else {
      // Not part of schedule — record departure and persist affected buddy changes
      await tx
        .update(group)
        .set({
          departedMembers: [
            ...existingDeparted,
            {
              userId: departingUser?.userId ?? "",
              name,
              departedAt,
              wasPartOfSchedule: false,
            },
          ],
          affectedBuddyMembers: updatedAffected,
        })
        .where(eq(group.id, groupId));
    }
  } else {
    // No schedule generated — still record departure and persist affected buddy changes
    const existingDeparted =
      (grpData?.departedMembers as {
        userId: string;
        name: string;
        departedAt: string;
        rejoinedAt?: string;
        wasPartOfSchedule?: boolean;
      }[]) ?? [];
    const name = departingUser
      ? `${departingUser.firstName} ${departingUser.lastName}`
      : "Unknown";
    const departedAt = new Date().toISOString();

    await tx
      .update(group)
      .set({
        departedMembers: [
          ...existingDeparted,
          {
            userId: departingUser?.userId ?? "",
            name,
            departedAt,
            wasPartOfSchedule: false,
          },
        ],
        affectedBuddyMembers: updatedAffected,
      })
      .where(eq(group.id, groupId));
  }

  // 6. Delete the departing member row
  await tx.delete(member).where(eq(member.id, departingMemberId));
}

export async function leaveGroup(groupId: string): Promise<ActionResult> {
  const { membership, error: authError } = await requireMembership(groupId);
  if (authError) return authError;

  if (membership.role === "owner") {
    return {
      error:
        "You must transfer ownership before leaving. Go to Group Settings to transfer ownership.",
    };
  }

  try {
    const [grp] = await db
      .select({ id: group.id })
      .from(group)
      .where(eq(group.id, groupId))
      .limit(1);

    if (!grp) return { error: MSG_GROUP_NOT_FOUND };

    await db.transaction(async (tx) => {
      await removeMemberTransaction(tx, groupId, membership.id);
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "Cannot remove the group owner.") {
      return {
        error:
          "You became the group owner while leaving. Please refresh the page.",
      };
    }
    return { error: failedAction("leave group") };
  }

  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/");
  return { success: true };
}

export async function removeMember(
  groupId: string,
  targetMemberId: string
): Promise<ActionResult> {
  const { membership: ownership, error: authError } =
    await requireOwnerMembership(groupId, "remove members");
  if (authError) return authError;

  const [target] = await db
    .select({
      id: member.id,
      role: member.role,
      status: member.status,
      groupId: member.groupId,
    })
    .from(member)
    .where(and(eq(member.id, targetMemberId), eq(member.groupId, groupId)))
    .limit(1);

  if (!target) {
    return { error: MSG_MEMBER_NOT_FOUND };
  }

  if (target.role === "owner") {
    return { error: "Cannot remove the group owner." };
  }

  if (target.status === "pending_approval" || target.status === "denied") {
    return { error: "Cannot remove a pending or denied member." };
  }

  try {
    const [grp] = await db
      .select({ id: group.id })
      .from(group)
      .where(eq(group.id, groupId))
      .limit(1);

    if (!grp) return { error: MSG_GROUP_NOT_FOUND };

    await db.transaction(async (tx) => {
      await removeMemberTransaction(tx, groupId, targetMemberId);
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "Cannot remove the group owner.") {
      return {
        error: "This member is now the group owner and cannot be removed.",
      };
    }
    return { error: failedAction("remove member") };
  }

  revalidatePath(`/groups/${groupId}`);
  return { success: true };
}

export async function updateDateConfig(
  groupId: string,
  formData: FormData
): Promise<ActionResult> {
  const { membership: ownership, error: authError } =
    await requireOwnerMembership(groupId, "update date configuration");
  if (authError) return authError;

  const dateMode = formData.get("dateMode") as string;

  let newDateMode: "consecutive" | "specific";
  let newConsecutiveDays: number | null = null;
  let newStartDate: string | null = null;
  let newEndDate: string | null = null;

  if (dateMode === "consecutive") {
    const days = formData.get("consecutiveDays") as string;
    const parsed = parseOrError(consecutiveDaysSchema, days);
    if ("error" in parsed) return parsed.error;
    newDateMode = "consecutive";
    newConsecutiveDays = parsed.data;
  } else if (dateMode === "specific") {
    const startDate = formData.get("startDate") as string;
    const endDate = formData.get("endDate") as string;
    const parsed = parseOrError(dateRangeSchema, { startDate, endDate });
    if ("error" in parsed) return parsed.error;
    newDateMode = "specific";
    newStartDate = parsed.data.startDate;
    newEndDate = parsed.data.endDate;
  } else {
    return { error: "Invalid date mode." };
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(group)
        .set({
          dateMode: newDateMode,
          consecutiveDays:
            newDateMode === "consecutive" ? newConsecutiveDays : null,
          startDate: newDateMode === "specific" ? newStartDate : null,
          endDate: newDateMode === "specific" ? newEndDate : null,
        })
        .where(eq(group.id, groupId));

      // Recompute window rankings if combos exist
      const [grpData] = await tx
        .select({ scheduleGeneratedAt: group.scheduleGeneratedAt })
        .from(group)
        .where(eq(group.id, groupId))
        .limit(1);

      if (grpData?.scheduleGeneratedAt) {
        // Delete old window rankings
        await tx
          .delete(windowRanking)
          .where(eq(windowRanking.groupId, groupId));

        // Query all ranked combos for the group
        const allCombos = await tx
          .select({
            memberId: combo.memberId,
            day: combo.day,
            score: combo.score,
            rank: combo.rank,
          })
          .from(combo)
          .where(eq(combo.groupId, groupId));

        if (allCombos.length > 0) {
          const memberScores = buildMemberScores(allCombos);

          // Collect unique dates from purchased sessions for window filtering
          const purchasedRows = await tx
            .selectDistinct({ sessionDate: session.sessionDate })
            .from(ticketPurchaseAssignee)
            .innerJoin(
              ticketPurchase,
              eq(ticketPurchaseAssignee.ticketPurchaseId, ticketPurchase.id)
            )
            .innerJoin(
              session,
              eq(ticketPurchase.sessionId, session.sessionCode)
            )
            .where(eq(ticketPurchase.groupId, groupId));
          const purchasedDays = purchasedRows.map((r) => r.sessionDate);

          const rankings = computeWindowRankings({
            memberScores,
            dateMode: newDateMode,
            consecutiveDays: newConsecutiveDays ?? undefined,
            startDate: newStartDate ?? undefined,
            endDate: newEndDate ?? undefined,
            requiredDays: purchasedDays.length > 0 ? purchasedDays : undefined,
          });

          if (rankings.length > 0) {
            await tx.insert(windowRanking).values(
              rankings.map((r) => ({
                groupId,
                startDate: r.startDate,
                endDate: r.endDate,
                score: r.score,
              }))
            );
          }
        }
      }
    });
  } catch {
    return {
      error: failedAction("update date configuration"),
    };
  }

  revalidatePath(`/groups/${groupId}`, "layout");
  return { success: true };
}

export async function deleteGroup(groupId: string): Promise<ActionResult> {
  const { membership: ownership, error: authError } =
    await requireOwnerMembership(groupId, "delete the group");
  if (authError) return authError;

  try {
    // All related tables have onDelete: "cascade" referencing group.id,
    // so deleting the group row cascades to all dependent data.
    await db.delete(group).where(eq(group.id, groupId));
  } catch {
    return { error: failedAction("delete group") };
  }

  revalidatePath("/");
  return { success: true };
}

export async function transferOwnership(
  groupId: string,
  targetMemberId: string
): Promise<ActionResult> {
  const { membership: ownership, error: authError } =
    await requireOwnerMembership(groupId, "transfer ownership");
  if (authError) return authError;

  if (ownership.id === targetMemberId) {
    return { error: "You are already the owner." };
  }

  const [target] = await db
    .select({
      id: member.id,
      role: member.role,
      status: member.status,
      groupId: member.groupId,
    })
    .from(member)
    .where(and(eq(member.id, targetMemberId), eq(member.groupId, groupId)))
    .limit(1);

  if (!target) {
    return { error: MSG_MEMBER_NOT_FOUND };
  }

  if (target.status === "pending_approval" || target.status === "denied") {
    return {
      error: "Cannot transfer ownership to a pending or denied member.",
    };
  }

  try {
    const result = await db.transaction(async (tx) => {
      // Lock group row to prevent concurrent member departures during transfer
      await tx
        .select({ id: group.id })
        .from(group)
        .where(eq(group.id, groupId))
        .for("update");

      // Re-verify target member inside transaction to prevent race with leaveGroup/removeMember
      const [txTarget] = await tx
        .select({ id: member.id, status: member.status })
        .from(member)
        .where(and(eq(member.id, targetMemberId), eq(member.groupId, groupId)))
        .limit(1);

      if (
        !txTarget ||
        txTarget.status === "pending_approval" ||
        txTarget.status === "denied"
      ) {
        return { gone: true as const };
      }

      await tx
        .update(member)
        .set({ role: "member" })
        .where(eq(member.id, ownership.id));
      await tx
        .update(member)
        .set({ role: "owner" })
        .where(eq(member.id, targetMemberId));

      return { gone: false as const };
    });

    if (result.gone) {
      return { error: MSG_MEMBER_NOT_FOUND };
    }
  } catch {
    return { error: failedAction("transfer ownership") };
  }

  revalidatePath(`/groups/${groupId}`);
  return { success: true };
}

export async function generateSchedules(
  groupId: string
): Promise<ActionResult & { membersWithNoCombos?: string[] }> {
  const { membership: ownership, error: authError } =
    await requireOwnerMembership(groupId, "generate schedules");
  if (authError) return authError;

  // Check group phase
  const [grp] = await db
    .select({
      phase: group.phase,
      affectedBuddyMembers: group.affectedBuddyMembers,
    })
    .from(group)
    .where(eq(group.id, groupId))
    .limit(1);

  if (!grp) return { error: MSG_GROUP_NOT_FOUND };
  if (grp.phase !== "preferences" && grp.phase !== "schedule_review") {
    return {
      error:
        "Schedules can only be generated during the preferences or schedule review phase.",
    };
  }

  if (
    Object.keys((grp.affectedBuddyMembers as Record<string, string[]>) ?? {})
      .length > 0
  ) {
    return {
      error:
        "All affected members must review their preferences before generating schedules.",
    };
  }

  // Check all active members have preferences_set
  const activeMembers = await db
    .select({
      id: member.id,
      status: member.status,
      minBuddies: member.minBuddies,
      sportRankings: member.sportRankings,
    })
    .from(member)
    .where(
      and(
        eq(member.groupId, groupId),
        notInArray(member.status, ["pending_approval", "denied"])
      )
    );

  const readyStatuses = ["preferences_set"];
  const notReady = activeMembers.filter(
    (m) => !readyStatuses.includes(m.status)
  );
  if (notReady.length > 0) {
    return {
      error:
        "All members must have their preferences set before generating schedules.",
    };
  }

  try {
    // Fetch buddy constraints for all members
    const memberIds = activeMembers.map((m) => m.id);
    const buddies = await db
      .select({
        memberId: buddyConstraint.memberId,
        buddyMemberId: buddyConstraint.buddyMemberId,
        type: buddyConstraint.type,
      })
      .from(buddyConstraint)
      .where(inArray(buddyConstraint.memberId, memberIds));

    // Fetch session preferences joined with session table
    const sessionPrefs = await db
      .select({
        memberId: sessionPreference.memberId,
        sessionCode: session.sessionCode,
        sport: session.sport,
        zone: session.zone,
        sessionDate: session.sessionDate,
        startTime: session.startTime,
        endTime: session.endTime,
        interest: sessionPreference.interest,
      })
      .from(sessionPreference)
      .innerJoin(session, eq(sessionPreference.sessionId, session.sessionCode))
      .where(inArray(sessionPreference.memberId, memberIds));

    // Fetch travel times
    const travelEntries = await db
      .select({
        originZone: travelTime.originZone,
        destinationZone: travelTime.destinationZone,
        drivingMinutes: travelTime.drivingMinutes,
        transitMinutes: travelTime.transitMinutes,
      })
      .from(travelTime);

    // Fetch sold-out sessions for this group
    const soldOutRows = await db
      .select({ sessionId: soldOutSession.sessionId })
      .from(soldOutSession)
      .where(eq(soldOutSession.groupId, groupId));
    const soldOutCodes = new Set(soldOutRows.map((r) => r.sessionId));

    // Fetch out-of-budget sessions per member
    const oobRows = await db
      .select({
        memberId: outOfBudgetSession.memberId,
        sessionId: outOfBudgetSession.sessionId,
      })
      .from(outOfBudgetSession)
      .where(eq(outOfBudgetSession.groupId, groupId));
    const oobByMember = new Map<string, Set<string>>();
    for (const row of oobRows) {
      const set = oobByMember.get(row.memberId) ?? new Set();
      set.add(row.sessionId);
      oobByMember.set(row.memberId, set);
    }

    // Fetch purchased sessions per assignee (locked sessions)
    const purchaseAssigneeRows = await db
      .select({
        memberId: ticketPurchaseAssignee.memberId,
        sessionId: ticketPurchase.sessionId,
      })
      .from(ticketPurchaseAssignee)
      .innerJoin(
        ticketPurchase,
        eq(ticketPurchaseAssignee.ticketPurchaseId, ticketPurchase.id)
      )
      .where(eq(ticketPurchase.groupId, groupId));
    const lockedByMember = groupBy(
      purchaseAssigneeRows,
      (r) => r.memberId,
      (r) => r.sessionId
    );

    // Find locked codes missing from each member's OWN preferences (not global).
    // A locked session may exist in another member's preferences but not the
    // assignee's — we still need metadata to inject it for the assignee.
    const perMemberMissingLocked = new Set<string>();
    for (const [memberId, codes] of lockedByMember) {
      const memberPrefCodes = new Set(
        sessionPrefs
          .filter((sp) => sp.memberId === memberId)
          .map((sp) => sp.sessionCode)
      );
      for (const code of codes) {
        if (!memberPrefCodes.has(code)) {
          perMemberMissingLocked.add(code);
        }
      }
    }

    // Build session metadata map: preferences already give us metadata for any
    // session at least one member preferred; query the DB only for truly orphan
    // locked codes that no member preferred at all.
    const sessionMetadataMap = new Map<
      string,
      {
        sessionCode: string;
        sport: string;
        zone: (typeof session.zone.enumValues)[number];
        sessionDate: string;
        startTime: string;
        endTime: string;
      }
    >();
    for (const sp of sessionPrefs) {
      if (!sessionMetadataMap.has(sp.sessionCode)) {
        sessionMetadataMap.set(sp.sessionCode, {
          sessionCode: sp.sessionCode,
          sport: sp.sport,
          zone: sp.zone,
          sessionDate: sp.sessionDate,
          startTime: sp.startTime,
          endTime: sp.endTime,
        });
      }
    }
    // Fetch metadata for locked codes not in any member's preferences
    const orphanLockedCodes = [...perMemberMissingLocked].filter(
      (c) => !sessionMetadataMap.has(c)
    );
    if (orphanLockedCodes.length > 0) {
      const orphanSessions = await db
        .select({
          sessionCode: session.sessionCode,
          sport: session.sport,
          zone: session.zone,
          sessionDate: session.sessionDate,
          startTime: session.startTime,
          endTime: session.endTime,
        })
        .from(session)
        .where(inArray(session.sessionCode, orphanLockedCodes));
      for (const s of orphanSessions) {
        sessionMetadataMap.set(s.sessionCode, s);
      }
    }

    // Assemble MemberData + track excluded sessions per member
    const excludedByMember = new Map<
      string,
      { code: string; soldOut: boolean; outOfBudget: boolean }[]
    >();
    const membersData: MemberData[] = activeMembers.map((m) => {
      const memberBuddies = buddies.filter((b) => b.memberId === m.id);
      const hardBuddies = memberBuddies
        .filter((b) => b.type === "hard")
        .map((b) => b.buddyMemberId);
      const softBuddies = memberBuddies
        .filter((b) => b.type === "soft")
        .map((b) => b.buddyMemberId);
      const memberOob = oobByMember.get(m.id);
      const memberLocked = new Set(lockedByMember.get(m.id) ?? []);
      const memberPrefs = sessionPrefs.filter((sp) => sp.memberId === m.id);
      const candidateSessions = memberPrefs
        // Exclude sold-out sessions — but NOT if this member has purchased tickets
        .filter(
          (sp) =>
            !soldOutCodes.has(sp.sessionCode) ||
            memberLocked.has(sp.sessionCode)
        )
        // Exclude out-of-budget sessions (for this member) — but NOT if purchased
        .filter(
          (sp) =>
            !memberOob?.has(sp.sessionCode) || memberLocked.has(sp.sessionCode)
        )
        .map((sp) => ({
          sessionCode: sp.sessionCode,
          sport: sp.sport,
          zone: sp.zone,
          sessionDate: sp.sessionDate,
          startTime: sp.startTime,
          endTime: sp.endTime,
          interest: sp.interest,
        }));

      // Inject locked sessions missing from this member's preferences
      const memberLockedCodes = lockedByMember.get(m.id) ?? [];
      for (const code of memberLockedCodes) {
        if (!candidateSessions.some((cs) => cs.sessionCode === code)) {
          const sData = sessionMetadataMap.get(code);
          if (sData) {
            candidateSessions.push({
              sessionCode: sData.sessionCode,
              sport: sData.sport,
              zone: sData.zone,
              sessionDate: sData.sessionDate,
              startTime: sData.startTime,
              endTime: sData.endTime,
              interest: "high",
            });
          }
        }
      }

      // Sessions excluded due to sold-out or out-of-budget — store the reason
      const candidateCodes = new Set(
        candidateSessions.map((s) => s.sessionCode)
      );
      const excluded = memberPrefs
        .filter((sp) => !candidateCodes.has(sp.sessionCode))
        .map((sp) => ({
          code: sp.sessionCode,
          soldOut: soldOutCodes.has(sp.sessionCode),
          outOfBudget: !!memberOob?.has(sp.sessionCode),
        }));
      excludedByMember.set(m.id, excluded);

      return {
        memberId: m.id,
        sportRankings: (m.sportRankings as string[]) ?? [],
        minBuddies: m.minBuddies,
        hardBuddies,
        softBuddies,
        candidateSessions,
        lockedSessionCodes: lockedByMember.get(m.id),
      };
    });

    const days = OLYMPIC_DAYS_LIST;

    const travelData: TravelEntry[] = travelEntries.map((t) => ({
      originZone: t.originZone,
      destinationZone: t.destinationZone,
      drivingMinutes: t.drivingMinutes,
      transitMinutes: t.transitMinutes,
    }));

    // Capture timestamp before running the algorithm so that any preference
    // changes made during generation will have statusChangedAt > this value,
    // which lets the existing notification logic detect mid-generation edits.
    const generationTimestamp = new Date();

    // Run algorithm
    const result = runScheduleGeneration(membersData, travelData, days);

    // Only treat timeout as fatal if the first full pass didn't complete
    // (some members have no combos). If timeout happened during convergence
    // refinement, all members have usable combos — treat as non-convergence.
    if (result.convergence.timedOut && result.membersWithNoCombos.length > 0) {
      return {
        error:
          "Schedule generation timed out. Try reducing the number of session preferences or buddy constraints and try again.",
      };
    }

    // Write results in transaction (lock group row to prevent concurrent departures)
    await db.transaction(async (tx) => {
      const [locked] = await tx
        .select({ phase: group.phase })
        .from(group)
        .where(eq(group.id, groupId))
        .limit(1)
        .for("update");
      if (
        !locked ||
        (locked.phase !== "preferences" && locked.phase !== "schedule_review")
      ) {
        throw new Error("Group state changed during generation");
      }

      // Verify active member count hasn't changed since we started
      const [{ count: currentActiveCount }] = await tx
        .select({ count: sql<number>`count(*)` })
        .from(member)
        .where(
          and(
            eq(member.groupId, groupId),
            notInArray(member.status, ["pending_approval", "denied"])
          )
        );
      if (Number(currentActiveCount) !== memberIds.length) {
        throw new Error(
          "Group membership changed during schedule generation. Please try again."
        );
      }

      // Cleanup existing data
      const existingComboIds = tx
        .select({ id: combo.id })
        .from(combo)
        .where(eq(combo.groupId, groupId));
      await tx
        .delete(comboSession)
        .where(inArray(comboSession.comboId, existingComboIds));
      await tx.delete(combo).where(eq(combo.groupId, groupId));

      await tx.delete(windowRanking).where(eq(windowRanking.groupId, groupId));

      // Insert combos
      for (const c of result.combos) {
        const [inserted] = await tx
          .insert(combo)
          .values({
            groupId,
            memberId: c.memberId,
            day: c.day,
            rank: c.rank,
            score: c.score,
          })
          .returning({ id: combo.id });

        if (c.sessionCodes.length > 0) {
          await tx.insert(comboSession).values(
            c.sessionCodes.map((sessionId) => ({
              comboId: inserted.id,
              sessionId,
            }))
          );
        }
      }

      // Members stay at preferences_set — no status update needed.

      const newPhase =
        result.membersWithNoCombos.length > 0
          ? "preferences"
          : "schedule_review";

      // Extract unique member IDs affected by non-convergence violations
      // (includes timeout-during-convergence, where all members have combos
      // but refinement didn't finish)
      const nonConvergenceMembers = result.convergence.converged
        ? []
        : [...new Set(result.convergence.violations.map((v) => v.memberId))];

      await tx
        .update(group)
        .set({
          phase: newPhase,
          scheduleGeneratedAt: generationTimestamp,
          purchaseDataChangedAt: null,
          soldOutCodesAtGeneration: [...soldOutCodes],
          departedMembers: [],
          affectedBuddyMembers: {},
          membersWithNoCombos: result.membersWithNoCombos,
          nonConvergenceMembers,
        })
        .where(eq(group.id, groupId));

      // Store excluded session codes per member
      for (const [memberId, codes] of excludedByMember) {
        await tx
          .update(member)
          .set({ excludedSessionCodes: codes })
          .where(eq(member.id, memberId));
      }

      // Compute window rankings if date config is set and schedule was successful
      if (newPhase === "schedule_review") {
        const [dateConfig] = await tx
          .select({
            dateMode: group.dateMode,
            consecutiveDays: group.consecutiveDays,
            startDate: group.startDate,
            endDate: group.endDate,
          })
          .from(group)
          .where(eq(group.id, groupId))
          .limit(1);

        if (dateConfig?.dateMode) {
          const memberScores = buildMemberScores(result.combos);

          // Collect unique dates from purchased sessions for window filtering
          const purchasedDays = new Set<string>();
          for (const [, codes] of lockedByMember) {
            for (const code of codes) {
              const meta = sessionMetadataMap.get(code);
              if (meta) purchasedDays.add(meta.sessionDate);
            }
          }

          const rankings = computeWindowRankings({
            memberScores,
            dateMode: dateConfig.dateMode,
            consecutiveDays: dateConfig.consecutiveDays ?? undefined,
            startDate: dateConfig.startDate ?? undefined,
            endDate: dateConfig.endDate ?? undefined,
            requiredDays:
              purchasedDays.size > 0 ? [...purchasedDays] : undefined,
          });

          if (rankings.length > 0) {
            await tx.insert(windowRanking).values(
              rankings.map((r) => ({
                groupId,
                startDate: r.startDate,
                endDate: r.endDate,
                score: r.score,
              }))
            );
          }
        }
      }
    });

    revalidatePath(`/groups/${groupId}`);
    return {
      success: true,
      membersWithNoCombos:
        result.membersWithNoCombos.length > 0
          ? result.membersWithNoCombos
          : undefined,
    };
  } catch (err) {
    if (err instanceof Error && err.message.includes("changed during")) {
      return { error: err.message };
    }
    return { error: failedAction("generate schedules") };
  }
}
