"use client";

import Modal from "@/components/modal";
import { btnPrimaryClass, btnSecondaryClass } from "@/lib/constants";

export default function GenerateScheduleModal({
  loading,
  error,
  isRegenerate,
  onConfirm,
  onClose,
}: {
  loading: boolean;
  error: string;
  isRegenerate: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal title="Generate Schedules" onClose={onClose}>
      <p className="mb-2 text-[15px] font-medium text-slate-900">
        {isRegenerate
          ? "Are you sure you want to regenerate schedules?"
          : "Are you ready to generate schedules?"}
      </p>
      <p className="mb-6 text-sm leading-relaxed text-slate-500">
        {isRegenerate
          ? "This will replace all existing schedules with newly generated ones. Members will need to review their schedules again."
          : "This will generate individual schedules for all members based on their preferences. Each member will receive ranked day combos to review."}
      </p>
      {loading && (
        <p className="mb-4 text-sm text-slate-500">
          This may take up to a few minutes. Do not refresh the page while
          generation is in progress.
        </p>
      )}
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className={btnSecondaryClass}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className={btnPrimaryClass}
        >
          {loading
            ? "Generating..."
            : isRegenerate
              ? "Generate New Schedules"
              : "Generate Schedules"}
        </button>
      </div>
    </Modal>
  );
}
