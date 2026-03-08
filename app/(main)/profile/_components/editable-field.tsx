"use client";

import { useActionState, useState } from "react";
import { updateProfileField } from "../actions";
import { profileFieldSchemas } from "@/lib/validations";
import { inputClass, disabledInputClass } from "@/lib/constants";

export function validateField(
  field: keyof typeof profileFieldSchemas,
  value: string
): string[] {
  if (value.length === 0) return [];
  const result = profileFieldSchemas[field].safeParse(value);
  if (!result.success) {
    return result.error.issues.map((i) => i.message);
  }
  return [];
}

export default function EditableField({
  label,
  field,
  initialValue,
  validate,
}: {
  label: string;
  field: string;
  initialValue: string;
  validate?: (value: string) => string[];
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialValue);
  const [displayValue, setDisplayValue] = useState(initialValue);
  const [state, formAction, pending] = useActionState(updateProfileField, null);
  const [prevState, setPrevState] = useState(state);

  if (prevState !== state) {
    setPrevState(state);
    if (state?.success && state.updatedValue) {
      setDisplayValue(state.updatedValue);
      setEditing(false);
    }
  }

  const hints = validate ? validate(value) : [];
  const isEmpty = value.trim().length === 0;

  function handleCancel() {
    setValue(displayValue);
    setEditing(false);
  }

  if (!editing) {
    return (
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-sm font-medium text-slate-600">{label}</label>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-sm font-medium text-[#009de5] hover:text-[#0088c9]"
          >
            Update
          </button>
        </div>
        <input
          type="text"
          value={displayValue}
          disabled
          className={disabledInputClass}
        />
      </div>
    );
  }

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-600">
        {label}
      </label>
      <form action={formAction}>
        <input type="hidden" name="field" value={field} />
        <input type="hidden" name="value" value={value} />
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className={inputClass}
          autoFocus
        />
        {hints.map((hint) => (
          <p key={hint} className="mt-1 text-sm text-slate-400">
            {hint}
          </p>
        ))}
        {state?.error && (
          <p className="mt-1 text-sm text-red-500">{state.error}</p>
        )}
        <div className="mt-2 flex gap-2">
          <button
            type="submit"
            disabled={pending || hints.length > 0 || isEmpty}
            className="rounded-lg bg-[#009de5] px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-[#0088c9] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={pending}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-all hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
