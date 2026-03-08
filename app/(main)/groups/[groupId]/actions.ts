"use server";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { group, member } from "@/lib/db/schema";
import { eq, and, notInArray, sql } from "drizzle-orm";
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
