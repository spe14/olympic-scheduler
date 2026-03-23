"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { joinGroup } from "../actions";
import { inviteCodeSchema } from "@/lib/validations";
import { btnSecondaryClass } from "@/lib/constants";
import Modal from "@/components/modal";

export default function JoinGroupModal({
  onClose,
  onJoined,
}: {
  onClose: () => void;
  onJoined: () => void;
}) {
  const [state, formAction, pending] = useActionState(joinGroup, null);
  const [code, setCode] = useState("");
  const [dismissed, setDismissed] = useState(false);
  const [prevState, setPrevState] = useState(state);
  const inputRef = useRef<HTMLInputElement>(null);

  if (prevState !== state) {
    setPrevState(state);
    if (state) {
      setDismissed(false);
    }
  }

  useEffect(() => {
    if (state?.success) onJoined();
  }, [state, onJoined]);

  const codeResult = inviteCodeSchema.safeParse(code);
  const hints =
    code.length > 0 && !codeResult.success
      ? codeResult.error.issues.map((i) => i.message)
      : [];

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <Modal title="Join Group" onClose={onClose}>
      <form action={formAction}>
        <label className="mb-1.5 block text-sm font-medium text-slate-600">
          Invite Code
        </label>
        <input
          ref={inputRef}
          type="text"
          name="inviteCode"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setDismissed(true);
          }}
          placeholder="Enter the invite code"
          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-[#009de5]/40 focus:outline-none focus:ring-2 focus:ring-[#009de5]/20"
        />
        {hints.map((h) => (
          <p key={h} className="mt-1.5 text-sm text-slate-400">
            {h}
          </p>
        ))}
        <p className="mt-2 text-sm text-slate-400">
          Ask a group member for their invite code to join.
        </p>
        {state?.error && !dismissed && (
          <p className="mt-1.5 text-sm text-red-500">{state.error}</p>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className={btnSecondaryClass}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={
              pending ||
              code.trim().length === 0 ||
              hints.length > 0 ||
              (!dismissed && state?.code === "already_member")
            }
            className="rounded-lg bg-[#009de5] px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-[#009de5]/20 transition-colors hover:bg-[#0088c9] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Joining..." : "Join Group"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
