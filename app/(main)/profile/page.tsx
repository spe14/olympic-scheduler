import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import ProfileForm from "./_components/profile-form";

export default async function ProfilePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-slate-50 px-6 py-10">
      <div className="flex flex-1 flex-col">
        <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">
          Profile
        </h1>
        <p className="text-md mb-8 text-slate-500">
          Manage your account information
        </p>

        <ProfileForm
          email={user.email}
          username={user.username}
          firstName={user.firstName}
          lastName={user.lastName}
          avatarColor={user.avatarColor}
        />
      </div>
    </div>
  );
}
