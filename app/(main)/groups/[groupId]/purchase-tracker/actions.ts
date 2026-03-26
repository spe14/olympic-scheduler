"use server";

import { requireMembership, getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  combo,
  comboSession,
  session,
  member,
  user,
  group,
  purchaseTimeslot,
  windowRanking,
  ticketPurchase,
  reportedPrice,
  soldOutSession,
  outOfBudgetSession,
} from "@/lib/db/schema";
import { eq, and, inArray, notInArray, desc, or, ilike } from "drizzle-orm";
import * as Sentry from "@sentry/nextjs";
import { failedAction } from "@/lib/messages";
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
  isSoldOut: boolean;
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

// ── Off-schedule session helper ─────────────────────────────────────────────

async function getOffScheduleSessions(
  groupId: string,
  memberId: string,
  onScheduleSessionCodes: string[],
  excludedCodes: Set<string>
): Promise<OffScheduleSession[]> {
  const [purchasedSessionCodes, reportedSessionCodes, soldOutReportedCodes] =
    await Promise.all([
      db
        .select({ sessionId: ticketPurchase.sessionId })
        .from(ticketPurchase)
        .where(
          and(
            eq(ticketPurchase.groupId, groupId),
            eq(ticketPurchase.purchasedByMemberId, memberId)
          )
        ),
      db
        .select({ sessionId: reportedPrice.sessionId })
        .from(reportedPrice)
        .where(
          and(
            eq(reportedPrice.groupId, groupId),
            eq(reportedPrice.reportedByMemberId, memberId)
          )
        ),
      db
        .select({ sessionId: soldOutSession.sessionId })
        .from(soldOutSession)
        .where(
          and(
            eq(soldOutSession.groupId, groupId),
            eq(soldOutSession.reportedByMemberId, memberId)
          )
        ),
    ]);

  const allTouchedCodes = new Set([
    ...purchasedSessionCodes.map((r) => r.sessionId),
    ...reportedSessionCodes.map((r) => r.sessionId),
    ...soldOutReportedCodes.map((r) => r.sessionId),
  ]);
  // Remove sessions in the current user's combos
  for (const code of onScheduleSessionCodes) {
    allTouchedCodes.delete(code);
  }
  // Remove sessions already in the excluded list
  for (const code of excludedCodes) {
    allTouchedCodes.delete(code);
  }
  const offScheduleCodes = [...allTouchedCodes];

  if (offScheduleCodes.length === 0) return [];

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
    memberId,
    offScheduleCodes
  );

  return offScheduleRows
    .map((row) => ({
      ...row,
      isSoldOut: offSchedulePurchaseData.soldOutSessions.has(row.sessionCode),
      purchases: offSchedulePurchaseData.purchases.get(row.sessionCode) ?? [],
      reportedPrices:
        offSchedulePurchaseData.reportedPrices.get(row.sessionCode) ?? [],
    }))
    .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));
}

// ── Data fetching ───────────────────────────────────────────────────────────

