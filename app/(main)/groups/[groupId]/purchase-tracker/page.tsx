import { getCurrentUser } from "@/lib/auth";
import { notFound } from "next/navigation";
import { getGroupDetail } from "@/lib/queries/get-group-detail";
import { GroupProvider } from "../_components/group-context";
import PurchaseTrackerContent from "./purchase-tracker-content";

export default async function PurchaseTrackerPage({
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
      <PurchaseTrackerContent />
    </GroupProvider>
  );
}
