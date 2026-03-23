import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import ResetPasswordForm from "./reset-password-form";

export default async function ResetPasswordPage() {
  const cookieStore = await cookies();
  const resetCookie = cookieStore.get("password_reset");

  if (!resetCookie) {
    redirect("/forgot-password");
  }

  return <ResetPasswordForm />;
}
