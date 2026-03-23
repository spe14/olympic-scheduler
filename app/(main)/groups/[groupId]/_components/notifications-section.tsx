"use client";

import { formatActionTimestamp } from "@/lib/utils";
import { useGroup } from "./group-context";

type Notification = {
  key: string;
  variant: "error" | "info" | "warning";
  content: React.ReactNode;
  timestamp: Date;
};

function formatNameList(names: string[]): string {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

export default function NotificationsSection() {
  const group = useGroup();

  const isOwner = group.myRole === "owner";
  const isRegenerate = !!group.scheduleGeneratedAt;

  const activeMembers = group.members.filter(
    (m) => m.status !== "pending_approval" && m.status !== "denied"
  );
  const affectedBuddyIds = new Set(Object.keys(group.affectedBuddyMembers));
  const affectedBuddyEntries = Object.entries(group.affectedBuddyMembers);

  // Departed member names that are NOT rejoined (for name list)
  const departedNotRejoined = group.departedMembers.filter(
    (d) => !d.rejoinedAt
  );
  // Departed members that have rejoined
  const departedRejoined = group.departedMembers.filter((d) => !!d.rejoinedAt);

  // Set of rejoined member names for filtering newly joined
  const rejoinedNames = new Set(departedRejoined.map((d) => d.name));

  // Members who joined after schedules were generated (no preferences yet)
  // Exclude affected buddy members and rejoined departed members
  const newlyJoinedMembers = group.scheduleGeneratedAt
    ? activeMembers.filter(
        (m) =>
          m.status === "joined" &&
          !affectedBuddyIds.has(m.id) &&
          !rejoinedNames.has(`${m.firstName} ${m.lastName}`)
      )
    : [];

  // Members who updated preferences after schedules were generated
  const updatedMembers = isRegenerate
    ? activeMembers.filter(
        (m) =>
          m.status === "preferences_set" &&
          m.statusChangedAt &&
          new Date(m.statusChangedAt) > new Date(group.scheduleGeneratedAt!) &&
          !(
            m.joinedAt &&
            new Date(m.joinedAt) > new Date(group.scheduleGeneratedAt!)
          )
      )
    : [];

  // The departed member names that affected the current user's buddy list (if any)
  const myAffectedByNames = group.affectedBuddyMembers[group.myMemberId] ?? [];

  function memberName(m: {
    id: string;
    firstName: string;
    lastName: string;
  }): string {
    return m.id === group.myMemberId ? "You" : `${m.firstName} ${m.lastName}`;
  }

  const notifications: Notification[] = [];

  // 1. No Combos (RED)
  if (group.membersWithNoCombos.length > 0) {
    notifications.push({
      key: "no-combos",
      variant: "error",
      content: (
        <>
          <span className="font-bold">
            Some members received no sessions on their schedules.
          </span>{" "}
          This may occur if there isn&apos;t enough session interest overlap to
          fulfill buddy requirements. Wait for affected members to update their
          preferences and then regenerate schedules.
        </>
      ),
      timestamp: new Date(group.scheduleGeneratedAt!),
    });
  }

  // 2. Departed Members (RED if not rejoined, BLUE if rejoined)
  if (departedNotRejoined.length > 0) {
    const names = departedNotRejoined.map((d) => d.name);
    const suffix = isOwner
      ? "You will need to regenerate schedules."
      : "Wait for the group owner to regenerate schedules.";
    // Use the most recent departedAt
    const latestDepartedAt = departedNotRejoined.reduce((latest, d) =>
      new Date(d.departedAt) > new Date(latest.departedAt) ? d : latest
    );
    notifications.push({
      key: "departed",
      variant: "error",
      content: `${formatNameList(names)} recently left the group. ${suffix}`,
      timestamp: new Date(latestDepartedAt.departedAt),
    });
  }

  for (const entry of departedRejoined) {
    notifications.push({
      key: `rejoined-${entry.name}`,
      variant: "info",
      content: `${entry.name} left and rejoined the group.`,
      timestamp: new Date(entry.rejoinedAt!),
    });
  }

  // 3. Affected Buddies (RED)
  if (isOwner && affectedBuddyEntries.length > 0) {
    // Group by departed name
    const byDeparted = new Map<string, Set<string>>();
    for (const [memberId, departedNames] of affectedBuddyEntries) {
      for (const departedName of departedNames) {
        if (!byDeparted.has(departedName))
          byDeparted.set(departedName, new Set());
        byDeparted.get(departedName)!.add(memberId);
      }
    }

    for (const [departedName, affectedMemberIds] of byDeparted) {
      const ownerAffected = affectedMemberIds.has(group.myMemberId);
      const othersAffected = affectedMemberIds.size > (ownerAffected ? 1 : 0);

      // Find the timestamp from the departedMembers entry for this departed name
      const departedEntry = group.departedMembers.find(
        (d) => d.name === departedName
      );
      const ts = departedEntry
        ? new Date(departedEntry.rejoinedAt ?? departedEntry.departedAt)
        : new Date();

      let message: React.ReactNode;
      if (ownerAffected && !othersAffected) {
        message = (
          <p>
            {departedName} was automatically removed from your required buddies
            list because they recently left or were removed from the group.
            Review and update your preferences as needed.
          </p>
        );
      } else if (ownerAffected && othersAffected) {
        message = (
          <p>
            {departedName} was automatically removed from your required buddies
            list because they recently left or were removed from the group.
            Other members were also affected. All affected members should review
            and update their preferences before new schedules can be generated.
          </p>
        );
      } else {
        message = (
          <p>
            {departedName} was automatically removed from some members&apos;
            required buddies list because they recently left or were removed
            from the group. All affected members should review and update their
            preferences before new schedules can be generated.
          </p>
        );
      }

      notifications.push({
        key: `affected-buddy-${departedName}`,
        variant: "error",
        content: message,
        timestamp: ts,
      });
    }
  } else if (!isOwner && myAffectedByNames.length > 0) {
    for (const name of myAffectedByNames) {
      const departedEntry = group.departedMembers.find((d) => d.name === name);
      const ts = departedEntry
        ? new Date(departedEntry.rejoinedAt ?? departedEntry.departedAt)
        : new Date();

      notifications.push({
        key: `affected-buddy-${name}`,
        variant: "error",
        content: (
          <p>
            {name} was automatically removed from your required buddies list
            because they recently left or were removed from the group. Review
            and update your preferences as needed.
          </p>
        ),
        timestamp: ts,
      });
    }
  }

  // 4. Newly Joined (BLUE)
  if (newlyJoinedMembers.length > 0) {
    const names = newlyJoinedMembers.map((m) => memberName(m));
    const hasYou = names.includes("You");
    const sorted = hasYou
      ? ["You", ...names.filter((n) => n !== "You")]
      : names;
    const suffix = isOwner
      ? "Wait for them to enter their preferences and then regenerate schedules."
      : hasYou && sorted.length === 1
        ? "Enter your preferences so the group owner can regenerate schedules."
        : "Wait for the group owner to regenerate schedules.";

    // Use most recent joinedAt
    const latestJoinedAt = newlyJoinedMembers.reduce(
      (latest, m) => {
        if (!m.joinedAt) return latest;
        if (!latest) return new Date(m.joinedAt);
        const d = new Date(m.joinedAt);
        return d > latest ? d : latest;
      },
      null as Date | null
    );

    notifications.push({
      key: "newly-joined",
      variant: "info",
      content: `${formatNameList(sorted)} recently joined the group. ${suffix}`,
      timestamp: latestJoinedAt ?? new Date(),
    });
  }

  // 5. Updated Preferences (BLUE)
  if (updatedMembers.length > 0) {
    const names = updatedMembers.map((m) => memberName(m));
    const hasYou = names.includes("You");
    const sorted = hasYou
      ? ["You", ...names.filter((n) => n !== "You")]
      : names;
    const verb = sorted.length === 1 && !hasYou ? "has" : "have";
    const possessive = hasYou && sorted.length === 1 ? "your" : "their";

    // Use most recent statusChangedAt
    const latestStatusChanged = updatedMembers.reduce(
      (latest, m) => {
        if (!m.statusChangedAt) return latest;
        if (!latest) return new Date(m.statusChangedAt);
        const d = new Date(m.statusChangedAt);
        return d > latest ? d : latest;
      },
      null as Date | null
    );

    notifications.push({
      key: "updated-preferences",
      variant: "info",
      content: `${formatNameList(sorted)} ${verb} updated ${possessive} preferences. These updates won't be reflected on your schedule until the owner regenerates schedules.`,
      timestamp: latestStatusChanged ?? new Date(),
    });
  }

  // 6. Non-Convergence (AMBER) — shown only to affected members
  const isAffectedByNonConvergence =
    group.nonConvergenceMembers?.includes(group.myMemberId) ?? false;

  if (isAffectedByNonConvergence && group.scheduleGeneratedAt) {
    notifications.push({
      key: "non-convergence",
      variant: "warning",
      content:
        "The algorithm was not able to meet all of your requirements during schedule generation. The generated schedule is the best-effort output. You can adjust preferences as needed in the Preferences tab if you are unsatisfied with your schedule.",
      timestamp: new Date(group.scheduleGeneratedAt),
    });
  }

  // 7. Purchase Changes (AMBER)
  const hasPurchaseChanges =
    group.purchaseDataChangedAt &&
    group.scheduleGeneratedAt &&
    new Date(group.purchaseDataChangedAt) > new Date(group.scheduleGeneratedAt);

  if (hasPurchaseChanges) {
    const message = isOwner
      ? "Some sessions have had their purchase status and/or availability updated since the last schedule generation. You may want to regenerate schedules to reflect these changes."
      : "Some sessions have had their purchase status and/or availability since the last schedule generation. These changes won't be reflected on your schedule until the owner regenerates schedules.";
    notifications.push({
      key: "purchase-changes",
      variant: "warning",
      content: message,
      timestamp: new Date(group.purchaseDataChangedAt!),
    });
  }

  if (notifications.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">
        Notifications
      </h2>
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="space-y-3">
          {notifications.map((n) => (
            <div
              key={n.key}
              className={`rounded-lg border px-4 py-3 text-sm ${
                n.variant === "error"
                  ? "border-red-200 bg-red-50 text-red-600"
                  : n.variant === "warning"
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-[#009de5]/20 bg-[#009de5]/5 text-[#009de5]"
              }`}
            >
              <div>{n.content}</div>
              <div
                className={`mt-1 text-xs ${
                  n.variant === "error"
                    ? "text-red-400"
                    : n.variant === "warning"
                      ? "text-amber-500"
                      : "text-[#009de5]/60"
                }`}
              >
                {formatActionTimestamp(n.timestamp)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
