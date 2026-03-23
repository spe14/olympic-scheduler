"use server";

import { requireMembership } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  purchaseTimeslot,
  purchasePlanEntry,
  ticketPurchase,
  ticketPurchaseAssignee,
  soldOutSession,
  outOfBudgetSession,
  reportedPrice,
  member,
  user,
  group,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/types";
import type { AvatarColor } from "@/lib/constants";
import { groupBy } from "@/lib/utils";

// ── Timeslot actions ────────────────────────────────────────────────────────

export type TimeslotData = {
  id: string;
  timeslotStart: Date;
  timeslotEnd: Date;
  status: "upcoming" | "in_progress" | "completed";
};

export async function getTimeslot(
  groupId: string
): Promise<{ data?: TimeslotData | null; error?: string }> {
  const { membership, error: authError } = await requireMembership(groupId);
  if (authError) return authError;

  const [row] = await db
    .select()
    .from(purchaseTimeslot)
    .where(
      and(
        eq(purchaseTimeslot.memberId, membership.id),
        eq(purchaseTimeslot.groupId, groupId)
      )
    )
    .limit(1);

  if (!row) return { data: null };

  return {
    data: {
      id: row.id,
      timeslotStart: row.timeslotStart,
      timeslotEnd: row.timeslotEnd,
      status: row.status,
    },
  };
}

export async function saveTimeslot(
  groupId: string,
  data: { start: string; end: string }
): Promise<ActionResult> {
  const { membership, error: authError } = await requireMembership(groupId);
  if (authError) return authError;

  const start = new Date(data.start);
  const end = new Date(data.end);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { error: "Invalid date format." };
  }
  if (end <= start) {
    return { error: "End time must be after start time." };
  }

  await db
    .insert(purchaseTimeslot)
    .values({
      groupId,
      memberId: membership.id,
      timeslotStart: start,
      timeslotEnd: end,
    })
    .onConflictDoUpdate({
      target: [purchaseTimeslot.memberId, purchaseTimeslot.groupId],
      set: {
        timeslotStart: start,
        timeslotEnd: end,
        updatedAt: new Date(),
      },
    });

  revalidatePath(`/groups/${groupId}/schedule`);
  return { success: true };
}

export async function updateTimeslotStatus(
  groupId: string,
  status: "upcoming" | "in_progress" | "completed"
): Promise<ActionResult> {
  const { membership, error: authError } = await requireMembership(groupId);
  if (authError) return authError;

  const [existing] = await db
    .select({ id: purchaseTimeslot.id })
    .from(purchaseTimeslot)
    .where(
      and(
        eq(purchaseTimeslot.memberId, membership.id),
        eq(purchaseTimeslot.groupId, groupId)
      )
    )
    .limit(1);

  if (!existing) return { error: "No timeslot found." };

  await db
    .update(purchaseTimeslot)
    .set({ status, updatedAt: new Date() })
    .where(eq(purchaseTimeslot.id, existing.id));

  revalidatePath(`/groups/${groupId}/schedule`);
  return { success: true };
}

// ── Purchase plan actions ───────────────────────────────────────────────────

export async function savePurchasePlanEntry(
  groupId: string,
  data: {
    sessionId: string;
    assigneeMemberId: string;
    priceCeiling: number | null;
  }
): Promise<ActionResult> {
  const { membership, error: authError } = await requireMembership(groupId);
  if (authError) return authError;

  await db
    .insert(purchasePlanEntry)
    .values({
      groupId,
      memberId: membership.id,
      sessionId: data.sessionId,
      assigneeMemberId: data.assigneeMemberId,
      priceCeiling: data.priceCeiling,
    })
    .onConflictDoUpdate({
      target: [
        purchasePlanEntry.memberId,
        purchasePlanEntry.sessionId,
        purchasePlanEntry.assigneeMemberId,
      ],
      set: {
        priceCeiling: data.priceCeiling,
        updatedAt: new Date(),
      },
    });

  revalidatePath(`/groups/${groupId}/schedule`);
  return { success: true };
}

export async function removePurchasePlanEntry(
  groupId: string,
  data: { sessionId: string; assigneeMemberId: string }
): Promise<ActionResult> {
  const { membership, error: authError } = await requireMembership(groupId);
  if (authError) return authError;

  await db
    .delete(purchasePlanEntry)
    .where(
      and(
        eq(purchasePlanEntry.groupId, groupId),
        eq(purchasePlanEntry.memberId, membership.id),
        eq(purchasePlanEntry.sessionId, data.sessionId),
        eq(purchasePlanEntry.assigneeMemberId, data.assigneeMemberId)
      )
    );

  revalidatePath(`/groups/${groupId}/schedule`);
  return { success: true };
}