export async function getPurchaseTrackerData(
  groupId: string
): Promise<{ data?: PurchaseTrackerData; error?: string }> {
  const { membership, error: authError } = await requireMembership(groupId);
  if (authError) return { error: authError.error };

  try {
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
      // No combos yet (schedules not generated), but still fetch off-schedule
      // sessions so users can track purchases made before using the app.
      const [activeMembers, offScheduleSessions] = await Promise.all([
        db
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
          ),
        getOffScheduleSessions(groupId, membership.id, [], new Set()),
      ]);
      return {
        data: {
          days: [],
          members: activeMembers.map((m) => ({
            memberId: m.memberId,
            firstName: m.firstName,
            lastName: m.lastName,
            avatarColor: m.avatarColor as AvatarColor,
          })),
          windowRankings: [],
          offScheduleSessions,
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
          purchasePlanEntries:
            purchaseData.planEntries.get(cs.sessionCode) ?? [],
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
    const storedExcludedCodes = storedExcluded
      .map((e) => e.code)
      .filter(Boolean);
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
      .select({
        sessionCode: outOfBudgetSession.sessionId,
        createdAt: outOfBudgetSession.createdAt,
      })
      .from(outOfBudgetSession)
      .where(
        and(
          eq(outOfBudgetSession.groupId, groupId),
          eq(outOfBudgetSession.memberId, membership.id)
        )
      );

    // Fetch group-level generation data for determining "at generation" status
    const [groupRow] = await db
      .select({
        scheduleGeneratedAt: group.scheduleGeneratedAt,
        soldOutCodesAtGeneration: group.soldOutCodesAtGeneration,
      })
      .from(group)
      .where(eq(group.id, groupId))
      .limit(1);
    const scheduleGeneratedAt = groupRow?.scheduleGeneratedAt;
    const soldOutAtGen = new Set(
      (groupRow?.soldOutCodesAtGeneration as string[] | null) ?? []
    );

    const onScheduleCodes = new Set(sessionCodes);
    const soldOutSet = new Set(soldOutRows.map((r) => r.sessionCode));
    const oobSet = new Set(oobRows.map((r) => r.sessionCode));

    // Build createdAt map for OOB marks (used for per-member timestamp comparison)
    const oobCreatedAt = new Map(
      oobRows.map((r) => [r.sessionCode, r.createdAt])
    );

    // Excluded sessions = what was actually excluded from the last generation.
    // Sources:
    //   1. storedExcludedCodes — per-member snapshot of sessions excluded at generation
    //   2. soldOutAtGen — group-wide sold-out codes recorded at generation time
    // We do NOT add sessions from the current soldOutSet/oobSet that haven't been
    // through a generation cycle yet. Those sessions haven't been "excluded" from
    // any generation — the amber notification on the overview page handles alerting
    // users that purchase data changed and regeneration may be needed.
    const excludedCodes = new Set([
      ...storedExcludedCodes,
      ...[...soldOutAtGen].filter((c) => !onScheduleCodes.has(c)),
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

      const storedCodeSet = new Set(storedExcludedCodes);
      for (const [code, s] of sessionMap) {
        const inSnapshot = storedCodeSet.has(code);
        // For sessions in the member's stored snapshot, use the snapshot flags.
        // For sessions NOT in the snapshot (e.g. sold-out sessions the member
        // never had in their preferences), use the group-level
        // soldOutCodesAtGeneration to determine "at generation" status. For OOB
        // (per-member), use createdAt vs scheduleGeneratedAt as fallback.
        const oobBeforeGen =
          scheduleGeneratedAt && oobCreatedAt.has(code)
            ? oobCreatedAt.get(code)! <= scheduleGeneratedAt
            : false;

        excludedSessions.push({
          ...s,
          isSoldOut: soldOutSet.has(code),
          isOutOfBudget: oobSet.has(code),
          wasSoldOut: inSnapshot
            ? storedSoldOutSet.has(code)
            : soldOutAtGen.has(code),
          wasOutOfBudget: inSnapshot ? storedOobSet.has(code) : oobBeforeGen,
          purchases: excludedPurchaseData.purchases.get(code) ?? [],
          reportedPrices: excludedPurchaseData.reportedPrices.get(code) ?? [],
        });
      }

      excludedSessions.sort((a, b) =>
        a.sessionCode.localeCompare(b.sessionCode)
      );
    }

    const offScheduleSessions = await getOffScheduleSessions(
      groupId,
      membership.id,
      sessionCodes,
      excludedCodes
    );

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
  } catch (err) {
    Sentry.captureException(err, {
      extra: { context: "getPurchaseTrackerData", groupId },
    });
    return { error: failedAction("load purchase tracker") };
  }
}

// ── Session lookup for off-schedule purchases ───────────────────────────────

export async function lookupSession(
  sessionCode: string,
  groupId: string
): Promise<{ data?: OffScheduleSession; error?: string }> {
  const { membership, error: authError } = await requireMembership(groupId);
  if (authError) return { error: authError.error };

  try {
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

    const purchaseData = await getPurchaseDataForSessions(
      groupId,
      membership.id,
      [sessionCode]
    );

    return {
      data: {
        ...row,
        isSoldOut: purchaseData.soldOutSessions.has(sessionCode),
        purchases: purchaseData.purchases.get(sessionCode) ?? [],
        reportedPrices: purchaseData.reportedPrices.get(sessionCode) ?? [],
      },
    };
  } catch (err) {
    Sentry.captureException(err, {
      extra: { context: "lookupSession", groupId, sessionCode },
    });
    return { error: failedAction("look up session") };
  }
}

export type SessionSuggestion = {
  sessionCode: string;
  sport: string;
  sessionType: string;
};

export async function searchSessionCodes(
  query: string
): Promise<{ data: SessionSuggestion[]; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { data: [] };

  const trimmed = query.trim();
  if (!trimmed) return { data: [] };

  try {
    // Escape SQL LIKE wildcards
    const escaped = trimmed.replace(/[%_\\]/g, (ch) => `\\${ch}`);
    const rows = await db
      .select({
        sessionCode: session.sessionCode,
        sport: session.sport,
        sessionType: session.sessionType,
      })
      .from(session)
      .where(ilike(session.sessionCode, `${escaped}%`))
      .orderBy(session.sessionCode)
      .limit(25);
    return { data: rows };
  } catch (err) {
    Sentry.captureException(err, {
      extra: { context: "searchSessionCodes" },
    });
    return {
      data: [],
      error:
        "There was an unexpected error while searching. Please refresh the page and try again.",
    };
  }
}
