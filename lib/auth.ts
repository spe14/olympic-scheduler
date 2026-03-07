import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

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
