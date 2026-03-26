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
import { eq, and, inArray, notInArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/types";
import type { AvatarColor } from "@/lib/constants";
import { groupBy } from "@/lib/utils";
import { failedAction } from "@/lib/messages";

// ── Timeslot actions ────────────────────────────────────────────────────────

export type TimeslotData = {
  id: string;
  timeslotStart: Date;
  timeslotEnd: Date;
};

export async function getTimeslot(
  groupId: string
): Promise<{ data?: TimeslotData | null; error?: string }> {
  const { membership, error: authError } = await requireMembership(groupId);
  if (authError) return { error: authError.error };

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

  try {
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
  } catch {
    return { error: failedAction("save timeslot") };
  }

  revalidatePath(`/groups/${groupId}/schedule`);
  return { success: true };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Returns active (joined / preferences_set) member IDs for a group. */
async function getActiveGroupMemberIds(
  groupId: string,
  txOrDb: { select: any } = db
) {
  const rows: { id: string }[] = await txOrDb
    .select({ id: member.id })
    .from(member)
    .where(
      and(
        eq(member.groupId, groupId),
        notInArray(member.status, ["pending_approval", "denied"])
      )
    );
  return new Set(rows.map((r) => r.id));
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

  if (
    data.priceCeiling != null &&
    (isNaN(data.priceCeiling) || data.priceCeiling < 0)
  ) {
    return { error: "Price ceiling must be a non-negative number." };
  }

  const activeIds = await getActiveGroupMemberIds(groupId);
  if (!activeIds.has(data.assigneeMemberId)) {
    return { error: "Invalid assignee: member is not active in this group." };
  }

  try {
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
  } catch {
    return { error: failedAction("save purchase plan entry") };
  }

  revalidatePath(`/groups/${groupId}/schedule`);
  return { success: true };
}

export async function removePurchasePlanEntry(
  groupId: string,
  data: { sessionId: string; assigneeMemberId: string }
): Promise<ActionResult> {
  const { membership, error: authError } = await requireMembership(groupId);
  if (authError) return authError;

  try {
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
  } catch {
    return { error: failedAction("remove purchase plan entry") };
  }

  revalidatePath(`/groups/${groupId}/schedule`);
  return { success: true };
}

export async function batchSavePurchasePlan(
  groupId: string,
  data: {
    sessionId: string;
    entries: { assigneeMemberId: string; priceCeiling: number | null }[];
  }
): Promise<ActionResult> {
  const { membership, error: authError } = await requireMembership(groupId);
  if (authError) return authError;

  for (const entry of data.entries) {
    if (
      entry.priceCeiling != null &&
      (isNaN(entry.priceCeiling) || entry.priceCeiling < 0)
    ) {
      return { error: "Price ceiling must be a non-negative number." };
    }
  }

  try {
    const result = await db.transaction(async (tx) => {
      // Validate assignee member IDs belong to this group
      if (data.entries.length > 0) {
        const activeIds = await getActiveGroupMemberIds(groupId, tx);
        const invalid = data.entries.find(
          (e) => !activeIds.has(e.assigneeMemberId)
        );
        if (invalid) {
          return {
            error: "Invalid assignee: member is not active in this group.",
          } as const;
        }
      }

      // Remove all existing plan entries for this member+session
      await tx
        .delete(purchasePlanEntry)
        .where(
          and(
            eq(purchasePlanEntry.groupId, groupId),
            eq(purchasePlanEntry.memberId, membership.id),
            eq(purchasePlanEntry.sessionId, data.sessionId)
          )
        );

      // Insert new entries
      if (data.entries.length > 0) {
        await tx.insert(purchasePlanEntry).values(
          data.entries.map((e) => ({
            groupId,
            memberId: membership.id,
            sessionId: data.sessionId,
            assigneeMemberId: e.assigneeMemberId,
            priceCeiling: e.priceCeiling,
          }))
        );
      }
    });

    if (result && "error" in result) {
      return { error: result.error };
    }
  } catch {
    return { error: failedAction("save purchase plan") };
  }

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

  if (
    data.pricePerTicket != null &&
    (isNaN(data.pricePerTicket) || data.pricePerTicket < 0)
  ) {
    return { error: "Price per ticket must be a non-negative number." };
  }

  for (const a of data.assignees) {
    if (a.pricePaid != null && (isNaN(a.pricePaid) || a.pricePaid < 0)) {
      return { error: "Price paid must be a non-negative number." };
    }
  }

  let purchaseId: string;
  try {
    const result = await db.transaction(async (tx) => {
      // Check if session is sold out
      const [soldOut] = await tx
        .select({ id: soldOutSession.id })
        .from(soldOutSession)
        .where(
          and(
            eq(soldOutSession.groupId, groupId),
            eq(soldOutSession.sessionId, data.sessionId)
          )
        )
        .limit(1);

      if (soldOut) {
        return { error: "This session has been marked as sold out." } as const;
      }

      // Validate all assignee member IDs belong to this group
      const activeIds = await getActiveGroupMemberIds(groupId, tx);
      const invalidAssignee = data.assignees.find(
        (a) => !activeIds.has(a.memberId)
      );
      if (invalidAssignee) {
        return {
          error: "Invalid assignee: member is not active in this group.",
        } as const;
      }

      // Filter out assignees who already have a purchase for this session
      const existingAssignees = await tx
        .select({ memberId: ticketPurchaseAssignee.memberId })
        .from(ticketPurchaseAssignee)
        .innerJoin(
          ticketPurchase,
          eq(ticketPurchaseAssignee.ticketPurchaseId, ticketPurchase.id)
        )
        .where(
          and(
            eq(ticketPurchase.groupId, groupId),
            eq(ticketPurchase.sessionId, data.sessionId),
            inArray(
              ticketPurchaseAssignee.memberId,
              data.assignees.map((a) => a.memberId)
            )
          )
        );

      const alreadyAssigned = new Set(existingAssignees.map((e) => e.memberId));
      const newAssignees = data.assignees.filter(
        (a) => !alreadyAssigned.has(a.memberId)
      );

      if (newAssignees.length === 0) {
        return {
          error:
            "All selected members already have a purchase for this session.",
        } as const;
      }

      const [purchase] = await tx
        .insert(ticketPurchase)
        .values({
          groupId,
          sessionId: data.sessionId,
          purchasedByMemberId: membership.id,
          pricePerTicket: data.pricePerTicket ?? null,
        })
        .returning({ id: ticketPurchase.id });

      await tx.insert(ticketPurchaseAssignee).values(
        newAssignees.map((a) => ({
          ticketPurchaseId: purchase.id,
          memberId: a.memberId,
          pricePaid: a.pricePaid ?? null,
        }))
      );
      await tx
        .update(group)
        .set({ purchaseDataChangedAt: new Date() })
        .where(eq(group.id, groupId));
      return { purchaseId: purchase.id } as const;
    });

    if ("error" in result) {
      return { error: result.error };
    }
    purchaseId = result.purchaseId;
  } catch {
    return { error: failedAction("record purchase") };
  }

  revalidatePath(`/groups/${groupId}/schedule`);
  revalidatePath(`/groups/${groupId}/group-schedule`);
  return { success: true, data: { purchaseId } };
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

  try {
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
  } catch {
    return { error: failedAction("delete purchase") };
  }

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

  // Verify the purchase belongs to this group and was made by the caller
  const [purchase] = await db
    .select({
      id: ticketPurchase.id,
      purchasedByMemberId: ticketPurchase.purchasedByMemberId,
    })
    .from(ticketPurchase)
    .where(
      and(
        eq(ticketPurchase.id, data.purchaseId),
        eq(ticketPurchase.groupId, groupId)
      )
    )
    .limit(1);

  if (!purchase) return { success: true };
  if (purchase.purchasedByMemberId !== membership.id) {
    return { error: "You can only edit your own purchases." };
  }

  try {
    await db.transaction(async (tx) => {
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
  } catch {
    return { error: failedAction("remove purchase assignee") };
  }

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

  if (data.pricePaid != null && (isNaN(data.pricePaid) || data.pricePaid < 0)) {
    return { error: "Price must be a non-negative number." };
  }

  try {
    await db.transaction(async (tx) => {
      // Verify the purchase belongs to this group and was made by the caller
      const [purchase] = await tx
        .select({
          id: ticketPurchase.id,
          purchasedByMemberId: ticketPurchase.purchasedByMemberId,
        })
        .from(ticketPurchase)
        .where(
          and(
            eq(ticketPurchase.id, data.purchaseId),
            eq(ticketPurchase.groupId, groupId)
          )
        )
        .limit(1);

      if (!purchase) throw new Error("Purchase not found.");
      if (purchase.purchasedByMemberId !== membership.id) {
        throw new Error("You can only edit your own purchases.");
      }

      await tx
        .update(ticketPurchaseAssignee)
        .set({ pricePaid: data.pricePaid })
        .where(
          and(
            eq(ticketPurchaseAssignee.ticketPurchaseId, data.purchaseId),
            eq(ticketPurchaseAssignee.memberId, data.memberId)
          )
        );
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (
      msg === "Purchase not found." ||
      msg === "You can only edit your own purchases."
    ) {
      return { error: msg };
    }
    return { error: failedAction("update assignee price") };
  }

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

  try {
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
  } catch {
    return { error: failedAction("mark session as sold out") };
  }

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

  try {
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
  } catch {
    return { error: failedAction("unmark session as sold out") };
  }

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

  try {
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
  } catch {
    return { error: failedAction("mark session as out of budget") };
  }

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

  try {
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
  } catch {
    return { error: failedAction("unmark session as out of budget") };
  }

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

  const trimmedComments = data.comments?.trim().slice(0, 200) || null;

  if (data.minPrice == null && data.maxPrice == null && !trimmedComments) {
    return { error: "At least one price or a comment is required." };
  }
  if (data.minPrice != null && (isNaN(data.minPrice) || data.minPrice <= 0))
    return { error: "Min price must be a positive number." };
  if (data.maxPrice != null && (isNaN(data.maxPrice) || data.maxPrice <= 0))
    return { error: "Max price must be a positive number." };
  if (
    data.minPrice != null &&
    data.maxPrice != null &&
    data.minPrice > data.maxPrice
  )
    return { error: "Min price cannot exceed max price." };

  try {
    const [inserted] = await db
      .insert(reportedPrice)
      .values({
        groupId,
        sessionId: data.sessionId,
        reportedByMemberId: membership.id,
        minPrice: data.minPrice,
        maxPrice: data.maxPrice,
        comments: trimmedComments,
      })
      .returning({ id: reportedPrice.id });

    revalidatePath(`/groups/${groupId}/schedule`);
    revalidatePath(`/groups/${groupId}/group-schedule`);
    return { success: true, data: { reportedPriceId: inserted.id } };
  } catch {
    return { error: failedAction("report session price") };
  }
}

export async function updateReportedPrice(
  groupId: string,
  data: {
    reportedPriceId: string;
    minPrice: number | null;
    maxPrice: number | null;
    comments: string | null;
  }
): Promise<ActionResult> {
  const { membership, error: authError } = await requireMembership(groupId);
  if (authError) return authError;

  const trimmedComments = data.comments?.trim().slice(0, 200) || null;

  if (data.minPrice == null && data.maxPrice == null && !trimmedComments) {
    return { error: "At least one price or a comment is required." };
  }
  if (data.minPrice != null && (isNaN(data.minPrice) || data.minPrice <= 0))
    return { error: "Min price must be a positive number." };
  if (data.maxPrice != null && (isNaN(data.maxPrice) || data.maxPrice <= 0))
    return { error: "Max price must be a positive number." };
  if (
    data.minPrice != null &&
    data.maxPrice != null &&
    data.minPrice > data.maxPrice
  )
    return { error: "Min price cannot exceed max price." };

  try {
    await db.transaction(async (tx) => {
      const [row] = await tx
        .select({ reportedByMemberId: reportedPrice.reportedByMemberId })
        .from(reportedPrice)
        .where(eq(reportedPrice.id, data.reportedPriceId))
        .limit(1);

      if (!row) {
        throw new Error("Not found");
      }
      if (row.reportedByMemberId !== membership.id) {
        throw new Error("Not authorized");
      }

      await tx
        .update(reportedPrice)
        .set({
          minPrice: data.minPrice,
          maxPrice: data.maxPrice,
          comments: trimmedComments,
        })
        .where(eq(reportedPrice.id, data.reportedPriceId));
    });
  } catch (e) {
    if (e instanceof Error && e.message === "Not found") {
      return {
        error: "Reported price not found. Please refresh and try again.",
      };
    }
    if (e instanceof Error && e.message === "Not authorized") {
      return { error: "You can only edit your own reported prices." };
    }
    return { error: failedAction("update reported price") };
  }

  revalidatePath(`/groups/${groupId}/schedule`);
  revalidatePath(`/groups/${groupId}/group-schedule`);
  return { success: true };
}

export async function deleteReportedPrice(
  groupId: string,
  data: { reportedPriceId: string }
): Promise<ActionResult> {
  const { membership, error: authError } = await requireMembership(groupId);
  if (authError) return authError;

  try {
    await db.transaction(async (tx) => {
      // Verify ownership
      const [row] = await tx
        .select({ reportedByMemberId: reportedPrice.reportedByMemberId })
        .from(reportedPrice)
        .where(eq(reportedPrice.id, data.reportedPriceId))
        .limit(1);

      if (!row) {
        throw new Error("Not found");
      }
      if (row.reportedByMemberId !== membership.id) {
        throw new Error("Not authorized");
      }

      await tx
        .delete(reportedPrice)
        .where(eq(reportedPrice.id, data.reportedPriceId));

      await tx
        .update(group)
        .set({ purchaseDataChangedAt: new Date() })
        .where(eq(group.id, groupId));
    });
  } catch (e) {
    if (e instanceof Error && e.message === "Not found") {
      return {
        error: "Reported price not found. Please refresh and try again.",
      };
    }
    if (e instanceof Error && e.message === "Not authorized") {
      return { error: "You can only delete your own reported prices." };
    }
    return { error: failedAction("delete reported price") };
  }

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

  try {
    await db.transaction(async (tx) => {
      // Delete purchases made by this member for this session
      await tx
        .delete(ticketPurchase)
        .where(
          and(
            eq(ticketPurchase.groupId, groupId),
            eq(ticketPurchase.sessionId, sessionId),
            eq(ticketPurchase.purchasedByMemberId, membership.id)
          )
        );

      // Delete reported prices by this member for this session
      await tx
        .delete(reportedPrice)
        .where(
          and(
            eq(reportedPrice.groupId, groupId),
            eq(reportedPrice.sessionId, sessionId),
            eq(reportedPrice.reportedByMemberId, membership.id)
          )
        );

      await tx
        .update(group)
        .set({ purchaseDataChangedAt: new Date() })
        .where(eq(group.id, groupId));
    });
  } catch {
    return { error: failedAction("delete off-schedule session data") };
  }

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
  pricePerTicket: number | null;
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
  id: string;
  reporterMemberId: string;
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
      id: reportedPrice.id,
      sessionId: reportedPrice.sessionId,
      reportedByMemberId: reportedPrice.reportedByMemberId,
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
      id: row.id,
      reporterMemberId: row.reportedByMemberId,
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
