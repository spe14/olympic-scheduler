"use server";

import { getOwnerMembership, getMembership } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  combo,
  comboSession,
  member,
  session,
  windowRanking,
} from "@/lib/db/schema";
import { eq, and, inArray, notInArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/types";
import type { AvatarColor } from "@/lib/constants";

export type GroupScheduleSession = {
  sessionCode: string;
  sport: string;
  sessionType: string;
  sessionDescription: string | null;
  venue: string;
  zone: string;
  startTime: string;
  endTime: string;
};

export type GroupScheduleMemberCombo = {
  memberId: string;
  firstName: string;
  lastName: string;
  avatarColor: AvatarColor;
  day: string;
  rank: "primary" | "backup1" | "backup2";
  score: number;
  sessions: GroupScheduleSession[];
};

export async function getGroupSchedule(groupId: string): Promise<{
  data?: GroupScheduleMemberCombo[];
  error?: string;
}> {
  const membership = await getMembership(groupId);
  if (!membership) {
    return { error: "You are not an active member of this group." };
  }

  // Fetch all combos (P+B1+B2) for all active members
  const activeMembers = await db
    .select({
      memberId: member.id,
      firstName: member.id, // placeholder — joined below
      status: member.status,
    })
    .from(member)
    .where(
      and(
        eq(member.groupId, groupId),
        notInArray(member.status, ["pending_approval", "denied"])
      )
    );

  const memberIds = activeMembers.map((m) => m.memberId);
  if (memberIds.length === 0) return { data: [] };

  const allCombos = await db
    .select({
      comboId: combo.id,
      memberId: combo.memberId,
      day: combo.day,
      rank: combo.rank,
      score: combo.score,
    })
    .from(combo)
    .where(and(eq(combo.groupId, groupId), inArray(combo.memberId, memberIds)))
    .orderBy(combo.day);

  if (allCombos.length === 0) return { data: [] };

  const comboIds = allCombos.map((c) => c.comboId);

  const allComboSessions = await db
    .select({
      comboId: comboSession.comboId,
      sessionCode: session.sessionCode,
      sport: session.sport,
      sessionType: session.sessionType,
      sessionDescription: session.sessionDescription,
      venue: session.venue,
      zone: session.zone,
      startTime: session.startTime,
      endTime: session.endTime,
    })
    .from(comboSession)
    .innerJoin(session, eq(comboSession.sessionId, session.sessionCode))
    .where(inArray(comboSession.comboId, comboIds));

  // Fetch member details
  const { user } = await import("@/lib/db/schema");
  const memberDetails = await db
    .select({
      id: member.id,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarColor: user.avatarColor,
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(inArray(member.id, memberIds));

  const memberMap = new Map(memberDetails.map((m) => [m.id, m]));

  const data: GroupScheduleMemberCombo[] = allCombos.map((c) => {
    const memberInfo = memberMap.get(c.memberId);
    const sessions = allComboSessions
      .filter((cs) => cs.comboId === c.comboId)
      .map((cs) => ({
        sessionCode: cs.sessionCode,
        sport: cs.sport,
        sessionType: cs.sessionType,
        sessionDescription: cs.sessionDescription,
        venue: cs.venue,
        zone: cs.zone,
        startTime: cs.startTime,
        endTime: cs.endTime,
      }))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    return {
      memberId: c.memberId,
      firstName: memberInfo?.firstName ?? "Unknown",
      lastName: memberInfo?.lastName ?? "",
      avatarColor: (memberInfo?.avatarColor ?? "blue") as AvatarColor,
      day: c.day,
      rank: c.rank,
      score: c.score,
      sessions,
    };
  });

  return { data };
}

export async function selectWindow(
  groupId: string,
  windowId: string
): Promise<ActionResult> {
  const ownership = await getOwnerMembership(groupId);
  if (!ownership) {
    return { error: "Only the group owner can select a window." };
  }

  try {
    await db.transaction(async (tx) => {
      // Deselect current
      await tx
        .update(windowRanking)
        .set({ selected: false })
        .where(
          and(
            eq(windowRanking.groupId, groupId),
            eq(windowRanking.selected, true)
          )
        );

      // Select new
      await tx
        .update(windowRanking)
        .set({ selected: true })
        .where(
          and(
            eq(windowRanking.id, windowId),
            eq(windowRanking.groupId, groupId)
          )
        );
    });
  } catch {
    return { error: "Failed to select window. Please try again." };
  }

  revalidatePath(`/groups/${groupId}`);
  return { success: true };
}
