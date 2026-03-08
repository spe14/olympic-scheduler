"use client";

import Modal from "@/components/modal";

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
  onConfirm,
  onClose,
}: {
  type: "leave" | "remove";
  memberName?: string;
  groupPhase: string;
  loading: boolean;
  error?: string;
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
      <p className="mb-6 text-sm leading-relaxed text-slate-500">
        {detail.replace("{name}", name)}
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
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
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
