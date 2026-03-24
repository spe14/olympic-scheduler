"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { db } from "@/lib/db";
import { user, member, group } from "@/lib/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { profileFieldSchemas, updatePasswordSchema } from "@/lib/validations";
import { parseFieldErrors } from "@/lib/utils";
import { avatarColors, type AvatarColor } from "@/lib/constants";
import { MSG_NOT_LOGGED_IN, MSG_USERNAME_TAKEN } from "@/lib/messages";
import { removeMemberTransaction } from "@/app/(main)/groups/[groupId]/actions";

export type ProfileResult = {
  success?: boolean;
  error?: string;
  updatedValue?: string;
};

type EditableField = keyof typeof profileFieldSchemas;

const dbColumnMap: Record<
  EditableField,
  "username" | "firstName" | "lastName"
> = {
  username: "username",
  firstName: "firstName",
  lastName: "lastName",
};

export async function updateProfileField(
  _prevState: ProfileResult | null,
  formData: FormData
): Promise<ProfileResult> {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return { error: MSG_NOT_LOGGED_IN };
  }

  const field = formData.get("field") as string;
  const value = formData.get("value") as string;

  if (!(field in profileFieldSchemas)) {
    return { error: "Invalid field." };
  }

  const schema = profileFieldSchemas[field as EditableField];
  const result = schema.safeParse(value);

  if (!result.success) {
    return { error: result.error.issues[0].message };
  }

  // Check username uniqueness
  if (field === "username") {
    const existing = await db
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.username, result.data), ne(user.id, currentUser.id)))
      .limit(1);

    if (existing.length > 0) {
      return { error: MSG_USERNAME_TAKEN };
    }
  }

  const column = dbColumnMap[field as EditableField];
  await db
    .update(user)
    .set({ [column]: result.data })
    .where(eq(user.id, currentUser.id));

  return { success: true, updatedValue: result.data };
}

export type PasswordResult = {
  success?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

export async function updatePassword(
  _prevState: PasswordResult | null,
  formData: FormData
): Promise<PasswordResult> {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return { error: MSG_NOT_LOGGED_IN };
  }

  const raw = {
    currentPassword: formData.get("currentPassword") as string,
    newPassword: formData.get("newPassword") as string,
    confirmPassword: formData.get("confirmPassword") as string,
  };

  const result = updatePasswordSchema.safeParse(raw);

  if (!result.success) {
    return { fieldErrors: parseFieldErrors(result.error) };
  }

  const supabase = await createClient();

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: currentUser.email,
    password: result.data.currentPassword,
  });

  if (signInError) {
    return {
      fieldErrors: { currentPassword: ["Current password is incorrect."] },
    };
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: result.data.newPassword,
  });

  if (updateError) {
    return { error: updateError.message };
  }

  return { success: true };
}

const validAvatarColors = Object.keys(avatarColors) as AvatarColor[];

export async function updateAvatarColor(
  color: AvatarColor
): Promise<{ success?: boolean; error?: string }> {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return { error: MSG_NOT_LOGGED_IN };
  }

  if (!validAvatarColors.includes(color)) {
    return { error: "Invalid color." };
  }

  await db
    .update(user)
    .set({ avatarColor: color })
    .where(eq(user.id, currentUser.id));

  return { success: true };
}

export type DeleteAccountResult = {
  error?: string;
};

export async function deleteAccount(
  password: string
): Promise<DeleteAccountResult> {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return { error: MSG_NOT_LOGGED_IN };
  }

  // Verify password
  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: currentUser.email,
    password,
  });

  if (signInError) {
    return { error: "Incorrect password." };
  }

  // Fetch all memberships for this user
  const memberships = await db
    .select({ id: member.id, groupId: member.groupId, role: member.role })
    .from(member)
    .where(eq(member.userId, currentUser.id));

  // Block deletion if the user owns any groups
  const ownedGroup = memberships.find((m) => m.role === "owner");
  if (ownedGroup) {
    return {
      error:
        "You must transfer ownership or delete all groups you own before deleting your account.",
    };
  }

  // Leave each group properly (departure tracking, algorithm cleanup, buddy notifications)
  for (const m of memberships) {
    await db.transaction(async (tx) => {
      await removeMemberTransaction(tx, m.groupId, m.id);
    });
  }

  // Delete user row from local DB
  await db.delete(user).where(eq(user.id, currentUser.id));

  // Delete auth user from Supabase
  const admin = createAdminClient();
  await admin.auth.admin.deleteUser(currentUser.authId);

  // Sign out and clear session cookies
  await supabase.auth.signOut();
  const cookieStore = await cookies();
  cookieStore.delete("session_start_at");
  cookieStore.delete("last_active_at");

  redirect("/login");
}
