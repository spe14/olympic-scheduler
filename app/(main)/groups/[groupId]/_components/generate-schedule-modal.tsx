"use client";

import Modal from "@/components/modal";

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
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className="rounded-lg bg-[#009de5] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0088c9] disabled:opacity-50"
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
