"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { profileFieldSchemas, updatePasswordSchema } from "@/lib/validations";
import { parseFieldErrors } from "@/lib/utils";
import type { AvatarColor } from "@/lib/constants";

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
    return { error: "You must be logged in." };
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
      return { error: "This username is already taken." };
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
    return { error: "You must be logged in." };
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

const validAvatarColors: AvatarColor[] = ["blue", "yellow", "pink", "green"];

export async function updateAvatarColor(
  color: AvatarColor
): Promise<{ success?: boolean; error?: string }> {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return { error: "You must be logged in." };
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
