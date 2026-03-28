import { getCurrentUser } from "@/lib/auth";
import NavBar from "@/components/nav-bar";
import PublicNavBar from "@/components/public-nav-bar";

export default async function AboutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <>
      {user ? (
        <NavBar
          firstName={user.firstName}
          lastName={user.lastName}
          username={user.username}
          avatarColor={user.avatarColor}
        />
      ) : (
        <PublicNavBar />
      )}
      {children}
    </>
  );
}
