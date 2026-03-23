"use server";

import { requireMembership, getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  combo,
  comboSession,
  session,
  member,
  user,
  purchaseTimeslot,
  windowRanking,
  ticketPurchase,
  reportedPrice,
  soldOutSession,
  outOfBudgetSession,
} from "@/lib/db/schema";
import { eq, and, inArray, notInArray, desc, or, ilike } from "drizzle-orm";
import type { AvatarColor } from "@/lib/constants";
import type { BaseMemberInfo } from "@/lib/types";
import {
  getPurchaseDataForSessions,
  type PurchasePlanEntryData,
  type PurchaseData,
  type ReportedPriceData,
} from "../schedule/purchase-actions";

// ── Types ───────────────────────────────────────────────────────────────────

export type TrackerInterestedMember = BaseMemberInfo;

export type TrackerSession = {
  sessionCode: string;
  sport: string;
  sessionType: string;
  sessionDescription: string | null;
  venue: string;
  zone: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  interestedMembers: TrackerInterestedMember[];
  purchasePlanEntries: PurchasePlanEntryData[];
  purchases: PurchaseData[];
  isSoldOut: boolean;
  isOutOfBudget: boolean;
  reportedPrices: ReportedPriceData[];
};

export type TrackerDay = {
  day: string;
  primaryScore: number;
  primary: TrackerSession[];
  backup1: TrackerSession[];
  backup2: TrackerSession[];
};

export type TrackerMember = BaseMemberInfo;

export type TrackerWindowRanking = {
  id: string;
  startDate: string;
  endDate: string;
  score: number;
  selected: boolean;
};

export type OffScheduleSession = {
  sessionCode: string;
  sport: string;
  sessionType: string;
  sessionDescription: string | null;
  venue: string;
  zone: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  purchases: PurchaseData[];
  reportedPrices: ReportedPriceData[];
};

export type ExcludedSession = {
  sessionCode: string;
  sport: string;
  sessionType: string;
  sessionDescription: string | null;
  venue: string;
  zone: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  isSoldOut: boolean;
  isOutOfBudget: boolean;
  wasSoldOut: boolean;
  wasOutOfBudget: boolean;
  purchases: PurchaseData[];
  reportedPrices: ReportedPriceData[];
};

export type PurchaseTrackerData = {
  days: TrackerDay[];
  members: TrackerMember[];
  windowRankings: TrackerWindowRanking[];
  offScheduleSessions: OffScheduleSession[];
  excludedSessions: ExcludedSession[];
  hasTimeslot: boolean;
};

// ── Data fetching ───────────────────────────────────────────────────────────

