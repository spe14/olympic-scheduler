import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { group, member } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import type { GroupMember } from "@/lib/types";
import { NextResponse } from "next/server";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const groups = await db
    .select({
      id: group.id,
      name: group.name,
      phase: group.phase,
      inviteCode: group.inviteCode,
      createdAt: group.createdAt,
      myRole: member.role,
      myStatus: member.status,
      myMemberId: member.id,
      memberCount: sql<number>`(
        SELECT COUNT(*)::int FROM member m2
        WHERE m2.group_id = ${group.id}
          AND m2.status NOT IN ('pending_approval', 'denied')
      )`,
      pendingCount: sql<number>`(
        SELECT COUNT(*)::int FROM member m2
        WHERE m2.group_id = ${group.id}
          AND m2.status = 'pending_approval'
      )`,
      members: sql<GroupMember[]>`(
        SELECT COALESCE(json_agg(json_build_object(
          'firstName', u.first_name,
          'lastName', u.last_name,
          'avatarColor', u.avatar_color
        )), '[]'::json)
        FROM member m3
        JOIN users u ON u.id = m3.user_id
        WHERE m3.group_id = ${group.id}
          AND m3.status NOT IN ('pending_approval', 'denied')
      )`,
    })
    .from(member)
    .innerJoin(group, eq(member.groupId, group.id))
    .where(eq(member.userId, user.id))
    .orderBy(group.createdAt);

  return NextResponse.json(groups);
}