// ── Ticket purchase actions ─────────────────────────────────────────────────

export async function markAsPurchased(
  groupId: string,
  data: {
    sessionId: string;
    pricePerTicket?: number;
    assignees: { memberId: string; pricePaid?: number | null }[];
  }
): Promise<ActionResult> {
  const { membership, error: authError } = await requireMembership(groupId);
  if (authError) return authError;

  if (data.assignees.length === 0) {
    return { error: "Must select at least one member to buy for." };
  }

  await db.transaction(async (tx) => {
    const [purchase] = await tx
      .insert(ticketPurchase)
      .values({
        groupId,
        sessionId: data.sessionId,
        purchasedByMemberId: membership.id,
        pricePerTicket: data.pricePerTicket ?? 0,
      })
      .returning({ id: ticketPurchase.id });

    await tx.insert(ticketPurchaseAssignee).values(
      data.assignees.map((a) => ({
        ticketPurchaseId: purchase.id,
        memberId: a.memberId,
        pricePaid: a.pricePaid ?? null,
      }))
    );
    await tx
      .update(group)
      .set({ purchaseDataChangedAt: new Date() })
      .where(eq(group.id, groupId));
  });

  revalidatePath(`/groups/${groupId}/schedule`);
  revalidatePath(`/groups/${groupId}/group-schedule`);
  return { success: true };
}

export async function deletePurchase(
  groupId: string,
  purchaseId: string
): Promise<ActionResult> {
  const { membership, error: authError } = await requireMembership(groupId);
  if (authError) return authError;

  // Verify this purchase belongs to the caller and this group
  const [purchase] = await db
    .select({ purchasedByMemberId: ticketPurchase.purchasedByMemberId })
    .from(ticketPurchase)
    .where(
      and(
        eq(ticketPurchase.id, purchaseId),
        eq(ticketPurchase.groupId, groupId)
      )
    )
    .limit(1);

  if (!purchase || purchase.purchasedByMemberId !== membership.id) {
    return { error: "Purchase not found or not yours." };
  }

  await db.transaction(async (tx) => {
    // Cascade handles ticketPurchaseAssignee deletion
    await tx
      .delete(ticketPurchase)
      .where(
        and(
          eq(ticketPurchase.id, purchaseId),
          eq(ticketPurchase.groupId, groupId)
        )
      );

    await tx
      .update(group)
      .set({ purchaseDataChangedAt: new Date() })
      .where(eq(group.id, groupId));
  });

  revalidatePath(`/groups/${groupId}/schedule`);
  revalidatePath(`/groups/${groupId}/group-schedule`);
  return { success: true };
}

export async function removePurchaseAssignee(
  groupId: string,
  data: { purchaseId: string; memberId: string }
): Promise<ActionResult> {
  const { membership, error: authError } = await requireMembership(groupId);
  if (authError) return authError;

  await db.transaction(async (tx) => {
    // Verify the purchase belongs to this group
    const [purchase] = await tx
      .select({ id: ticketPurchase.id })
      .from(ticketPurchase)
      .where(
        and(
          eq(ticketPurchase.id, data.purchaseId),
          eq(ticketPurchase.groupId, groupId)
        )
      )
      .limit(1);

    if (!purchase) return;

    await tx
      .delete(ticketPurchaseAssignee)
      .where(
        and(
          eq(ticketPurchaseAssignee.ticketPurchaseId, data.purchaseId),
          eq(ticketPurchaseAssignee.memberId, data.memberId)
        )
      );

    // If no assignees left, delete the purchase record too
    const remaining = await tx
      .select({ memberId: ticketPurchaseAssignee.memberId })
      .from(ticketPurchaseAssignee)
      .where(eq(ticketPurchaseAssignee.ticketPurchaseId, data.purchaseId))
      .limit(1);

    if (remaining.length === 0) {
      await tx
        .delete(ticketPurchase)
        .where(eq(ticketPurchase.id, data.purchaseId));
    }

    await tx
      .update(group)
      .set({ purchaseDataChangedAt: new Date() })
      .where(eq(group.id, groupId));
  });

  revalidatePath(`/groups/${groupId}/schedule`);
  revalidatePath(`/groups/${groupId}/group-schedule`);
  return { success: true };
}

