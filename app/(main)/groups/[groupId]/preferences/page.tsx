import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { member, buddyConstraint, session } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import PreferenceWizard from "./_components/preference-wizard";

export default async function PreferencesPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const currentUser = await getCurrentUser();
  if (!currentUser) notFound();

  const { groupId } = await params;

  // Fetch current member data
  const [myMember] = await db
    .select({
      id: member.id,
      budget: member.budget,
      minBuddies: member.minBuddies,
      sportRankings: member.sportRankings,
      preferenceStep: member.preferenceStep,
      status: member.status,
    })
    .from(member)
    .where(and(eq(member.groupId, groupId), eq(member.userId, currentUser.id)))
    .limit(1);

  if (!myMember) notFound();

  // Fetch existing buddy constraints
  const existingBuddies = await db
    .select({
      buddyMemberId: buddyConstraint.buddyMemberId,
      type: buddyConstraint.type,
    })
    .from(buddyConstraint)
    .where(eq(buddyConstraint.memberId, myMember.id));

  // Fetch distinct sports from session table
  const sportsResult = await db
    .selectDistinct({ sport: session.sport })
    .from(session);
  const availableSports = sportsResult
    .map((s) => s.sport)
    .sort((a, b) => a.localeCompare(b));

  return (
    <PreferenceWizard
      initialBudget={myMember.budget}
      initialMinBuddies={myMember.minBuddies}
      initialBuddies={existingBuddies.map((b) => ({
        memberId: b.buddyMemberId,
        type: b.type,
      }))}
      initialSportRankings={(myMember.sportRankings as string[]) ?? []}
      initialPreferenceStep={myMember.preferenceStep}
      initialStatus={myMember.status}
      availableSports={availableSports}
    />
  );
}
