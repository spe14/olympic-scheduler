import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PublicNavBar from "@/components/public-nav-bar";

export default async function GuestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/");
  }

  return (
    <>
      <PublicNavBar />
      {children}
    </>
  );
}
