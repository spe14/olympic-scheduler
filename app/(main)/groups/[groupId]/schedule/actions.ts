"use server";

import { getMembership } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  combo,
  comboSession,
  member,
  session,
  sessionPreference,
  user,
} from "@/lib/db/schema";
import { eq, and, inArray, ne } from "drizzle-orm";
import type { AvatarColor } from "@/lib/constants";

export type InterestedMember = {
  firstName: string;
  lastName: string;
  username: string;
  avatarColor: AvatarColor;
};

export type ScheduledMember = {
  firstName: string;
  lastName: string;
  username: string;
  avatarColor: AvatarColor;
  rank: "primary" | "backup1" | "backup2";
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
};

export type ScheduleCombo = {
  rank: "primary" | "backup1" | "backup2";
  score: number;
  sessions: ScheduleSession[];
};

export type ScheduleDay = {
  day: string;
  combos: ScheduleCombo[];
};

export async function getMySchedule(groupId: string): Promise<{
  data?: ScheduleDay[];
  error?: string;
}> {
  const membership = await getMembership(groupId);
  if (!membership) {
    return { error: "You are not an active member of this group." };
  }

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
              ne(sessionPreference.memberId, membership.id),
              eq(sessionPreference.excluded, false)
            )
          )
      : [];

  const interestedMap = new Map<string, InterestedMember[]>();
  for (const row of interestedRows) {
    const list = interestedMap.get(row.sessionId) ?? [];
    list.push({
      firstName: row.firstName,
      lastName: row.lastName,
      username: row.username,
      avatarColor: row.avatarColor as AvatarColor,
    });
    interestedMap.set(row.sessionId, list);
  }

  // Fetch other members' combo assignments for sessions in current user's combos
  const scheduledRows =
    sessionCodes.length > 0
      ? await db
          .select({
            sessionId: comboSession.sessionId,
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

  // Build scheduledMembers map: sessionCode → best rank per member
  const scheduledMap = new Map<string, ScheduledMember[]>();
  const RANK_ORDER: Record<string, number> = {
    primary: 0,
    backup1: 1,
    backup2: 2,
  };
  for (const row of scheduledRows) {
    const list = scheduledMap.get(row.sessionId) ?? [];
    const existing = list.find((m) => m.username === row.username);
    if (existing) {
      if (RANK_ORDER[row.rank] < RANK_ORDER[existing.rank]) {
        existing.rank = row.rank;
      }
    } else {
      list.push({
        firstName: row.firstName,
        lastName: row.lastName,
        username: row.username,
        avatarColor: row.avatarColor as AvatarColor,
        rank: row.rank,
      });
      scheduledMap.set(row.sessionId, list);
    }
  }

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
      }))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    const existing = dayMap.get(c.day) ?? [];
    existing.push({ rank: c.rank, score: c.score, sessions });
    dayMap.set(c.day, existing);
  }

  const data: ScheduleDay[] = [...dayMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, combos]) => ({ day, combos }));

  return { data };
}
