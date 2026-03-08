"use server";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  group,
  member,
  buddyConstraint,
  sessionPreference,
  combo,
  comboSession,
  viableConfig,
  viableConfigMember,
  conflict,
  windowRanking,
} from "@/lib/db/schema";
import { eq, and, or, notInArray, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { groupNameSchema } from "@/lib/validations";
import { MAX_GROUP_MEMBERS } from "@/lib/constants";

export type ActionResult = {
  error?: string;
  success?: boolean;
};

async function getOwnerMembership(groupId: string) {
  const user = await getCurrentUser();
  if (!user) return null;

  const [membership] = await db
    .select({ id: member.id, role: member.role })
    .from(member)
    .where(and(eq(member.groupId, groupId), eq(member.userId, user.id)))
    .limit(1);

  if (!membership || membership.role !== "owner") return null;
  return membership;
}

export async function updateGroupName(
  groupId: string,
  formData: FormData
): Promise<ActionResult> {
  const ownership = await getOwnerMembership(groupId);
  if (!ownership) {
    return { error: "Only the group owner can rename the group." };
  }

  const name = formData.get("name") as string;
  const result = groupNameSchema.safeParse(name);
  if (!result.success) {
    return { error: result.error.issues[0].message };
  }

  try {
    await db
      .update(group)
      .set({ name: result.data })
      .where(eq(group.id, groupId));
  } catch {
    return { error: "Failed to update group name. Please try again." };
  }

  revalidatePath(`/groups/${groupId}`);
  return { success: true };
}

export async function approveMember(
  groupId: string,
  memberId: string
): Promise<ActionResult> {
  const ownership = await getOwnerMembership(groupId);
  if (!ownership) {
    return { error: "Only the group owner can approve members." };
  }

  const [target] = await db
    .select({ id: member.id, status: member.status })
    .from(member)
    .where(and(eq(member.id, memberId), eq(member.groupId, groupId)))
    .limit(1);

  if (!target || target.status !== "pending_approval") {
    return { error: "Member is not pending approval." };
  }

  const [{ count: activeCount }] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(member)
    .where(
      and(
        eq(member.groupId, groupId),
        notInArray(member.status, ["pending_approval", "denied"])
      )
    );

  if (activeCount >= MAX_GROUP_MEMBERS) {
    return { error: "This group is full. Groups are limited to 12 members." };
  }

  try {
    await db
      .update(member)
      .set({ status: "joined" })
      .where(eq(member.id, memberId));
  } catch {
    return {
      error: "Failed to approve member's join request. Please try again.",
    };
  }

  revalidatePath(`/groups/${groupId}`);
  return { success: true };
}

export async function denyMember(
  groupId: string,
  memberId: string
): Promise<ActionResult> {
  const ownership = await getOwnerMembership(groupId);
  if (!ownership) {
    return { error: "Only the group owner can deny members." };
  }

  const [target] = await db
    .select({ id: member.id, status: member.status })
    .from(member)
    .where(and(eq(member.id, memberId), eq(member.groupId, groupId)))
    .limit(1);

  if (!target || target.status !== "pending_approval") {
    return { error: "Member is not pending approval." };
  }

  try {
    await db
      .update(member)
      .set({ status: "denied" })
      .where(eq(member.id, memberId));
  } catch {
    return { error: "Failed to deny member's join request. Please try again." };
  }

  revalidatePath(`/groups/${groupId}`);
  return { success: true };
}

async function getMembership(groupId: string) {
  const user = await getCurrentUser();
  if (!user) return null;

  const [membership] = await db
    .select({
      id: member.id,
      role: member.role,
      status: member.status,
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

async function removeMemberTransaction(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  groupId: string,
  departingMemberId: string,
  groupPhase: string
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

  // 4. Reset affected members (had buddy connection) to buddies_budget step
  if (affectedMemberIds.length > 0) {
    await tx
      .update(member)
      .set({ status: "joined", preferenceStep: "buddies_budget" })
      .where(inArray(member.id, affectedMemberIds));
  }

  // Post-preferences phase: delete algorithm outputs and reset group
  if (groupPhase !== "preferences") {
    // 7. Delete algorithm outputs in dependency order
    const comboIds = tx
      .select({ id: combo.id })
      .from(combo)
      .where(eq(combo.groupId, groupId));
    await tx
      .delete(comboSession)
      .where(inArray(comboSession.comboId, comboIds));
    await tx.delete(combo).where(eq(combo.groupId, groupId));

    const vcIds = tx
      .select({ id: viableConfig.id })
      .from(viableConfig)
      .where(eq(viableConfig.groupId, groupId));
    await tx
      .delete(viableConfigMember)
      .where(inArray(viableConfigMember.viableConfigId, vcIds));
    await tx.delete(viableConfig).where(eq(viableConfig.groupId, groupId));

    await tx.delete(conflict).where(eq(conflict.groupId, groupId));
    await tx.delete(windowRanking).where(eq(windowRanking.groupId, groupId));

    // 8. Reset override/excluded flags on session preferences for remaining members
    await tx
      .update(sessionPreference)
      .set({
        hardBuddyOverride: false,
        minBuddyOverride: false,
        excluded: false,
      })
      .where(
        inArray(
          sessionPreference.memberId,
          tx
            .select({ id: member.id })
            .from(member)
            .where(
              and(
                eq(member.groupId, groupId),
                notInArray(member.status, ["pending_approval", "denied"])
              )
            )
        )
      );

    // 9. Set unaffected active members to preferences_set
    await tx
      .update(member)
      .set({ status: "preferences_set" })
      .where(
        and(
          eq(member.groupId, groupId),
          notInArray(member.status, ["pending_approval", "denied"]),
          notInArray(member.id, [
            departingMemberId,
            ...(affectedMemberIds.length > 0 ? affectedMemberIds : []),
          ])
        )
      );

    // 10. Reset group phase
    await tx
      .update(group)
      .set({ phase: "preferences" })
      .where(eq(group.id, groupId));
  }

  // 6. Delete the departing member row
  await tx.delete(member).where(eq(member.id, departingMemberId));
}

export async function leaveGroup(groupId: string): Promise<ActionResult> {
  const membership = await getMembership(groupId);
  if (!membership) {
    return { error: "You are not an active member of this group." };
  }

  if (membership.role === "owner") {
    return {
      error:
        "You must transfer ownership before leaving. Go to Group Settings to transfer ownership.",
    };
  }

  try {
    const [grp] = await db
      .select({ phase: group.phase })
      .from(group)
      .where(eq(group.id, groupId))
      .limit(1);

    if (!grp) return { error: "Group not found." };

    await db.transaction(async (tx) => {
      await removeMemberTransaction(tx, groupId, membership.id, grp.phase);
    });
  } catch {
    return { error: "Failed to leave group. Please try again." };
  }

  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/");
  return { success: true };
}

export async function removeMember(
  groupId: string,
  targetMemberId: string
): Promise<ActionResult> {
  const ownership = await getOwnerMembership(groupId);
  if (!ownership) {
    return { error: "Only the group owner can remove members." };
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
    return { error: "Member not found." };
  }

  if (target.role === "owner") {
    return { error: "Cannot remove the group owner." };
  }

  if (target.status === "pending_approval" || target.status === "denied") {
    return { error: "Cannot remove a pending or denied member." };
  }

  try {
    const [grp] = await db
      .select({ phase: group.phase })
      .from(group)
      .where(eq(group.id, groupId))
      .limit(1);

    if (!grp) return { error: "Group not found." };

    await db.transaction(async (tx) => {
      await removeMemberTransaction(tx, groupId, targetMemberId, grp.phase);
    });
  } catch {
    return { error: "Failed to remove member. Please try again." };
  }

  revalidatePath(`/groups/${groupId}`);
  return { success: true };
}
