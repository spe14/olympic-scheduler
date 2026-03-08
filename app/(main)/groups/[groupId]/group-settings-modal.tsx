"use client";

import Modal from "@/components/modal";
import type { GroupDetail } from "@/lib/types";

export default function GroupSettingsModal({
  group,
  isOwner,
  onClose,
}: {
  group: GroupDetail;
  isOwner: boolean;
  onClose: () => void;
}) {
  let dateDisplay: string;
  if (group.dateMode === "consecutive" && group.consecutiveDays) {
    dateDisplay = `${group.consecutiveDays} consecutive days`;
  } else if (
    group.dateMode === "specific" &&
    group.startDate &&
    group.endDate
  ) {
    const fmt = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const start = new Date(group.startDate + "T00:00:00");
    const end = new Date(group.endDate + "T00:00:00");
    dateDisplay = `${fmt.format(start)} - ${fmt.format(end)}`;
  } else {
    dateDisplay = "Not configured yet";
  }

  return (
    <Modal title="Group Settings" onClose={onClose}>
      <div className="space-y-6">
        {/* Date Configuration */}
        <div>
          <h3 className="mb-3 text-sm font-semibold text-slate-700">
            Date Configuration
          </h3>
          <div className="rounded-lg border border-slate-200 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Attendance Dates</p>
                <p className="mt-0.5 font-medium text-slate-900">
                  {dateDisplay}
                </p>
              </div>
              {isOwner && (
                <button
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                  onClick={() => {
                    // TODO: open date config edit form
                  }}
                >
                  {group.dateMode ? "Edit" : "Configure"}
                </button>
              )}
            </div>
            {!group.dateMode && (
              <p className="mt-2 text-sm text-amber-600">
                Date configuration must be set before schedules can be
                generated.
              </p>
            )}
          </div>
        </div>

        {/* Transfer Ownership */}
        {isOwner && (
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-700">
              Ownership
            </h3>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-900">
                  Transfer Ownership
                </p>
                <p className="text-sm text-slate-500">
                  Transfer group ownership to another member.
                </p>
              </div>
              <button
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                onClick={() => {
                  // TODO: open transfer ownership flow
                }}
              >
                Transfer
              </button>
            </div>
          </div>
        )}

        {/* Danger Zone */}
        {isOwner && (
          <div>
            <h3 className="mb-3 text-sm font-semibold text-red-600">
              Danger Zone
            </h3>
            <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50/50 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-red-600">Delete Group</p>
                <p className="text-sm text-slate-500">
                  Permanently delete this group and all associated data.
                </p>
              </div>
              <button
                className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-100"
                onClick={() => {
                  // TODO: open delete confirmation
                }}
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
