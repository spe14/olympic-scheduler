import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  member,
  buddyConstraint,
  session,
  sessionPreference,
} from "@/lib/db/schema";
import { eq, and, inArray, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getGroupDetail } from "@/lib/queries/get-group-detail";
import { GroupProvider } from "../_components/group-context";
import PreferenceWizard from "./_components/preference-wizard";

export default async function PreferencesPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const currentUser = await getCurrentUser();
  if (!currentUser) notFound();

  const { groupId } = await params;

  const group = await getGroupDetail(groupId, currentUser.id);
  if (!group) notFound();

  // Round 1: myMember + available sports in parallel (independent)
  const [myMemberResult, sportsResult] = await Promise.all([
    db
      .select({
        id: member.id,
        minBuddies: member.minBuddies,
        sportRankings: member.sportRankings,
        preferenceStep: member.preferenceStep,
        status: member.status,
      })
      .from(member)
      .where(
        and(eq(member.groupId, groupId), eq(member.userId, currentUser.id))
      )
      .limit(1),
    db.selectDistinct({ sport: session.sport }).from(session),
  ]);

  const [myMember] = myMemberResult;
  if (!myMember) notFound();

  const availableSports = sportsResult
    .map((s) => s.sport)
    .sort((a, b) => a.localeCompare(b));

  // Round 2: buddies + sessions + session preferences in parallel (all depend on myMember)
  const sportRankings = (myMember.sportRankings as string[]) ?? [];
  const [existingBuddies, sessions, existingSessionPreferences] =
    await Promise.all([
      db
        .select({
          buddyMemberId: buddyConstraint.buddyMemberId,
          type: buddyConstraint.type,
        })
        .from(buddyConstraint)
        .where(eq(buddyConstraint.memberId, myMember.id)),
      sportRankings.length > 0
        ? db
            .select({
              sessionCode: session.sessionCode,
              sport: session.sport,
              venue: session.venue,
              zone: session.zone,
              sessionDate: session.sessionDate,
              sessionType: session.sessionType,
              sessionDescription: session.sessionDescription,
              startTime: session.startTime,
              endTime: session.endTime,
            })
            .from(session)
            .where(inArray(session.sport, sportRankings))
            .orderBy(asc(session.sessionDate), asc(session.startTime))
        : Promise.resolve([]),
      db
        .select({
          sessionId: sessionPreference.sessionId,
          interest: sessionPreference.interest,
        })
        .from(sessionPreference)
        .where(eq(sessionPreference.memberId, myMember.id)),
    ]);

  return (
    <GroupProvider group={group}>
      <PreferenceWizard
        initialMinBuddies={myMember.minBuddies}
        initialBuddies={existingBuddies.map((b) => ({
          memberId: b.buddyMemberId,
          type: b.type,
        }))}
        initialSportRankings={sportRankings}
        initialPreferenceStep={myMember.preferenceStep}
        initialStatus={myMember.status}
        availableSports={availableSports}
        sessions={sessions}
        initialSessionPreferences={existingSessionPreferences}
      />
    </GroupProvider>
  );
}
