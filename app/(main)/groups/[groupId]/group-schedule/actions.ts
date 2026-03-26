"use server";

import { requireMembership } from "@/lib/auth";
import { db } from "@/lib/db";
import { combo, comboSession, member, session, user } from "@/lib/db/schema";
import { eq, and, inArray, notInArray } from "drizzle-orm";
import type { AvatarColor } from "@/lib/constants";
import type { BaseMemberInfo } from "@/lib/types";
import { failedAction } from "@/lib/messages";
import * as Sentry from "@sentry/nextjs";
import {
  getPurchaseDataForSessions,
  type PurchaseData,
  type ReportedPriceData,
} from "../schedule/purchase-actions";

export type GroupScheduleSession = {
  sessionCode: string;
  sport: string;
  sessionType: string;
  sessionDescription: string | null;
  venue: string;
  zone: string;
  startTime: string;
  endTime: string;
  // Purchase data
  purchases: PurchaseData[];
  isSoldOut: boolean;
  isOutOfBudget: boolean;
  reportedPrices: ReportedPriceData[];
};

export type GroupScheduleMemberCombo = BaseMemberInfo & {
  day: string;
  rank: "primary" | "backup1" | "backup2";
  score: number;
  sessions: GroupScheduleSession[];
};

export async function getGroupSchedule(groupId: string): Promise<{
  data?: GroupScheduleMemberCombo[];
  error?: string;
}> {
  const { membership, error: authError } = await requireMembership(groupId);
  if (authError) return { error: authError.error };

  try {
    // Fetch all combos (P+B1+B2) for all active members
    const activeMembers = await db
      .select({
        memberId: member.id,
        firstName: member.id, // placeholder — joined below
        status: member.status,
      })
      .from(member)
      .where(
        and(
          eq(member.groupId, groupId),
          notInArray(member.status, ["pending_approval", "denied"])
        )
      );

    const memberIds = activeMembers.map((m) => m.memberId);
    if (memberIds.length === 0) return { data: [] };

    const allCombos = await db
      .select({
        comboId: combo.id,
        memberId: combo.memberId,
        day: combo.day,
        rank: combo.rank,
        score: combo.score,
      })
      .from(combo)
      .where(
        and(eq(combo.groupId, groupId), inArray(combo.memberId, memberIds))
      )
      .orderBy(combo.day);

    if (allCombos.length === 0) return { data: [] };

    const comboIds = allCombos.map((c) => c.comboId);

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

    // Fetch member details
    const memberDetails = await db
      .select({
        id: member.id,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarColor: user.avatarColor,
      })
      .from(member)
      .innerJoin(user, eq(member.userId, user.id))
      .where(inArray(member.id, memberIds));

    const memberMap = new Map(memberDetails.map((m) => [m.id, m]));

    // Fetch purchase data for all sessions
    const allSessionCodes = [
      ...new Set(allComboSessions.map((cs) => cs.sessionCode)),
    ];
    const purchaseData = await getPurchaseDataForSessions(
      groupId,
      membership.id,
      allSessionCodes
    );

    const data: GroupScheduleMemberCombo[] = allCombos.map((c) => {
      const memberInfo = memberMap.get(c.memberId);
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
          purchases: purchaseData.purchases.get(cs.sessionCode) ?? [],
          isSoldOut: purchaseData.soldOutSessions.has(cs.sessionCode),
          isOutOfBudget: purchaseData.outOfBudgetSessions.has(cs.sessionCode),
          reportedPrices: purchaseData.reportedPrices.get(cs.sessionCode) ?? [],
        }))
        .sort((a, b) => a.startTime.localeCompare(b.startTime));

      return {
        memberId: c.memberId,
        firstName: memberInfo?.firstName ?? "Unknown",
        lastName: memberInfo?.lastName ?? "",
        avatarColor: (memberInfo?.avatarColor ?? "blue") as AvatarColor,
        day: c.day,
        rank: c.rank,
        score: c.score,
        sessions,
      };
    });

    return { data };
  } catch (err) {
    Sentry.captureException(err, {
      extra: { context: "getGroupSchedule", groupId },
    });
    return { error: failedAction("load group schedule") };
  }
}
