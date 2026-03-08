"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

type PasswordInputProps = {
  id: string;
  name: string;
  className: string;
  placeholder?: string;
  errors?: string[];
} & (
  | { value: string; onChange: (value: string) => void; defaultValue?: never }
  | { defaultValue?: string; value?: never; onChange?: never }
);

export default function PasswordInput({
  id,
  name,
  defaultValue,
  value,
  onChange,
  placeholder,
  className,
  errors,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          name={name}
          required
          {...(onChange
            ? {
                value,
                onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                  onChange(e.target.value),
              }
            : { defaultValue })}
          placeholder={placeholder}
          className={className}
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {errors?.map((err) => (
        <p key={err} className="mt-1 text-sm text-red-500">
          {err}
        </p>
      ))}
    </>
  );
}
