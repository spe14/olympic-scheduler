import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { user, member } from "@/lib/db/schema";
import { eq, and, notInArray } from "drizzle-orm";
import type { ActionResult } from "@/lib/types";
import { MSG_NOT_MEMBER } from "@/lib/messages";

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

/**
 * Returns the membership or an ActionResult error.
 * Use in server actions to avoid repeating the null-check pattern.
 */
export async function requireMembership(groupId: string) {
  const membership = await getMembership(groupId);
  if (!membership) {
    return {
      membership: null as never,
      error: { error: MSG_NOT_MEMBER } as ActionResult,
    };
  }
  return { membership, error: null };
}

/**
 * Returns the owner membership or an ActionResult error.
 */
export async function requireOwnerMembership(groupId: string, action: string) {
  const membership = await getOwnerMembership(groupId);
  if (!membership) {
    return {
      membership: null as never,
      error: { error: `Only the group owner can ${action}.` } as ActionResult,
    };
  }
  return { membership, error: null };
}
