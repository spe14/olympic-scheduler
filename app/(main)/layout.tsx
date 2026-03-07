import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import NavBar from "@/components/nav-bar";

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
      <NavBar
        firstName={user.firstName}
        lastName={user.lastName}
        username={user.username}
        avatarColor={user.avatarColor}
      />
      {children}
    </>
  );
}
