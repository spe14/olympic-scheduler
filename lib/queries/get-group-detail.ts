import { cache } from "react";
import { db } from "@/lib/db";
import {
  group,
  member,
  user,
  windowRanking,
  purchaseTimeslot,
  ticketPurchase,
  ticketPurchaseAssignee,
} from "@/lib/db/schema";
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
      purchaseDataChangedAt: group.purchaseDataChangedAt,
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

  // Fetch which members have declared purchase timeslots
  const timeslotRows = await db
    .select({
      memberId: purchaseTimeslot.memberId,
      timeslotStart: purchaseTimeslot.timeslotStart,
      timeslotEnd: purchaseTimeslot.timeslotEnd,
      status: purchaseTimeslot.status,
    })
    .from(purchaseTimeslot)
    .where(eq(purchaseTimeslot.groupId, groupId));
  const memberTimeslots = new Set(timeslotRows.map((r) => r.memberId));

  const myTimeslotRow = timeslotRows.find(
    (r) => r.memberId === myMembership.id
  );

  // Fetch which members have recorded at least 1 purchase as buyer
  const purchaseBuyerRows = await db
    .selectDistinct({ memberId: ticketPurchase.purchasedByMemberId })
    .from(ticketPurchase)
    .where(eq(ticketPurchase.groupId, groupId));
  const membersPurchased = purchaseBuyerRows.map((r) => r.memberId);

  // Fetch members with any purchase data (buyer OR assignee) — used to prevent removal
  const purchaseAssigneeRows = await db
    .selectDistinct({ memberId: ticketPurchaseAssignee.memberId })
    .from(ticketPurchaseAssignee)
    .innerJoin(
      ticketPurchase,
      eq(ticketPurchaseAssignee.ticketPurchaseId, ticketPurchase.id)
    )
    .where(eq(ticketPurchase.groupId, groupId));
  const membersWithPurchaseData = new Set([
    ...membersPurchased,
    ...purchaseAssigneeRows.map((r) => r.memberId),
  ]);

  return {
    ...groupData,
    myRole: myMembership.role,
    myStatus: myMembership.status,
    myMemberId: myMembership.id,
    myScheduleWarningAckedAt: myMembership.scheduleWarningAckedAt,
    myTimeslot: myTimeslotRow
      ? {
          timeslotStart: myTimeslotRow.timeslotStart,
          timeslotEnd: myTimeslotRow.timeslotEnd,
          status: myTimeslotRow.status,
        }
      : null,
    purchaseDataChangedAt: groupData.purchaseDataChangedAt ?? null,
    members,
    memberTimeslots: [...memberTimeslots],
    membersPurchased,
    membersWithPurchaseData: [...membersWithPurchaseData],
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
