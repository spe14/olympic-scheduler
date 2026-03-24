import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { group, member, user, windowRanking } from "@/lib/db/schema";
import { eq, and, desc, notInArray } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { groupId } = await params;

  // Verify current user is a member of this group
  const myMembership = await db
    .select({ id: member.id, role: member.role, status: member.status })
    .from(member)
    .where(and(eq(member.groupId, groupId), eq(member.userId, currentUser.id)))
    .limit(1);

  if (
    myMembership.length === 0 ||
    myMembership[0].status === "pending_approval" ||
    myMembership[0].status === "denied"
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
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
      createdAt: group.createdAt,
    })
    .from(group)
    .where(eq(group.id, groupId));

  if (!groupData) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const windowRankings = await db
    .select({
      id: windowRanking.id,
      startDate: windowRanking.startDate,
      endDate: windowRanking.endDate,
      score: windowRanking.score,
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

  return NextResponse.json({
    ...groupData,
    myRole: myMembership[0].role,
    myStatus: myMembership[0].status,
    myMemberId: myMembership[0].id,
    members,
    windowRankings,
    departedMembers: Array.isArray(groupData.departedMembers)
      ? (groupData.departedMembers as unknown[]).map((entry) =>
          typeof entry === "string"
            ? { name: entry, departedAt: new Date().toISOString() }
            : entry
        )
      : [],
    affectedBuddyMembers:
      groupData.affectedBuddyMembers &&
      typeof groupData.affectedBuddyMembers === "object" &&
      !Array.isArray(groupData.affectedBuddyMembers)
        ? groupData.affectedBuddyMembers
        : {},
  });
}
