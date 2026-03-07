import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import ProfileForm from "./profile-form";

export default async function ProfilePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-6xl">
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
