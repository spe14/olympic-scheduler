"use server";

import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import {
  signUpSchema,
  loginSchema,
  resetPasswordSchema,
  emailSchema,
} from "@/lib/validations";
import { parseFieldErrors } from "@/lib/utils";

export type AuthResult = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  values?: Record<string, string>;
};

export async function signUp(
  _prevState: AuthResult | null,
  formData: FormData
): Promise<AuthResult | null> {
  const raw = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    username: formData.get("username") as string,
    firstName: formData.get("firstName") as string,
    lastName: formData.get("lastName") as string,
  };

  const result = signUpSchema.safeParse(raw);

  if (!result.success) {
    return { fieldErrors: parseFieldErrors(result.error), values: raw };
  }

  const { email, password, username, firstName, lastName } = result.data;

  // Check username availability before creating the auth user
  const existingUser = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.username, username))
    .limit(1);

  if (existingUser.length > 0) {
    return {
      error: "This username is already taken. Please enter a different one.",
      values: raw,
    };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    const message =
      error.message === "User already registered"
        ? "This email is already associated with an account. Please log in."
        : error.message;
    return { error: message, values: raw };
  }

  if (!data.user) {
    return { error: "Sign up failed. Please try again.", values: raw };
  }

  try {
    await db.insert(user).values({
      authId: data.user.id,
      email,
      username,
      firstName,
      lastName,
    });
  } catch {
    return { error: "Account creation failed. Please try again.", values: raw };
  }

  redirect("/");
}

export async function login(
  _prevState: AuthResult | null,
  formData: FormData
): Promise<AuthResult | null> {
  const raw = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const result = loginSchema.safeParse(raw);

  if (!result.success) {
    return { fieldErrors: parseFieldErrors(result.error), values: raw };
  }

  const { email, password } = result.data;

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: "Invalid email or password.", values: raw };
  }

  redirect("/");
}

export async function forgotPassword(
  _prevState: AuthResult | null,
  formData: FormData
): Promise<AuthResult | null> {
  const email = (formData.get("email") as string) ?? "";

  const result = emailSchema.safeParse(email);

  if (!result.success) {
    return {
      fieldErrors: { email: result.error.issues.map((i) => i.message) },
      values: { email },
    };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(result.data, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/callback?next=/reset-password`,
  });

  if (error) {
    return { error: error.message, values: { email } };
  }

  return {
    error:
      "If an account exists with this email, you will receive a password reset link.",
    values: { email },
  };
}

export async function resetPassword(
  _prevState: AuthResult | null,
  formData: FormData
): Promise<AuthResult | null> {
  const raw = {
    password: formData.get("password") as string,
    confirmPassword: formData.get("confirmPassword") as string,
  };

  const result = resetPasswordSchema.safeParse(raw);

  if (!result.success) {
    return { fieldErrors: parseFieldErrors(result.error) };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.updateUser({
    password: result.data.password,
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/login");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const cookieStore = await cookies();
  cookieStore.delete("session_start_at");
  cookieStore.delete("last_active_at");

  redirect("/login");
}
