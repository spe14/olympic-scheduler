import { getCurrentUser } from "@/lib/auth";
import { notFound } from "next/navigation";
import { getGroupDetail } from "@/lib/queries/get-group-detail";
import { GroupProvider } from "../_components/group-context";
import GroupScheduleContent from "./group-schedule-content";

export default async function GroupSchedulePage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const currentUser = await getCurrentUser();
  if (!currentUser) notFound();

  const { groupId } = await params;
  const group = await getGroupDetail(groupId, currentUser.id);
  if (!group) notFound();

  return (
    <GroupProvider group={group}>
      <GroupScheduleContent />
    </GroupProvider>
  );
}
