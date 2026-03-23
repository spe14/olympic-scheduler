"use server";

import { requireMembership } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  combo,
  comboSession,
  member,
  session,
  sessionPreference,
  user,
} from "@/lib/db/schema";
import { purchaseTimeslot } from "@/lib/db/schema";
import { eq, and, inArray, ne } from "drizzle-orm";
import type { AvatarColor } from "@/lib/constants";
import { groupBy } from "@/lib/utils";
import type { BaseMemberInfo } from "@/lib/types";
import {
  getPurchaseDataForSessions,
  type PurchasePlanEntryData,
  type PurchaseData,
  type ReportedPriceData,
  type TimeslotData,
} from "./purchase-actions";

export type InterestedMember = BaseMemberInfo & {
  username: string;
};

export type ScheduledMember = BaseMemberInfo & {
  username: string;
  ranks: ("primary" | "backup1" | "backup2")[];
};

export type ScheduleSession = {
  sessionCode: string;
  sport: string;
  sessionType: string;
  sessionDescription: string | null;
  venue: string;
  zone: string;
  startTime: string;
  endTime: string;
  interest: "low" | "medium" | "high";
  scheduledMembers: ScheduledMember[];
  interestedMembers: InterestedMember[];
  // Phase 2 purchase data
  purchasePlanEntries: PurchasePlanEntryData[];
  purchases: PurchaseData[];
  isSoldOut: boolean;
  isOutOfBudget: boolean;
  reportedPrices: ReportedPriceData[];
};

export type ScheduleCombo = {
  rank: "primary" | "backup1" | "backup2";
  score: number;
  sessions: ScheduleSession[];
};

export type ScheduleDay = {
  day: string;
  combos: ScheduleCombo[];
  primaryScore: number;
};

