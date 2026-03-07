"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { logout } from "@/app/(auth)/actions";
import { avatarColors, type AvatarColor } from "@/lib/constants";

type NavBarProps = {
  firstName: string;
  lastName: string;
  username: string;
  avatarColor: AvatarColor;
};

export default function NavBar({
  firstName,
  lastName,
  username,
  avatarColor,
}: NavBarProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <nav className="border-b border-slate-200 bg-white px-6 py-3">
      <div className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-yellow-500">
            <span className="text-xs font-bold text-white">28</span>
          </div>
          <span className="text- font-bold uppercase tracking-widest text-[#009de5]">
            LA 2028 Scheduler
          </span>
        </Link>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-3 rounded-lg px-2 py-1 transition-colors hover:bg-slate-50"
          >
            <span className="text-sm text-slate-600">@{username}</span>
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium"
              style={{
                backgroundColor: avatarColors[avatarColor].bg,
                color: avatarColors[avatarColor].text,
              }}
            >
              {firstName[0]}
              {lastName[0]}
            </div>
          </button>

          {isDropdownOpen && (
            <div className="absolute right-0 mt-1 w-48 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
              <div className="border-b border-slate-100 px-4 py-2">
                <p className="text-sm font-medium text-slate-900">
                  {firstName} {lastName}
                </p>
                <p className="text-xs text-slate-500">@{username}</p>
              </div>
              <Link
                href="/profile"
                className="block px-4 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50"
                onClick={() => setIsDropdownOpen(false)}
              >
                Profile
              </Link>
              <form action={logout}>
                <button
                  type="submit"
                  className="w-full px-4 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Log Out
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
