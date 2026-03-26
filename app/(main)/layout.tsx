import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import NavBar from "@/components/nav-bar";
import InactivityGuard from "@/components/inactivity-guard";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <>
      <InactivityGuard />
      <NavBar
        firstName={user.firstName}
        lastName={user.lastName}
        username={user.username}
        avatarColor={user.avatarColor}
      />
      <div className="flex min-h-[60vh] items-center justify-center px-6 md:hidden">
        <p className="text-center text-sm text-slate-500">
          Collaboly is designed for desktop use. Please open this page on a
          computer for the best experience.
        </p>
      </div>
      <div className="hidden md:block">{children}</div>
    </>
  );
}