export async function getMySchedule(groupId: string): Promise<{
  data?: ScheduleDay[];
  timeslot?: TimeslotData | null;
  error?: string;
}> {
  const { membership, error: authError } = await requireMembership(groupId);
  if (authError) return authError;

  const combos = await db
    .select({
      comboId: combo.id,
      day: combo.day,
      rank: combo.rank,
      score: combo.score,
    })
    .from(combo)
    .where(and(eq(combo.groupId, groupId), eq(combo.memberId, membership.id)))
    .orderBy(combo.day, combo.rank);

  if (combos.length === 0) {
    return { data: [] };
  }

  const comboIds = combos.map((c) => c.comboId);

  const allComboSessions = await db
    .select({
      comboId: comboSession.comboId,
      sessionCode: session.sessionCode,
      sport: session.sport,
      sessionType: session.sessionType,
      sessionDescription: session.sessionDescription,
      venue: session.venue,
      zone: session.zone,
      startTime: session.startTime,
      endTime: session.endTime,
    })
    .from(comboSession)
    .innerJoin(session, eq(comboSession.sessionId, session.sessionCode))
    .where(inArray(comboSession.comboId, comboIds));

  const sessionCodes = [
    ...new Set(allComboSessions.map((cs) => cs.sessionCode)),
  ];

  const prefs =
    sessionCodes.length > 0
      ? await db
          .select({
            sessionId: sessionPreference.sessionId,
            interest: sessionPreference.interest,
          })
          .from(sessionPreference)
          .where(
            and(
              eq(sessionPreference.memberId, membership.id),
              inArray(sessionPreference.sessionId, sessionCodes)
            )
          )
      : [];

  const interestMap = new Map(prefs.map((p) => [p.sessionId, p.interest]));

  // Fetch other interested members for all sessions in one query
  const interestedRows =
    sessionCodes.length > 0
      ? await db
          .select({
            sessionId: sessionPreference.sessionId,
            memberId: sessionPreference.memberId,
            firstName: user.firstName,
            lastName: user.lastName,
            username: user.username,
            avatarColor: user.avatarColor,
          })
          .from(sessionPreference)
          .innerJoin(member, eq(sessionPreference.memberId, member.id))
          .innerJoin(user, eq(member.userId, user.id))
          .where(
            and(
              inArray(sessionPreference.sessionId, sessionCodes),
              eq(member.groupId, groupId),
              ne(sessionPreference.memberId, membership.id)
            )
          )
      : [];

  const interestedMap = groupBy(
    interestedRows,
    (r) => r.sessionId,
    (row): InterestedMember => ({
      memberId: row.memberId,
      firstName: row.firstName,
      lastName: row.lastName,
      username: row.username,
      avatarColor: row.avatarColor as AvatarColor,
    })
  );

  // Fetch other members' combo assignments for sessions in current user's combos
  const scheduledRows =
    sessionCodes.length > 0
      ? await db
          .select({
            sessionId: comboSession.sessionId,
            memberId: combo.memberId,
            rank: combo.rank,
            firstName: user.firstName,
            lastName: user.lastName,
            username: user.username,
            avatarColor: user.avatarColor,
          })
          .from(comboSession)
          .innerJoin(combo, eq(comboSession.comboId, combo.id))
          .innerJoin(member, eq(combo.memberId, member.id))
          .innerJoin(user, eq(member.userId, user.id))
          .where(
            and(
              inArray(comboSession.sessionId, sessionCodes),
              eq(combo.groupId, groupId),
              ne(combo.memberId, membership.id)
            )
          )
      : [];

  // Build scheduledMembers map: sessionCode → member with all ranks collected
  const scheduledMap = new Map<string, ScheduledMember[]>();
  for (const row of scheduledRows) {
    const list = scheduledMap.get(row.sessionId) ?? [];
    const existing = list.find((m) => m.memberId === row.memberId);
    if (existing) {
      if (!existing.ranks.includes(row.rank)) {
        existing.ranks.push(row.rank);
      }
    } else {
      list.push({
        memberId: row.memberId,
        firstName: row.firstName,
        lastName: row.lastName,
        username: row.username,
        avatarColor: row.avatarColor as AvatarColor,
        ranks: [row.rank],
      });
      scheduledMap.set(row.sessionId, list);
    }
  }

  // Fetch purchase data for all sessions
  const purchaseData = await getPurchaseDataForSessions(
    groupId,
    membership.id,
    sessionCodes
  );

  // Fetch timeslot for current user
  const [timeslotRow] = await db
    .select()
    .from(purchaseTimeslot)
    .where(
      and(
        eq(purchaseTimeslot.memberId, membership.id),
        eq(purchaseTimeslot.groupId, groupId)
      )
    )
    .limit(1);

  const timeslot: TimeslotData | null = timeslotRow
    ? {
        id: timeslotRow.id,
        timeslotStart: timeslotRow.timeslotStart,
        timeslotEnd: timeslotRow.timeslotEnd,
        status: timeslotRow.status,
      }
    : null;

  // Group combos by day
  const dayMap = new Map<string, ScheduleCombo[]>();
  for (const c of combos) {
    const sessions = allComboSessions
      .filter((cs) => cs.comboId === c.comboId)
      .map((cs) => ({
        sessionCode: cs.sessionCode,
        sport: cs.sport,
        sessionType: cs.sessionType,
        sessionDescription: cs.sessionDescription,
        venue: cs.venue,
        zone: cs.zone,
        startTime: cs.startTime,
        endTime: cs.endTime,
        interest: interestMap.get(cs.sessionCode) ?? "medium",
        scheduledMembers: scheduledMap.get(cs.sessionCode) ?? [],
        interestedMembers: interestedMap.get(cs.sessionCode) ?? [],
        purchasePlanEntries: purchaseData.planEntries.get(cs.sessionCode) ?? [],
        purchases: purchaseData.purchases.get(cs.sessionCode) ?? [],
        isSoldOut: purchaseData.soldOutSessions.has(cs.sessionCode),
        isOutOfBudget: purchaseData.outOfBudgetSessions.has(cs.sessionCode),
        reportedPrices: purchaseData.reportedPrices.get(cs.sessionCode) ?? [],
      }))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    const existing = dayMap.get(c.day) ?? [];
    existing.push({ rank: c.rank, score: c.score, sessions });
    dayMap.set(c.day, existing);
  }

  const data: ScheduleDay[] = [...dayMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, dayCombos]) => {
      const primaryCombo = dayCombos.find((c) => c.rank === "primary");
      return {
        day,
        combos: dayCombos,
        primaryScore: primaryCombo?.score ?? 0,
      };
    });

  return { data, timeslot };
}
