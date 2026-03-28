"use client";

import { useState, useTransition } from "react";
import Modal from "@/components/modal";
import PasswordInput from "@/components/password-input";
import { deleteAccount } from "../actions";
import { btnDangerClass, btnSecondaryClass, inputClass } from "@/lib/constants";

export default function DeleteAccountSection() {
  const [showModal, setShowModal] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    if (!password) return;
    setError("");
    startTransition(async () => {
      const result = await deleteAccount(password);
      if (result?.error) {
        setError(result.error);
      }
    });
  }

  function handleClose() {
    if (pending) return;
    setShowModal(false);
    setPassword("");
    setError("");
  }

  return (
    <>
      <div className="rounded-2xl border border-red-200 bg-white p-4 shadow-sm sm:p-6 lg:p-8">
        <h2 className="mb-2 text-lg font-semibold text-red-600">
          Delete Account
        </h2>
        <p className="mb-5 text-sm leading-relaxed text-slate-500">
          Permanently delete your account and all associated data. This action
          cannot be undone.
        </p>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className={btnDangerClass}
        >
          Delete Account
        </button>
      </div>

      {showModal && (
        <Modal title="Delete Account" onClose={handleClose}>
          <p className="mb-2 text-[15px] font-medium text-slate-900">
            Are you sure you want to delete your account?
          </p>
          <p className="mb-4 text-sm leading-relaxed text-slate-500">
            This will permanently delete your profile, all group memberships,
            preferences, and any associated data. This action cannot be undone.
          </p>

          <div className="mb-4">
            <label
              htmlFor="delete-password"
              className="mb-1.5 block text-sm font-medium text-slate-600"
            >
              Enter your password to confirm
            </label>
            <PasswordInput
              id="delete-password"
              name="password"
              value={password}
              onChange={setPassword}
              className={inputClass}
            />
          </div>

          {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={pending}
              className={btnSecondaryClass}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!password || pending}
              className={btnDangerClass}
            >
              {pending ? "Deleting..." : "Delete Account"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
