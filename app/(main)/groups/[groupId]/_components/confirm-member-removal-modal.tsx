"use client";

import Modal from "@/components/modal";
import {
  btnPrimaryClass,
  btnSecondaryClass,
  btnDangerClass,
} from "@/lib/constants";

const warningMessages = {
  leave: {
    preferences: {
      heading: "Are you sure you want to leave this group?",
      detail:
        "Your preferences will be deleted. Members who selected you as a buddy will need to review their preferences.",
    },
    post: {
      heading: "Are you sure you want to leave this group?",
      detail:
        "Leaving will delete all generated schedules. Members who selected you as a buddy will need to review their preferences and new schedules will need to be generated.",
    },
  },
  remove: {
    preferences: {
      heading: "Are you sure you want to remove {name}?",
      detail:
        "Their preferences will be deleted. Members who selected them as a buddy will need to review their preferences.",
    },
    post: {
      heading: "Are you sure you want to remove {name}?",
      detail:
        "Removing them will delete all generated schedules. Members who selected them as a buddy will need to review their preferences and new schedules will need to be generated.",
    },
  },
};

export default function ConfirmMemberRemovalModal({
  type,
  memberName,
  groupPhase,
  loading,
  error,
  hasPurchaseData,
  onConfirm,
  onClose,
}: {
  type: "leave" | "remove";
  memberName?: string;
  groupPhase: string;
  loading: boolean;
  error?: string;
  hasPurchaseData?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const phaseKey = groupPhase === "preferences" ? "preferences" : "post";
  const name = memberName ?? "this member";
  const { heading, detail } = warningMessages[type][phaseKey];

  const title = type === "leave" ? "Leave Group" : "Remove Member";

  return (
    <Modal title={title} onClose={onClose}>
      <p className="mb-2 text-[15px] font-medium text-slate-900">
        {heading.replace("{name}", name)}
      </p>
      <p className="mb-4 text-sm leading-relaxed text-slate-500">
        {detail.replace("{name}", name)}
      </p>
      {hasPurchaseData && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600">
          <p className="font-medium">
            {type === "leave" ? "You have" : `${name} has`} ticket purchase
            records. This action will:
          </p>
          <ul className="mt-1 list-disc pl-5 text-xs leading-relaxed">
            <li>
              Delete all purchases {type === "leave" ? "you" : "they"} recorded
              (including tickets bought for other members)
            </li>
            <li>
              Remove {type === "leave" ? "your" : "their"} ticket assignments
              from purchases made by other members
            </li>
          </ul>
          <p className="mt-1.5 text-sm font-medium">
            This action cannot be undone.
          </p>
        </div>
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
          className={btnDangerClass}
        >
          {loading
            ? type === "leave"
              ? "Leaving..."
              : "Removing..."
            : type === "leave"
              ? "Leave Group"
              : "Remove Member"}
        </button>
      </div>
    </Modal>
  );
}

export function OwnerLeaveModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Leave Group" onClose={onClose}>
      <p className="mb-6 text-sm leading-relaxed text-slate-600">
        You must transfer ownership before leaving. Go to Group Settings to
        transfer ownership.
      </p>
      <div className="flex justify-end">
        <button type="button" onClick={onClose} className={btnPrimaryClass}>
          OK
        </button>
      </div>
    </Modal>
  );
}
