import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { group, member, user } from "@/lib/db/schema";
import { eq, and, notInArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import GroupShell from "./group-shell";
import type { GroupDetail } from "@/lib/types";

export default async function GroupLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ groupId: string }>;
}) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    notFound();
  }

  const { groupId } = await params;

  const [myMembership] = await db
    .select({ id: member.id, role: member.role, status: member.status })
    .from(member)
    .where(and(eq(member.groupId, groupId), eq(member.userId, currentUser.id)))
    .limit(1);

  if (!myMembership || myMembership.status === "denied") {
    notFound();
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
      createdAt: group.createdAt,
    })
    .from(group)
    .where(eq(group.id, groupId));

  if (!groupData) {
    notFound();
  }

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
      budget: member.budget,
      createdAt: member.createdAt,
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(
      and(eq(member.groupId, groupId), notInArray(member.status, ["denied"]))
    )
    .orderBy(member.createdAt);

  const groupDetail: GroupDetail = {
    ...groupData,
    myRole: myMembership.role,
    myStatus: myMembership.status,
    myMemberId: myMembership.id,
    members,
  };

  return <GroupShell group={groupDetail}>{children}</GroupShell>;
}
