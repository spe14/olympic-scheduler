import { cache } from "react";
import { db } from "@/lib/db";
import { group, member, user, windowRanking } from "@/lib/db/schema";
import { eq, and, notInArray, desc } from "drizzle-orm";
import type { GroupDetail } from "@/lib/types";

export const getGroupDetail = cache(async function getGroupDetail(
  groupId: string,
  userId: string
): Promise<GroupDetail | null> {
  const [myMembership] = await db
    .select({
      id: member.id,
      role: member.role,
      status: member.status,
      scheduleWarningAckedAt: member.scheduleWarningAckedAt,
    })
    .from(member)
    .where(and(eq(member.groupId, groupId), eq(member.userId, userId)))
    .limit(1);

  if (!myMembership || myMembership.status === "denied") {
    return null;
  }

  const [groupData] = await db
    .select({
      id: group.id,
      name: group.name,
      phase: group.phase,
      inviteCode: group.inviteCode,
      dateMode: group.dateMode,
      consecutiveDays: group.consecutiveDays,
      startDate: group.startDate,
      endDate: group.endDate,
      scheduleGeneratedAt: group.scheduleGeneratedAt,
      departedMembers: group.departedMembers,
      affectedBuddyMembers: group.affectedBuddyMembers,
      membersWithNoCombos: group.membersWithNoCombos,
      createdAt: group.createdAt,
    })
    .from(group)
    .where(eq(group.id, groupId));

  if (!groupData) {
    return null;
  }

  const windowRankings = await db
    .select({
      id: windowRanking.id,
      startDate: windowRanking.startDate,
      endDate: windowRanking.endDate,
      score: windowRanking.score,
      selected: windowRanking.selected,
    })
    .from(windowRanking)
    .where(eq(windowRanking.groupId, groupId))
    .orderBy(desc(windowRanking.score));

  const members = await db
    .select({
      id: member.id,
      userId: member.userId,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      avatarColor: user.avatarColor,
      role: member.role,
      status: member.status,
      joinedAt: member.joinedAt,
      statusChangedAt: member.statusChangedAt,
      createdAt: member.createdAt,
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(
      and(eq(member.groupId, groupId), notInArray(member.status, ["denied"]))
    )
    .orderBy(member.createdAt);

  return {
    ...groupData,
    myRole: myMembership.role,
    myStatus: myMembership.status,
    myMemberId: myMembership.id,
    myScheduleWarningAckedAt: myMembership.scheduleWarningAckedAt,
    members,
    windowRankings,
    membersWithNoCombos: Array.isArray(groupData.membersWithNoCombos)
      ? (groupData.membersWithNoCombos as string[])
      : [],
    departedMembers: Array.isArray(groupData.departedMembers)
      ? (groupData.departedMembers as unknown[]).map((entry) =>
          typeof entry === "string"
            ? { name: entry, departedAt: new Date().toISOString() }
            : (entry as {
                name: string;
                departedAt: string;
                rejoinedAt?: string;
              })
        )
      : [],
    affectedBuddyMembers:
      groupData.affectedBuddyMembers &&
      typeof groupData.affectedBuddyMembers === "object" &&
      !Array.isArray(groupData.affectedBuddyMembers)
        ? (groupData.affectedBuddyMembers as Record<string, string[]>)
        : {},
  };
});
