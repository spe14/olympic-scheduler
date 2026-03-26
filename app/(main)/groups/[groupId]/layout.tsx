import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { notFound } from "next/navigation";
import GroupShell from "./_components/group-shell";
import { getGroupDetail } from "@/lib/queries/get-group-detail";

export default async function GroupLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ groupId: string }>;
}) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    notFound();
  }

  const { groupId } = await params;
  const group = await getGroupDetail(groupId, currentUser.id);

  if (!group) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-black">
            This group was deleted.
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            The group you&apos;re looking for no longer exists.
          </p>
          <Link
            href="/groups"
            className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-[#009de5] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0080be]"
          >
            Back to Groups
          </Link>
        </div>
      </div>
    );
  }

  return <GroupShell group={group}>{children}</GroupShell>;
}
