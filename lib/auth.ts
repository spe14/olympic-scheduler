import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { user, member } from "@/lib/db/schema";
import { eq, and, notInArray } from "drizzle-orm";

export async function getCurrentUser() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return null;
  }

  const appUser = await db
    .select()
    .from(user)
    .where(eq(user.authId, data.user.id))
    .limit(1);

  if (appUser.length === 0) {
    return null;
  }

  return appUser[0];
}

export async function getMembership(groupId: string) {
  const user = await getCurrentUser();
  if (!user) return null;

  const [membership] = await db
    .select({
      id: member.id,
      role: member.role,
      status: member.status,
      preferenceStep: member.preferenceStep,
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

export async function getOwnerMembership(groupId: string) {
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