export async function getPurchaseTrackerData(
  groupId: string
): Promise<{ data?: PurchaseTrackerData; error?: string }> {
  const { membership, error: authError } = await requireMembership(groupId);
  if (authError) return authError;

  // Check if user has a timeslot
  const [timeslotRow] = await db
    .select({ id: purchaseTimeslot.id })
    .from(purchaseTimeslot)
    .where(
      and(
        eq(purchaseTimeslot.memberId, membership.id),
        eq(purchaseTimeslot.groupId, groupId)
      )
    )
    .limit(1);

  const hasTimeslot = !!timeslotRow;

  // Fetch user's combos
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
    return {
      data: {
        days: [],
        members: [],
        windowRankings: [],
        offScheduleSessions: [],
        excludedSessions: [],
        hasTimeslot,
      },
    };
  }

  const comboIds = combos.map((c) => c.comboId);

  // Fetch sessions for all combos
  const allComboSessions = await db
    .select({
      comboId: comboSession.comboId,
      sessionCode: session.sessionCode,
      sport: session.sport,
      sessionType: session.sessionType,
      sessionDescription: session.sessionDescription,
      venue: session.venue,
      zone: session.zone,
      sessionDate: session.sessionDate,
      startTime: session.startTime,
      endTime: session.endTime,
    })
    .from(comboSession)
    .innerJoin(session, eq(comboSession.sessionId, session.sessionCode))
    .where(inArray(comboSession.comboId, comboIds));

  const sessionCodes = [
    ...new Set(allComboSessions.map((cs) => cs.sessionCode)),
  ];

  // Fetch interested members — all members who have each session in any combo
  const interestedRows =
    sessionCodes.length > 0
      ? await db
          .select({
            sessionId: comboSession.sessionId,
            memberId: combo.memberId,
            firstName: user.firstName,
            lastName: user.lastName,
            avatarColor: user.avatarColor,
          })
          .from(comboSession)
          .innerJoin(combo, eq(comboSession.comboId, combo.id))
          .innerJoin(member, eq(combo.memberId, member.id))
          .innerJoin(user, eq(member.userId, user.id))
          .where(
            and(
              eq(combo.groupId, groupId),
              inArray(comboSession.sessionId, sessionCodes)
            )
          )
      : [];

  // Build interested members map: sessionCode → deduplicated members
  const interestedMap = new Map<string, TrackerInterestedMember[]>();
  for (const row of interestedRows) {
    const list = interestedMap.get(row.sessionId) ?? [];
    if (!list.some((m) => m.memberId === row.memberId)) {
      list.push({
        memberId: row.memberId,
        firstName: row.firstName,
        lastName: row.lastName,
        avatarColor: row.avatarColor as AvatarColor,
      });
    }
    interestedMap.set(row.sessionId, list);
  }

  // Fetch purchase data
  const purchaseData = await getPurchaseDataForSessions(
    groupId,
    membership.id,
    sessionCodes
  );

  // Fetch group members (for buy-for checkboxes)
  const activeMembers = await db
    .select({
      memberId: member.id,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarColor: user.avatarColor,
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(
      and(
        eq(member.groupId, groupId),
        notInArray(member.status, ["pending_approval", "denied"])
      )
    );

  // Fetch window rankings
  const windows = await db
    .select({
      id: windowRanking.id,
      startDate: windowRanking.startDate,
      endDate: windowRanking.endDate,
      score: windowRanking.score,
      selected: windowRanking.selected,
    })
    .from(windowRanking)
    .where(eq(windowRanking.groupId, groupId))
    .orderBy(desc(windowRanking.score));

  // Group combos by day
  const dayMap = new Map<
    string,
    {
      primaryScore: number;
      primary: TrackerSession[];
      backup1: TrackerSession[];
      backup2: TrackerSession[];
    }
  >();

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
        sessionDate: cs.sessionDate,
        startTime: cs.startTime,
        endTime: cs.endTime,
        interestedMembers: interestedMap.get(cs.sessionCode) ?? [],
        purchasePlanEntries: purchaseData.planEntries.get(cs.sessionCode) ?? [],
        purchases: purchaseData.purchases.get(cs.sessionCode) ?? [],
        isSoldOut: purchaseData.soldOutSessions.has(cs.sessionCode),
        isOutOfBudget: purchaseData.outOfBudgetSessions.has(cs.sessionCode),
        reportedPrices: purchaseData.reportedPrices.get(cs.sessionCode) ?? [],
      }))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    const existing = dayMap.get(c.day) ?? {
      primaryScore: 0,
      primary: [],
      backup1: [],
      backup2: [],
    };

    if (c.rank === "primary") {
      existing.primary = sessions;
      existing.primaryScore = c.score;
    } else if (c.rank === "backup1") {
      existing.backup1 = sessions;
    } else if (c.rank === "backup2") {
      existing.backup2 = sessions;
    }

    dayMap.set(c.day, existing);
  }

  // Sort days by primary score descending
  const days: TrackerDay[] = [...dayMap.entries()]
    .map(([day, data]) => ({ day, ...data }))
    .sort((a, b) => b.primaryScore - a.primaryScore);

  // Find off-schedule sessions: sessions with purchases or reported prices
  // by the current member that are NOT in any of the current user's combos.
  // Also exclude sessions that appear in any group member's combo — those
  // are still "on-schedule" and their purchase data is shown in the main
  // tracker section (e.g. a session purchased then marked sold out, which
  // drops it from combos on regeneration but it's still visible on the
  // tracker via another member's combo).
  const purchasedSessionCodes = await db
    .select({ sessionId: ticketPurchase.sessionId })
    .from(ticketPurchase)
    .where(
      and(
        eq(ticketPurchase.groupId, groupId),
        eq(ticketPurchase.purchasedByMemberId, membership.id)
      )
    );
  const reportedSessionCodes = await db
    .select({ sessionId: reportedPrice.sessionId })
    .from(reportedPrice)
    .where(
      and(
        eq(reportedPrice.groupId, groupId),
        eq(reportedPrice.reportedByMemberId, membership.id)
      )
    );
  const allTouchedCodes = new Set([
    ...purchasedSessionCodes.map((r) => r.sessionId),
    ...reportedSessionCodes.map((r) => r.sessionId),
  ]);
  // Remove sessions in the current user's combos
  for (const code of sessionCodes) {
    allTouchedCodes.delete(code);
  }
  // Also remove sessions that appear in ANY group member's combo
  if (allTouchedCodes.size > 0) {
    const groupComboSessionRows = await db
      .select({ sessionId: comboSession.sessionId })
      .from(comboSession)
      .innerJoin(combo, eq(comboSession.comboId, combo.id))
      .where(
        and(
          eq(combo.groupId, groupId),
          inArray(comboSession.sessionId, [...allTouchedCodes])
        )
      );
    for (const row of groupComboSessionRows) {
      allTouchedCodes.delete(row.sessionId);
    }
  }
  const offScheduleCodes = [...allTouchedCodes];

  let offScheduleSessions: OffScheduleSession[] = [];
  if (offScheduleCodes.length > 0) {
    const offScheduleRows = await db
      .select({
        sessionCode: session.sessionCode,
        sport: session.sport,
        sessionType: session.sessionType,
        sessionDescription: session.sessionDescription,
        venue: session.venue,
        zone: session.zone,
        sessionDate: session.sessionDate,
        startTime: session.startTime,
        endTime: session.endTime,
      })
      .from(session)
      .where(inArray(session.sessionCode, offScheduleCodes));

    const offSchedulePurchaseData = await getPurchaseDataForSessions(
      groupId,
      membership.id,
      offScheduleCodes
    );

    offScheduleSessions = offScheduleRows
      .map((row) => ({
        ...row,
        purchases: offSchedulePurchaseData.purchases.get(row.sessionCode) ?? [],
        reportedPrices:
          offSchedulePurchaseData.reportedPrices.get(row.sessionCode) ?? [],
      }))
      .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));
  }

  // Excluded sessions: use the stored list from last generation, then check
  // current sold-out/OOB status (which may have changed since generation)
  const [memberRow] = await db
    .select({ excludedSessionCodes: member.excludedSessionCodes })
    .from(member)
    .where(eq(member.id, membership.id))
    .limit(1);
  // Handle both old format (string[]) and new format ({ code, soldOut, outOfBudget }[])
  const rawExcluded = Array.isArray(memberRow?.excludedSessionCodes)
    ? memberRow.excludedSessionCodes
    : [];
  const storedExcluded = rawExcluded.map((e: unknown) =>
    typeof e === "string"
      ? { code: e, soldOut: false, outOfBudget: false }
      : (e as { code: string; soldOut: boolean; outOfBudget: boolean })
  );
  const storedExcludedCodes = storedExcluded.map((e) => e.code).filter(Boolean);
  const storedSoldOutSet = new Set(
    storedExcluded.filter((e) => e.soldOut).map((e) => e.code)
  );
  const storedOobSet = new Set(
    storedExcluded.filter((e) => e.outOfBudget).map((e) => e.code)
  );

  // Also include any sessions currently marked sold-out or OOB that aren't
  // in the user's combos (new marks since last generation)
  const soldOutRows = await db
    .select({ sessionCode: soldOutSession.sessionId })
    .from(soldOutSession)
    .where(eq(soldOutSession.groupId, groupId));

  const oobRows = await db
    .select({ sessionCode: outOfBudgetSession.sessionId })
    .from(outOfBudgetSession)
    .where(
      and(
        eq(outOfBudgetSession.groupId, groupId),
        eq(outOfBudgetSession.memberId, membership.id)
      )
    );

  const onScheduleCodes = new Set(sessionCodes);
  const soldOutSet = new Set(soldOutRows.map((r) => r.sessionCode));
  const oobSet = new Set(oobRows.map((r) => r.sessionCode));

  // Combine stored excluded codes + any new off-schedule sold-out/OOB marks
  const excludedCodes = new Set([
    ...storedExcludedCodes,
    ...[...soldOutSet].filter((c) => !onScheduleCodes.has(c)),
    ...[...oobSet].filter((c) => !onScheduleCodes.has(c)),
  ]);

  let excludedSessions: ExcludedSession[] = [];
  if (excludedCodes.size > 0) {
    const excludedSessionRows = await db
      .select({
        sessionCode: session.sessionCode,
        sport: session.sport,
        sessionType: session.sessionType,
        sessionDescription: session.sessionDescription,
        venue: session.venue,
        zone: session.zone,
        sessionDate: session.sessionDate,
        startTime: session.startTime,
        endTime: session.endTime,
      })
      .from(session)
      .where(inArray(session.sessionCode, [...excludedCodes]));

    const excludedPurchaseData = await getPurchaseDataForSessions(
      groupId,
      membership.id,
      [...excludedCodes]
    );

    const sessionMap = new Map(
      excludedSessionRows.map((r) => [r.sessionCode, r])
    );

    for (const [code, s] of sessionMap) {
      excludedSessions.push({
        ...s,
        isSoldOut: soldOutSet.has(code),
        isOutOfBudget: oobSet.has(code),
        wasSoldOut: storedSoldOutSet.has(code),
        wasOutOfBudget: storedOobSet.has(code),
        purchases: excludedPurchaseData.purchases.get(code) ?? [],
        reportedPrices: excludedPurchaseData.reportedPrices.get(code) ?? [],
      });
    }

    excludedSessions.sort((a, b) => a.sessionCode.localeCompare(b.sessionCode));
  }

  return {
    data: {
      days,
      members: activeMembers.map((m) => ({
        memberId: m.memberId,
        firstName: m.firstName,
        lastName: m.lastName,
        avatarColor: m.avatarColor as AvatarColor,
      })),
      windowRankings: windows.slice(0, 3),
      offScheduleSessions,
      excludedSessions,
      hasTimeslot,
    },
  };
}