export async function updatePurchaseAssigneePrice(
  groupId: string,
  data: { purchaseId: string; memberId: string; pricePaid: number | null }
): Promise<ActionResult> {
  const { membership, error: authError } = await requireMembership(groupId);
  if (authError) return authError;

  // Verify the purchase belongs to this group
  const [purchase] = await db
    .select({ id: ticketPurchase.id })
    .from(ticketPurchase)
    .where(
      and(
        eq(ticketPurchase.id, data.purchaseId),
        eq(ticketPurchase.groupId, groupId)
      )
    )
    .limit(1);

  if (!purchase) return { error: "Purchase not found." };

  await db
    .update(ticketPurchaseAssignee)
    .set({ pricePaid: data.pricePaid })
    .where(
      and(
        eq(ticketPurchaseAssignee.ticketPurchaseId, data.purchaseId),
        eq(ticketPurchaseAssignee.memberId, data.memberId)
      )
    );

  revalidatePath(`/groups/${groupId}/schedule`);
  return { success: true };
}

// ── Sold out actions ────────────────────────────────────────────────────────

export async function markAsSoldOut(
  groupId: string,
  data: { sessionId: string }
): Promise<ActionResult> {
  const { membership, error: authError } = await requireMembership(groupId);
  if (authError) return authError;

  await db.transaction(async (tx) => {
    await tx
      .insert(soldOutSession)
      .values({
        groupId,
        sessionId: data.sessionId,
        reportedByMemberId: membership.id,
      })
      .onConflictDoNothing();

    await tx
      .update(group)
      .set({ purchaseDataChangedAt: new Date() })
      .where(eq(group.id, groupId));
  });

  revalidatePath(`/groups/${groupId}/schedule`);
  revalidatePath(`/groups/${groupId}/group-schedule`);
  return { success: true };
}

export async function unmarkSoldOut(
  groupId: string,
  data: { sessionId: string }
): Promise<ActionResult> {
  const { membership, error: authError } = await requireMembership(groupId);
  if (authError) return authError;

  await db.transaction(async (tx) => {
    await tx
      .delete(soldOutSession)
      .where(
        and(
          eq(soldOutSession.groupId, groupId),
          eq(soldOutSession.sessionId, data.sessionId)
        )
      );

    await tx
      .update(group)
      .set({ purchaseDataChangedAt: new Date() })
      .where(eq(group.id, groupId));
  });

  revalidatePath(`/groups/${groupId}/schedule`);
  revalidatePath(`/groups/${groupId}/group-schedule`);
  return { success: true };
}

// ── Out of budget actions ───────────────────────────────────────────────────

export async function markAsOutOfBudget(
  groupId: string,
  data: { sessionId: string }
): Promise<ActionResult> {
  const { membership, error: authError } = await requireMembership(groupId);
  if (authError) return authError;

  await db.transaction(async (tx) => {
    await tx
      .insert(outOfBudgetSession)
      .values({
        groupId,
        memberId: membership.id,
        sessionId: data.sessionId,
      })
      .onConflictDoNothing();

    await tx
      .update(group)
      .set({ purchaseDataChangedAt: new Date() })
      .where(eq(group.id, groupId));
  });

  revalidatePath(`/groups/${groupId}/schedule`);
  revalidatePath(`/groups/${groupId}/group-schedule`);
  return { success: true };
}

export async function unmarkOutOfBudget(
  groupId: string,
  data: { sessionId: string }
): Promise<ActionResult> {
  const { membership, error: authError } = await requireMembership(groupId);
  if (authError) return authError;

  await db.transaction(async (tx) => {
    await tx
      .delete(outOfBudgetSession)
      .where(
        and(
          eq(outOfBudgetSession.groupId, groupId),
          eq(outOfBudgetSession.memberId, membership.id),
          eq(outOfBudgetSession.sessionId, data.sessionId)
        )
      );

    await tx
      .update(group)
      .set({ purchaseDataChangedAt: new Date() })
      .where(eq(group.id, groupId));
  });

  revalidatePath(`/groups/${groupId}/schedule`);
  revalidatePath(`/groups/${groupId}/group-schedule`);
  return { success: true };
}

// ── Report price actions ────────────────────────────────────────────────────

