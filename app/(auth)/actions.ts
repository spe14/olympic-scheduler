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
import { MSG_USERNAME_TAKEN } from "@/lib/messages";
import * as Sentry from "@sentry/nextjs";

export type AuthResult = {
  error?: string;
  message?: string;
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
    avatarColor: (formData.get("avatarColor") as string) || "blue",
  };

  const result = signUpSchema.safeParse(raw);

  const { password: _, ...safeValues } = raw;

  if (!result.success) {
    return { fieldErrors: parseFieldErrors(result.error), values: safeValues };
  }

  const { email, password, username, firstName, lastName, avatarColor } =
    result.data;

  // Check username availability before creating the auth user
  const existingUser = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.username, username))
    .limit(1);

  if (existingUser.length > 0) {
    return {
      error: MSG_USERNAME_TAKEN,
      values: safeValues,
    };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    // If Supabase says email already registered, try to recover orphaned accounts
    // (auth created but local DB insert failed on a prior attempt)
    if (error.message === "User already registered") {
      const { data: signInData, error: signInError } =
        await supabase.auth.signInWithPassword({ email, password });

      if (signInError || !signInData.user) {
        return {
          error:
            "This email is already associated with an account. Please log in.",
          values: safeValues,
        };
      }

      // Check if local DB user exists
      const existingDbUser = await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.authId, signInData.user.id))
        .limit(1);

      if (existingDbUser.length > 0) {
        await supabase.auth.signOut();
        return {
          error:
            "This email is already associated with an account. Please log in.",
          values: safeValues,
        };
      }

      // Orphaned auth user — create the missing DB row
      try {
        await db.insert(user).values({
          authId: signInData.user.id,
          email,
          username,
          firstName,
          lastName,
          avatarColor,
        });
      } catch (recoverErr) {
        await supabase.auth.signOut();
        const recoverMessage =
          recoverErr instanceof Error && recoverErr.message.includes("username")
            ? MSG_USERNAME_TAKEN
            : "Sign up failed. Please try again.";
        if (recoverMessage !== MSG_USERNAME_TAKEN) {
          Sentry.captureException(recoverErr, {
            extra: { context: "signUp orphaned account recovery" },
          });
        }
        return { error: recoverMessage, values: safeValues };
      }

      redirect("/about");
    }

    Sentry.captureException(new Error("Supabase signUp failed"), {
      extra: { context: "signUp", supabaseError: error.message },
    });
    return { error: "Sign up failed. Please try again.", values: safeValues };
  }

  if (!data.user) {
    return { error: "Sign up failed. Please try again.", values: safeValues };
  }

  try {
    await db
      .insert(user)
      .values({
        authId: data.user.id,
        email,
        username,
        firstName,
        lastName,
        avatarColor,
      })
      .onConflictDoUpdate({
        target: user.authId,
        set: { email, username, firstName, lastName, avatarColor },
      });
  } catch (err) {
    await supabase.auth.signOut();
    const message =
      err instanceof Error && err.message.includes("username")
        ? MSG_USERNAME_TAKEN
        : "Sign up failed. Please try again.";
    if (message !== MSG_USERNAME_TAKEN) {
      Sentry.captureException(err, { extra: { context: "signUp DB insert" } });
    }
    return { error: message, values: safeValues };
  }

  redirect("/about");
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

  const { password: _pw, ...safeLoginValues } = raw;

  if (!result.success) {
    return {
      fieldErrors: parseFieldErrors(result.error),
      values: safeLoginValues,
    };
  }

  const { email, password } = result.data;

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: "Invalid email or password.", values: safeLoginValues };
  }

  // Verify the user has a local DB record to prevent a redirect loop
  // (Supabase auth may succeed even if the local user row was deleted)
  const appUser = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.authId, data.user.id))
    .limit(1);

  if (appUser.length === 0) {
    await supabase.auth.signOut();
    return { error: "Invalid email or password.", values: safeLoginValues };
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
    Sentry.captureException(new Error("Password reset email failed"), {
      extra: { supabaseError: error.message },
    });
  }

  return {
    message:
      "If an account exists with this email, you will receive a password reset link. Please check your spam folder if you don't see it.",
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

  const cookieStore = await cookies();
  const resetCookie = cookieStore.get("password_reset");

  if (!resetCookie) {
    return {
      error: "Your reset link has expired. Please request a new one.",
    };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.updateUser({
    password: result.data.password,
  });

  if (error) {
    Sentry.captureException(new Error("Password reset failed"), {
      extra: { context: "resetPassword", supabaseError: error.message },
    });
    return { error: "Failed to reset password. Please try again." };
  }

  cookieStore.delete("password_reset");
  cookieStore.delete("session_start_at");
  cookieStore.delete("last_active_at");
  await supabase.auth.signOut();
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
