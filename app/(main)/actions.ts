"use server";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { group, member } from "@/lib/db/schema";
import { eq, and, notInArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  groupNameSchema,
  inviteCodeSchema,
  dateRangeSchema,
  consecutiveDaysSchema,
} from "@/lib/validations";
import crypto from "crypto";
import { MAX_GROUP_MEMBERS } from "@/lib/constants";

export type GroupActionResult = {
  error?: string;
  code?: string;
  success?: boolean;
};

export async function createGroup(
  _prevState: GroupActionResult | null,
  formData: FormData
): Promise<GroupActionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "You must be logged in." };
  }

  const name = formData.get("name") as string;
  const dateMode = formData.get("dateMode") as string | null;

  const nameResult = groupNameSchema.safeParse(name);
  if (!nameResult.success) {
    return { error: nameResult.error.issues[0].message };
  }

  let groupValues: {
    name: string;
    inviteCode: string;
    dateMode?: "consecutive" | "specific";
    consecutiveDays?: number;
    startDate?: string;
    endDate?: string;
  } = {
    name: nameResult.data,
    inviteCode: crypto.randomBytes(4).toString("hex"),
  };

  if (dateMode === "consecutive") {
    const days = formData.get("consecutiveDays") as string;
    const daysResult = consecutiveDaysSchema.safeParse(days);
    if (!daysResult.success) {
      return { error: daysResult.error.issues[0].message };
    }
    groupValues.dateMode = "consecutive";
    groupValues.consecutiveDays = daysResult.data;
  } else if (dateMode === "specific") {
    const startDate = formData.get("startDate") as string;
    const endDate = formData.get("endDate") as string;
    const rangeResult = dateRangeSchema.safeParse({ startDate, endDate });
    if (!rangeResult.success) {
      return { error: rangeResult.error.issues[0].message };
    }
    groupValues.dateMode = "specific";
    groupValues.startDate = rangeResult.data.startDate;
    groupValues.endDate = rangeResult.data.endDate;
  }

  try {
    const [newGroup] = await db
      .insert(group)
      .values(groupValues)
      .returning({ id: group.id });

    await db.insert(member).values({
      userId: user.id,
      groupId: newGroup.id,
      role: "owner",
      status: "joined",
    });
  } catch {
    return { error: "Failed to create group. Please try again." };
  }

  revalidatePath("/");
  return { success: true };
}

export async function joinGroup(
  _prevState: GroupActionResult | null,
  formData: FormData
): Promise<GroupActionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "You must be logged in." };
  }

  const code = (formData.get("inviteCode") as string)?.trim() ?? "";
  const result = inviteCodeSchema.safeParse(code);
  if (!result.success) {
    return { error: result.error.issues[0].message };
  }

  const matchingGroup = await db
    .select({ id: group.id })
    .from(group)
    .where(eq(group.inviteCode, result.data))
    .limit(1);

  if (matchingGroup.length === 0) {
    return { error: "No group found with that invite code." };
  }

  const groupId = matchingGroup[0].id;

  const existingMember = await db
    .select({ id: member.id, status: member.status })
    .from(member)
    .where(and(eq(member.userId, user.id), eq(member.groupId, groupId)))
    .limit(1);

  if (existingMember.length > 0) {
    if (existingMember[0].status === "pending_approval") {
      return {
        error: "You already have a pending join request for this group.",
        code: "pending_approval",
      };
    }
    if (existingMember[0].status !== "denied") {
      return {
        error: "You are already a member of this group.",
        code: "already_member",
      };
    }
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

  if (existingMember.length > 0) {
    // Status must be "denied" — reset to pending
    try {
      await db
        .update(member)
        .set({ status: "pending_approval" })
        .where(eq(member.id, existingMember[0].id));
    } catch {
      return { error: "Failed to join group. Please try again." };
    }
    revalidatePath("/");
    return { success: true };
  }

  try {
    await db.insert(member).values({
      userId: user.id,
      groupId,
      role: "member",
      status: "pending_approval",
    });
  } catch {
    return { error: "Failed to join group. Please try again." };
  }

  revalidatePath("/");
  return { success: true };
}

export async function removeMembership(
  memberId: string
): Promise<GroupActionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "You must be logged in." };
  }

  const [membership] = await db
    .select({ id: member.id, userId: member.userId, status: member.status })
    .from(member)
    .where(eq(member.id, memberId))
    .limit(1);

  if (!membership || membership.userId !== user.id) {
    return { error: "Membership not found." };
  }

  if (
    membership.status !== "pending_approval" &&
    membership.status !== "denied"
  ) {
    return { error: "You must leave the group from the group page." };
  }

  try {
    await db.delete(member).where(eq(member.id, memberId));
  } catch {
    return { error: "Failed to remove membership. Please try again." };
  }

  revalidatePath("/");
  return { success: true };
}
