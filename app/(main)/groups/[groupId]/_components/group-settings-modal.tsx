"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/modal";
import UserAvatar from "@/components/user-avatar";
import {
  DateModeOption,
  ConsecutiveDaysInput,
  SpecificDatesInput,
  useDateValidation,
} from "@/components/date-mode-fields";
import type { GroupDetail } from "@/lib/types";
import { getDateDisplay } from "@/lib/utils";
import {
  btnPrimaryClass,
  btnSecondaryClass,
  btnDangerClass,
} from "@/lib/constants";
import { transferOwnership, updateDateConfig, deleteGroup } from "../actions";

type DateMode = "consecutive" | "specific";

export default function GroupSettingsModal({
  group,
  isOwner,
  onClose,
}: {
  group: GroupDetail;
  isOwner: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const dateDisplay = group.dateMode
    ? getDateDisplay(group)
    : "Not configured yet";

  const [showDateEdit, setShowDateEdit] = useState(false);
  const [dateMode, setDateMode] = useState<DateMode>(
    group.dateMode ?? "consecutive"
  );
  const [consecutiveDays, setConsecutiveDays] = useState(
    group.consecutiveDays?.toString() ?? ""
  );
  const [startDate, setStartDate] = useState(group.startDate ?? "");
  const [endDate, setEndDate] = useState(group.endDate ?? "");
  const [dateLoading, setDateLoading] = useState(false);
  const [dateError, setDateError] = useState("");

  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [showTransfer, setShowTransfer] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferError, setTransferError] = useState("");
  const [transferSuccess, setTransferSuccess] = useState(false);

  const transferableMembers = group.members.filter(
    (m) =>
      m.role !== "owner" &&
      m.status !== "pending_approval" &&
      m.status !== "denied"
  );

  const {
    daysHints,
    dateRangeHints,
    isValid: isDateFormValid,
  } = useDateValidation(dateMode, consecutiveDays, startDate, endDate);

  async function handleDateSubmit() {
    setDateLoading(true);
    setDateError("");
    const formData = new FormData();
    formData.set("dateMode", dateMode);
    if (dateMode === "consecutive") {
      formData.set("consecutiveDays", consecutiveDays);
    } else {
      formData.set("startDate", startDate);
      formData.set("endDate", endDate);
    }
    const result = await updateDateConfig(group.id, formData);
    setDateLoading(false);
    if (result.error) {
      setDateError(result.error);
    } else {
      setShowDateEdit(false);
      router.refresh();
    }
  }

  async function handleTransfer() {
    if (!selectedMemberId) return;
    setTransferLoading(true);
    setTransferError("");
    const result = await transferOwnership(group.id, selectedMemberId);
    setTransferLoading(false);
    if (result.error) {
      setTransferError(result.error);
    } else {
      setTransferSuccess(true);
      router.refresh();
    }
  }

  async function handleDelete() {
    setDeleteLoading(true);
    setDeleteError("");
    const result = await deleteGroup(group.id);
    setDeleteLoading(false);
    if (result.error) {
      setDeleteError(result.error);
    } else {
      router.push("/");
    }
  }

  if (showDelete) {
    return (
      <Modal
        title="Delete Group"
        onClose={() => {
          setShowDelete(false);
          setDeleteError("");
          setDeleteConfirmName("");
        }}
      >
        <p className="mb-4 text-base text-slate-600">
          This action is{" "}
          <span className="font-semibold text-red-600">permanent</span> and
          cannot be undone. All group data will be deleted.
        </p>
        <p className="mb-2 text-base text-slate-600">
          Type{" "}
          <span className="font-semibold text-slate-900">{group.name}</span> to
          confirm.
        </p>
        <input
          type="text"
          value={deleteConfirmName}
          onChange={(e) => setDeleteConfirmName(e.target.value)}
          placeholder={group.name}
          className="mb-4 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-base text-slate-900 placeholder:text-slate-300 focus:border-red-300 focus:outline-none focus:ring-1 focus:ring-red-300"
        />

        {deleteError && (
          <p className="mb-4 text-base text-red-600">{deleteError}</p>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              setShowDelete(false);
              setDeleteError("");
              setDeleteConfirmName("");
            }}
            disabled={deleteLoading}
            className={btnSecondaryClass}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteConfirmName !== group.name || deleteLoading}
            className={btnDangerClass}
          >
            {deleteLoading ? "Deleting..." : "Delete"}
          </button>
        </div>
      </Modal>
    );
  }

  if (transferSuccess) {
    const newOwner = transferableMembers.find((m) => m.id === selectedMemberId);
    return (
      <Modal title="Ownership Transferred" onClose={onClose}>
        <p className="mb-6 text-sm leading-relaxed text-slate-600">
          {newOwner
            ? `${newOwner.firstName} ${newOwner.lastName} is now the group owner.`
            : "Ownership has been transferred."}{" "}
          You are now a regular member.
        </p>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[#009de5] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0088c9]"
          >
            OK
          </button>
        </div>
      </Modal>
    );
  }

  if (showTransfer) {
    return (
      <Modal title="Transfer Ownership" onClose={() => setShowTransfer(false)}>
        <p className="mb-4 text-sm text-slate-500">
          Select the member who will become the new group owner. You will become
          a regular member.
        </p>

        {transferableMembers.length === 0 ? (
          <p className="mb-6 text-sm text-amber-600">
            There are no eligible members to transfer ownership to. Approve a
            pending member first.
          </p>
        ) : (
          <div className="mb-6 space-y-1">
            {transferableMembers.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setSelectedMemberId(m.id);
                  setTransferError("");
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                  selectedMemberId === m.id
                    ? "bg-[#009de5]/10 ring-1 ring-[#009de5]"
                    : "hover:bg-slate-50"
                }`}
              >
                <UserAvatar
                  firstName={m.firstName}
                  lastName={m.lastName}
                  avatarColor={m.avatarColor ?? "blue"}
                />
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {m.firstName} {m.lastName}
                  </p>
                  <p className="text-xs text-slate-400">@{m.username}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {transferError && (
          <p className="mb-4 text-sm text-red-600">{transferError}</p>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setShowTransfer(false)}
            disabled={transferLoading}
            className={btnSecondaryClass}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleTransfer}
            disabled={
              !selectedMemberId ||
              transferLoading ||
              transferableMembers.length === 0
            }
            className={btnPrimaryClass}
          >
            {transferLoading ? "Transferring..." : "Confirm Transfer"}
          </button>
        </div>
      </Modal>
    );
  }

  if (showDateEdit) {
    return (
      <Modal
        title="Date Configuration"
        onClose={() => {
          setShowDateEdit(false);
          setDateError("");
        }}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <DateModeOption
              selected={dateMode === "consecutive"}
              onClick={() => setDateMode("consecutive")}
              label="Consecutive Days"
              description="The algorithm will find the best N-day window for your group."
            />
            <DateModeOption
              selected={dateMode === "specific"}
              onClick={() => setDateMode("specific")}
              label="Specific Dates"
              description="Your group has already chosen specific dates to attend."
            />
          </div>

          {dateMode === "consecutive" && (
            <ConsecutiveDaysInput
              value={consecutiveDays}
              onChange={setConsecutiveDays}
              hints={daysHints}
            />
          )}

          {dateMode === "specific" && (
            <SpecificDatesInput
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
              hints={dateRangeHints}
            />
          )}

          {dateError && <p className="text-sm text-red-600">{dateError}</p>}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setShowDateEdit(false);
                setDateError("");
              }}
              disabled={dateLoading}
              className={btnSecondaryClass}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDateSubmit}
              disabled={!isDateFormValid || dateLoading}
              className={btnPrimaryClass}
            >
              {dateLoading ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Group Settings" onClose={onClose}>
      <div className="space-y-6">
        {/* Date Configuration */}
        <div>
          <h3 className="mb-3 text-sm font-semibold text-slate-600">
            Date Configuration
          </h3>
          <div className="rounded-lg border border-slate-200 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900">
                  Attendance Dates
                </p>
                <p className="mt-0.5 font-medium text-slate-900">
                  {dateDisplay}
                </p>
              </div>
              {isOwner && (
                <button
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                  onClick={() => setShowDateEdit(true)}
                >
                  {group.dateMode ? "Edit" : "Configure"}
                </button>
              )}
            </div>
            {group.dateMode ? (
              <p className="mt-2 text-sm text-slate-500">
                You can update this at any time.
              </p>
            ) : (
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
            <h3 className="mb-3 text-sm font-semibold text-slate-600">
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
              <span className="group/transfer relative">
                <button
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={transferableMembers.length === 0}
                  onClick={() => setShowTransfer(true)}
                >
                  Transfer
                </button>
                {transferableMembers.length === 0 && (
                  <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover/transfer:opacity-100">
                    There are no members available to transfer ownership to.
                  </span>
                )}
              </span>
            </div>
          </div>
        )}

        {/* Danger Zone */}
        {isOwner && (
          <div>
            <h3 className="mb-3 text-sm font-semibold text-red-600">
              Danger Zone
            </h3>
            <div className="flex items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50/50 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-red-600">Delete Group</p>
                <p className="text-sm text-slate-500">
                  Permanently delete this group and all associated data.
                </p>
              </div>
              <button
                className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-100"
                onClick={() => setShowDelete(true)}
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
