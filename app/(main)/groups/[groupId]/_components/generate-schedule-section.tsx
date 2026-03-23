"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useGroup } from "./group-context";
import { generateSchedules } from "../actions";
import GenerateScheduleModal from "./generate-schedule-modal";
import Tooltip from "@/components/tooltip";

export default function GenerateScheduleSection() {
  const group = useGroup();
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isOwner = group.myRole === "owner";
  if (group.phase !== "preferences" && group.phase !== "schedule_review")
    return null;

  const isRegenerate = !!group.scheduleGeneratedAt;

  const activeMembers = group.members.filter(
    (m) => m.status !== "pending_approval" && m.status !== "denied"
  );
  const affectedBuddyIds = new Set(Object.keys(group.affectedBuddyMembers));
  const noCombosNotUpdatedIds = new Set(
    group.membersWithNoCombos.filter((id) => {
      const m = activeMembers.find((am) => am.id === id);
      if (!m) return false;
      // No-combo member counts as not-updated if they haven't changed preferences since generation
      return !(
        m.statusChangedAt &&
        group.scheduleGeneratedAt &&
        new Date(m.statusChangedAt) > new Date(group.scheduleGeneratedAt)
      );
    })
  );
  const readyStatuses = ["preferences_set"];
  const readyCount = activeMembers.filter(
    (m) =>
      readyStatuses.includes(m.status) &&
      !affectedBuddyIds.has(m.id) &&
      !noCombosNotUpdatedIds.has(m.id)
  ).length;
  const allReady =
    readyCount === activeMembers.length && activeMembers.length > 0;

  // When schedules have already been generated, only enable if something
  // has changed that warrants regeneration.
  const hasUpdatedPrefs = activeMembers.some(
    (m) =>
      m.status === "preferences_set" &&
      m.statusChangedAt &&
      group.scheduleGeneratedAt &&
      new Date(m.statusChangedAt) > new Date(group.scheduleGeneratedAt) &&
      !(
        m.joinedAt && new Date(m.joinedAt) > new Date(group.scheduleGeneratedAt)
      )
  );
  const hasDepartedMembers = group.departedMembers.length > 0;
  const hasNoCombos = group.membersWithNoCombos.length > 0;
  const hasPurchaseChanges = !!(
    group.purchaseDataChangedAt &&
    group.scheduleGeneratedAt &&
    new Date(group.purchaseDataChangedAt) > new Date(group.scheduleGeneratedAt)
  );
  const needsRegeneration =
    !isRegenerate ||
    hasUpdatedPrefs ||
    hasDepartedMembers ||
    hasNoCombos ||
    hasPurchaseChanges;

  async function handleGenerate() {
    setLoading(true);
    setError("");
    const result = await generateSchedules(group.id);
    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      setShowModal(false);
      router.refresh();
    }
  }

  return (
    <section className="mt-8">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">
        Generate Schedules
      </h2>
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        {isRegenerate && group.scheduleGeneratedAt && (
          <p className="mb-3 text-sm text-[#d97706]">
            Schedules Last Updated On:{" "}
            {new Date(group.scheduleGeneratedAt).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        )}

        {group.phase === "preferences" && (
          <div className="mb-4 flex items-center gap-2 text-sm">
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full ${
                allReady ? "bg-emerald-100" : "bg-slate-100"
              }`}
            >
              {allReady ? (
                <svg
                  className="h-3 w-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="#059669"
                  strokeWidth={3}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4.5 12.75l6 6 9-13.5"
                  />
                </svg>
              ) : (
                <span className="h-2 w-2 rounded-full bg-slate-300" />
              )}
            </span>
            <span className={allReady ? "text-emerald-700" : "text-slate-500"}>
              Members ready: {readyCount}/{activeMembers.length} have set
              preferences
            </span>
          </div>
        )}

        <Tooltip
          className="inline-block"
          label={
            !isOwner
              ? "Only the owner can generate schedules."
              : !allReady
                ? "All members must set their preferences first."
                : !needsRegeneration
                  ? "Schedules are up to date."
                  : null
          }
        >
          <button
            onClick={() => setShowModal(true)}
            disabled={!isOwner || !allReady || !needsRegeneration}
            className="rounded-lg bg-[#009de5] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#0088c9] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isRegenerate ? "Generate New Schedules" : "Generate Schedules"}
          </button>
        </Tooltip>
      </div>

      {showModal && (
        <GenerateScheduleModal
          loading={loading}
          error={error}
          isRegenerate={isRegenerate}
          onConfirm={handleGenerate}
          onClose={() => {
            setShowModal(false);
            setError("");
          }}
        />
      )}
    </section>
  );
}