export async function reportSessionPrice(
  groupId: string,
  data: {
    sessionId: string;
    minPrice: number | null;
    maxPrice: number | null;
    comments: string | null;
  }
): Promise<ActionResult> {
  const { membership, error: authError } = await requireMembership(groupId);
  if (authError) return authError;

  if (
    data.minPrice == null &&
    data.maxPrice == null &&
    !data.comments?.trim()
  ) {
    return { error: "At least one price or a comment is required." };
  }
  if (data.minPrice != null && data.minPrice <= 0)
    return { error: "Min price must be positive." };
  if (data.maxPrice != null && data.maxPrice <= 0)
    return { error: "Max price must be positive." };
  if (
    data.minPrice != null &&
    data.maxPrice != null &&
    data.minPrice > data.maxPrice
  )
    return { error: "Min price cannot exceed max price." };

  await db.insert(reportedPrice).values({
    groupId,
    sessionId: data.sessionId,
    reportedByMemberId: membership.id,
    minPrice: data.minPrice,
    maxPrice: data.maxPrice,
    comments: data.comments || null,
  });

  revalidatePath(`/groups/${groupId}/schedule`);
  revalidatePath(`/groups/${groupId}/group-schedule`);
  return { success: true };
}

export async function deleteOffScheduleSessionData(
  groupId: string,
  sessionId: string
): Promise<ActionResult> {
  const { membership, error: authError } = await requireMembership(groupId);
  if (authError) return authError;

  // Delete purchases made by this member for this session
  await db
    .delete(ticketPurchase)
    .where(
      and(
        eq(ticketPurchase.groupId, groupId),
        eq(ticketPurchase.sessionId, sessionId),
        eq(ticketPurchase.purchasedByMemberId, membership.id)
      )
    );

  // Delete reported prices by this member for this session
  await db
    .delete(reportedPrice)
    .where(
      and(
        eq(reportedPrice.groupId, groupId),
        eq(reportedPrice.sessionId, sessionId),
        eq(reportedPrice.reportedByMemberId, membership.id)
      )
    );

  revalidatePath(`/groups/${groupId}/schedule`);
  revalidatePath(`/groups/${groupId}/purchase-tracker`);
  return { success: true };
}

// ── Query helpers for schedule data enrichment ──────────────────────────────

export type PurchasePlanEntryData = {
  assigneeMemberId: string;
  assigneeFirstName: string;
  assigneeLastName: string;
  assigneeAvatarColor: AvatarColor;
  priceCeiling: number | null;
};

export type PurchaseData = {
  purchaseId: string;
  buyerMemberId: string;
  buyerFirstName: string;
  buyerLastName: string;
  pricePerTicket: number;
  assignees: {
    memberId: string;
    firstName: string;
    lastName: string;
    avatarColor: AvatarColor;
    pricePaid: number | null;
  }[];
  createdAt: Date;
};

export type ReportedPriceData = {
  reporterFirstName: string;
  reporterLastName: string;
  minPrice: number | null;
  maxPrice: number | null;
  comments: string | null;
  createdAt: Date;
};