// ── Session lookup for off-schedule purchases ───────────────────────────────

export type LookedUpSession = {
  sessionCode: string;
  sport: string;
  sessionType: string;
  sessionDescription: string | null;
  venue: string;
  zone: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
};

export async function lookupSession(
  sessionCode: string
): Promise<{ data?: LookedUpSession; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated." };

  const [row] = await db
    .select({
      sessionCode: session.sessionCode,
      sport: session.sport,
      sessionType: session.sessionType,
      sessionDescription: session.sessionDescription,
      venue: session.venue,
      zone: session.zone,
      sessionDate: session.sessionDate,
      startTime: session.startTime,
      endTime: session.endTime,
    })
    .from(session)
    .where(eq(session.sessionCode, sessionCode))
    .limit(1);

  if (!row) return { error: "Session not found." };
  return { data: row };
}

export type SessionSuggestion = {
  sessionCode: string;
  sport: string;
  sessionType: string;
};

export async function searchSessionCodes(
  query: string
): Promise<SessionSuggestion[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  if (!query.trim()) return [];
  const rows = await db
    .select({
      sessionCode: session.sessionCode,
      sport: session.sport,
      sessionType: session.sessionType,
    })
    .from(session)
    .where(ilike(session.sessionCode, `${query.trim()}%`))
    .orderBy(session.sessionCode)
    .limit(25);
  return rows;
}