export async function getPurchaseDataForSessions(
  groupId: string,
  memberId: string,
  sessionCodes: string[]
) {
  if (sessionCodes.length === 0) {
    return {
      planEntries: new Map<string, PurchasePlanEntryData[]>(),
      purchases: new Map<string, PurchaseData[]>(),
      soldOutSessions: new Set<string>(),
      outOfBudgetSessions: new Set<string>(),
      reportedPrices: new Map<string, ReportedPriceData[]>(),
    };
  }

  const { inArray } = await import("drizzle-orm");

  // 1. Purchase plan entries for this member (as purchaser)
  const planRows = await db
    .select({
      sessionId: purchasePlanEntry.sessionId,
      assigneeMemberId: purchasePlanEntry.assigneeMemberId,
      priceCeiling: purchasePlanEntry.priceCeiling,
      assigneeFirstName: user.firstName,
      assigneeLastName: user.lastName,
      assigneeAvatarColor: user.avatarColor,
    })
    .from(purchasePlanEntry)
    .innerJoin(member, eq(purchasePlanEntry.assigneeMemberId, member.id))
    .innerJoin(user, eq(member.userId, user.id))
    .where(
      and(
        eq(purchasePlanEntry.memberId, memberId),
        eq(purchasePlanEntry.groupId, groupId),
        inArray(purchasePlanEntry.sessionId, sessionCodes)
      )
    );

  const planEntries = groupBy(
    planRows,
    (r) => r.sessionId,
    (row): PurchasePlanEntryData => ({
      assigneeMemberId: row.assigneeMemberId,
      assigneeFirstName: row.assigneeFirstName,
      assigneeLastName: row.assigneeLastName,
      assigneeAvatarColor: row.assigneeAvatarColor as AvatarColor,
      priceCeiling: row.priceCeiling,
    })
  );

  // 2. Ticket purchases for sessions in this group
  const purchaseRows = await db
    .select({
      purchaseId: ticketPurchase.id,
      sessionId: ticketPurchase.sessionId,
      buyerMemberId: ticketPurchase.purchasedByMemberId,
      pricePerTicket: ticketPurchase.pricePerTicket,
      buyerFirstName: user.firstName,
      buyerLastName: user.lastName,
      createdAt: ticketPurchase.createdAt,
    })
    .from(ticketPurchase)
    .innerJoin(member, eq(ticketPurchase.purchasedByMemberId, member.id))
    .innerJoin(user, eq(member.userId, user.id))
    .where(
      and(
        eq(ticketPurchase.groupId, groupId),
        inArray(ticketPurchase.sessionId, sessionCodes)
      )
    );

  // Get assignees for all purchases
  const purchaseIds = purchaseRows.map((r) => r.purchaseId);
  const assigneeRows =
    purchaseIds.length > 0
      ? await db
          .select({
            ticketPurchaseId: ticketPurchaseAssignee.ticketPurchaseId,
            memberId: ticketPurchaseAssignee.memberId,
            pricePaid: ticketPurchaseAssignee.pricePaid,
            firstName: user.firstName,
            lastName: user.lastName,
            avatarColor: user.avatarColor,
          })
          .from(ticketPurchaseAssignee)
          .innerJoin(member, eq(ticketPurchaseAssignee.memberId, member.id))
          .innerJoin(user, eq(member.userId, user.id))
          .where(inArray(ticketPurchaseAssignee.ticketPurchaseId, purchaseIds))
      : [];

  const assigneesByPurchase = groupBy(
    assigneeRows,
    (r) => r.ticketPurchaseId,
    (row) => ({
      memberId: row.memberId,
      firstName: row.firstName,
      lastName: row.lastName,
      avatarColor: row.avatarColor as AvatarColor,
      pricePaid: row.pricePaid,
    })
  );

  const purchases = groupBy(
    purchaseRows,
    (r) => r.sessionId,
    (row): PurchaseData => ({
      purchaseId: row.purchaseId,
      buyerMemberId: row.buyerMemberId,
      buyerFirstName: row.buyerFirstName,
      buyerLastName: row.buyerLastName,
      pricePerTicket: row.pricePerTicket,
      assignees: assigneesByPurchase.get(row.purchaseId) ?? [],
      createdAt: row.createdAt,
    })
  );

  // 3. Sold-out sessions for this group
  const soldOutRows = await db
    .select({ sessionId: soldOutSession.sessionId })
    .from(soldOutSession)
    .where(
      and(
        eq(soldOutSession.groupId, groupId),
        inArray(soldOutSession.sessionId, sessionCodes)
      )
    );
  const soldOutSessions = new Set(soldOutRows.map((r) => r.sessionId));

  // 4. Out-of-budget sessions for this member
  const oobRows = await db
    .select({ sessionId: outOfBudgetSession.sessionId })
    .from(outOfBudgetSession)
    .where(
      and(
        eq(outOfBudgetSession.groupId, groupId),
        eq(outOfBudgetSession.memberId, memberId),
        inArray(outOfBudgetSession.sessionId, sessionCodes)
      )
    );
  const outOfBudgetSessions = new Set(oobRows.map((r) => r.sessionId));

  // 5. Reported prices for this group
  const priceRows = await db
    .select({
      sessionId: reportedPrice.sessionId,
      minPrice: reportedPrice.minPrice,
      maxPrice: reportedPrice.maxPrice,
      comments: reportedPrice.comments,
      createdAt: reportedPrice.createdAt,
      reporterFirstName: user.firstName,
      reporterLastName: user.lastName,
    })
    .from(reportedPrice)
    .innerJoin(member, eq(reportedPrice.reportedByMemberId, member.id))
    .innerJoin(user, eq(member.userId, user.id))
    .where(
      and(
        eq(reportedPrice.groupId, groupId),
        inArray(reportedPrice.sessionId, sessionCodes)
      )
    );

  const reportedPrices = groupBy(
    priceRows,
    (r) => r.sessionId,
    (row): ReportedPriceData => ({
      reporterFirstName: row.reporterFirstName,
      reporterLastName: row.reporterLastName,
      minPrice: row.minPrice,
      maxPrice: row.maxPrice,
      comments: row.comments,
      createdAt: row.createdAt,
    })
  );

  return {
    planEntries,
    purchases,
    soldOutSessions,
    outOfBudgetSessions,
    reportedPrices,
  };
}
